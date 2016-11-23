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

Faerun.csvToArray = function (str, dataTypes) {
  var lines = str.split('\n');
  var arrays = [];

  for (var i = 0; i < lines[0].split(',').length; i++)
    arrays.push(Faerun.initArray(dataTypes[i], lines.length));

  for (var i = 0; i < lines.length; i++) {
    var values = lines[i].split(',');
    for (var j = 0; j < values.length; j++)
      arrays[j][i] = parseInt(values[j]);
  }

  return arrays;
}

Faerun.parseUrlParams = function() {
  var search = location.search.substring(1);
   return JSON.parse('{"' + decodeURI(search).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}');
}

Faerun.schemblUrl = 'https://www.surechembl.org/chemical/';