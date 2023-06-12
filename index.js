const EventEmitter = require('events').EventEmitter
const electron = require('electron-eval')

module.exports = function (opts) {
  const daemon = electron(opts)
  const wrtc = new EventEmitter()

  return Object.assign(wrtc, {
    close: daemon.close.bind(daemon),
    electronDaemon: daemon,
    RTCPeerConnection: require('./src/RTCPeerConnection.js')(daemon, wrtc),
    RTCSessionDescription: require('./src/RTCSessionDescription.js'),
    RTCIceCandidate: require('./src/RTCIceCandidate.js'),
    RTCDataChannel: require('./src/RTCDataChannel.js')
  })
}
