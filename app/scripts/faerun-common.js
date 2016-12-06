/**
 * The Faerun class contains static helper functions used in the app.
 */
function Faerun() {}

/**
 * Initializes a TypedArray based on the type and length. This allows the dynamic creation of
 * differently typed TypedArrays. Returns a Float32Array if no valid type is provided.
 *
 * @param {String} type - The type of the TypedArray. Can be 'uint8clamped', 'uint8', 'int8', 'uint16', 'int16', 'uint32', 'int32', 'float32' or 'float64'.
 * @param {Number} length - The size of the TypedArray.
 * @return {any} A TypedArray of size 'length' and type 'type'.
 */
Faerun.initArray = function (type, length) {
  if (type === 'uint8clamped') return new Uint8ClampedArray(length);
  if (type === 'uint8') return new Uint8Array(length);
  if (type === 'int8') return new Int8Array(length);
  if (type === 'uint16') return new Uint16Array(length);
  if (type === 'int16') return new Int16Array(length);
  if (type === 'uint32') return new Uint32Array(length);
  if (type === 'int32') return new Int32Array(length);
  if (type === 'float32') return new Float32Array(length);
  if (type === 'float64') return new Float64Array(length);

  // If nothing matches return float32
  return new Float32Array(length);
};

/**
 * Initializes a TypedArray based on the type and and an existing buffer. Allows buffers to be accessed as the given type. 
 * Returns a Float32Array if no valid type is provided.
 *
 * @param {String} type - The type of the TypedArray. Can be 'uint8clamped', 'uint8', 'int8', 'uint16', 'int16', 'uint32', 'int32', 'float32' or 'float64'.
 * @param {ArrayBuffer} buffer - The size of the TypedArray.
 * @return {any} A TypedArray with the content of the buffer 'buffer' and type 'type'.
 */
Faerun.initArrayFromBuffer = function (type, buffer) {
  if (type === 'uint8clamped') return new Uint8ClampedArray(buffer);
  if (type === 'uint8') return new Uint8Array(buffer);
  if (type === 'int8') return new Int8Array(buffer);
  if (type === 'uint16') return new Uint16Array(buffer);
  if (type === 'int16') return new Int16Array(buffer);
  if (type === 'uint32') return new Uint32Array(buffer);
  if (type === 'int32') return new Int32Array(buffer);
  if (type === 'float32') return new Float32Array(buffer);
  if (type === 'float64') return new Float64Array(buffer);

  // If nothing matches return float32
  return new Float32Array(buffer);
};

Faerun.isTypeFloat = function (type) {
  if (type === 'float32' || type === 'float64') return true;

  return false;
};

Faerun.csvToArray = function (str, dataTypes) {
  var lines = str.split('\n');
  var arrays = [];

  var i;
  for (i = 0; i < lines[0].split(',').length; i++)
    arrays.push(Faerun.initArray(dataTypes[i], lines.length));

  for (i = 0; i < lines.length; i++) {
    var values = lines[i].split(',');
    for (var j = 0; j < values.length; j++) {
      if (Faerun.isTypeFloat(dataTypes[j]))
        arrays[j][i] = parseFloat(values[j]);
      else
        arrays[j][i] = parseInt(values[j], 10);
    }
  }
  console.log(arrays);
  return arrays;
};

Faerun.parseUrlParams = function () {
  var search = location.search.substring(1);
  return JSON.parse('{"' + decodeURI(search).replace(/"/g, '\\"').replace(/&/g, '","').replace(/\=/g, '":"') + '"}');
};

Faerun.getCoords = function (arr, scale) {
  scale = scale || 500;

  // Avoid points on the lines
  var fraction = Math.round(scale / 20);

  var xArr = new Uint16Array(arr.length);
  var yArr = new Uint16Array(arr.length);
  var zArr = new Uint16Array(arr.length);

  var xArrTmp = new Float32Array(arr.length);
  var yArrTmp = new Float32Array(arr.length);
  var zArrTmp = new Float32Array(arr.length);

  var max = {
    x: -Number.MAX_VALUE,
    y: -Number.MAX_VALUE,
    z: -Number.MAX_VALUE
  };
  var min = {
    x: Number.MAX_VALUE,
    y: Number.MAX_VALUE,
    z: Number.MAX_VALUE
  };

  var i;
  for (i = 0; i < arr.length; i++) {
    var values = arr[i].split(',');
    var x = parseFloat(values[0].trim());
    var y = parseFloat(values[1].trim());
    var z = parseFloat(values[2].trim());

    if (max.x < x) max.x = x;
    if (max.y < y) max.y = y;
    if (max.z < z) max.z = z;

    if (min.x > x) min.x = x;
    if (min.y > y) min.y = y;
    if (min.z > z) min.z = z;

    xArrTmp[i] = x;
    yArrTmp[i] = y;
    zArrTmp[i] = z;
  }

  // Normalize the values
  for (i = 0; i < arr.length; i++) {
    xArr[i] = Math.round((xArrTmp[i] - min.x) / (max.x - min.x) * scale) + fraction;
    yArr[i] = Math.round((yArrTmp[i] - min.y) / (max.y - min.y) * scale) + fraction;
    zArr[i] = Math.round((zArrTmp[i] - min.z) / (max.z - min.z) * scale) + fraction;
  }

  return {
    x: xArr,
    y: yArr,
    z: zArr,
    scale: scale + 2 * fraction
  };
};

Faerun.schemblUrl = 'https://www.surechembl.org/chemical/';
Faerun.getSchemblStructure = function (smiles) {
  return 'https://api.surechembl.org/service/chemical/image?structure=' +
    encodeURIComponent(smiles).replace(/%5B/g, '[').replace(/%5D/g, ']') +
    '&structure_hightlight&height=250&width=250';
};

// HTML helpers
/**
 * Lunch fullscreen mode.
 *
 * @param {HTMLElement} element - The HTML element to be shown in fullscreen.
 */
Faerun.launchIntoFullscreen = function (element) {
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  }
};

/**
 * Exits the fullscreen mode.
 */
Faerun.exitFullscreen = function () {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  }
};

/**
 * Removes all the children from a given HTMLElement.
 *
 * @param {HTMLElement} element - The element from which to remove all children.
 */
Faerun.removeChildren = function (element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
};

/**
 * Sets the title of the Faerun app.
 *
 * @param {String} title - The new title.
 */
Faerun.setTitle = function (title) {
  document.getElementById('datatitle').innerHTML = title;
};

/**
 * Attaches an HTMLOptionElement to a HTMLSelectElement.
 *
 * @param {HTMLSelectElement} element - A HTMLSelectElement to which the option is attached.
 * @param {any} value - The value of the HTMLOptionElement.
 * @param {any} text - The innerHTML of the HTMLOptionElement.
 */
Faerun.appendOption = function (element, value, text) {
  var option = document.createElement('option');
  option.value = value;
  option.innerHTML = text;
  element.appendChild(option);
};

/**
 * Attaches an empty HTMLOptionElement to an HTMLSelectElement.
 *
 * @param {HTMLSelectElement} element - A HTMLSelectElement to which an empty HTMLOptionElement is added.
 */
Faerun.appendEmptyOption = function (element) {
  var option = document.createElement('option');
  element.appendChild(option);
};

/**
 * Hides an HTMLElement by adding the class 'hidden' to the classList of the element.
 *
 * @param {HTMLElement} element - The HTMLElement to be hidden.
 */
Faerun.hide = function (element) {
  element.classList.add('hidden');
};

/**
 * Shows an HTMLElement by removing the class 'hidden' from the classList of the element.
 *
 * @param {HTMLElement} element - The HTMLElement to be hidden.
 */
Faerun.show = function (element) {
  element.classList.remove('hidden');
};


/**
 * Moves the absolute positioned element to the position x, y.
 *
 * @param {HTMLElement} element - HtmlElement to translate.
 * @param {Number} x - The x position to translate the element to.
 * @param {Number} y - The y position to translate the element to.
 * @param {Boolean} center - If true, centers the object given its width and height.
 */
Faerun.translateAbsolute = function (element, x, y, center) {
  if (center) {
    x -= element.offsetWidth / 2.0;
    y -= element.offsetHeight / 2.0;
  }
  element.style.left = x + 'px';
  element.style.top = y + 'px';
};


/**
 * Resize the element to a new width and height.
 *
 * @param {HTMLElement} element - HtmlElement to resize.
 * @param {Number} width - The width to resize the element to.
 * @param {Number} height - The height to resize the element to.
 */
Faerun.resize = function (element, width, height) {
  element.style.width = width + 'px';
  element.style.height = height + 'px';
};

/**
 * Set the background color of an element from an array containing r, g and b values.
 *
 * @param {HTMLElement} element - HtmlElement to set the background color on.
 * @param {Array} arr - The array containing the r, g and b values.
 */
Faerun.setColorFromArray = function (element, arr) {
  element.style.backgroundColor = 'rgb(' + Math.round(arr[0] * 255) + ', ' + Math.round(arr[1] * 255) +
                                  ', ' + Math.round(arr[2] * 255) + ')';
};
