(function () {
  // Globals
  var lore = null;
  var smilesDrawer = null;
  var pointHelper = null;
  var treeHelper = null;
  var octreeHelper = null;
  var coordinatesHelper = null;
  var smilesData = null;
  var idsData = null;
  var coords = null;
  var sourceInfos = {};
  var sources = {};
  var socketWorker = new Worker('scripts/socketWorkerDetails.js');
  var treeWorker = new Worker('libs/kmst/kmst-worker.js');

  var bindings = Faerun.getBindings();

  // Events
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

  // Socket.IO communication
  document.addEventListener('DOMContentLoaded', function (event) {
    smilesDrawer = new SmilesDrawer();

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
      var message = e.data.message;

      if (cmd === 'initresponse') {
        var params = Faerun.parseUrlParams();
        socketWorker.postMessage({
          cmd: 'loaddetails',
          message: {
            set_id: params.set_id,
            index: params.index
          }
        });
      } else if (cmd === 'loaddetailsresponse') {
        coords = Faerun.getCoords(message.data.coords, 250);
        smilesData = message.data.smiles;
        idsData = message.data.ids;
        console.log(message);

        if (message.data.size > 2) {
          lore = Lore.init('lore', {
            clearColor: '#121212'
          });

          // Setup the coordinate system
          var cs = Faerun.updateCoordinatesHelper(lore, coords.scale);
          coordinatesHelper = cs.helper;

          // The tree
          var tmpArr = [];
          for (var i = 0; i < coords.x.length; i++) {
            tmpArr.push([coords.x[i], coords.y[i], coords.z[i]]);
          }

          treeWorker.postMessage(tmpArr);

          pointHelper = new Lore.PointHelper(lore, 'TestGeometry', 'sphere', {
            pointScale: 10,
            octreeThreshold: 1
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

          octreeHelper.addEventListener('updated', function() {
            if (octreeHelper.hovered) updateHovered();
            // if (octreeHelper.selected) updateSelected();
          });
        } else {
          Faerun.removeElement(bindings.loreCell);
          Faerun.removeClasses(bindings.moleculeCell, ['mdl-cell--6-col-desktop', 'mdl-cell--4-col-tablet', 'mdl-cell--4-col-phone']);
          Faerun.addClasses(bindings.moleculeCell, ['mdl-cell--12-col-desktop', 'mdl-cell--8-col-tablet', 'mdl-cell--8-col-phone']);
        }


        JSONP.get(Faerun.sourceIdsUrl, function(srcIds) {
          var length = srcIds.length;

          for (var i = 0; i < srcIds.length; i++) {
            JSONP.get(Faerun.sourceInformationUrl(srcIds[i].src_id), function(sourceData) {
              sourceInfos[sourceData[0].src_id] = sourceData;
              if (--length === 0) {
                initMoleculeList();
              }
            });
          }
        });
      }
    };
  });

  // Helpers
  function updateHovered() {
    Faerun.show(bindings.hoverIndicator);
    Faerun.translateAbsolute(bindings.hoverIndicator, octreeHelper.hovered.screenPosition[0], octreeHelper.hovered.screenPosition[1], true);
    var pointSize = pointHelper.getPointSize();
    Faerun.resize(bindings.hoverIndicator, pointSize, pointSize);

    var molecule = document.getElementById('mol' + octreeHelper.hovered.index);
    bindings.molecules.scrollTop = molecule.offsetTop;
    Faerun.removeClasses('.molecule', ['highlight']);
    Faerun.addClasses('.molecule', ['dimmed']);
    Faerun.addClasses(molecule, ['highlight']);
    Faerun.removeClasses(molecule, ['dimmed']);

    console.log(sources);
  }

  /**
   * Initializes the list of molecules.
   */
  function initMoleculeList() {
    for (var i = 0; i < smilesData.length; i++) {
      var smile = smilesData[i].trim();
      var schemblIds = idsData[i].trim();
      var schemblUrl = Faerun.schemblUrl + idsData[i].trim();
      var structureViewId = 'structure-view' + i;

      var schemblIdsSplit = schemblIds.split(';');

      for (var j = 0; j < schemblIdsSplit.length; j++) {
        var schemblId = schemblIdsSplit[j];
        sources[schemblId] = [];
        JSONP.get(Faerun.schemblIdsUrl(schemblId), function(data) {
          // Recover schembl id
          var id = '';
          for (var k = 0; k < data.length; k++) {
            if (parseInt(data[k].src_id, 10) === 15) {
              id = data[k].src_compound_id;
              break;
            }
          }

          for (var k = 0; k < data.length; k++) {
            var srcId = data[k].src_id;
            var srcInfo = sourceInfos[srcId];
            sources[id].push(srcId);
          }
        });
      }

      Faerun.appendTemplate(bindings.molecules, 'molecule-template', {
        id: i,
        compoundId: schemblIds,
        schemblUrl: schemblUrl
      });

      var data = smiles.parse(smile);
      smilesDrawer.draw(data, structureViewId, false, true);
    }
  }
})();
