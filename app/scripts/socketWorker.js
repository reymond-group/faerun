importScripts('../libs/socketio/socket.io-1.4.5.js');
importScripts('../scripts/common.js');
importScripts('../config.js');

// var socket = socket = io.connect('http://130.92.75.77:8080/underdark');
// var socket = socket = io.connect('http://192.168.1.3:8080/underdark');
// var socket = socket = io.connect('http://46.101.234.147:8080/underdark');

var ws;
var config = null;
var initialized = false;

function connectSocket(callback) {
    ws = new WebSocket(FaerunConfig.server.url) 
    
    ws.onopen = function (e) {
        if (!initialized) {
            postMessage({
                cmd: 'connection:open',
                msg: ''
            });

            // Initialize as soon as connection is established
            ws.send(JSON.stringify({
                cmd: 'init',
                msg: []
            }));

            initialized = true;
        } else {
            postMessage({
                cmd: 'connection:reopened',
                msg: ''
            }); 
        }

        if (callback) {
            callback();
        }
    };

    ws.onclose = function (e) {
        postMessage({
            cmd: 'connection:closed',
            msg: ''
        });
    };

    ws.onerror = function (e) {
        postMessage({
            cmd: 'connection:error',
            msg: ''
        });
    };

    ws.onmessage = function (e) {
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
        else if (data.cmd === 'search:infos')
            onSearchInfos(data);
        else if (data.cmd === 'load:stats')
            onStatsLoaded(data);
    };
}

function socketComm(cmd, message) {
    if (ws.readyState === 1) {
        if (cmd === 'load:variant') {
            // response.msg.databases[0].fingerprints[0].variants[0].id
            ws.send(JSON.stringify({
                cmd: 'load:variant',
                msg: [
                    message.variantId
                ]
            }));
        }

        if (cmd === 'load:stats') {
            // response.msg.databases[0].fingerprints[0].variants[0].id
            ws.send(JSON.stringify({
                cmd: 'load:stats',
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
                    message.fingerprintId,
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

        if (cmd === 'search:infos') {
            msg = [
                message.fingerprintId,
                message.variantId
            ];

            msg.append

            ws.send(JSON.stringify({
                cmd: 'search:infos',
                msg: msg.concat(message.searchTerms)
            }));
        }
    } else {
        setTimeout(function () {
            socketComm(cmd, message);
        }, 1000);
    }
}

connectSocket();

onmessage = function (e) {
    var cmd = e.data.cmd;
    var message = e.data.msg;

    // If the connection has been closed (due to timeout) -> reopen
    if (ws.readyState === 3) {
        connectSocket(function() { socketComm(cmd, message); });
    } else {
        socketComm(cmd, message);
    }
};

function onInit(data) {
    config = data.msg;
    postMessage(data);
}

function onLoadVariant(data) {
    var variant = Faerun.getConfigItemById(config, data.id);

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
    var map = Faerun.getConfigItemById(config, data.id);
    var arr = Faerun.csvToArray(data.msg, map.dataTypes);
    
    for (var i = 0; i < arr.length; i++) {
        arr[i] = arr[i].buffer;
    }

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
    postMessage({
        cmd: data.cmd,
        msg: {
            smiles: data.smiles,
            ids: data.ids,
            fps: data.fps,
            coordinates: data.coordinates,
            index: parseInt(data.index, 10),
            binSize: parseInt(data.binSize, 10)
        }
    });
}

function onSearchInfos(data) {
    postMessage({
        cmd: data.cmd,
        msg: {
            binIndices: data.binIndices,
            searchTerms: data.searchTerms
        }
    });
}

function onStatsLoaded(data) {
    postMessage({
        cmd: data.cmd,
        msg: {
            compoundCount: data.msg.compoundCount,
            binCount: data.msg.binCount,
            avgCompoundCount: data.msg.avgCompoundCount,
            binHist: data.msg.binHist,
            histMin: data.msg.histMin,
            histMax: data.msg.histMax
        }
    });
}
