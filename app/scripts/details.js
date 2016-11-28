(function() {
    // Globals
    var socket = null;
    var lore = null;
    var smilesDrawer = null;
    var pointHelper = null;
    var octreeHelper = null;
    var smiles_data = null;
    var socketWorker = new Worker('scripts/socketWorkerDetails.js');
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

    // Socket.IO communication
    document.addEventListener("DOMContentLoaded", function(event) {
        lore = Lore.init('lore', { clearColor: '#212121' });
        smilesDrawer = new SmilesDrawer();

        socketWorker.onmessage = function(e){
            var cmd = e.data.cmd;
            var message = e.data.message;
            
            if(cmd === 'initresponse') {
                var params = Faerun.parseUrlParams();
                socketWorker.postMessage({ cmd: 'loaddetails', message: { set_id: params.set_id, index: params.index }});
            }
            else if(cmd === 'loaddetailsresponse') {
                var coords = Faerun.getCoords(message.data.coords, 250);
                smiles_data = message.data.smiles;
                updateCoordinatesHelper(coords.scale);

                pointHelper = new Lore.PointHelper(lore, 'TestGeometry', 'default', { pointScale: 10 });
                pointHelper.setFogDistance(coords.scale * 2 + 200);
                console.log(coords.x, coords.y, coords.z);
                pointHelper.setPositionsXYZColor(coords.x, coords.y, coords.z, new Lore.Color.fromHex('#8BC34A'));
                octreeHelper = new Lore.OctreeHelper(lore, 'OctreeGeometry', 'default', pointHelper);

                initMoleculeList();
            }
        }; 
    });

    // Helpers
    function initMoleculeList() {
        var container = document.getElementById('molecules');
        for(var i = 0; i < smiles_data.length; i++) {
            var smile = smiles_data[i].trim();
            var molecule = document.createElement('div');
            var structure = document.createElement('div');
            molecule.classList.add('molecule');
            structure.classList.add('structure-view');
            
            structure.id = 'structure-view' + i;
            var p = document.createElement('p');
            p.innerHTML = smile;

            molecule.appendChild(structure);
            molecule.appendChild(p);

            container.appendChild(molecule);
            var data = smiles.parse(smile);
            smilesDrawer.draw(data, structure.id, false);
        }
    }

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