importScripts('/libs/socketio/socket.io-1.4.5.js');
importScripts('/scripts/faerun-common.js');

var socket = io.connect('http://localhost:8080/underdark');

socket.on('initresponse', function (msg) {
  postMessage({
    cmd: 'initresponse',
    message: 'ready'
  });
});

socket.on('loaddetailsresponse', function (msg) {
  postMessage({
    cmd: 'loaddetailsresponse',
    message: {
      data: msg
    }
  });
});

onmessage = function (e) {
  var cmd = e.data.cmd;
  var message = e.data.message;

  socket.emit(cmd, message);
};
