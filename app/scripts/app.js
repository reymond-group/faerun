(function() {
    // Globals
    var socket = null;
    var lore = null;
    var availableSets = null;
    var currentSet = null;
    var socketWorker = new Worker('scripts/socketWorker.js');

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
            lore.setClearColor(Lore.Color.fromHex('#001821'));
        }
    }, false);

    var selectSet = document.getElementById('select-set');
    var loaderSelectSet = document.getElementById('loader-select-set');

    selectSet.addEventListener('change', function() {
        socketWorker.postMessage({ cmd: 'load', message: selectSet.value });
        selectSet.parentElement.style.pointerEvents = 'none';
        show(loaderSelectSet);
    }, false);

    // UI - data
    function populateServerSets() {
        removeChildren(selectSet);
        appendEmptyOption(selectSet);
        for(var i = 0; i < availableSets.length; i++) {
            currentSet = availableSets[i];
            appendOption(selectSet, currentSet[0], currentSet[1]);
        }
    }

    // Socket.IO communication
    document.addEventListener("DOMContentLoaded", function(event) {
        lore = Lore.init('lore', { clearColor: '#212121' });
        
        socketWorker.onmessage = function(e){
            var cmd = e.data.cmd;
            var message = e.data.message;

            if(cmd === 'initresponse') {
                availableSets = message;
                populateServerSets();
            }
            else if(cmd === 'loadresponse') {
                selectSet.parentElement.style.pointerEvents = 'auto';
                document.getElementById('datatitle').innerHTML = currentSet[1];
                hide(loaderSelectSet);
                for(var i = 0; i < message.data.length; i++) message.data[i] = new Uint16Array(message.data[i])

                var pointHelper = new Lore.PointHelper(lore, 'TestGeometry', 'default');
                pointHelper.setPositionsXYZColor(message.data[0], message.data[1], message.data[2], new Lore.Color(0.1, 0.2, 0.8));
            }
        }; 
    });

    // Helpers
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