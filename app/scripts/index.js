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
  var selectIndicators = [];
  var selectCanvas = {};
  var selectSmiles = {};
  var socketWorker = new Worker('scripts/socketWorkerIndex.js');
  var loader = document.getElementById('loader');

  var switchFullscreen = document.getElementById('switch-fullscreen');
  var labelSwitchColor = document.getElementById('label-switch-color');
  var switchColor = document.getElementById('switch-color');
  var selectSet = document.getElementById('select-set');
  var selectColorMap = document.getElementById('select-color-map');
  var selectView = document.getElementById('select-view');
  var sliderCutoff = document.getElementById('slider-cutoff');
  var sliderColor = document.getElementById('slider-color');
  var hudContainer = document.getElementById('hud-container');
  var hudHeader = document.getElementById('hud-header');
  var hudHeaderIcon = document.getElementById('hud-header-icon');
  var buttonRecenter = document.getElementById('button-recenter');
  var buttonZoomIn = document.getElementById('button-zoomin');
  var buttonZoomOut = document.getElementById('button-zoomout');
  var buttonToggleSelect = document.getElementById('button-toggle-select');
  var buttonSelectHovered = document.getElementById('button-select-hovered');
  var hoverIndicator = document.getElementById('hover-indicator');
  var hoverStructure = document.getElementById('hover-structure');
  var selectContainer = document.getElementById('select-container');

  // Events
  hudHeader.addEventListener('click', function () {
    Faerun.toggle(hudContainer);
    Faerun.toggleClass(hudHeaderIcon, 'rotate');
  }, false);

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
      lore.setClearColor(Lore.Color.fromHex('#121212'));
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

  selectView.addEventListener('change', function() {
    var val = selectView.value;

    if (val === 'free') lore.controls.setFreeView();
    if (val === 'top') lore.controls.setTopView();
    if (val === 'left') lore.controls.setLeftView();
    if (val === 'right') lore.controls.setRightView();
    if (val === 'front') lore.controls.setFrontView();
    if (val === 'back') lore.controls.setBackView();
  });

  sliderCutoff.addEventListener('input', function () {
    pointHelper.setCutoff(sliderCutoff.value);
  });

  sliderColor.addEventListener('input', function() {
    var val = parseFloat(sliderColor.value);
    var filter = pointHelper.getFilter('hueRange');

    if (val < 0.02) {
      filter.reset();
      return;
    }

    val = Lore.Color.gdbHueShift(val);
    filter.setMin(val - 0.002);
    filter.setMax(val + 0.002);
    filter.filter();
  });

  buttonRecenter.addEventListener('click', function () {
    lore.controls.setLookAt(center);
  });

  buttonZoomIn.addEventListener('click', function () {
    lore.controls.zoomIn();
  });

  buttonZoomOut.addEventListener('click', function () {
    lore.controls.zoomOut();
  });

  buttonToggleSelect.addEventListener('click', function () {
    Faerun.toggleClass(buttonToggleSelect, 'mdl-button--colored');
    if (lore.controls.touchMode === 'drag') {
      Faerun.showMobile(hoverStructure);
      lore.controls.touchMode = 'select';
    } else {
      Faerun.hideMobile(hoverStructure);
      lore.controls.touchMode = 'drag';
    }
  });

  buttonSelectHovered.addEventListener('click', function () {
    octreeHelper.selectHovered();
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

  function createSelected(index, id) {
    var selected = octreeHelper.selected[index];
    var hue = pointHelper.getHue(id);
    var rgb = Lore.Color.hslToRgb(hue, 1.0, 0.75);
    rgb[0] = Math.round(rgb[0] * 255); rgb[1] = Math.round(rgb[1] * 255); rgb[2] = Math.round(rgb[2] * 255);

    var structure = document.createElement('a');
    structure.classList.add('mdl-badge', 'mdl-badge--overlap');
    structure.setAttribute('id', 'selected-' + index);
    structure.setAttribute('data-badge', index);
    structure.setAttribute('href', '/details.html?index=' + id + '&set_id=' + currentSet.id);
    structure.style.borderColor = 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', 1.0)';

    Faerun.hover(structure, function() {
      var data = smiles.parse(selectSmiles[id]);
      smilesDrawer.draw(data, 'hover-structure-drawing', false);
    }, function() {
      Faerun.clearCanvas('hover-structure-drawing');
    });

    var canvas = document.createElement('canvas');
    canvas.setAttribute('id', 'select-structure-drawing-' + id);
    canvas.setAttribute('width', '50');
    canvas.setAttribute('height', '50');
    structure.appendChild(canvas);

    var indicator = document.createElement('span');
    indicator.classList.add('mdl-badge', 'mdl-badge--overlap', 'select-indicator');
    indicator.setAttribute('id', 'selected-indicator-' + index);
    indicator.setAttribute('data-badge', index);
    Faerun.translateAbsolute(indicator, selected.screenPosition[0], selected.screenPosition[1], true);
    var pointSize = pointHelper.getPointSize();
    Faerun.resize(indicator, pointSize, pointSize);

    selectCanvas[id] = canvas;

    selectIndicators.push(indicator);

    selectContainer.appendChild(structure);
    selectContainer.parentElement.appendChild(indicator);
  }

  function clearSelected() {
    selectCanvas = {};
    selectSmiles = {};
    Faerun.removeChildren(selectContainer);

    selectIndicators = [];
    var indicators = document.getElementsByClassName('select-indicator');
    for (var i = indicators.length - 1; i >= 0; i--) {
      indicators[i].parentNode.removeChild(indicators[i]);
    }
  }

  function updateSelected() {
    var pointSize = pointHelper.getPointSize();
    for (var i = 0; i < selectIndicators.length; i++) {
      var selected = octreeHelper.selected[i];
      var indicator = selectIndicators[i];
      Faerun.translateAbsolute(indicator, selected.screenPosition[0], selected.screenPosition[1], true);
      Faerun.resize(indicator, pointSize, pointSize);
    }
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
      clearColor: '#121212'
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
        pointHelper.addFilter('hueRange', new Lore.InRangeFilter('color', 0, 0.22, 0.25));

        octreeHelper = new Lore.OctreeHelper(lore, 'OctreeGeometry', 'default', pointHelper);

        octreeHelper.addEventListener('hoveredchanged', function (e) {
          if (!e.e) {
            Faerun.hide(hoverIndicator);
            return;
          }

          updateHovered();

          socketWorker.postMessage({
            cmd: 'loadsmiles',
            message: {
              set_id: currentSet.id,
              index: e.e.index
            }
          });
        });

        octreeHelper.addEventListener('selectedchanged', function (e) {
          clearSelected();
          for (var i = 0; i < octreeHelper.selected.length; i++) {
            var selected = octreeHelper.selected[i];
            createSelected(i, selected.index);

            socketWorker.postMessage({
              cmd: 'loadsmiles',
              message: {
                set_id: currentSet.id,
                index: e.e[i].index
              }
            });
          }
        });

        octreeHelper.addEventListener('updated', function() {
          if (octreeHelper.hovered) updateHovered();
          if (octreeHelper.selected) updateSelected();
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
        var target = 'hover-structure-drawing';

        if (selectCanvas.hasOwnProperty(message.index)) {
          target = 'select-structure-drawing-' + message.index;
          selectSmiles[message.index] = message.smiles.trim();
        }

        var data = smiles.parse(message.smiles.trim());
        smilesDrawer.draw(data, target, false);
      }
    };
  });

  // Helpers

  function updateHovered() {
    Faerun.show(hoverIndicator);
    Faerun.translateAbsolute(hoverIndicator, octreeHelper.hovered.screenPosition[0], octreeHelper.hovered.screenPosition[1], true);
    var pointSize = pointHelper.getPointSize();
    Faerun.resize(hoverIndicator, pointSize, pointSize);
  }

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
