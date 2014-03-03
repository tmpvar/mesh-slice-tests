function Vertex(x, y, z) {
  if (x instanceof Float32Array) {
    this.position = x;
  } else if (Array.isArray(x)) {
    this.position = vec3.fromValues(x[0], x[1], x[2]);
  } else {
    this.position = vec3.fromValues(x, y, z);
  }

  this.id = Vertex.id++;
}

Vertex.id = 0;

Vertex.toString = function(coordArray) {
  return '(' + [coordArray[0], coordArray[1], coordArray[2]].join(',') + ')'
};

Vertex.prototype = {
  near : function(vert, threshold) {
    return vec3.dist(this.position, vert.position) < (threshold || 0.1)
  },

  toString : function() {
    return Vertex.toString(this.position);
  }
};
