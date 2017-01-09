function tree() {}



tree.mst = function (arr, k) {
  k = k || 5;
  var height = arr.length;
  var width = arr[0].length;

  var arrDist = new Array(height);
  for (var i = 0; i < height; i++) {
    arrDist[i] = new Array(height - 1);
  }

  for (var i = 0; i < height; i++) {
    for (var j = i + 1; j < height; j++) {
      var dist = tree.getDist(arr[i], arr[j]);
      arrDist[i][j] = [j, dist];
      arrDist[j][i] = [i, dist];
    }
  }

  // Sort the arrays
  for (var i = 0; i < height; i++) {
    arrDist[i].sort(function (a, b) {
      return a[1] - b[1];
    });
  }

  // Create an edge list with k nearest neighbours
  var edges = new Array();

  for (var i = 0; i < height; i++) {
    var j = 0;
    while (j < k) {
      var val = arrDist[i][j];
      if (!val) break;
      if (!tree.containsEdge(edges, i, val[0])) edges.push([i, val[0], val[1]]);
      j++;
    }
  }

  var nodes = new Array(height);
  for (var i = 0; i < height; i++) {
    nodes[i] = i;
  }

  return tree.kruskal(nodes, edges);
}

tree.getDist = function (a, b) {
  var dist = 0;
  for (var i = 0; i < a.length; i++) {
    dist += Math.abs(a[i] - b[i]);
  }
  return dist;
}

tree.containsEdge = function (edges, a, b) {
  for (var i = 0; i < edges.length; i++) {
    if (edges[i][0] === a && edges[i][1] === b || edges[i][1] === a && edges[i][0] === b) return true;
  }

  return false;
}

tree.kruskal = function (nodes, edges) {
  var mst = [];
  var forest = _.map(nodes, function (node) {
    return [node];
  });
  var sortedEdges = _.sortBy(edges, function (edge) {
    return -edge[2];
  });
  while (forest.length > 1) {
    var edge = sortedEdges.pop();
    var n1 = edge[0];
    var n2 = edge[1];

    var t1 = _.filter(forest, function (tree) {
      return _.include(tree, n1);
    });

    var t2 = _.filter(forest, function (tree) {
      return _.include(tree, n2);
    });

    if (!_.isEqual(t1, t2)) {
      forest = _.without(forest, t1[0], t2[0]);
      forest.push(_.union(t1[0], t2[0]));
      mst.push(edge);
    }
  }
  return mst;
}
