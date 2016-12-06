(function () {
  // Globals
  var lore = null;
  var smilesDrawer = null;
  var pointHelper = null;
  var octreeHelper = null;
  var smilesData = null;
  var socketWorker = new Worker('scripts/socketWorkerDetails.js');
  var loader = document.getElementById('loader');

  // Events
  var switchFullscreen = document.getElementById('switch-fullscreen');
  switchFullscreen.addEventListener('change', function () {
    if (switchFullscreen.checked) {
      Faerun.launchIntoFullscreen(document.documentElement);
    } else {
      Faerun.exitFullscreen();
    }
  }, false);

  var labelSwitchColor = document.getElementById('label-switch-color');
  var switchColor = document.getElementById('switch-color');
  switchColor.addEventListener('change', function () {
    if (switchColor.checked) {
      labelSwitchColor.innerHTML = 'Light Background';
      lore.setClearColor(Lore.Color.fromHex('#DADFE1'));
    } else {
      labelSwitchColor.innerHTML = 'Dark Background';
      lore.setClearColor(Lore.Color.fromHex('#1E1E1E'));
    }
  }, false);

  // Socket.IO communication
  document.addEventListener('DOMContentLoaded', function (event) {
    lore = Lore.init('lore', {
      clearColor: '#212121'
    });
    smilesDrawer = new SmilesDrawer();

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
        var coords = Faerun.getCoords(message.data.coords, 250);
        smilesData = message.data.smiles;
        updateCoordinatesHelper(coords.scale);

        pointHelper = new Lore.PointHelper(lore, 'TestGeometry', 'sphere', {
          pointScale: 10
        });
        pointHelper.setFogDistance(coords.scale * Math.sqrt(3) * 2 + 400);
        console.log(coords.x, coords.y, coords.z);
        pointHelper.setPositionsXYZColor(coords.x, coords.y, coords.z, new Lore.Color.fromHex('#8BC34A'));
        octreeHelper = new Lore.OctreeHelper(lore, 'OctreeGeometry', 'default', pointHelper);

        initMoleculeList();
      }
    };
  });

  // Helpers

  /**
   * Initializes the list of molecules.
   */
  function initMoleculeList() {
    var container = document.getElementById('molecules');
    for (var i = 0; i < smilesData.length; i++) {
      var smile = smilesData[i].trim();
      var molecule = document.createElement('div');
      var structure = document.createElement('canvas');
      var image = document.createElement('div');

      molecule.classList.add('molecule');
      structure.classList.add('structure-view');
      structure.width = 250;
      structure.height = 250;

      image.classList.add('structure-view');
      image.id = 'structure-view-image' + i;

      structure.id = 'structure-view' + i;
      var p = document.createElement('p');
      p.innerHTML = smile;

      molecule.appendChild(structure);
      molecule.appendChild(image);
      molecule.appendChild(p);

      image.style.backgroundImage = 'url(\'' + Faerun.getSchemblStructure(smile) + '\')';
      container.appendChild(molecule);
      var data = smiles.parse(smile);
      smilesDrawer.draw(data, structure.id, false);
    }
  }

  /**
   * Update the coordinates according to the data.
   *
   * @param {Number} size - The size of the x, y and z coordinate axis
   */
  function updateCoordinatesHelper(size) {
    var coordinatesHelper = new Lore.CoordinatesHelper(lore, 'Coordinates', 'coordinates', {
      position: new Lore.Vector3f(0, 0, 0),
      axis: {
        x: {
          length: size,
          color: Lore.Color.fromHex('#097692')
        },
        y: {
          length: size,
          color: Lore.Color.fromHex('#097692')
        },
        z: {
          length: size,
          color: Lore.Color.fromHex('#097692')
        }
      },
      ticks: {
        x: {
          length: 10,
          color: Lore.Color.fromHex('#097692')
        },
        y: {
          length: 10,
          color: Lore.Color.fromHex('#097692')
        },
        z: {
          length: 10,
          color: Lore.Color.fromHex('#097692')
        }
      },
      box: {
        enabled: false,
        x: {
          color: Lore.Color.fromHex('#004F6E')
        },
        y: {
          color: Lore.Color.fromHex('#004F6E')
        },
        z: {
          color: Lore.Color.fromHex('#004F6E')
        }
      }
    });

    var halfSize = size / 2.0;
    lore.controls.setRadius(size * Math.sqrt(3) + 100);
    lore.controls.setLookAt(new Lore.Vector3f(halfSize, halfSize, halfSize));
  }
})();
