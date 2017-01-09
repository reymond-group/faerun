importScripts('underscore-min.js', 'kmst.js');


self.addEventListener('message', function(e) {
  var data = e.data;
  self.postMessage(tree.mst(data));
  self.close();
}, false);
