(function() {
    // Globals
    var socket = null;
    var lore = null;
    var smilesDrawer = null;
    var pointHelper = null;
    var octreeHelper = null;
    var availableSets = null;
    var availableMaps = null;
    var currentSet = null;
    var currentMap = null;
    var socketWorker = new Worker('scripts/socketWorkerIndex.js');
    var loader = document.getElementById('loader');

    // Events
    var switchFullscreen = document.getElementById('switch-fullscreen');
    switchFullscreen.addEventListener('change', function() {
        if(switchFullscreen.checked) {
            launchIntoFullscreen(document.documentElement);
        }
        else {
            exitFullscreen();
        }
    }, false);

    var labelSwitchColor = document.getElementById('label-switch-color');
    var switchColor = document.getElementById('switch-color');
    switchColor.addEventListener('change', function() {
        if(switchColor.checked) {
            labelSwitchColor.innerHTML = 'Light Background';
            lore.setClearColor(Lore.Color.fromHex('#DADFE1'));
        }
        else {
            labelSwitchColor.innerHTML = 'Dark Background';
            lore.setClearColor(Lore.Color.fromHex('#212121'));
        }
    }, false);

    var selectSet = document.getElementById('select-set');

    selectSet.addEventListener('change', function() {
        currentSet = availableSets[selectSet.value];
        socketWorker.postMessage({ cmd: 'load', message: selectSet.value });
        selectSet.parentElement.style.pointerEvents = 'none';
        show(loader);
    }, false);

    var selectColorMap = document.getElementById('select-color-map');

    selectColorMap.addEventListener('change', function() {
        currentMap = availableMaps[selectColorMap.value];
        socketWorker.postMessage({ cmd: 'loadmap', message: JSON.stringify({ set_id: currentSet.id, map_id: currentMap.id })});
        selectColorMap.parentElement.style.pointerEvents = 'none';
        show(loader);
    }, false);

    // UI - data
    function populateServerSets() {
        removeChildren(selectSet);
        appendEmptyOption(selectSet);
        for(key in availableSets)
            appendOption(selectSet, key, availableSets[key].name);
    }

    function populateColorMaps() {
        removeChildren(selectColorMap);
        appendEmptyOption(selectColorMap);
        for(key in availableMaps)
            appendOption(selectColorMap, key, availableMaps[key].name);
    }

    // Socket.IO communication
    document.addEventListener("DOMContentLoaded", function(event) {
        lore = Lore.init('lore', { clearColor: '#212121' });
        smilesDrawer = new SmilesDrawer();

        socketWorker.onmessage = function(e){
            var cmd = e.data.cmd;
            var message = e.data.message;
            // console.log(e.data);
            if(cmd === 'initresponse') {
                availableSets = {};
                for(var i = 0; i < message.length; i++) availableSets[message[i].id] = message[i];
                populateServerSets();
            }
            else if(cmd === 'loadresponse') {
                availableMaps = {};
                for(var i = 0; i < message.maps.length; i++) availableMaps[message.maps[i].id] = message.maps[i];
                populateColorMaps();

                for(var i = 0; i < message.data.length; i++) message.data[i] = Faerun.initArrayFromBuffer(message.data_types[i], message.data[i])

                updateCoordinatesHelper(message.size);

                pointHelper = new Lore.PointHelper(lore, 'TestGeometry', 'default');
                pointHelper.setFogDistance(message.size * 2 + 200);
                pointHelper.setPositionsXYZColor(message.data[0], message.data[1], message.data[2], new Lore.Color(0.1, 0.2, 0.8));
                octreeHelper = new Lore.OctreeHelper(lore, 'OctreeGeometry', 'default', pointHelper);
                octreeHelper.addEventListener('singlehoveredchanged', function(e) {
                    socketWorker.postMessage({ cmd: 'loadsmiles', message: { set_id: currentSet.id, index: e.e.index } });
                });

                document.getElementById('datatitle').innerHTML = currentSet.name;
                selectSet.parentElement.style.pointerEvents = 'auto';
                hide(loader);
            }
            else if(cmd === 'loadmapresponse') {
                for(var i = 0; i < message.data.length; i++) message.data[i] = Faerun.initArrayFromBuffer(message.data_types[i], message.data[i])
                pointHelper.updateRGB(message.data[0], message.data[1], message.data[2]);


                document.getElementById('datatitle').innerHTML = currentSet.name + ' &middot; ' + currentMap.name;
                selectColorMap.parentElement.style.pointerEvents = 'auto';
                hide(loader);
            }
            else if(cmd === 'loadsmilesresponse') {
                var data = smiles.parse(message.trim());
                
                smilesDrawer.draw(data, 'structure-view', false)
            }
        }; 
    });

    // Helpers
    function updateCoordinatesHelper(size) {
        var coordinatesHelper = new Lore.CoordinatesHelper(lore, 'Coordinates', 'coordinates', {
            position: new Lore.Vector3f(0, 0, 0),
            axis: {
                x: { length: size, color: Lore.Color.fromHex('#097692') },
                y: { length: size, color: Lore.Color.fromHex('#097692') },
                z: { length: size, color: Lore.Color.fromHex('#097692') }
            },
            ticks: {
                x: { length: 10, color: Lore.Color.fromHex('#097692') },
                y: { length: 10, color: Lore.Color.fromHex('#097692') },
                z: { length: 10, color: Lore.Color.fromHex('#097692') }
            },
            box: {
                enabled: false,
                x: { color: Lore.Color.fromHex('#004F6E') },
                y: { color: Lore.Color.fromHex('#004F6E') },
                z: { color: Lore.Color.fromHex('#004F6E') }
            }
        });

        var halfSize = size / 2.0;
        lore.controls.setRadius(size * Math.sqrt(3) + 100);
        lore.controls.setLookAt(new Lore.Vector3f(halfSize, halfSize, halfSize));
    }

    function launchIntoFullscreen(element) {
        if(element.requestFullscreen) {
            element.requestFullscreen();
        } else if(element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if(element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if(element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    }

    function exitFullscreen() {
        if(document.exitFullscreen) {
            document.exitFullscreen();
        } else if(document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if(document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }

    function removeChildren(element) {
        while(element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    function appendOption(element, value, text) {
        var option = document.createElement('option');
        option.value = value;
        option.innerHTML = text;
        element.appendChild(option);
    }

    function appendEmptyOption(element) {
        var option = document.createElement('option');
        element.appendChild(option);
    }

    function hide(element) {
        element.classList.add('hidden');
    }

    function show(element) {
        element.classList.remove('hidden');
    }

})();