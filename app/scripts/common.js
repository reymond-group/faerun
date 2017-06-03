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

Faerun.sourceIdsUrl = 'https://www.ebi.ac.uk/unichem/rest/src_ids/';

Faerun.sourceInformationUrl = function (id) {
  return 'https://www.ebi.ac.uk/unichem/rest/sources/' + id;
};

Faerun.schemblIdsUrl = function (id) {
  return 'https://www.ebi.ac.uk/unichem/rest/src_compound_id/' + id + '/15';
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
  document.getElementById('data-title').innerHTML = title;
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
  option.value = value === null ? '' : value;
  option.innerHTML = text;

  if (value === null) {
    option.selected = true;
    option.disabled = true;
  }

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
 * Hides an HTMLElement by adding the class 'hidden' to the classList of the element.
 *
 * @param {HTMLElement} element - The HTMLElement to be hidden.
 */
Faerun.hideMobile = function (element) {
  element.classList.add('hidden-mobile');
};

/**
 * Shows an HTMLElement by removing the class 'hidden' from the classList of the element.
 *
 * @param {HTMLElement} element - The HTMLElement to be hidden.
 */
Faerun.showMobile = function (element) {
  element.classList.remove('hidden-mobile');
};


/**
 * Shows or hides an HTMLElement by adding or removing the class 'hidden' from the classList of the element.
 *
 * @param {HTMLElement} element - The HTMLElement to be shown or hidden.
 */
Faerun.toggle = function (element) {
  if (Faerun.hasClass(element, 'hidden'))
    Faerun.show(element);
  else
    Faerun.hide(element);
};

/**
 * Checks whether an element has a class.
 *
 * @param {HTMLElement} element - The HTMLElement to check.
 * @param {String} name - The name of the class.
 * @return {Boolean} Whether or not the HTMLElement has the class name.
 */
Faerun.hasClass = function (element, name) {
  return new RegExp('(\\s|^)' + name + '(\\s|$)').test(element.className);
};

/**
 * Removes or adds the class to the HTMLElement.
 *
 * @param {HTMLElement} element - The HTMLElement to add or remove the class to / from.
 * @param {String} name - The name of the class.
 */
Faerun.toggleClass = function (element, name) {
  if (Faerun.hasClass(element, name))
    element.classList.remove(name);
  else
    element.classList.add(name);
};

Faerun.removeClasses = function (element, classNames) {
  if (typeof element === 'string') {
    var elements = document.querySelectorAll(element);
    for (var i = 0; i < classNames.length; i++) {
      for (var j = 0; j < elements.length; j++) {
        elements[j].classList.remove(classNames[i]);
      }
    }
  } else {
    for (var i = 0; i < classNames.length; i++) {
      element.classList.remove(classNames[i]);
    }
  }
};

Faerun.addClasses = function (element, classNames) {
  if (typeof element === 'string') {
    var elements = document.querySelectorAll(element);
    for (var i = 0; i < classNames.length; i++) {
      for (var j = 0; j < elements.length; j++) {
        elements[j].classList.add(classNames[i]);
      }
    }
  } else {
    for (var i = 0; i < classNames.length; i++) {
      element.classList.add(classNames[i]);
    }
  }
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


Faerun.resize = function (element, width, height) {
  element.style.width = width + 'px';
  element.style.height = height + 'px';
};

Faerun.positionIndicator = function (element, pointSize, x, y) {
  element.style.width = pointSize + 'px';
  element.style.height = pointSize + 'px';
  element.style.left = 1 + (x - pointSize / 2.0 - 2) + 'px';
  element.style.top = 51 + (y - pointSize / 2.0 - 2) + 'px';
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

Faerun.hover = function (element, enter, leave) {
  element.addEventListener('mouseenter', enter, false);
  element.addEventListener('mouseleave', leave, false);
};

Faerun.clearCanvas = function (id) {
  var canvas = document.getElementById(id);
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

Faerun.removeElement = function (element) {
  return element.parentNode.removeChild(element);
};

Faerun.getBindings = function () {
  var bindings = {};
  var elements = document.querySelectorAll('[data-binding-id]');

  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];
    bindings[element.getAttribute('data-binding-id')] = element;
  }

  return bindings;
};

/**
 * Update the coordinates according to the current data set.
 *
 * @param {Lore} lore - A Lore visualizer context
 * @param {Number} size - The size of the x, y and z coordinate axis
 * @return {any} Retruns an object containing the center (.center) of the CoordinatesHelper and the CoordiantesHelper itself (.helper)
 */
Faerun.updateCoordinatesHelper = function (lore, size, ticks = 10, box = true, y = true) {
  var coordinatesHelper = new Lore.CoordinatesHelper(lore, 'Coordinates', 'coordinates', {
    position: new Lore.Vector3f(0, 0, 0),
    axis: {
      x: {
        length: size
      },
      y: {
        length: y ? size : 0
      },
      z: {
        length: size
      }
    },
    ticks: {
      x: {
        length: ticks
      },
      y: {
        length: ticks
      },
      z: {
        length: ticks
      }
    },
    box: {
      enabled: box
    }
  });

  var halfSize = size / 2.0;
  var center = new Lore.Vector3f(halfSize, halfSize, halfSize);
  lore.controls.setRadius((size * Math.sqrt(3)) / 2.0 + 100);
  lore.controls.setLookAt(center);

  return {
    center: center,
    helper: coordinatesHelper
  };
};

Faerun.appendTemplate = function (element, templateId, context) {
  var source = document.getElementById(templateId).innerHTML;
  var template = Handlebars.compile(source);

  var div = document.createElement('div');
  div.innerHTML = template(context);
  var elements = div.childNodes;

  for (var i = 0; i < elements.length; i++) {
    element.appendChild(elements[i].cloneNode(true));
  }
};

Faerun.clickClass = function (className, callback) {
  document.addEventListener('click', function (e) {
    if (Faerun.hasClass(e.target, className)) {
      callback(e);
    }
  }, false);
};

Faerun.hoverClass = function (className, enter, leave) {
  document.addEventListener('mouseover', function (e) {
    if (Faerun.hasClass(e.target, className)) {
      enter(e);
    }
  });
  document.addEventListener('mouseout', function (e) {
    if (Faerun.hasClass(e.target, className)) {
      leave(e);
    }
  });
};

Faerun.getConfigItemById = function (config, id) {
  for (var i = 0; i < config.databases.length; i++) {
    var database = config.databases[i];
    if (id === database.id) return database;

    for (var j = 0; j < database.fingerprints.length; j++) {
      var fingerprint = database.fingerprints[j];
      if (id === fingerprint.id === id) return fingerprint;

      for (var k = 0; k < fingerprint.variants.length; k++) {
        var variant = fingerprint.variants[k];
        if (id === variant.id) return variant;

        for (var l = 0; l < variant.maps.length; l++) {
          var map = variant.maps[l];
          if (id === map.id) return map;
        }
      }
    }
  }
};

Faerun.initFullscreenSwitch = function (switchElement) {
  switchElement.addEventListener('change', function () {
    if (switchElement.checked) {
      Faerun.launchIntoFullscreen(document.documentElement);
    } else {
      Faerun.exitFullscreen();
    }
  }, false);

  Faerun.addEventListeners('fullscreenchange webkitfullscreenchange mozfullscreenchange MSFullscreenChange', document, function (event) {
    var isFullscreen = (window.fullScreen) || (window.innerWidth === screen.width && window.innerHeight === screen.height);

    // if (isFullscreen)
      // switchElement.parentElement.MaterialSwitch.on();
    // else
      // switchElement.parentElement.MaterialSwitch.off();
  });
};

Faerun.initViewSelect = function (selectElement, lore) {
  $(selectElement).on('change', function () {
    var val = selectElement.value;

    if (val === 'free') lore.controls.setFreeView();
    if (val === 'top') lore.controls.setTopView();
    if (val === 'left') lore.controls.setLeftView();
    if (val === 'right') lore.controls.setRightView();
    if (val === 'front') lore.controls.setFrontView();
    if (val === 'back') lore.controls.setBackView();
  });
};

Faerun.initColorpicker = function (element, colors) {
  var input = element.getElementsByTagName('input')[0];
  var initialColor = Faerun.hex2rgb(colors[0], true);

  var container = document.createElement('div');
  container.classList.add('colorpicker');
  container.classList.add('hidden');

  var indicator = document.createElement('div');
  indicator.classList.add('indicator');

  setTimeout(function () {
    input.value = colors[0];
    indicator.style.backgroundColor = initialColor;
  }, 1000);

  for (var i = 0; i < colors.length; i++) {
    var colorElement = document.createElement('div');
    colorElement.style.backgroundColor = colors[i];
    container.appendChild(colorElement);

    colorElement.addEventListener('click', function (e) {
      var hex = Faerun.rgb2hex(this.style.backgroundColor);
      input.value = hex;
      Faerun.triggerEvent(input, 'keyup');
    });

    if ((i + 1) % 5 === 0) {
      container.appendChild(document.createElement('br'));
    }
  }

  element.appendChild(container);
  element.appendChild(indicator);

  input.addEventListener('focus', function (e) {
    Faerun.removeClasses(container, ['hidden']);
  });
  input.addEventListener('blur', function (e) {
    setTimeout(function () {
      Faerun.addClasses(container, ['hidden']);
    }, 200);
  });

  input.addEventListener('keyup', function (e) {
    indicator.style.backgroundColor = Faerun.hex2rgb(this.value, true);
  });
};

Faerun.addEventListeners = function (eventNames, element, callback) {
  var names = eventNames.split(' ');
  for (var i = 0; i < names.length; i++) {
    element.addEventListener(names[i], function (e) {
      callback(e);
    });
  }
};

Faerun.blockElements = function () {
  for (var i = 0; i < arguments.length; i++) {
    arguments[i].style.pointerEvents = 'none';
    arguments[i].style.opacity = 0.25;
  }
};

Faerun.unblockElements = function () {
  for (var i = 0; i < arguments.length; i++) {
    arguments[i].style.pointerEvents = 'auto';
    arguments[i].style.opacity = 1.0;
  }
};

Faerun.format = function (str, args) {
  return str.replace(/{(\d+)}/g, function (match, number) {
    return !(typeof args[number] === 'undefined') ?
      args[number] :
      match;
  });
};

Faerun.loadFingerprint = function (url, callback) {
  var xhr = new XMLHttpRequest();

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      var data = xhr.responseText.split(':');
      callback(data[1].trim(), data[2].trim());
    }
  };

  xhr.open('GET', url, true);
  xhr.send();
};

Faerun.loadProjection = function (url, data, callback) {
  var xhr = new XMLHttpRequest();

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      callback(JSON.parse(xhr.responseText));
    }
  };

  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
  xhr.send(JSON.stringify(data));
};


Faerun.rgb2hex = function (rgb) {
  if (/^#[0-9A-F]{6}$/i.test(rgb)) return rgb;

  rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);

  function hex(x) {
    return ('0' + parseInt(x).toString(16)).slice(-2);
  }

  return '#' + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
};

Faerun.hex2rgb = function (hex, format) {
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function (m, r, g, b) {
    return r + r + g + g + b + b;
  });

  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  if (result) {
    if (format) {
      return 'rgb(' + parseInt(result[1], 16) + ',' + parseInt(result[2], 16) + ',' + parseInt(result[3], 16) + ')';
    } else {
      return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    }
  } else {
    return null;
  }
}

Faerun.hex2hsl = function (hex) {
  var rgb = Faerun.hex2rgb(hex);
  var r = rgb.r;
  var g = rgb.g;
  var b = rgb.b;

  r /= 255;
  g /= 255;
  b /= 255;

  var max = Math.max(r, g, b);
  var min = Math.min(r, g, b);
  var h = (max + min) / 2;
  var s = h;
  var l = h;

  if (max === min) {
    // achromatic
    h = s = 0;
  } else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }

    h /= 6;
  }

  return {
    h: h,
    s: s,
    l: l
  };
};

Faerun.triggerEvent = function (element, eventName) {
  var e = null;
  if ('createEvent' in document) {
    e = document.createEvent('HTMLEvents');
    e.initEvent(eventName, false, true);
    element.dispatchEvent(e);
  } else {
    e = document.createEventObject();
    e.eventType = type;
    element.fireEvent('on' + e.eventType, e);
  }
}

Faerun.drawHistogram = function (element, values, max) {
  var ctx = element.getContext('2d');
  var width = element.width;
  var height = element.height;

  var padding = 2;
  var barWidth = (width / values.length);
  var pos = 0;


  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#3299BB';

  max = Math.sqrt(max);

  for (var i = 0; i < values.length; i++) {
    var value = Math.sqrt(values[i]);
    var barHeight = value === 0 ? 0 : height * (value / max);

    ctx.fillRect(pos, height - barHeight, barWidth, barHeight);

    pos += barWidth;
  }
};

Faerun.formatNumber = function (str) {
  return str.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
