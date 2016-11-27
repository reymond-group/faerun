function Faerun() {};

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
}

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
}

Faerun.isTypeFloat = function (type) {
  if (type === 'float32' || type === 'float64') return true;

  return false;
}

Faerun.csvToArray = function (str, dataTypes) {
  var lines = str.split('\n');
  var arrays = [];

  for (var i = 0; i < lines[0].split(',').length; i++)
    arrays.push(Faerun.initArray(dataTypes[i], lines.length));

  for (var i = 0; i < lines.length; i++) {
    var values = lines[i].split(',');
    for (var j = 0; j < values.length; j++) {
      if(Faerun.isTypeFloat(dataTypes[j]))
        arrays[j][i] = parseFloat(values[j]);
      else
        arrays[j][i] = parseInt(values[j]);
    }
  }
  console.log(arrays);
  return arrays;
}

Faerun.parseUrlParams = function() {
  var search = location.search.substring(1);
   return JSON.parse('{"' + decodeURI(search).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}');
}

Faerun.getCoords = function(arr, scale) {
  scale = scale || 500;

  // Avoid points on the lines
  var fraction = Math.round(scale / 20);

  var x_arr = new Uint16Array(arr.length);
  var y_arr = new Uint16Array(arr.length);
  var z_arr = new Uint16Array(arr.length);

  var x_arr_tmp = new Float32Array(arr.length);
  var y_arr_tmp = new Float32Array(arr.length);
  var z_arr_tmp = new Float32Array(arr.length);

  var max = { x: -Number.MAX_VALUE, y: -Number.MAX_VALUE, z: -Number.MAX_VALUE };
  var min = { x: Number.MAX_VALUE, y: Number.MAX_VALUE, z: Number.MAX_VALUE };

  for(var i = 0; i < arr.length; i++) {
    var values = arr[i].split(',');
    var x = parseFloat(values[0].trim());
    var y = parseFloat(values[1].trim());
    var z = parseFloat(values[2].trim());

    if(max.x < x) max.x = x;
    if(max.y < y) max.y = y;
    if(max.z < z) max.z = z;

    if(min.x > x) min.x = x;
    if(min.y > y) min.y = y;
    if(min.z > z) min.z = z;

    x_arr_tmp[i] = x;
    y_arr_tmp[i] = y;
    z_arr_tmp[i] = z;
  }

  // Normalize the values
  for(var i = 0; i < arr.length; i++) {
    x_arr[i] = Math.round((x_arr_tmp[i] - min.x) / (max.x - min.x) * scale) + fraction;
    y_arr[i] = Math.round((y_arr_tmp[i] - min.y) / (max.y - min.y) * scale) + fraction;
    z_arr[i] = Math.round((z_arr_tmp[i] - min.z) / (max.z - min.z) * scale) + fraction;
  }

  return { x: x_arr, y: y_arr, z: z_arr, scale: scale + 2 * fraction };
}

Faerun.schemblUrl = 'https://www.surechembl.org/chemical/';
