(function () {
  // Globals
  var lore = null;
  var smilesDrawer = null;
  var pointHelper = null;
  var octreeHelper = null;
  var availableSets = null;
  var availableMaps = null;
  var currentSet = null;
  var currentMap = null;
  var center = null;
  var socketWorker = new Worker('scripts/socketWorkerIndex.js');
  var loader = document.getElementById('loader');

  var switchFullscreen = document.getElementById('switch-fullscreen');
  var labelSwitchColor = document.getElementById('label-switch-color');
  var switchColor = document.getElementById('switch-color');
  var selectSet = document.getElementById('select-set');
  var selectColorMap = document.getElementById('select-color-map');
  var sliderCutoff = document.getElementById('slider-cutoff');
  var hudContainer = document.getElementById('hud-container');
  var buttonRecenter = document.getElementById('button-recenter');

  // Events
  switchFullscreen.addEventListener('change', function () {
    if (switchFullscreen.checked) {
      Faerun.launchIntoFullscreen(document.documentElement);
    } else {
      Faerun.exitFullscreen();
    }
  }, false);

  switchColor.addEventListener('change', function () {
    if (switchColor.checked) {
      labelSwitchColor.innerHTML = 'Light Background';
      lore.setClearColor(Lore.Color.fromHex('#DADFE1'));
    } else {
      labelSwitchColor.innerHTML = 'Dark Background';
      lore.setClearColor(Lore.Color.fromHex('#1E1E1E'));
    }
  }, false);

  selectSet.addEventListener('change', function () {
    currentSet = availableSets[selectSet.value];
    socketWorker.postMessage({
      cmd: 'load',
      message: selectSet.value
    });
    selectSet.parentElement.style.pointerEvents = 'none';
    Faerun.show(loader);
  }, false);

  selectColorMap.addEventListener('change', function () {
    currentMap = availableMaps[selectColorMap.value];
    socketWorker.postMessage({
      cmd: 'loadmap',
      message: JSON.stringify({
        set_id: currentSet.id,
        map_id: currentMap.id
      })
    });
    selectColorMap.parentElement.style.pointerEvents = 'none';
    Faerun.show(loader);
  }, false);

  sliderCutoff.addEventListener('input', function () {
    pointHelper.setCutoff(sliderCutoff.value);
  });

  buttonRecenter.addEventListener('click', function () {
    lore.controls.setLookAt(center);
  });

  // UI - data


  /**
   * Populates the HTMLSelectElement containing the sets available on the server.
   */
  function populateServerSets() {
    Faerun.removeChildren(selectSet);
    Faerun.appendEmptyOption(selectSet);
    for (var key in availableSets)
      if ({}.hasOwnProperty.call(availableSets, key))
        Faerun.appendOption(selectSet, key, availableSets[key].name);
  }

  /**
   * Populates the HTMLSelectElement containing the color maps available for the selected set.
   */
  function populateColorMaps() {
    Faerun.removeChildren(selectColorMap);
    Faerun.appendEmptyOption(selectColorMap);
    for (var key in availableMaps)
      if ({}.hasOwnProperty.call(availableMaps, key))
        Faerun.appendOption(selectColorMap, key, availableMaps[key].name);
  }

  /**
   * Sets the range of the slider that is used to set the cutoff.
   *
   * @param {Number} diameter - The maximum value of the cutoff, shoud be equal to the maximal diameter of the coordinate system.
   */
  function setCutoffRange(diameter) {
    // 100.0 is also added to radius when setting the camera.
    sliderCutoff.min = 100.0;
    sliderCutoff.max = diameter + 100.0;
  }

  // Socket.IO communication
  document.addEventListener('DOMContentLoaded', function (event) {
    lore = Lore.init('lore', {
      clearColor: '#212121'
    });
    smilesDrawer = new SmilesDrawer();

    socketWorker.onmessage = function (e) {
      var cmd = e.data.cmd;
      var message = e.data.message;
      var i;

      if (cmd === 'initresponse') {
        availableSets = {};
        for (i = 0; i < message.length; i++) availableSets[message[i].id] = message[i];
        populateServerSets();
      } else if (cmd === 'loadresponse') {
        availableMaps = {};
        for (i = 0; i < message.maps.length; i++) availableMaps[message.maps[i].id] = message.maps[i];
        for (i = 0; i < message.data.length; i++) message.data[i] = Faerun.initArrayFromBuffer(message.data_types[i], message.data[i]);
        populateColorMaps();
        setCutoffRange(message.size * Math.sqrt(3));
        Faerun.show(hudContainer);
        updateCoordinatesHelper(message.size);

        pointHelper = new Lore.PointHelper(lore, 'TestGeometry', 'default');
        pointHelper.setFogDistance(message.size * Math.sqrt(3) + 500);
        pointHelper.setPositionsXYZColor(message.data[0], message.data[1], message.data[2], new Lore.Color(0.1, 0.2, 0.8));
        octreeHelper = new Lore.OctreeHelper(lore, 'OctreeGeometry', 'default', pointHelper);
        octreeHelper.addEventListener('hoveredchanged', function (e) {
          if (!e.e) return;
          socketWorker.postMessage({
            cmd: 'loadsmiles',
            message: {
              set_id: currentSet.id,
              index: e.e.index
            }
          });
        });

        document.getElementById('datatitle').innerHTML = currentSet.name;
        selectSet.parentElement.style.pointerEvents = 'auto';
        Faerun.hide(loader);
      } else if (cmd === 'loadmapresponse') {
        for (i = 0; i < message.data.length; i++) message.data[i] = Faerun.initArrayFromBuffer(message.data_types[i], message.data[i]);
        pointHelper.updateRGB(message.data[0], message.data[1], message.data[2]);
        Faerun.setTitle(currentSet.name + ' &middot; ' + currentMap.name);
        selectColorMap.parentElement.style.pointerEvents = 'auto';
        Faerun.hide(loader);
      } else if (cmd === 'loadsmilesresponse') {
        var data = smiles.parse(message.trim());

        smilesDrawer.draw(data, 'structure-view', false);
      }
    };
  });

  // Helpers

  /**
   * Update the coordinates according to the current data set.
   *
   * @param {Number} size - The size of the x, y and z coordinate axis
   */
  function updateCoordinatesHelper(size) {
    var coordinatesHelper = new Lore.CoordinatesHelper(lore, 'Coordinates', 'coordinates', {
      position: new Lore.Vector3f(0, 0, 0),
      axis: {
        x: {
          length: size,
          color: Lore.Color.fromHex('#B71C1C')
        },
        y: {
          length: size,
          color: Lore.Color.fromHex('#1B5E20')
        },
        z: {
          length: size,
          color: Lore.Color.fromHex('#0D47A1')
        }
      },
      ticks: {
        x: {
          length: 10,
          color: Lore.Color.fromHex('#B71C1C')
        },
        y: {
          length: 10,
          color: Lore.Color.fromHex('#1B5E20')
        },
        z: {
          length: 10,
          color: Lore.Color.fromHex('#0D47A1')
        }
      },
      box: {
        enabled: false,
        x: {
          color: Lore.Color.fromHex('#EEEEEE')
        },
        y: {
          color: Lore.Color.fromHex('#EEEEEE')
        },
        z: {
          color: Lore.Color.fromHex('#EEEEEE')
        }
      }
    });

    var halfSize = size / 2.0;
    center = new Lore.Vector3f(halfSize, halfSize, halfSize);
    lore.controls.setRadius((size * Math.sqrt(3)) / 2.0 + 100);
    lore.controls.setLookAt(center);
  }
})();
