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
  let selectedBins = [];
  let socketWorker = new Worker('scripts/socketWorker.js');

  let bindings = Faerun.getBindings();

  // Events
  bindings.switchColor.addEventListener('change', function () {
    if (bindings.switchColor.checked) {
      lore.setClearColor(Lore.Color.fromHex('#DADFE1'));
    } else {
      lore.setClearColor(Lore.Color.fromHex('#121212'));
    }
  }, false);

  $(bindings.selectDatabase).on('change', function () {
    currentDatabase = config.databases[bindings.selectDatabase.value];
    populateFingerprints(currentDatabase);
  });

  $(bindings.selectFingerprint).on('change', function () {
    currentFingerprint = currentDatabase.fingerprints[bindings.selectFingerprint.value];
    populateVariants(currentFingerprint);
  });

  $(bindings.selectVariant).on('change', function () {
    loadStats(bindings.selectVariant.value);
    loadVariant(bindings.selectVariant.value);
  });

  $(bindings.selectMap).on('change', function () {
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
  });

  $('#download-bins').click(function() {
    socketWorker.postMessage({
      cmd: 'load:bin',
      msg: {
        databaseId: currentDatabase.id,
        fingerprintId: currentFingerprint.id,
        variantId: currentVariant.id,
        binIndex: selectedBins.join()
      }
    });
  });

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

    bindings.loadingMessage.innerHTML = 'Searching ...';
    Faerun.show(bindings.loader);
  });

  // Project
  bindings.buttonExecProject.addEventListener('click', function () {
    bindings.loadingMessage.innerHTML = 'Projecting ...';
    Faerun.hide(bindings.loader);

    project();

    Faerun.hide(bindings.loader);
  });

  // KNN
  bindings.buttonExecKNN.addEventListener('click', function () {
    knn();
  });

  /**
   * Populates the HTMLSelectElement containing the databases available on the server.
   */
  function populateDatabases() {
    Faerun.removeChildren(bindings.selectDatabase);
    Faerun.appendOption(bindings.selectDatabase, null, 'Select a database');

    for (let i = 0; i < config.databases.length; i++) {
      let database = config.databases[i];

      Faerun.appendOption(bindings.selectDatabase, i, database.name);
    }

    $(bindings.selectDatabase).material_select();
  }

  /**
   * Populate the fingerprint select element with the fingerprints contained in 'database'.
   *
   * @param {Database} database - A database configuration item
   */
  function populateFingerprints(database) {
    Faerun.removeChildren(bindings.selectFingerprint);
    Faerun.appendOption(bindings.selectFingerprint, null, 'Select a fingerprint');

    for (let i = 0; i < database.fingerprints.length; i++) {
      let fingerprint = database.fingerprints[i];

      Faerun.appendOption(bindings.selectFingerprint, i, fingerprint.name);
    }

    $(bindings.selectFingerprint).material_select();
  }

  /**
   * Populate the variant select element with the varants contained in 'fingerprint'.
   *
   * @param {Fingerprint} fingerprint - A fingerprint configuration item
   */
  function populateVariants(fingerprint) {
    Faerun.removeChildren(bindings.selectVariant);
    Faerun.appendOption(bindings.selectVariant, null, 'Select a variant');

    for (let i = 0; i < fingerprint.variants.length; i++) {
      let variant = fingerprint.variants[i];

      Faerun.appendOption(bindings.selectVariant, i, variant.name);
    }

    $(bindings.selectVariant).material_select();

    if (fingerprint.variants.length === 1) {
      bindings.selectVariant.value = 0;
      loadStats(0);
      loadVariant(0);
    }

    // Also clear maps
    Faerun.removeChildren(bindings.selectMap);
    Faerun.appendOption(bindings.selectMap, null, 'Select a map');
    $(bindings.selectMap).material_select();
  }

  /**
   * Populate the map select element with the maps contained in 'variant'.
   *
   * @param {Variant} variant - A variant configuration item
   */
  function populateMaps(variant) {
    Faerun.removeChildren(bindings.selectMap);
    Faerun.appendOption(bindings.selectMap, null, 'Select a map');

    for (let i = 0; i < variant.maps.length; i++) {
      let map = variant.maps[i];

      Faerun.appendOption(bindings.selectMap, i, map.name);
    }

    $(bindings.selectMap).material_select();
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

  function setMainProjection(projection) {
    if (projections[0]) {
      projections[0].octreeHelper.destruct();
    }

    projections[0] = projection;
    updateLayers();
  }

  /**
   * Create an HTML element with index 'idx' representing the bin specified by 'id'.
   *
   * @param {Number} idx - The index for the selected element
   * @param {Number} id - The id of the bin / point
   * @param {Number} layer - A layer id.
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
      hue: hue,
      color: 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', 0.5)'
    });

    let structure = document.getElementById('selected-structure-' + layer + '-' + id);
    let item = document.getElementById('selected-bin-item-' + layer + '-' + id);
    let closer = document.getElementById('bin-closer-' + layer + '-' + id);
    let center = document.getElementById('bin-center-' + layer + '-' + id);

    selectCanvas[layer + '-' + id] = structure;

    Faerun.hover(item, function () {
      SmilesDrawer.parse(selectSmiles[layer + '-' + id], function(tree) {
        smilesDrawer.draw(tree, 'hover-structure-drawing', 'dark');
      });

      document.getElementById('hover-bin-size').innerHTML = document.getElementById('select-bin-size-0-' + id).innerHTML;
    }, function () {
      Faerun.clearCanvas('hover-structure-drawing');
      document.getElementById('hover-bin-size').innerHTML = '-';
    });

    item.addEventListener('click', function (e) {
      let indices = id;

      let nCompounds = parseFloat(document.getElementById('select-bin-size-0-' + id).innerHTML);
      if (nCompounds < 10) {
        let nearestNeighbours = binKnn(id, 26);

        for (var i = 1; i < nearestNeighbours.length; i++) {
          indices += ',' + nearestNeighbours[i];
        }
      }

      window.open('details.html?binIndex=' + indices +
                  '&databaseId=' + currentDatabase.id +
                  '&fingerprintId=' + currentFingerprint.id +
                  '&variantId=' + currentVariant.id +
                  '&hue=' + item.getAttribute('data-hue'), '_blank');
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


    let indicator = document.createElement('div');

    indicator.classList.add('select-indicator');
    indicator.setAttribute('id', 'selected-indicator-' + layer + '-' + id);
    indicator.setAttribute('data-badge', idx);
    indicator.setAttribute('data-item', item.getAttribute('id'));

    let pointSize = projections[0].pointHelper.getPointSize();

    selectIndicators.push(indicator);
    document.body.appendChild(indicator);

    item.addEventListener('mouseenter', function(e) {
      $('.select-indicator').removeClass('current');
      $('#select-container .item').removeClass('current');
      $(this).addClass('current');
      $(indicator).addClass('current');
    });

    indicator.addEventListener('mouseenter', function(e) {
      var item = $('#' + $(this).attr('data-item'));
      var scrollContainer = $('#select-container').parent();

      $('#select-container .item').removeClass('current');
      $('.select-indicator').removeClass('current');
      $(this).addClass('current');
      item.addClass('current');
      scrollContainer.animate({scrollTop: (item.offset().top - item.offsetParent().offset().top) + 'px'}, 200);
    });

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
   *
   * @param {Number} layer - A layer ID.
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
    lore = Lore.init('lore', {
      clearColor: '#121212'
    });

    smilesDrawer = new SmilesDrawer.Drawer({width: 180, height: 180});
    smallSmilesDrawer = new SmilesDrawer.Drawer({width: 48, height: 48, atomVisualization: 'balls'});

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
      else if (e.data.cmd === 'load:bin')
        onBinLoaded(e.data.msg);
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

    let ph = new Lore.PointHelper(lore, 'MainGeometry', 'sphere');

    ph.setFogDistance(0, currentVariant.resolution * Math.sqrt(3));
    ph.setPositionsXYZHSS(message.data[0], message.data[1], message.data[2], 0.6, 1.0, 1.0);
    ph.addFilter('hueRange', new Lore.InRangeFilter('color', 0, 0.22, 0.25));

    let oh = new Lore.OctreeHelper(lore, 'OctreeGeometry', 'default', ph, {
      visualize: false
    });

    oh.addEventListener('hoveredchanged', function (e) {
      if (currentLayer !== 0) return;

      if (!e.e || projections[currentLayer].octreeHelper.hovered === null) {
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
      selectedBins = [];

      for (let i = 0; i < oh.selected.length; i++) {
        let selected = oh.selected[i];

        createSelected(i, selected.index, 0);
        selectedBins.push(selected.index);

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

    setMainProjection({
      name: currentDatabase.name,
      color: '#fff',
      pointHelper: ph,
      octreeHelper: oh
    });

    // Remove selected from previous variant
    clearSelected();

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

  function onBinLoaded(message) {
    let output = 'binIndex;id;smiles;x;y;z\n';

    for (var i = 0; i < message.smiles.length; i++) {
      let coords = message.coordinates[i].split(',');

      output += message.binIndices[i] + ';' + message.ids[i] + ';' +
        message.smiles[i] + ';' + coords[0] + ';' + coords[1] + ';' + coords[2] + '\n';
    }

    output = output.substring(0, output.length);

    let blob = new Blob([output], {type: 'text/plain;charset=utf-8'});
    saveAs(blob, 'faerun_export_' + currentVariant.id + '.csv');
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

    // Hide the sidenav once the map is loaded
    $('.button-toggle-nav').sideNav('hide');
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
      $('#select-bin-size-0-' + message.index).html(message.binSize);
      sd = smallSmilesDrawer;
    } else {
      $('#hover-bin-size').html(message.binSize);
    }

    SmilesDrawer.parse(message.smiles, function(tree) {
      sd.draw(tree, target, 'dark');
    });
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
      Materialize.toast('Projection failed: No variant selected.', 5000, 'toast-error');
      return;
    }

    let smilesData = bindings.textareaProject.value.split('\n');
    let hsl = Faerun.hex2hsl(bindings.colorpickerDialogProjectInput.value);
    let fingerprints = [];
    let fingerprintSmiles = [];

    if (smilesData.length < 1 || smilesData[0] === '') {
      Materialize.toast('Projection failed: No SMILES were provided.', 5000, 'toast-error');
      return;
    }

    let fingerprintId = currentFingerprint.id.split('.').pop();
    let baseUrl = FaerunConfig.services.fpUrls[fingerprintId];

    // Split smiles into chunks to not overload the fingerprint server
    let chunks = [];

    let chunkSize = 25;
    for (let i = 0, j = smilesData.length; i < j; i += chunkSize) {
      chunks.push(smilesData.slice(i, i + chunkSize));
    }

    let x = [];
    let y = [];
    let z = [];

    let chunkIndex = 0;

    let loadChunk = function (callback) {
      let chunk = chunks[chunkIndex];
      let done = 0;
      let smis = '';

      for (let i = 0; i < chunk.length; i++) {
        smis += chunk[i].trim() + ';';
      }

      smis = smis.substring(0, smis.length - 1);

      let url = Faerun.format(baseUrl, [encodeURIComponent('dummy')]);

      Faerun.loadFingerprint(url.split('?')[0], baseUrl.split('=')[2], smis, function (fpsRaw, smi) {
        for (var i = 0; i < fpsRaw.length; i++) {
          let fp = fpsRaw[i].split(';');

          // Something is wrong when the fp is of length 1
          if (fp.length > 1) {
            for (let j = 0; j < fp.length; j++) {
              fp[j] = parseInt(fp[j], 10);
            }

            fingerprints.push(fp);
            fingerprintSmiles.push(smi[i]);
          }
        }

        Faerun.loadProjection(FaerunConfig.services.pcaUrl, {
          database: currentDatabase.id,
          fingerprint: fingerprintId,
          dimensions: 3,
          binning: true,
          resolution: currentVariant.resolution,
          data: fingerprints
        }, function (projections) {
          if (!projections.success) {
            Materialize.toast('Projection failed: Unknown server error.', 5000, 'toast-error');
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
      });
    };

    loadChunk(function () {
      let ph = new Lore.PointHelper(lore, 'ProjectionGeometry' + projections.length, 'defaultAnimated');
      ph.setFogDistance(0, currentVariant.resolution * Math.sqrt(3));
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

        SmilesDrawer.parse(projections[layer].smiles[e.e.index], function(tree) {
          smilesDrawer.draw(tree, target, 'dark');
        });

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
