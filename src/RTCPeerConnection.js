'use strict'

const hat = require('hat')
const debug = require('debug')('RTCPC')

module.exports = function (daemon, wrtc) {
  const RTCDataChannel = require('./RTCDataChannel.js')(daemon, wrtc)

  let i = 0
  daemon.eval('window.conns = {}', (err) => {
    if (err) wrtc.emit('error', err)
  })

  return class RTCPeerConnection {
    constructor (opts) {
      if (daemon.closing) {
        throw new Error('Cannot create RTCPeerConnection, the electron-webrtc daemon has been closed')
      }
      this._id = (i++).toString(36)
      this._dataChannels = new Map()
      this._offer = null
      this._answer = null
      this.iceConnectionState = 'new'
      this.iceGatheringState = 'new'
      this.localDescription = null
      this.peerIdentity = { catch: () => {} } // TODO: update this
      this.remoteDescription = null
      this.signalingState = 'stable'
      daemon.on(`pc:${this._id}`, this.onMessage.bind(this))
      daemon.eval(`
        (function () {
          var pc = conns[${JSON.stringify(this._id)}] = new webkitRTCPeerConnection(${JSON.stringify(opts)})
          pc.dataChannels = {}
          var id = 'pc:' + ${JSON.stringify(this._id)}
          pc.onaddstream = function (e) {
            // TODO: send MediaStream info
            send(id, { type: 'addstream' })
          }
          pc.ondatachannel = function (e) {
            pc.dataChannels[e.channel.id] = e.channel
            var channel = {}
            for (var key in e.channel) {
              if (typeof e.channel[key] === 'function' || e.channel[key] == null) continue
              channel[key] = e.channel[key]
            }
            // Queues messages that have been recieved before the message listener has been added
            e.channel.msgQueue = []
            e.channel.onmessage = function (eMsg) {
              e.channel.msgQueue.push(eMsg)
            }
            send(id, {
              type: 'datachannel',
              channel: channel
            })
          }
          pc.onicecandidate = function (e) {
            var event = {}
            if (e.candidate) {
              event.candidate = {
                candidate: e.candidate.candidate,
                sdpMid: e.candidate.sdpMid,
                sdpMLineIndex: e.candidate.sdpMLineIndex
              }
            }
            var offer, answer
            function sendEvent () {
              send(id, {
                type: 'icecandidate',
                event: event,
                iceGatheringState: pc.iceGatheringState,
                offer: offer ? offer.toJSON() : null
              })
            }
            pc.createOffer(function (o) {
              offer = o
              sendEvent()
            }, function () {
              offer = false
              sendEvent()
            })
          }
          pc.oniceconnectionstatechange = function (e) {
            send(id, { type: 'iceconnectionstatechange', iceConnectionState: pc.iceConnectionState })
          }
          pc.onidentityresult = function (e) {
            send(id, { type: 'identityresult', event: {
              assertion: e.assertion
            }})
          }
          pc.onidpassertionerror = function (e) {
            send(id, {
              type: 'idpassertionerror',
              event: {
                idp: e.idp,
                loginUrl: e.loginUrl,
                protocol: e.protocol,
              }
            })
          }
          pc.onidpvalidationerror = function (e) {
            send(id, {
              type: 'idpvalidationerror',
              event: {
                idp: e.idp,
                loginUrl: e.loginUrl,
                protocol: e.protocol,
              }
            })
          }
          pc.onnegotiationneeded = function (e) {
            send(id, { type: 'negotiationneeded' })
          }
          pc.onremovestream = function (e) {
            send(id, {
              type: 'removestream',
              event: { id: e.stream.id }
            })
          }
          pc.onsignalingstatechange = function (e) {
            send(id, {
              type: 'signalingstatechange',
              signalingState: pc.signalingState
            })
          }
        })()
      `, (err) => {
        if (err) wrtc.emit('error', err, this)
      })
    }

    onMessage (message) {
      const handler = this['on' + message.type]
      const event = message.event || {}

      debug(this._id + '<<', message.type, message, !!handler)

      // TODO: create classes for different event types?

      switch (message.type) {
        case 'addstream':
          // TODO: create MediaStream wrapper
          // TODO: index MediaStream by id
          // TODO: create event
          break

        case 'datachannel':
          message.channel._pcId = this._id
          event.channel = new RTCDataChannel(message.channel)
          this._dataChannels.set(event.channel.id, event.channel)
          break

        case 'icecandidate':
          this.iceGatheringState = message.iceGatheringState
          if (message.offer) {
            this._offer = Object.assign(this._offer || {}, message.offer)
          }
          break

        case 'iceconnectionstatechange':
          this.iceConnectionState = message.iceConnectionState
          break

        case 'removestream':
          // TODO: fetch MediaStream by id
          // TODO: create event
          break

        case 'signalingstatechange':
          this.signalingState = message.signalingState
          break
      }

      if (handler) handler(event)
    }

    createDataChannel (label, options) {
      const dc = new RTCDataChannel(this._id, label, options)
      dc.once('init', () => this._dataChannels.set(dc.id, dc))
      return dc
    }

    async createOffer (options) {
      return await new Promise((resolve, reject) => {
        if (this._offer) {
          return resolve(this._offer)
        }
        return this._callRemote(
          'createOffer',
          `onSuccess, onFailure, ${JSON.stringify(options)}`,
          (offer) => {
            this._offer = offer
            resolve(offer)
          }, (e) => {
            reject(e)
          }
        )
      })
    }

    async createAnswer (options) {
      return new Promise((resolve, reject) => {
        if (this._answer) {
          return resolve(this._answer)
        }
        return this._callRemote(
          'createAnswer',
          `onSuccess, onFailure, ${JSON.stringify(options)}`,
          (offer) => {
            this._answer = offer
            resolve(offer)
          }, (e) => {
            reject(e)
          }
        )
      })
    }

    async setLocalDescription (desc, cb, errCb) {
      await new Promise((resolve, reject) => {
        this.localDescription = desc
        this._callRemote(
          'setLocalDescription',
          `new RTCSessionDescription(${JSON.stringify(desc)}), onSuccess, onFailure`,
          (o) => resolve(o), (e) => reject(e))
      })
    }

    async setRemoteDescription (desc) {
      await new Promise((resolve, reject) => {
        this._callRemote(
          'setRemoteDescription',
          `new RTCSessionDescription(${JSON.stringify(desc)}), onSuccess, onFailure`,
          (o) => {
            this.remoteDescription = desc;
            resolve(o);
          }, (e) => reject(e))
      })
    }

    async addIceCandidate (candidate) {
      await new Promise((resolve, reject) => {
        this._callRemote(
          'addIceCandidate',
          `new RTCIceCandidate(${JSON.stringify(candidate)}), onSuccess, onFailure`,
          (o) => resolve(o), (e) => reject(e))
      })
    }

    close () {
      this._eval(`
        if (pc.signalingState !== 'closed') pc.close()
      `)
    }

    getStats (cb) {
      this._callRemote('getStats', `
        function (res) {
          res = res.result()
          var output = res.map(function (res) {
            var item = {
              id: res.id,
              timestamp: res.timestamp,
              type: res.type,
              stats: {}
            }
            res.names().forEach(function (name) {
              item.stats[name] = res.stat(name)
            })
            return item
          })
          onSuccess(output)
        }
      `, (res) => {
        for (const item of res) {
          const stats = item.stats
          delete item.stats
          item.names = () => Object.keys(stats)
          item.stat = (name) => stats[name]
        }
        cb({ result: () => res })
      })
    }

    _eval (code, cb, errCb) {
      let _resolve
      let _reject
      const promise = new Promise((resolve, reject) => {
        _resolve = resolve
        _reject = reject
      })
      const reqId = hat()
      daemon.once(reqId, (res) => {
        if (res.err && errCb) {
          errCb(res.err)
          _reject(res.err)
        } else if (!res.err && cb) {
          cb(res.res)
          _resolve(res.res)
        }
      })
      daemon.eval(`
        (function () {
          var id = ${JSON.stringify(this._id)}
          var reqId = ${JSON.stringify(reqId)}
          var pc = conns[id]
          var onSuccess = function (res) {
            send(reqId, { res: res && res.toJSON ? res.toJSON() : res })
          }
          var onFailure = function (err) {
            send(reqId, { err: err })
          }
          ${code}
        })()
      `, (err) => {
        if (err) wrtc.emit('error', err, this)
      })
      return promise
    }

    _callRemote (name, args, cb, errCb) {
      return this._eval(`pc.${name}(${args || ''})`, cb, errCb)
    }
  }
}
