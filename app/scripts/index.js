(function () {
    // Globals
    var lore = null;
    var smilesDrawer = null;
    var coordinatesHelper = null;
    var config = null;
    var currentDatabase = null;
    var currentFingerprint = null;
    var currentVariant = null;
    var currentMap = null;
    var center = null;
    var projections = [];
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
        currentVariant = currentFingerprint.variants[bindings.selectVariant.value];

        // Block the select elements during loading
        Faerun.blockElements(bindings.selectDatabase.parentElement, bindings.selectFingerprint.parentElement,
                bindings.selectVariant.parentElement, bindings.selectMap.parentElement);

        // Show the loader (blocks the main view)
        Faerun.show(bindings.loader);

        socketWorker.postMessage({
            cmd: 'load:variant',
            msg: {
                variantId: currentVariant.id
            }
        });
        populateMaps(currentVariant);
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
        Faerun.show(bindings.loader);
    }, false);


    bindings.sliderCutoff.addEventListener('input', function () {
        projections[0].pointHelper.setCutoff(bindings.sliderCutoff.value);
    });

    bindings.sliderColor.addEventListener('input', function () {
        var val = parseFloat(bindings.sliderColor.value);
        var filter = projections[0].pointHelper.getFilter('hueRange');

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

    bindings.buttonSearch.addEventListener('click', function() {
        bindings.dialogSearch.showModal();
    });

    bindings.dialogSearch.querySelector('.close').addEventListener('click', function() {
        bindings.dialogSearch.close();
    });

    bindings.buttonExecSearch.addEventListener('click', function() {
        if (!currentVariant) {
            bindings.toastError.MaterialSnackbar.showSnackbar({
                message: 'Please select a variant before searching ...'
            });
            return; 
        }

        var queries = bindings.textareaSearch.value.split('\n');
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
        Faerun.show(bindings.loader);
    });

    // Project
    if (!bindings.dialogProject.showModal) {
        dialogPolyfill.registerDialog(bindings.dialogProject)
    }

    bindings.buttonProject.addEventListener('click', function() {
        bindings.dialogProject.showModal();
    });

    bindings.dialogProject.querySelector('.close').addEventListener('click', function() {
        bindings.dialogProject.close();
    });

    bindings.buttonExecProject.addEventListener('click', function() {
        project();

        bindings.dialogProject.close();
        // Faerun.show(bindings.loader);
    });

    // KNN
    bindings.buttonKNN.addEventListener('click', function() {
        var oh = projections[0].octreeHelper;
        var ph = projections[0].pointHelper;
        var positions = ph.getAttribute('position');
        var results = oh.octree.kNearestNeighbours(500, { x: 100, y: 100, z: 100 }, null, positions);
        
        for (var i = 0; i < ph.geometry.attributes['color'].data.length; i++) {
            ph.geometry.attributes['color'].data[i * 3 + 2] = -Math.abs(ph.geometry.attributes['color'].data[i * 3 + 2]);
        }
        
        for (var i = 0; i < results.length; i++) {
            ph.geometry.attributes['color'].data[results[i] * 3 + 2] = Math.abs(ph.geometry.attributes['color'].data[results[i] * 3 + 2]);
        }

        ph.geometry.updateAttribute('color');
    });


    /**
     * Populates the HTMLSelectElement containing the databases available on the server.
     */
    function populateDatabases() {
        Faerun.removeChildren(bindings.selectDatabase);
        Faerun.appendEmptyOption(bindings.selectDatabase);

        for (var i = 0; i < config.databases.length; i++) {
            Faerun.appendOption(bindings.selectDatabase, i, config.databases[i].name);
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

        for (var i = 0; i < database.fingerprints.length; i++) {
            Faerun.appendOption(bindings.selectFingerprint, i, database.fingerprints[i].name);
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
        for (var i = 0; i < fingerprint.variants.length; i++) {
            Faerun.appendOption(bindings.selectVariant, i, fingerprint.variants[i].name);
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
        for (var i = 0; i < variant.maps.length; i++) {
            Faerun.appendOption(bindings.selectMap, i, variant.maps[i].name);
        }
    }

    /**
     * Update the layer list
     */
    function updateLayers() {
        Faerun.removeChildren(bindings.layerContainer);

        for (var i = 0; i < projections.length; i++) {
            var projection = projections[i];
            Faerun.appendTemplate(bindings.layerContainer, 'layer-template', {
                id: i,
                name: projection.name,
                color: projection.color
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
        var selected = projections[0].octreeHelper.selected[idx];
        var hue = projections[0].pointHelper.getHue(id);
        var rgb = Lore.Color.hslToRgb(hue, 1.0, 0.5);
        
        for (var i = 0; i < rgb.length; i++)
            rgb[i] = Math.round(rgb[i] * 255);
        
        Faerun.appendTemplate(bindings.selectContainer, 'selected-bin-template', {
            id: id,
            idx: idx,
            layer: layer,
            color: 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', 0.5)'
        });

        var structure = document.getElementById('selected-structure-' + layer + '-' + id);
        var item = document.getElementById('selected-bin-item-' + layer + '-' + id);
        var closer = document.getElementById('bin-closer-' + layer + '-' + id);

        selectCanvas[layer + '-' + id] = structure;
       
        Faerun.hover(item, function () {
            var data = smiles.parse(selectSmiles[layer + '-' + id]);
            smilesDrawer.draw(data, 'hover-structure-drawing', false);
        }, function () {
            Faerun.clearCanvas('hover-structure-drawing');
        });
        
        item.addEventListener('click', function(e) {
           window.open('details.html?binIndex=' + id + '&databaseId=' + currentDatabase.id + 
                       '&fingerprintId=' + currentFingerprint.id + '&variantId=' + 
                       currentVariant.id, '_blank'); 
        });

        closer.addEventListener('click', function(e) {
            projections[layer].octreeHelper.removeSelected(idx);
            e.stopPropagation();
            e.preventDefault();
        });

        var indicator = document.createElement('span');
        indicator.classList.add('mdl-badge', 'mdl-badge--overlap', 'select-indicator');
        indicator.setAttribute('id', 'selected-indicator-' + layer + '-' + id);
        indicator.setAttribute('data-badge', idx);
        Faerun.translateAbsolute(indicator, selected.screenPosition[0], selected.screenPosition[1], true);
        var pointSize = projections[0].pointHelper.getPointSize();
        Faerun.resize(indicator, pointSize, pointSize);
        selectIndicators.push(indicator);
        bindings.main.appendChild(indicator);
    }

     /**
     * Remove all HTML elements representing selected bins.
     */
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

    /**
     * Update all HTML elements representing selected bins.
     */
    function updateSelected() {
        var pointSize = projections[0].pointHelper.getPointSize();
        for (var i = 0; i < selectIndicators.length; i++) {
            var selected = projections[0].octreeHelper.selected[i];
            var indicator = selectIndicators[i];
            Faerun.translateAbsolute(indicator, selected.screenPosition[0], selected.screenPosition[1], true);
            Faerun.resize(indicator, pointSize, pointSize);
        }
    }

    /**
     * Update the hover indicators.
     */
    function updateHovered() {
        Faerun.show(bindings.hoverIndicator);
        Faerun.translateAbsolute(bindings.hoverIndicator, projections[0].octreeHelper.hovered.screenPosition[0], projections[0].octreeHelper.hovered.screenPosition[1], true);
        var pointSize = projections[0].pointHelper.getPointSize();
        Faerun.resize(bindings.hoverIndicator, pointSize, pointSize);
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
        setTimeout(function() {
            Faerun.toggle(bindings.hudContainer);
            Faerun.toggleClass(bindings.hudHeaderIcon, 'rotate');
        }, 1000);

        lore = Lore.init('lore', {
            clearColor: '#121212'
        });

        smilesDrawer = new SmilesDrawer();

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
        for (var i = 0; i < message.data.length; i++) {
            message.data[i] = Faerun.initArrayFromBuffer(message.dataTypes[i], message.data[i]);
        }

        setCutoffRange(currentVariant.resolution * Math.sqrt(3));

        // Setup the coordinate system
        var cs = Faerun.updateCoordinatesHelper(lore, currentVariant.resolution);
        center = cs.center;
        coordinatesHelper = cs.helper;
        
        

        var ph = new Lore.PointHelper(lore, 'TestGeometry', 'default');
        ph.setFogDistance(currentVariant.resolution * Math.sqrt(3) + 500);
        ph.setPositionsXYZHSS(message.data[0], message.data[1], message.data[2], 0.6, 1.0, 1.0);
        ph.addFilter('hueRange', new Lore.InRangeFilter('color', 0, 0.22, 0.25));

        var oh = new Lore.OctreeHelper(lore, 'OctreeGeometry', 'default', ph, { visualize: false });

        oh.addEventListener('hoveredchanged', function (e) {
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
            clearSelected();
            for (var i = 0; i < oh.selected.length; i++) {
                var selected = oh.selected[i];
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
            if (oh.hovered) updateHovered();
            if (oh.selected) updateSelected();
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

    /**
     * Initialiize the color of the point cloud with the data received for the selected map.
     *
     * @param {any} message - The server message containing the map data
     */
    function onMapLoaded (message) {
        for (var i = 0; i < message.data.length; i++) {
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
    function onBinPreviewLoaded (message) {
        var target = 'hover-structure-drawing';

        if (selectCanvas.hasOwnProperty('0-' + message.index)) {
            // Smiles are only loaded from 0 layer (the one loaded from the server)
            target = 'select-structure-drawing-0-' + message.index;
            selectSmiles['0-' + message.index] = message.smiles;
        }
        var data = smiles.parse(message.smiles);
        smilesDrawer.draw(data, target, false);
    }

    function onInfosSearched (message) {
        for (var i = 0; i < message.binIndices.length; i++) {
            for (var j = 0; j < message.binIndices[i].length; j++) {
                projections[0].octreeHelper.addSelected(message.binIndices[i][j]);
            }
        }

        Faerun.hide(bindings.loader);
    }

    function project() {
        if (!currentVariant) {
            bindings.toastError.MaterialSnackbar.showSnackbar({
                message: 'Please select a variant before projecting ...'
            });
            return; 
        }

        var smiles = bindings.textareaProject.value.split('\n');
        var hsl = Faerun.hex2hsl(bindings.colorpickerDialogProjectInput.value);
        var fingerprints = new Array();

        if (smiles.length < 1 || smiles[0] === '') {
            bindings.toastError.MaterialSnackbar.showSnackbar({
                message: 'Please enter at least one molecule in SMILES form ...'
            });
            return; 
        }

        var fingerprintId = currentFingerprint.id.split('.').pop();
        var baseUrl = FaerunConfig.services.fpUrls[fingerprintId];

        // Split smiles into chunks to not overload the fingerprint server
        var chunks = [];

        var chunkSize = 250;
        for (var i = 0, j = smiles.length; i < j; i += chunkSize) {
            chunks.push(smiles.slice(i, i + chunkSize));
        }
            
        console.log(chunks.length);

        var x = [];
        var y = [];
        var z = [];

        var chunkIndex = 0;

        var loadChunk = function(callback) {
            var chunk = chunks[chunkIndex];

            for (var i = 0; i < chunk.length; i++) {
                chunk[i] = chunk[i].trim();
                if (chunk[i] === '') continue;

                var url = Faerun.format(baseUrl, [ encodeURIComponent(chunk[i]) ]);
                var done = 0;

                Faerun.loadFingerprint(url, function(fpRaw) {
                    var fp = fpRaw.split(';');

                    // Something is wrong when the fp is of length 1
                    if (fp.length > 1) {
                        for (var j = 0; j < fp.length; j++) fp[j] = parseInt(fp[j]);
                        fingerprints.push(fp);
                    }

                    done++;

                    if (done === chunk.length) {
                        Faerun.loadProjection(FaerunConfig.services.pcaUrl, {
                            "database": currentDatabase.id,
                            "fingerprint": fingerprintId,
                            "dimensions": 3,
                            "binning": true,
                            "resolution": currentVariant.resolution,
                            "data": fingerprints
                        }, function(projections) {
                            if (!projections.success) {
                                bindings.toastError.MaterialSnackbar.showSnackbar({
                                    message: 'Oops, something went wrong, please try projecting again ...'
                                });
                                return;
                            }

                            var data = projections.data;

                            for (var j = 0; j < data.length; j++) {
                                x.push(data[j][0]);
                                y.push(data[j][1]);
                                z.push(data[j][2]);
                            }

                            // To the next chunk
                            console.log('Chunk ' + chunkIndex + ' done.');
                            if (chunkIndex < chunks.length - 1) {
                                chunkIndex++;
                                loadChunk(callback);
                            }
                            else
                                callback();
                        }); 
                    }
                });
            }
        }

        loadChunk(function() {
            console.log('Loading ...');
            var ph = new Lore.PointHelper(lore, 'ProjectionGeometry' + projections.length, 'defaultAnimated');
            ph.setFogDistance(currentVariant.resolution * Math.sqrt(3) + 500);
            ph.setPositionsXYZHSS(x, y, z, hsl.h, hsl.s, 1.0);

            var oh = new Lore.OctreeHelper(lore, 'ProjectionOctreeGeometry' + projections.length, 'default', ph);

            oh.addEventListener('hoveredchanged', function (e) {
                if (!e.e) {
                    return;
                }
                console.log(e);
            });
            
            addProjection({
                name: bindings.nameDialogProjectInput.value,
                color: bindings.colorpickerDialogProjectInput.value,
                pointHelper: ph,
                octreeHelper: oh
            });
        });
    }
})();
