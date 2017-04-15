(function () {
  // Globals
  let lore = null;
  let smilesDrawer = null;
  let smallSmilesDrawer = null;
  let coordinatesHelper = null;
  let config = null;
  let currentDatabase = null;
  let currentFingerprint = null;
  let currentVariant = null;
  let currentMap = null;
  let currentLayer = 0;
  let center = null;
  let projections = [];
  let selectIndicators = [];
  let selectCanvas = {};
  let selectSmiles = {};
  let socketWorker = new Worker('scripts/socketWorker.js');

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

  bindings.selectDatabase.addEventListener('change', function () {
    currentDatabase = config.databases[bindings.selectDatabase.value];
    populateFingerprints(currentDatabase);
  }, false);

  bindings.selectFingerprint.addEventListener('change', function () {
    currentFingerprint = currentDatabase.fingerprints[bindings.selectFingerprint.value];
    populateVariants(currentFingerprint);
  }, false);

  bindings.selectVariant.addEventListener('change', function () {
    loadStats(bindings.selectVariant.value);
    loadVariant(bindings.selectVariant.value);
  }, false);

  bindings.selectMap.addEventListener('change', function () {
    currentMap = currentVariant.maps[bindings.selectMap.value];

    // Block the select elements during loading
    Faerun.blockElements(bindings.selectDatabase.parentElement, bindings.selectFingerprint.parentElement,
      bindings.selectVariant.parentElement, bindings.selectMap.parentElement);

    socketWorker.postMessage({
      cmd: 'load:map',
      msg: {
        mapId: currentMap.id
      }
    });

    bindings.selectMap.parentElement.style.pointerEvents = 'none';
    bindings.loadingMessage.innerHTML = 'Loading map ...';
    Faerun.show(bindings.loader);
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

  // Search
  if (!bindings.dialogSearch.showModal) {
    dialogPolyfill.registerDialog(bindings.dialogSearch)
  }

  bindings.buttonSearch.addEventListener('click', function () {
    bindings.dialogSearch.showModal();
  });

  bindings.dialogSearch.querySelector('.close').addEventListener('click', function () {
    bindings.dialogSearch.close();
  });

  bindings.buttonExecSearch.addEventListener('click', function () {
    if (!currentVariant) {
      bindings.toastError.MaterialSnackbar.showSnackbar({
        message: 'Please select a variant before searching ...'
      });
      return;
    }

    let queries = bindings.textareaSearch.value.split('\n');
    console.log('Queries:', queries);
    if (queries.length < 1 || queries[0] === '') {
      bindings.toastError.MaterialSnackbar.showSnackbar({
        message: 'Please enter at least one query ...'
      });
      return;
    }

    socketWorker.postMessage({
      cmd: 'search:infos',
      msg: {
        fingerprintId: currentFingerprint.id,
        variantId: currentVariant.id,
        searchTerms: queries
      }
    });

    bindings.dialogSearch.close();
    bindings.loadingMessage.innerHTML = 'Searching ...';
    Faerun.show(bindings.loader);
  });

  // Project
  if (!bindings.dialogProject.showModal) {
    dialogPolyfill.registerDialog(bindings.dialogProject)
  }

  bindings.buttonProject.addEventListener('click', function () {
    bindings.dialogProject.showModal();
  });

  bindings.dialogProject.querySelector('.close').addEventListener('click', function () {
    bindings.dialogProject.close();
  });

  bindings.buttonExecProject.addEventListener('click', function () {
    project();

    bindings.dialogProject.close();
    bindings.loadingMessage.innerHTML = 'Projecting ...';
    Faerun.show(bindings.loader);
  });

  // KNN
  if (!bindings.dialogKNN.showModal) {
    dialogPolyfill.registerDialog(bindings.dialogKNN);
  }

  bindings.buttonKNN.addEventListener('click', function () {
    bindings.dialogKNN.showModal();
  });

  bindings.dialogKNN.querySelector('.close').addEventListener('click', function () {
    bindings.dialogKNN.close();
  });

  bindings.buttonExecKNN.addEventListener('click', function () {
    knn();
    bindings.dialogProject.close();
  });

  bindings.buttonKNN.addEventListener('click', function () {

  });

  /**
   * Populates the HTMLSelectElement containing the databases available on the server.
   */
  function populateDatabases() {
    Faerun.removeChildren(bindings.selectDatabase);
    Faerun.appendEmptyOption(bindings.selectDatabase);

    for (let i = 0; i < config.databases.length; i++) {
      let database = config.databases[i];

      Faerun.appendOption(bindings.selectDatabase, i, database.name);
    }
  }

  /**
   * Populate the fingerprint select element with the fingerprints contained in 'database'.
   *
   * @param {Database} database - A database configuration item
   */
  function populateFingerprints(database) {
    Faerun.removeChildren(bindings.selectFingerprint);
    Faerun.appendEmptyOption(bindings.selectFingerprint);

    for (let i = 0; i < database.fingerprints.length; i++) {
      let fingerprint = database.fingerprints[i];

      Faerun.appendOption(bindings.selectFingerprint, i, fingerprint.name);
    }
  }

  /**
   * Populate the variant select element with the varants contained in 'fingerprint'.
   *
   * @param {Fingerprint} fingerprint - A fingerprint configuration item
   */
  function populateVariants(fingerprint) {
    Faerun.removeChildren(bindings.selectVariant);
    Faerun.appendEmptyOption(bindings.selectVariant);

    for (let i = 0; i < fingerprint.variants.length; i++) {
      let variant = fingerprint.variants[i];

      Faerun.appendOption(bindings.selectVariant, i, variant.name);
    }

    if (fingerprint.variants.length === 1) {
      bindings.selectVariant.value = 0;
      loadStats(0);
      loadVariant(0);
    }
  }

  /**
   * Populate the map select element with the maps contained in 'variant'.
   *
   * @param {Variant} variant - A variant configuration item
   */
  function populateMaps(variant) {
    Faerun.removeChildren(bindings.selectMap);
    Faerun.appendEmptyOption(bindings.selectMap);

    for (let i = 0; i < variant.maps.length; i++) {
      let map = variant.maps[i];

      Faerun.appendOption(bindings.selectMap, i, map.name);
    }
  }

  /**
   * Update the layer list
   */
  function updateLayers() {
    Faerun.removeChildren(bindings.layerContainer);

    for (let i = 0; i < projections.length; i++) {
      let projection = projections[i];

      Faerun.appendTemplate(bindings.layerContainer, 'layer-template', {
        id: i,
        name: projection.name,
        color: projection.color,
        current: i === currentLayer
      });
    }

    let layers = document.getElementsByClassName('radio-current-layer');

    for (let i = 0; i < layers.length; i++) {
      layers[i].addEventListener('click', function (e) {
        currentLayer = parseFloat(this.value);
      });
    }
  }

  /**
   * Add a layer to the available projections
   *
   * @param {any} projection - A projection item to be added to the available projections
   */
  function addProjection(projection) {
    projections.push(projection);
    updateLayers();
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

      window.open('details.html?binIndex=' + indices + '&databaseId=' + currentDatabase.id +
        '&fingerprintId=' + currentFingerprint.id + '&variantId=' +
        currentVariant.id, '_blank');
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
   * Sets the range of the slider that is used to set the cutoff.
   *
   * @param {Number} diameter - The maximum value of the cutoff, shoud be equal to the maximal diameter of the coordinate system.
   */
  function setCutoffRange(diameter) {
    // 100.0 is also added to radius when setting the camera.
    bindings.sliderCutoff.min = 100.0;
    bindings.sliderCutoff.max = diameter + 100.0;
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Hide the hud with animation (to show a brief glimpse to the user
    // so that he knows it's there)
    setTimeout(function () {
      Faerun.toggle(bindings.hudContainer);
      Faerun.toggleClass(bindings.hudHeaderIcon, 'rotate');
    }, 1000);

    lore = Lore.init('lore', {
      clearColor: '#121212'
    });

    smilesDrawer = new SmilesDrawer({bondLength: 20});
    smallSmilesDrawer = new SmilesDrawer({atomVisualization: 'balls'});

    Faerun.initFullscreenSwitch(bindings.switchFullscreen);
    Faerun.initViewSelect(bindings.selectView, lore);
    Faerun.initColorpicker(bindings.colorpickerDialogProject, FaerunConfig.colors.colorpickerDialogProject);

    socketWorker.onmessage = function (e) {
      if (e.data.cmd === 'init')
        onInit(e.data.msg);
      else if (e.data.cmd === 'load:variant')
        onVariantLoaded(e.data.msg);
      else if (e.data.cmd === 'load:map')
        onMapLoaded(e.data.msg);
      else if (e.data.cmd === 'load:binpreview')
        onBinPreviewLoaded(e.data.msg);
      else if (e.data.cmd === 'search:infos')
        onInfosSearched(e.data.msg);
      else if (e.data.cmd === 'load:stats')
        onStatsLoaded(e.data.msg);
    };
  });

  /**
   * Initialize the configuration and populate the database select element.
   *
   * @param {any} message - The server message containing init information
   */
  function onInit(message) {
    config = message;
    populateDatabases();
  }

  /**
   * Initialiize the point cloud with the data received for the selected variant.
   *
   * @param {any} message - The server message containing the variant data
   */
  function onVariantLoaded(message) {
    for (let i = 0; i < message.data.length; i++) {
      message.data[i] = Faerun.initArrayFromBuffer(message.dataTypes[i], message.data[i]);
    }

    setCutoffRange(currentVariant.resolution * Math.sqrt(3));

    // Setup the coordinate system
    let cs = Faerun.updateCoordinatesHelper(lore, currentVariant.resolution);
    center = cs.center;
    coordinatesHelper = cs.helper;



    let ph = new Lore.PointHelper(lore, 'TestGeometry', 'sphere');
    ph.setFogDistance(currentVariant.resolution * Math.sqrt(3) + 250);
    ph.setPositionsXYZHSS(message.data[0], message.data[1], message.data[2], 0.6, 1.0, 1.0);
    ph.addFilter('hueRange', new Lore.InRangeFilter('color', 0, 0.22, 0.25));

    let oh = new Lore.OctreeHelper(lore, 'OctreeGeometry', 'default', ph, {
      visualize: false
    });

    oh.addEventListener('hoveredchanged', function (e) {
      if (currentLayer !== 0) return;

      if (!e.e) {
        Faerun.hide(bindings.hoverIndicator);
        return;
      }

      updateHovered();

      socketWorker.postMessage({
        cmd: 'load:binpreview',
        msg: {
          databaseId: currentDatabase.id,
          fingerprintId: currentFingerprint.id,
          variantId: currentVariant.id,
          binIndex: e.e.index
        }
      });
    });

    oh.addEventListener('selectedchanged', function (e) {
      if (currentLayer !== 0) return;

      clearSelected();

      for (let i = 0; i < oh.selected.length; i++) {
        let selected = oh.selected[i];
        createSelected(i, selected.index, 0);

        socketWorker.postMessage({
          cmd: 'load:binpreview',
          msg: {
            databaseId: currentDatabase.id,
            fingerprintId: currentFingerprint.id,
            variantId: currentVariant.id,
            binIndex: e.e[i].index
          }
        });
      }
    });

    oh.addEventListener('updated', function () {
      if (oh.hovered) {
        updateHovered();
      }

      if (oh.selected) {
        updateSelected();
      }
    });

    addProjection({
      name: currentDatabase.name,
      color: '#fff',
      pointHelper: ph,
      octreeHelper: oh
    });

    bindings.dataTitle.innerHTML = currentDatabase.name;
    bindings.selectDatabase.parentElement.style.pointerEvents = 'auto';
    Faerun.hide(bindings.loader);

    // Unblock the select elements after loading
    Faerun.unblockElements(bindings.selectDatabase.parentElement, bindings.selectFingerprint.parentElement,
      bindings.selectVariant.parentElement, bindings.selectMap.parentElement);
  }

  function onStatsLoaded(message) {
    Faerun.drawHistogram(bindings.statsCanvas, message.binHist, message.histMax);

    bindings.statsAvg.innerHTML = Faerun.formatNumber(message.avgCompoundCount);
    bindings.statsMin.innerHTML = Faerun.formatNumber(message.histMin);
    bindings.statsMax.innerHTML = Faerun.formatNumber(message.histMax);
    bindings.statsCompounds.innerHTML = Faerun.formatNumber(message.compoundCount);
    bindings.statsBins.innerHTML = Faerun.formatNumber(message.binCount);
  }

  /**
   * Initialiize the color of the point cloud with the data received for the selected map.
   *
   * @param {any} message - The server message containing the map data
   */
  function onMapLoaded(message) {
    for (let i = 0; i < message.data.length; i++) {
      message.data[i] = Faerun.initArrayFromBuffer(message.dataTypes[i], message.data[i]);
    }

    projections[0].pointHelper.setRGB(message.data[0], message.data[1], message.data[2]);

    Faerun.setTitle(currentDatabase.name + ' &middot; ' + currentMap.name);
    bindings.selectMap.parentElement.style.pointerEvents = 'auto';
    Faerun.hide(bindings.loader);

    // Unblock the select elements after loading
    Faerun.unblockElements(bindings.selectDatabase.parentElement, bindings.selectFingerprint.parentElement,
      bindings.selectVariant.parentElement, bindings.selectMap.parentElement);
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

  function knn() {
    if (currentLayer === 0) {
      return;
    }

    let k = parseFloat(bindings.kKNN.value);

    let oh = projections[0].octreeHelper;
    let ph = projections[0].pointHelper;

    let positions = projections[currentLayer].pointHelper.getAttribute('position');

    for (let i = 0; i < ph.geometry.attributes.color.data.length; i++) {
      ph.geometry.attributes.color.data[i * 3 + 2] = -Math.abs(ph.geometry.attributes.color.data[i * 3 + 2]);
    }

    for (let i = 0; i < positions.length; i += 3) {
      let results = oh.octree.kNearestNeighbours(k - 1, {
        x: positions[i],
        y: positions[i + 1],
        z: positions[i + 2]
      }, null, ph.getAttribute('position'));

      for (let j = 0; j < results.length; j++) {
        ph.geometry.attributes.color.data[results[j] * 3 + 2] = Math.abs(ph.geometry.attributes.color.data[results[j] * 3 + 2]);
      }
    }

    ph.geometry.updateAttribute('color');
  }

  function binKnn(binIndex, k) {
    let oh = projections[0].octreeHelper;
    let ph = projections[0].pointHelper;

    let positions = ph.getAttribute('position');
    let index = binIndex * 3;

    return oh.octree.kNearestNeighbours(k - 1, {
      x: positions[index],
      y: positions[index + 1],
      z: positions[index + 2]
    }, null, ph.getAttribute('position'));
  }

  function project() {
    if (!currentVariant) {
      bindings.toastError.MaterialSnackbar.showSnackbar({
        message: 'Please select a variant before projecting ...'
      });
      return;
    }

    let smilesData = bindings.textareaProject.value.split('\n');
    let hsl = Faerun.hex2hsl(bindings.colorpickerDialogProjectInput.value);
    let fingerprints = [];
    let fingerprintSmiles = [];

    if (smilesData.length < 1 || smilesData[0] === '') {
      bindings.toastError.MaterialSnackbar.showSnackbar({
        message: 'Please enter at least one molecule in SMILES form ...'
      });
      return;
    }

    let fingerprintId = currentFingerprint.id.split('.').pop();
    let baseUrl = FaerunConfig.services.fpUrls[fingerprintId];

    // Split smiles into chunks to not overload the fingerprint server
    let chunks = [];

    let chunkSize = 250;
    for (let i = 0, j = smilesData.length; i < j; i += chunkSize) {
      chunks.push(smilesData.slice(i, i + chunkSize));
    }

    let x = [];
    let y = [];
    let z = [];

    let chunkIndex = 0;

    let loadChunk = function (callback) {
      let chunk = chunks[chunkIndex];

      for (let i = 0; i < chunk.length; i++) {
        chunk[i] = chunk[i].trim();
        if (chunk[i] === '') continue;

        let url = Faerun.format(baseUrl, [encodeURIComponent(chunk[i])]);
        let done = 0;

        Faerun.loadFingerprint(url, function (fpRaw, smi) {
          let fp = fpRaw.split(';');

          // Something is wrong when the fp is of length 1
          if (fp.length > 1) {
            for (let j = 0; j < fp.length; j++) fp[j] = parseInt(fp[j]);
            fingerprints.push(fp);
            fingerprintSmiles.push(smi);
          }

          done++;

          if (done === chunk.length) {
            Faerun.loadProjection(FaerunConfig.services.pcaUrl, {
              database: currentDatabase.id,
              fingerprint: fingerprintId,
              dimensions: 3,
              binning: true,
              resolution: currentVariant.resolution,
              data: fingerprints
            }, function (projections) {
              if (!projections.success) {
                bindings.toastError.MaterialSnackbar.showSnackbar({
                  message: 'Oops, something went wrong, please try projecting again ...'
                });
                return;
              }

              let data = projections.data;

              for (let j = 0; j < data.length; j++) {
                x.push(data[j][0]);
                y.push(data[j][1]);
                z.push(data[j][2]);
              }

              // To the next chunk
              bindings.loadingMessage.innerHTML = 'Projecting chunk ' + (chunkIndex + 1) + ' of ' + chunks.length + ' ...';
              if (chunkIndex < chunks.length - 1) {
                chunkIndex++;
                loadChunk(callback);
              } else
                callback();
            });
          }
        });
      }
    };

    loadChunk(function () {
      let ph = new Lore.PointHelper(lore, 'ProjectionGeometry' + projections.length, 'defaultAnimated');
      ph.setFogDistance(currentVariant.resolution * Math.sqrt(3) + 500);
      ph.setPositionsXYZHSS(x, y, z, hsl.h, hsl.s, 1.0);

      let oh = new Lore.OctreeHelper(lore, 'ProjectionOctreeGeometry' + projections.length, 'default', ph);

      let layer = projections.length;

      oh.addEventListener('hoveredchanged', function (e) {
        if (currentLayer !== layer) return;

        if (!e.e) {
          Faerun.hide(bindings.hoverIndicator);
          return;
        }

        let target = 'hover-structure-drawing';
        var data = SmilesDrawer.parse(projections[layer].smiles[e.e.index]);
        smilesDrawer.draw(data, target, 'dark');

        updateHovered(layer);
      });

      addProjection({
        name: bindings.nameDialogProjectInput.value,
        color: bindings.colorpickerDialogProjectInput.value,
        smiles: fingerprintSmiles,
        pointHelper: ph,
        octreeHelper: oh
      });

      Faerun.hide(bindings.loader);
    });
  }

  function loadVariant(variantIndex) {
    currentVariant = currentFingerprint.variants[variantIndex];

    // Block the select elements during loading
    Faerun.blockElements(bindings.selectDatabase.parentElement, bindings.selectFingerprint.parentElement,
      bindings.selectVariant.parentElement, bindings.selectMap.parentElement);

    // Show the loader (blocks the main view)
    bindings.loadingMessage.innerHTML = 'Loading variant ...';
    Faerun.show(bindings.loader);

    socketWorker.postMessage({
      cmd: 'load:variant',
      msg: {
        variantId: currentVariant.id
      }
    });
    populateMaps(currentVariant);
  }

  function loadStats(variantIndex) {
    currentVariant = currentFingerprint.variants[variantIndex];
    socketWorker.postMessage({
      cmd: 'load:stats',
      msg: {
        variantId: currentVariant.id
      }
    });
  }
})();
