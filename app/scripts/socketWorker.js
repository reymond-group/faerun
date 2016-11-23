importScripts('/libs/socketio/socket.io-1.4.5.js');
var socket = socket = io.connect('http://localhost:8080/underdark');

socket.on('initresponse', function(msg) {
    postMessage({ cmd: 'initresponse', message: msg.data });
});

socket.on('loadresponse', function(msg) { 
    var arr = toArray(msg.data);
    for(var i = 0; i < arr.length; i++) arr[i] = arr[i].buffer;
    postMessage({ cmd: 'loadresponse', message: { data: arr, data_types: msg.data_types, maps: msg.maps } });
});

socket.on('loadmapresponse', function(msg) { 
    var arr = toArray(msg.data);
    for(var i = 0; i < arr.length; i++) arr[i] = arr[i].buffer;
    postMessage({ cmd: 'loadmapresponse', message: { data: arr, data_types: msg.data_types } });
});

onmessage = function(e) {
    var cmd = e.data.cmd;
    var message = e.data.message;
    
    socket.emit(cmd, message);
}

function toArray(str) {
    var lines = str.split('\n');
    var arrays = [];

    var nValues = lines[0].split(',').length;
    for(var i = 0; i < nValues; i++) {
        arrays.push(new Uint16Array(lines.length));
    }

    for(var i = 0; i < lines.length; i++) {
        var values = lines[i].split(',');
        for(var j = 0; j < values.length; j++) {
            arrays[j][i] = parseInt(values[j]);
        }
    }

    return arrays;
}