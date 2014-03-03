var vertexLinkage = {};
var near = function(a, b, t) {
  var t = t || 0.000000000001;
  return Math.abs(Math.abs(a)-Math.abs(b)) < t;
}

function Triangle(a, b, c, normal) {
  this.verts = [a, b, c];
  this.normal = normal;

  this.sortByZ();
  this.id = Triangle.id++;
}

Triangle.id = 0;

Triangle.prototype.sortByZAscending = function(a, b) {
  return a.position[2] > b.position[2] ? -1 : 1;
};

Triangle.prototype.sortByZ = function() {
  // TODO SORT: reverse sort if milling/printing
  this.verts.sort(this.sortByZAscending);
};

function Intersection(isect, a, b) {
  this.position = isect;
  this.a = a;
  this.b = b;
}

function Vertex(x, y, z) {
  if (x instanceof Float32Array) {
    this.position = x;
  } else if (Array.isArray(x)) {
    this.position = vec3.createFrom(x[0], x[1], x[2]);
  } else {
    this.position = vec3.createFrom(x, y, z);
  }

  var key = this.key();
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
  },

  key : function() {
    return Array.prototype.join.call(this.position, ',');
  },
  addLink : function(vertex) {
    if (!this.linkIds[vertex.id]) {
      this.links.push(vertex);
      this.linkIds[vertex.id] = vertex;
    }
    return this;
  },

  findSharedLinkWith : function(target) {
    var ids = Object.keys(this.linkIds);
    for (var i=0; i<ids.length; i++) {
      if (ids[i] === target.id) {
        continue;
      }

      if (target.linkIds[ids[i]]) {
        return target.linkIds[ids[i]];
      }
    }
    return null;
  },

  findSharedLinksWith : function(target) {
    var ids = Object.keys(this.linkIds), links = [];
    for (var i=0; i<ids.length; i++) {
      if (ids[i] === target.id) {
        continue;
      }

      if (target.linkIds[ids[i]]) {
        links.push(target.linkIds[ids[i]]);
      }
    }
    return links;
  },

  inRange : function(z, link) {
    return !(
      (link.position[2] > sliceZ && this.position[2] > sliceZ) ||
      (link.position[2] < sliceZ && this.position[2] < sliceZ)
    );
  }
};

function ZPlane(sliceZ) {
  this.position = vec3.createFrom(0,0,sliceZ),
  this.v1 = vec3.createFrom(2, 0, sliceZ),
  this.v2 = vec3.createFrom(0, 2, sliceZ),
  this.normal = vec3.createFrom(0, 0, 1);

  this.n = vec3.cross(
    vec3.subtract(
      this.v1,
      this.position,
      vec3.createFrom(0, 0, 0)
    ),
    vec3.subtract(
      this.v2,
      this.position,
      vec3.createFrom(0, 0, 0)
    ),
    vec3.createFrom(0, 0, 0)
  );
}

ZPlane.prototype.intersect = function(start, end) {
  var tmp = vec3.createFrom(0, 0, 0)
  var num = vec3.dot(
    this.n,
    vec3.subtract(
      this.position,
      start.position,
      tmp
    )
  );

  var line = vec3.subtract(
    end.position,
    start.position,
    tmp
  );

  var den = vec3.dot(this.n,line);

  var res = num/den;
  if (!isNaN(res) && 0 <= res && res <= 1.0) {
    var isect = vec3.add(
      start.position,
      vec3.multiply(
        line,
        vec3.createFrom(res, res, res),
        tmp
      ),
      tmp
    );

    return isect;
  }
};

ZPlane.prototype.distanceToPoint = function(point) {
  return vec3.dot(
    point,
    this.normal
  ) - this.position[2];
};
