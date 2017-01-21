importScripts('../libs/socketio/socket.io-1.4.5.js');
importScripts('../scripts/faerun-common.js');

// var socket = socket = io.connect('http://130.92.75.77:8080/underdark');
// var socket = socket = io.connect('http://192.168.1.3:8080/underdark');
// var socket = socket = io.connect('http://46.101.234.147:8080/underdark');

var ws = new WebSocket('ws://localhost:8080/underdark');
var config = null;

ws.onopen = function(e) {
  postMessage({
    cmd: 'connection:open',
    msg: ''
  });

  // Initialize as soon as connection is established
  ws.send(JSON.stringify({
    cmd: 'init',
    msg: []
  }));
};

ws.onclose = function(e) {
  postMessage({
    cmd: 'connection:closed',
    msg: ''
  });
};

ws.onerror = function(e) {
  postMessage({
    cmd: 'connection:error',
    msg: ''
  });
};

ws.onmessage = function(e) {
  var data = JSON.parse(e.data);

  if (data.cmd === 'init')
    onInit(data);
  else if (data.cmd === 'load:variant')
    onLoadVariant(data);
  else if (data.cmd === 'load:map')
    onLoadMap(data);
  else if (data.cmd === 'load:binpreview')
    onLoadBinPreview(data);
  else if (data.cmd === 'load:bin')
    onLoadBin(data);
};

onmessage = function (e) {
  var cmd = e.data.cmd;
  var message = e.data.msg;

  if (cmd === 'load:variant') {
    // response.msg.databases[0].fingerprints[0].variants[0].id
    ws.send(JSON.stringify({
      cmd: 'load:variant',
      msg: [
        message.variantId
      ]
    }));
  }

  if (cmd === 'load:map') {
    // response.msg.databases[0].fingerprints[0].variants[0].maps[0].id
    ws.send(JSON.stringify({
      cmd: 'load:map',
      msg: [
        message.mapId
      ]
    }));
  }

  if (cmd === 'load:binpreview') {
    // response.msg.databases[0].id,
    // response.msg.databases[0].fingerprints[0].variants[0].id,
    // '654321'
    ws.send(JSON.stringify({
      cmd: 'load:binpreview',
      msg: [
        message.databaseId,
        message.variantId,
        message.binIndex.toString()
      ]
    }));
  }

  if (cmd === 'load:bin') {
    // response.msg.databases[0].id,
    // response.msg.databases[0].fingerprints[0].id,
    // response.msg.databases[0].fingerprints[0].variants[0].id,
    // '654321'
    ws.send(JSON.stringify({
      cmd: 'load:bin',
      msg: [
        message.databaseId,
        message.fingerprintId,
        message.variantId,
        message.binIndex.toString()
      ]
    }));
  }
};

function onInit(data) {
  config = data.msg;
  postMessage(data);
}

function onLoadVariant(data) {
  var variant = getConfigItemById(data.id);

  var arr = Faerun.csvToArray(data.msg, variant.dataTypes);
  for (var i = 0; i < arr.length; i++) arr[i] = arr[i].buffer;

  postMessage({
    cmd: data.cmd,
    msg: {
      data: arr,
      dataTypes: variant.dataTypes
    }
  });
}

function onLoadMap(data) {
  var map = getConfigItemById(data.id);

  var arr = Faerun.csvToArray(data.msg, map.dataTypes);
  for (var i = 0; i < arr.length; i++) arr[i] = arr[i].buffer;

  postMessage({
    cmd: data.cmd,
    msg: {
      data: arr,
      dataTypes: map.dataTypes
    }
  });
}

function onLoadBinPreview(data) {
  postMessage({
    cmd: data.cmd,
    msg: {
      smiles: data.smiles,
      index: parseInt(data.index, 10),
      binSize: parseInt(data.binSize, 10)
    }
  });
}

function onLoadBin(data) {
  postMessage(data);
}

function getConfigItemById(id) {
  for (var i = 0; i < config.databases.length; i++) {
    var database = config.databases[i];
    if (id === database.id) return database;

    for (var j = 0; j < database.fingerprints.length; j++) {
      var fingerprint = database.fingerprints[j];
      if (id === fingerprint.id === id) return fingerprint;

      for (var k = 0; k < fingerprint.variants.length; k++) {
        var variant = fingerprint.variants[k];
        if (id === variant.id) return variant;

        for (var l = 0; l < variant.maps.length; l++) {
          var map = variant.maps[l];
          if (id === map.id) return map;
        }
      }
    }
  }
}
