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
    var config = null;
    var params = Faerun.parseUrlParams();
    var coords = null;
    var sourceInfos = {};
    var sources = {};
    var schemblIdToId = {};
    var socketWorker = new Worker('scripts/socketWorker.js');
    var treeWorker = new Worker('libs/kmst/kmst-worker.js');

    var bindings = Faerun.getBindings();
    console.log(bindings);

    // Events
    bindings.switchColor.addEventListener('change', function () {
        if (bindings.switchColor.checked) {
            bindings.labelSwitchColor.innerHTML = 'Light Background';
            lore.setClearColor(Lore.Color.fromHex('#DADFE1'));
        } else {
            bindings.labelSwitchColor.innerHTML = 'Dark Background';
            lore.setClearColor(Lore.Color.fromHex('#121212'));
        }
    }, false);

    Faerun.clickClass('more', function (e) {
        var moreContainer = document.getElementById(e.target.getAttribute('data-target'));
        Faerun.toggle(moreContainer);
    });

    Faerun.hoverClass('structure-view', function (e) {
        var index = e.target.getAttribute('data-index');
        console.log(index);
        console.log('Hovered!');
    }, function (e) {

    });

    // Socket.IO communication
    document.addEventListener('DOMContentLoaded', function (event) {
        Faerun.initFullscreenSwitch(bindings.switchFullscreen);

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
    }

    /**
     * Update the hover indicator and the associated compound card.
     */
    function updateHovered() {
        var pointSize = pointHelper.getPointSize();

        Faerun.positionIndicator(bindings.hoverIndicator, pointSize, 
                                 octreeHelper.hovered.screenPosition[0], 
                                 octreeHelper.hovered.screenPosition[1]);

        Faerun.show(bindings.hoverIndicator);

        var molecule = document.getElementById('mol' + octreeHelper.hovered.index);
        bindings.molecules.scrollTop = molecule.offsetTop;
        Faerun.removeClasses('.molecule', ['highlight']);
        Faerun.addClasses('.molecule', ['dimmed']);
        Faerun.addClasses(molecule, ['highlight']);
        Faerun.removeClasses(molecule, ['dimmed']);
    }

    /**
     * Initializes the list of molecules.
     */
    function initMoleculeList() {
        for (var i = 0; i < smilesData.length; i++) {
            var smile = smilesData[i].trim();
            var schemblIds = idsData[i].trim();
            // Only take the first one for now
            var schemblId = schemblIds.split('_')[0];

            var schemblUrl = Faerun.schemblUrl + idsData[i].trim();
            var structureViewId = 'structure-view' + i;

            schemblIdToId[schemblId] = i;

            Faerun.appendTemplate(bindings.molecules, 'molecule-template', {
                id: i,
                compoundId: schemblId,
                schemblUrl: schemblUrl,
                showMap: smilesData.length > 2
            });

            var data = smiles.parse(smile);

            smilesDrawer.draw(data, structureViewId, 'light');

            sources[schemblId] = [];

            JSONP.get(Faerun.schemblIdsUrl(schemblId), function (data) {
                // Recover schembl id
                var id = '';
                var k = 0;
                for (k = 0; k < data.length; k++) {
                    if (parseInt(data[k].src_id, 10) === 15) {
                        id = data[k].src_compound_id;
                        break;
                    }
                }

                var items = [];
                for (k = 0; k < data.length; k++) {
                    var srcId = data[k].src_id;
                    var srcInfo = sourceInfos[srcId];
                    sources[id].push(srcId);
                    items.push({
                        id: data[k].src_compound_id,
                        name: srcInfo.name_label,
                        url: srcInfo.base_id_url + data[k].src_compound_id
                    });
                }

                var moreContainer = document.getElementById('structure-more' + schemblIdToId[id]);
                Faerun.appendTemplate(moreContainer, 'more-template', {
                    items: items
                });
            });
        }
    }
})();
