var JSONP = (function (document) {
  var requests = 0;
  var callbacks = {};

  return {
    get: function (src, data, callback) {
      if (!arguments[2]) {
        callback = arguments[1];
        data = {};
      }

      src += (src.indexOf('?') + 1 ? '&' : '?');

      var head = document.getElementsByTagName('head')[0];
      var script = document.createElement('script');
      var params = [];
      var requestId = requests;
      var param;

      requests++;

      data.callback = 'JSONP.callbacks.request_' + requestId;

      callbacks['request_' + requestId] = function (data) {
        head.removeChild(script);
        delete callbacks['request_' + requestId];

        callback(data);
      };

      for (param in data) {
        params.push(param + '=' + encodeURIComponent(data[param]));
      }

      src += params.join('&');

      script.type = 'text/javascript';
      script.src = src;

      head.appendChild(script);
    },

    callbacks: callbacks
  };
})(document);
