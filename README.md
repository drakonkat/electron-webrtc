# electron-webrtc-webtorrent

[![npm version](https://img.shields.io/npm/v/electron-webrtc.svg)](https://www.npmjs.com/package/electron-webrtc)
## Status - unstable 

### FORKED from the original to update the RTCPeerConnections and make it work with webtorrent 

#### TODO LIST
- Upgrade electron and update all the method relative to WRTC
- Improve stability
- Test on linux, windows and mac

Use WebRTC in Node.js via a hidden Electron process

WebRTC is a powerful web API that lets browsers make peer-to-peer connections, and has already been
deployed in [many popular browsers](http://caniuse.com/#feat=rtcpeerconnection). It may sometimes be
useful to let Node.js programs use WebRTC, e.g. in [`webtorrent-hybrid`](https://github.com/feross/webtorrent-hybrid). However, the modules for WebRTC in Node ([`node-webrtc`](https://github.com/js-platform/node-webrtc) and [`node-rtc-peer-connection`](https://github.com/nickdesaulniers/node-rtc-peer-connection)) are either hard to install, broken, or incomplete.

## Status

This module is compatible with [`simple-peer`](https://github.com/feross/simple-peer) and passes its tests.

`electron-webrtc` is intended for use with RTCDataChannels, so the MediaStream API is not supported.

## Usage

`npm i electron-webrtc-webtorrent`

```js
// call exported function to create Electron process
wrtc = require('electron-webrtc-webtorrent')({electron: path.resolve(path.join(__dirname, "../node_modules/electron-webrtc-webtorrent/node_modules/electron/dist/electron.exe"))});
global.WRTC = wrtc
```

### Methods

#### `var wrtc = require('electron-webrtc')([opts])`

Calling the function exported by this module will create a new hidden Electron process. It is recommended to only create one, since Electron uses a lot of resources.

An optional `opts` object may contain specific options (including headless mode). See [`electron-eval`](https://github.com/mappum/electron-eval#var-daemon--electronevalopts)

The object returned by this function has the same API as the [`node-webrtc`](https://github.com/js-platform/node-webrtc) package.

Any errors that occur when communicating with the Electron daemon will be emitted by the `wrtc` object (`wrtc.on('error', ...)`).

#### `wrtc.close()`

Closes the Electron process and releases its resources. You may not need to do this since the Electron process will close automatically after the Node process terminates.

### Properties

#### `wrtc.electronDaemon`

A handle to the [`electron-eval`](https://github.com/mappum/electron-eval) daemon that this module uses to talk to the Electron process.

### Events

#### - `error`
Emitted by `RTCPeerConnection` or `RTCDataChannel` when `daemon.eval()` evaluates code that throws an internal error.

### Running on a headless server

Chromium normally won't run on a headless server since it expects a screen that it can render to. So to work around this, we can use `Xvfb`, a utility that creates a framebuffer that Chromium can use as a virtual screen.

First, install `Xvfb`:
```sh
apt-get install xvfb # Ubuntu/Debian
yum install xorg-x11-server-Xvfb # CentOS
```

Create the `HEADLESS` env variable:
```sh
export HEADLESS=true
```

Or if you want to do it programmatically, initialize a new instance and pass in `headless` as a key as demonstrated:
```js
var wrtc = require('electron-webrtc')({ headless: true })
```

Now you may run your WebRTC code with `electron-webrtc-webtorrent` :)

## Related Modules

- [`node-webrtc`](https://github.com/js-platform/node-webrtc)
- [`node-rtc-peer-connection`](https://github.com/nickdesaulniers/node-rtc-peer-connection)
- [`electron-eval`](https://github.com/mappum/electron-eval)
- [`electron-webrtc`](https://github.com/mappum/electron-webrtc)
