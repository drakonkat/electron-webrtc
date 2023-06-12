const EventEmitter = require('events').EventEmitter
const getBrowserRTC = require('get-browser-rtc')

module.exports = function (opts) {
  const wrtc = new EventEmitter()
  // If electron-webrtc is required in the browser, return the browser RTC implementation.
  return Object.assign(wrtc, getBrowserRTC(), {
    close: function () {},
    electronDaemon: wrtc
  })
}
