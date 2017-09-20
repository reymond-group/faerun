(function () {
  // Globals
  let lore = null;
  let smilesDrawer = null;
  let smilesDrawerBig = null;
  let coords = [];
  let smilesData = [];
  let idsData = [];
  let databaseLinks = {};
  let schemblIdToId = {};
  let idToSchemblId = {};
  let center = null;
  let projections = [];
  let selectIndicators = [];
  let selectCanvas = {};
  let selectSmiles = {};
  let treeWorker = new Worker('libs/kmst/kmst-worker.js');
  let socketWorker = new Worker('scripts/socketWorker.js');
  let params = Faerun.parseUrlParams();
  let binColor = params.hue ? parseFloat(params.hue, 10) : 0.8;
  let csv = '';
  let viewAllInitialized = false;
  let selected = null;

  let bindings = Faerun.getBindings();

  // Events
  bindings.switchColor.addEventListener('change', function () {
    if (bindings.switchColor.checked) {
      lore.setClearColor(Lore.Color.fromHex('#DADFE1'));
    } else {
      lore.setClearColor(Lore.Color.fromHex('#121212'));
    }
  }, false);

  $('#download-csv').click(function () {
    let blob = new Blob([csv], {
      type: 'text/plain;charset=utf-8'
    });

    saveAs(blob, 'faerun_export_' + params.variantId + '.csv');
  });

  $('#button-all-compounds').click(function () {
    if (!viewAllInitialized) {
      setTimeout(function () {
        for (var i = 0; i < smilesData.length; i++) {
          let smiles = smilesData[i];
          let compoundWrapper = document.createElement('div');
          let compoundInfo = document.createElement('div');
          let canvas = document.createElement('canvas');
          let container = $('#compounds-container');

          compoundWrapper.classList.add('compound-wrapper');
          compoundInfo.classList.add('compound-info');
          compoundInfo.setAttribute('data-schemblid', idToSchemblId[i]);
          canvas.setAttribute('id', 'canvas-' + i);
          compoundWrapper.appendChild(canvas);
          compoundWrapper.appendChild(compoundInfo);
          container.append(compoundWrapper);

          Faerun.hover(compoundInfo, function () {
            $(compoundInfo).empty();

            let schemblId = compoundInfo.getAttribute('data-schemblid');
            let databases = databaseLinks[schemblId];

            compoundInfo.innerHTML += '<p>' + schemblId + '</p>';

            if (databases) {
              for (var i = 0; i < databases.length; i++) {
                let database = databases[i];
                let a = document.createElement('a');

                a.innerHTML = database.name;
                a.setAttribute('href', database.url);

                compoundInfo.appendChild(a);
              }
            } else {
              compoundInfo.innerHTML = 'Could not load remote info for ' + schemblId;
            }

            compoundInfo.classList.add('visible');
          }, function () {
            compoundInfo.classList.remove('visible');
          });

          SmilesDrawer.parse(smiles, function (tree) {
            smilesDrawerBig.draw(tree, 'canvas-' + i, 'light');
          });
        }
      }, 1000);
    }

    viewAllInitialized = true;
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
    smilesDrawer = new SmilesDrawer.Drawer({
      width: 180,
      height: 180
    });

    smilesDrawerBig = new SmilesDrawer.Drawer({
      width: 250,
      height: 250
    });


    // Show the loader from the beginning until everything is loaded
    bindings.loadingMessage.innerHTML = 'Loading geometry ...';
    Faerun.show(bindings.loader);

    treeWorker.onmessage = function (e) {
      treeHelper = new Lore.TreeHelper(lore, 'TreeGeometry', 'tree');
      treeHelper.setFogDistance(0, coords.scale * Math.sqrt(3));
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

      treeHelper.setPositionsXYZHSS(x, y, z, binColor, 0.25, 1.0);
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

    // Create the csv
    csv = 'binIndex;id;smiles;x;y;z\n';

    for (var i = 0; i < message.smiles.length; i++) {
      let xyz = message.coordinates[i].split(',');

      csv += message.binIndices[i] + ';' + message.ids[i] + ';' +
        message.smiles[i] + ';' + xyz[0] + ';' + xyz[1] + ';' + xyz[2] + '\n';
    }

    csv = csv.substring(0, csv.length);

    lore = Lore.init('lore', {
      clearColor: '#121212',
      limitRotationToHorizon: true,
      antialiasing: true
    });

    Faerun.initViewSelect(bindings.selectView, lore);

    // Setup the coordinate system
    var cs = Faerun.updateCoordinatesHelper(lore, coords.scale, 0, true, false);

    // Add a bit of randomness to the coords to resolve overlaps
    for (var i = 0; i < coords.x.length; i++) {
      coords.x[i] += (Math.random() - 0.5) * 10;
      coords.y[i] += (Math.random() - 0.5) * 10;
      coords.z[i] += (Math.random() - 0.5) * 10;
    }

    // The tree
    var tmpArr = [];

    for (var i = 0; i < coords.x.length; i++) {
      tmpArr.push([coords.x[i], coords.y[i], coords.z[i]]);
    }

    treeWorker.postMessage(tmpArr);

    let pointHelper = new Lore.PointHelper(lore, 'TestGeometry', 'sphere', {
      pointScale: 10
    });

    pointHelper.setFogDistance(0, coords.scale * Math.sqrt(3));
    pointHelper.setPositionsXYZHSS(coords.x, coords.y, coords.z, binColor, 0.3, 1.0);

    let firstBinIndex = parseInt(params.binIndex.split(',')[0], 10);
    for (var i = 0; i < coords.x.length; i++) {
      if (message.binIndices[i] === firstBinIndex) {
        pointHelper.updateColor(i, new Lore.Color(binColor, 1.0, 1.0));
      }
    }

    let octreeHelper = new Lore.OctreeHelper(lore, 'OctreeGeometry', 'default', pointHelper, {multiSelect: false});

    octreeHelper.addEventListener('hoveredchanged', function (e) {
      if (!e.e) {
        Faerun.hide(bindings.hoverIndicator);

        if (selected) {
          updatePanel(selected.index);
        }

        return;
      }

      updateHovered();
    });

    octreeHelper.addEventListener('selectedchanged', function (e) {
      if (!e.e) {
        Faerun.hide(bindings.hoverIndicator);
        return;
      }

      selected = e.e[0];

      updateSelected();
    });

    octreeHelper.addEventListener('updated', function () {
      if (octreeHelper.hovered) {
        updateHovered();
      }

      if (selected) {
        updateSelected();
      }
    });

    projections.push({
      name: 'main',
      color: '#fff',
      pointHelper: pointHelper,
      octreeHelper: octreeHelper
    });

    bindings.loadingMessage.innerHTML = 'Loading remote info ...';
    initMoleculeList();
  }

  /**
   * Initializes the list of molecules.
   */
  function initMoleculeList() {
    let length = smilesData.length;

    for (var i = 0; i < smilesData.length; i++) {
      let smile = smilesData[i].trim();
      let schemblIds = idsData[i].trim();

      // Only take the first one for now
      let schemblId = schemblIds.split('_')[0];
      let schemblUrl = Faerun.schemblUrl + idsData[i].trim();
      let structureViewId = 'structure-view' + i;

      schemblIdToId[schemblId] = i;
      idToSchemblId[i] = schemblId;

      $.ajax({
        url: Faerun.schemblIdsUrl(schemblId),
        jsonp: 'callback',
        dataType: 'jsonp',
        data: {},
        success: function (response) {
          // Recover schembl id
          let id = '';

          for (var k = 0; k < response.length; k++) {
            if (parseInt(response[k].src_id, 10) === 15) {
              id = response[k].src_compound_id;
              break;
            }
          }

          let items = [];

          for (var k = 0; k < response.length; k++) {
            let srcId = response[k].src_id;
            let srcInfo = FaerunConfig.schembl.sources[srcId];

            if(!srcInfo) {
              continue;
            }

            items.push({
              id: response[k].src_compound_id,
              name: srcInfo.name_label,
              url: srcInfo.base_id_url + response[k].src_compound_id
            });
          }

          databaseLinks[id] = items;
        },
        complete: function () {
          if (--length === 0) {
            // Hide loader here, since this is the closest to fully
            // loaded we get :-)
            Faerun.hide(bindings.loader);
          }
        }
      });
    }
  }

  /**
   * Update all HTML elements representing selected bins.
   */
  function updateSelected() {
    let pointSize = projections[0].pointHelper.getPointSize();
    let screenPosition = projections[0].octreeHelper.getScreenPosition(selected.index);

    Faerun.positionIndicator(bindings.selectIndicator, pointSize, screenPosition[0], screenPosition[1]);

    Faerun.show(bindings.selectIndicator);
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

    let index = projections[layer].octreeHelper.hovered.index;

    updatePanel(index);
  }

  function updatePanel(index) {
    let smiles = smilesData[index];
    let schemblId = idToSchemblId[index];

    SmilesDrawer.parse(smiles, function (tree) {
      smilesDrawer.draw(tree, 'hover-structure-drawing', 'dark');
    });

    bindings.infoSmiles.innerHTML = smiles;

    $(bindings.infoDatabases).empty();

    let databases = databaseLinks[schemblId];

    if (databases) {
      for (var i = 0; i < databases.length; i++) {
        let database = databases[i];
        let a = document.createElement('a');

        a.innerHTML = database.name;
        a.setAttribute('href', database.url);

        bindings.infoDatabases.appendChild(a);
      }
    } else {
      let info = document.createElement('p');

      info.classList.add('info');
      info.innerHTML = 'Could not load remote info for ' + schemblId;
    }
  }
})();
