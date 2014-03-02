var id = 0;
var vertexLinkage = {};
var near = function(a, b) {
  return Math.abs(a-b) <= 0.000000000001;
}

function Intersection(isect, a, b) {
  this.position = isect;
  this.a = a;
  this.b = b;
}

function Vertex(x, y, z) {
  this.position = vec3.createFrom(x, y, z);
  var key = this.key();
  if (!vertexLinkage[key]) {
    this.id = id++;
    this.links = [];
    this.linkIds = {};
    vertexLinkage[key] = this;
  }

  return vertexLinkage[key];
}

function planeline(plane, start, end) {
  var num = vec3.dot(
    plane.n,
    vec3.subtract(
      plane.position,
      start.position,
      vec3.createFrom(0, 0, 0)
    ),
    vec3.createFrom(0, 0, 0)
  );

  var line = vec3.subtract(
    end.position,
    start.position,
    vec3.createFrom(0, 0, 0)
  );

  var den = vec3.dot(
    plane.n,
    line,
    vec3.createFrom(0, 0, 0)
  );

  var res = num/den;
  if (0 <= res && res <= 1.0) {
    return vec3.add(
      start.position,
      vec3.multiply(
        line,
        vec3.createFrom(res, res, res),
        vec3.createFrom(0,0,0)
      ),
      vec3.createFrom(0,0,0)
    );
  }
}

Vertex.prototype = {
  key : function() {
    return Array.prototype.join.call(this.position, ',');
  },
  addLink : function(vertex) {
    if (!this.linkIds[vertex.id]) {
      this.links.push(vertex);
      this.linkIds[vertex.id] = true;
    }
    return this;
  },


  test : function(plane, intersections) {
    if (this.seen) {
      return intersections;
    }

    this.seen = true;

    intersections = intersections || [];
    for (var i = 0; i<this.links.length; i++) {
      var link = this.links[i];

      // avoid recursing forever
      if (link.seen) {
        //console.log('skip');
        continue;
      }

      var sliceZ = plane.position[2];
      // skip cases that are obviously out of range
      if (
        (link.position[2] > sliceZ && this.position[2] > sliceZ) ||
        (link.position[2] < sliceZ && this.position[2] < sliceZ)
      ) {
        //console.log('out of range');
        //link.seen = true;
        continue;
      } else if (link.position[2] === sliceZ) {
        continue;
        intersections.push(new Intersection(
          link.position,
          link,
          this
        ));
      } else if (this.position[2] === sliceZ) {
        continue;
        intersections.push(new Intersection(
          this.position,
          this,
          link
        ));
      } else {

        var isect = planeline(plane, this, link)
        if (isect) {
          intersections.push(new Intersection(
            isect,
            this,
            link
          ));
        }
      }

      link.test(plane, intersections)
    }
    return intersections;
  }
};