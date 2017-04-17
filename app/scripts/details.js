(function () {
  // Globals
  let lore = null;
  let smilesDrawer = null;
  let smallSmilesDrawer = null;
  let coordinatesHelper = null;
  let config = null;
  let center = null;
  let projections = [];
  let selectIndicators = [];
  let selectCanvas = {};
  let selectSmiles = {};
  let treeWorker = new Worker('libs/kmst/kmst-worker.js');
  let socketWorker = new Worker('scripts/socketWorker.js');
  let params = Faerun.parseUrlParams();

  let bindings = Faerun.getBindings();

  // Events
  bindings.hudHeader.addEventListener('click', function () {
    Faerun.toggle(bindings.hudContainer);
    Faerun.toggleClass(bindings.hudHeaderIcon, 'rotate');
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

  bindings.sliderCutoff.addEventListener('input', function () {
    projections[0].pointHelper.setCutoff(bindings.sliderCutoff.value);
  });

  bindings.sliderColor.addEventListener('input', function () {
    let val = parseFloat(bindings.sliderColor.value);
    let filter = projections[0].pointHelper.getFilter('hueRange');

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
    projections[0].octreeHelper.selectHovered();
  });

  // Socket.IO communication
  document.addEventListener('DOMContentLoaded', function (event) {
    Faerun.initFullscreenSwitch(bindings.switchFullscreen);
    console.log('params');
    smilesDrawer = new SmilesDrawer();

    // Show the loader from the beginning until everything is loaded
    Faerun.show(bindings.loader);

    treeWorker.onmessage = function (e) {
      treeHelper = new Lore.TreeHelper(lore, 'TreeGeometry', 'tree');
      treeHelper.setFogDistance(coords.scale * Math.sqrt(3) * 1.5);
      var x = new Array(e.data.length * 2);
      var y = new Array(e.data.length * 2);
      var z = new Array(e.data.length * 2);

      for (var i = 0; i < e.data.length; i++) {
        var a = e.data[i][0];
        var b = e.data[i][1];

        x.push(coords.x[a]);
        y.push(coords.y[a]);
        z.push(coords.z[a]);

        x.push(coords.x[b]);
        y.push(coords.y[b]);
        z.push(coords.z[b]);
      }

      treeHelper.setPositionsXYZHSS(x, y, z, 0.8, 0.5, 1.0);
    };

    socketWorker.onmessage = function (e) {
      var cmd = e.data.cmd;
      var message = e.data.msg;

      if (cmd === 'init') {
        onInit(message);
      } else if (cmd === 'load:bin') {
        onBinLoaded(message);
      }
    };
  });

  /**
   * Initialize the configuration and load the bin data on init.
   *
   * @param {any} message - The server message containing the init information
   */
  function onInit(message) {
    config = message;
    socketWorker.postMessage({
      cmd: 'load:bin',
      msg: {
        databaseId: params.databaseId,
        fingerprintId: params.fingerprintId,
        variantId: params.variantId,
        binIndex: params.binIndex
      }
    });
  }


  /**
   * Initialize the 3d map as well as the compound cards.
   *
   * @param {any} message - The server message containing the bin data
   */
  function onBinLoaded(message) {
    coords = Faerun.getCoords(message.coordinates, 250);
    smilesData = message.smiles;
    idsData = message.ids;
    fpsData = message.fps;

    if (message.binSize > 2) {
      lore = Lore.init('lore', {
        clearColor: '#121212',
        limitRotationToHorizon: true
      });

      Faerun.initViewSelect(bindings.selectView, lore);

      // Setup the coordinate system
      var cs = Faerun.updateCoordinatesHelper(lore, coords.scale);
      coordinatesHelper = cs.helper;

      // The tree
      var tmpArr = [];
      for (var i = 0; i < coords.x.length; i++) {
        tmpArr.push([coords.x[i], coords.y[i], coords.z[i]]);
      }

      // for (var i = 0; i < fpsData.length; i++) {
      //   tmpArr.push(fpsData[i].split(";"));
      // }

      treeWorker.postMessage(tmpArr);

      pointHelper = new Lore.PointHelper(lore, 'TestGeometry', 'sphere', {
        pointScale: 10
      });

      pointHelper.setFogDistance(coords.scale * Math.sqrt(3) * 1.5);
      pointHelper.setPositionsXYZHSS(coords.x, coords.y, coords.z, 0.9, 1.0, 1.0);

      octreeHelper = new Lore.OctreeHelper(lore, 'OctreeGeometry', 'default', pointHelper);
      octreeHelper.addEventListener('hoveredchanged', function (e) {
        if (!e.e) {
          Faerun.hide(bindings.hoverIndicator);
          return;
        }

        updateHovered();
      });

      octreeHelper.addEventListener('updated', function () {
        if (octreeHelper.hovered) updateHovered();
        // if (octreeHelper.selected) updateSelected();
      });
    } else {
      Faerun.removeElement(bindings.loreCell);
      Faerun.addClasses(bindings.moleculeCell, ['full-width']);
    }
    /*
    console.log(Faerun.sourceIdsUrl);
    JSONP.get(Faerun.sourceIdsUrl, function (srcIds) {
      var length = srcIds.length;

      for (var i = 0; i < srcIds.length; i++) {
        JSONP.get(Faerun.sourceInformationUrl(srcIds[i].src_id), function (sourceData) {
          sourceInfos[sourceData[0].src_id] = sourceData[0];
          if (--length === 0) {
            initMoleculeList();

            // Hide loader here, since this is the closest to fully
            // loaded we get :-)
            Faerun.hide(bindings.loader);
          }
        });
      }
    });
    */

    Faerun.hide(bindings.loader);
  }

  /**
   * Create an HTML element with index 'idx' representing the bin specified by 'id'.
   *
   * @param {Number} idx - The index for the selected element
   * @param {Number} id - The id of the bin / point
   */
  function createSelected(idx, id, layer) {
    let selected = projections[0].octreeHelper.selected[idx];
    let hue = projections[0].pointHelper.getHue(id);
    let rgb = Lore.Color.hslToRgb(hue, 1.0, 0.5);

    for (let i = 0; i < rgb.length; i++) {
      rgb[i] = Math.round(rgb[i] * 255);
    }

    Faerun.appendTemplate(bindings.selectContainer, 'selected-bin-template', {
      id: id,
      idx: idx,
      layer: layer,
      color: 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', 0.5)'
    });

    let structure = document.getElementById('selected-structure-' + layer + '-' + id);
    let item = document.getElementById('selected-bin-item-' + layer + '-' + id);
    let closer = document.getElementById('bin-closer-' + layer + '-' + id);
    let center = document.getElementById('bin-center-' + layer + '-' + id);

    selectCanvas[layer + '-' + id] = structure;

    Faerun.hover(item, function () {
      let data = SmilesDrawer.parse(selectSmiles[layer + '-' + id]);
      smilesDrawer.draw(data, 'hover-structure-drawing', 'dark');
    }, function () {
      Faerun.clearCanvas('hover-structure-drawing');
    });

    item.addEventListener('click', function (e) {
      let nCompounds = parseFloat(document.getElementById('select-bin-size-0-' + id).innerHTML);
      let indices = id;
      if (nCompounds < 10) {
        let nearestNeighbours = binKnn(id, 26);

        for (const index of nearestNeighbours) {
          indices += ',' + index;
        }
      }
    });

    closer.addEventListener('click', function (e) {
      projections[layer].octreeHelper.removeSelected(idx);
      e.stopPropagation();
      e.preventDefault();
    });

    center.addEventListener('click', function (e) {
      let vec = projections[layer].pointHelper.getPosition(id);

      lore.controls.setLookAt(vec);
      e.stopPropagation();
      e.preventDefault();
    });


    let indicator = document.createElement('span');

    indicator.classList.add('mdl-badge', 'mdl-badge--overlap', 'select-indicator');
    indicator.setAttribute('id', 'selected-indicator-' + layer + '-' + id);
    indicator.setAttribute('data-badge', idx);

    let pointSize = projections[0].pointHelper.getPointSize();
    selectIndicators.push(indicator);
    bindings.main.appendChild(indicator);

    updateSelected();
  }

  /**
   * Remove all HTML elements representing selected bins.
   */
  function clearSelected() {
    selectCanvas = {};
    selectSmiles = {};
    Faerun.removeChildren(bindings.selectContainer);

    selectIndicators = [];
    let indicators = document.getElementsByClassName('select-indicator');

    for (let i = indicators.length - 1; i >= 0; i--) {
      indicators[i].parentNode.removeChild(indicators[i]);
    }
  }

  /**
   * Update all HTML elements representing selected bins.
   */
  function updateSelected() {
    let pointSize = projections[0].pointHelper.getPointSize();

    for (let i = 0; i < selectIndicators.length; i++) {
      let selected = projections[0].octreeHelper.selected[i];
      let indicator = selectIndicators[i];
      let screenPosition = projections[0].octreeHelper.getScreenPosition(selected.index);

      Faerun.positionIndicator(indicator, pointSize, screenPosition[0], screenPosition[1]);
    }
  }

  /**
   * Update the hover indicators.
   */
  function updateHovered(layer) {
    layer = layer || 0;
    Faerun.show(bindings.hoverIndicator);
    let pointSize = projections[layer].pointHelper.getPointSize();
    Faerun.positionIndicator(bindings.hoverIndicator, pointSize, projections[layer].octreeHelper.hovered.screenPosition[0],
      projections[layer].octreeHelper.hovered.screenPosition[1]);
  }

  /**
   * Show the bin preview (the structure drawing)
   *
   * @param {any} message - The server message containing the bin preview data
   */
  function onBinPreviewLoaded(message) {
    let target = 'hover-structure-drawing';
    let sd = smilesDrawer;
    if (selectCanvas.hasOwnProperty('0-' + message.index)) {
      // Smiles are only loaded from 0 layer (the one loaded from the server)
      target = 'select-structure-drawing-0-' + message.index;
      selectSmiles['0-' + message.index] = message.smiles;
      document.getElementById('select-bin-size-0-' + message.index).innerHTML = message.binSize;
      sd = smallSmilesDrawer;
    } else {
      document.getElementById('hover-bin-size').innerHTML = message.binSize;
    }

    let data = SmilesDrawer.parse(message.smiles);
    sd.draw(data, target, 'dark');
  }

  function onInfosSearched(message) {
    for (let binIndex of message.binIndices) {
      for (let result of binIndex) {
        projections[0].octreeHelper.addSelected(result);
      }
    }

    Faerun.hide(bindings.loader);
  }
})();
