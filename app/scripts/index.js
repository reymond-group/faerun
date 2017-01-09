(function () {
  // Globals
  var lore = null;
  var smilesDrawer = null;
  var pointHelper = null;
  var octreeHelper = null;
  var coordinatesHelper = null;
  var availableSets = null;
  var availableMaps = null;
  var currentSet = null;
  var currentMap = null;
  var center = null;
  var selectIndicators = [];
  var selectCanvas = {};
  var selectSmiles = {};
  var socketWorker = new Worker('scripts/socketWorkerIndex.js');

  var bindings = Faerun.getBindings();

  // Events
  bindings.hudHeader.addEventListener('click', function () {
    Faerun.toggle(bindings.hudContainer);
    Faerun.toggleClass(bindings.hudHeaderIcon, 'rotate');
  }, false);

  bindings.switchFullscreen.addEventListener('change', function () {
    if (bindings.switchFullscreen.checked) {
      Faerun.launchIntoFullscreen(document.documentElement);
    } else {
      Faerun.exitFullscreen();
    }
  }, false);

  bindings.switchColor.addEventListener('change', function () {
    if (bindings.switchColor.checked) {
      bindings.labelSwitchColor.innerHTML = 'Light Background';
      lore.setClearColor(Lore.Color.fromHex('#DADFE1'));
    } else {
      bindings.labelSwitchColor.innerHTML = 'Dark Background';
      lore.setClearColor(Lore.Color.fromHex('#121212'));
    }
  }, false);

  bindings.selectSet.addEventListener('change', function () {
    currentSet = availableSets[bindings.selectSet.value];
    socketWorker.postMessage({
      cmd: 'load',
      message: bindings.selectSet.value
    });
    bindings.selectSet.parentElement.style.pointerEvents = 'none';
    Faerun.show(bindings.loader);
  }, false);

  bindings.selectColorMap.addEventListener('change', function () {
    currentMap = availableMaps[bindings.selectColorMap.value];
    socketWorker.postMessage({
      cmd: 'loadmap',
      message: JSON.stringify({
        set_id: currentSet.id,
        map_id: currentMap.id
      })
    });
    bindings.selectColorMap.parentElement.style.pointerEvents = 'none';
    Faerun.show(bindings.loader);
  }, false);

  bindings.selectView.addEventListener('change', function() {
    var val = bindings.selectView.value;

    if (val === 'free') lore.controls.setFreeView();
    if (val === 'top') lore.controls.setTopView();
    if (val === 'left') lore.controls.setLeftView();
    if (val === 'right') lore.controls.setRightView();
    if (val === 'front') lore.controls.setFrontView();
    if (val === 'back') lore.controls.setBackView();
  });

  bindings.sliderCutoff.addEventListener('input', function () {
    pointHelper.setCutoff(bindings.sliderCutoff.value);
  });

  bindings.sliderColor.addEventListener('input', function() {
    var val = parseFloat(bindings.sliderColor.value);
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

  bindings.buttonRecenter.addEventListener('click', function () {
    lore.controls.setLookAt(center);
  });

  bindings.buttonZoomIn.addEventListener('click', function () {
    lore.controls.zoomIn();
  });

  bindings.buttonZoomOut.addEventListener('click', function () {
    lore.controls.zoomOut();
  });

  bindings.buttonToggleSelect.addEventListener('click', function () {
    Faerun.toggleClass(bindings.buttonToggleSelect, 'mdl-button--colored');
    if (lore.controls.touchMode === 'drag') {
      Faerun.showMobile(bindings.hoverStructure);
      lore.controls.touchMode = 'select';
    } else {
      Faerun.hideMobile(bindings.hoverStructure);
      lore.controls.touchMode = 'drag';
    }
  });

  bindings.buttonSelectHovered.addEventListener('click', function () {
    octreeHelper.selectHovered();
  });

  // UI - data


  /**
   * Populates the HTMLSelectElement containing the sets available on the server.
   */
  function populateServerSets() {
    Faerun.removeChildren(bindings.selectSet);
    Faerun.appendEmptyOption(bindings.selectSet);
    for (var key in availableSets) {
      if ({}.hasOwnProperty.call(availableSets, key)) {
        Faerun.appendOption(bindings.selectSet, key, availableSets[key].name);
      }
    }
  }

  /**
   * Populates the HTMLSelectElement containing the color maps available for the selected set.
   */
  function populateColorMaps() {
    Faerun.removeChildren(bindings.selectColorMap);
    Faerun.appendEmptyOption(bindings.selectColorMap);
    for (var key in availableMaps) {
      if ({}.hasOwnProperty.call(availableMaps, key)) {
        Faerun.appendOption(bindings.selectColorMap, key, availableMaps[key].name);
      }
    }
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
    structure.setAttribute('href', 'details.html?index=' + id + '&set_id=' + currentSet.id);
    structure.setAttribute('target', '_blank');
    structure.style.borderColor = 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', 1.0)';

    var closer = document.createElement('span');
    closer.innerHTML = '&times;';
    closer.addEventListener('click', function(e) {
      octreeHelper.removeSelected(index);
      e.stopPropagation();
      e.preventDefault();
    });
    structure.appendChild(closer);

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

    bindings.selectContainer.appendChild(structure);
    bindings.selectContainer.parentElement.appendChild(indicator);
  }

  function clearSelected() {
    selectCanvas = {};
    selectSmiles = {};
    Faerun.removeChildren(bindings.selectContainer);

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
    bindings.sliderCutoff.min = 100.0;
    bindings.sliderCutoff.max = diameter + 100.0;
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
        Faerun.show(bindings.hudContainer);
        
        // Setup the coordinate system
        var cs = Faerun.updateCoordinatesHelper(lore, message.size);
        center = cs.center;
        coordinatesHelper = cs.helper;


        pointHelper = new Lore.PointHelper(lore, 'TestGeometry', 'default');
        pointHelper.setFogDistance(message.size * Math.sqrt(3) + 500);
        pointHelper.setPositionsXYZHSS(message.data[0], message.data[1], message.data[2], 0.6, 1.0, 1.0);
        pointHelper.addFilter('hueRange', new Lore.InRangeFilter('color', 0, 0.22, 0.25));

        octreeHelper = new Lore.OctreeHelper(lore, 'OctreeGeometry', 'default', pointHelper);

        octreeHelper.addEventListener('hoveredchanged', function (e) {
          if (!e.e) {
            Faerun.hide(bindings.hoverIndicator);
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

        bindings.dataTitle.innerHTML = currentSet.name;
        bindings.selectSet.parentElement.style.pointerEvents = 'auto';
        Faerun.hide(bindings.loader);
      } else if (cmd === 'loadmapresponse') {
        for (i = 0; i < message.data.length; i++) message.data[i] = Faerun.initArrayFromBuffer(message.data_types[i], message.data[i]);
        pointHelper.setRGB(message.data[0], message.data[1], message.data[2]);
        Faerun.setTitle(currentSet.name + ' &middot; ' + currentMap.name);
        bindings.selectColorMap.parentElement.style.pointerEvents = 'auto';
        Faerun.hide(bindings.loader);
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
    Faerun.show(bindings.hoverIndicator);
    Faerun.translateAbsolute(bindings.hoverIndicator, octreeHelper.hovered.screenPosition[0], octreeHelper.hovered.screenPosition[1], true);
    var pointSize = pointHelper.getPointSize();
    Faerun.resize(bindings.hoverIndicator, pointSize, pointSize);
  }
})();
