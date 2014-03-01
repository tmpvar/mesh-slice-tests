var id = 0;
var vertexLinkage = {};
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

var near = function(a, b) {
  return Math.abs(a-b) <= 0.000000000001;
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
  test : function(plane, skipIds) {
    skipIds = Object.create(skipIds);
    var intersections = [];
    for (var i = 0; i<this.links.length; i++) {
      // avoid recursing forever
      if (skipIds[this.links[i].id]) {
        continue;
      }

      var ab = vec3.subtract(this.links[i].position, this.position, vec3.createFrom(0, 0, 0));
      var t = plane.d - vec3.dot(plane.n, this.position, vec3.createFrom(0,0,0))
      var dot = vec3.dot(plane.n, ab, vec3.createFrom(0,0,0)) ;
      t /= dot;

      if (near(t, 0) || (t > 0 && t <= 1.0) || (Math.abs(t) === Infinity && plane.position[0] === this.position[0])) {

        if (Math.abs(t) === Infinity) {
          console.log('PLANE POS', plane.position[0], this.position[0])
          intersections.push({
            position: this.position,
            a: this.id,
            b: this.links[i].id
          });
        } else {
          intersections.push({
              position: vec3.add(
                  this.position,
                  vec3.multiply(
                      vec3.createFrom(t,t,t), ab, vec3.createFrom(0,0,0)
                  ),
                  vec3.createFrom(0,0,0)
              ),
              a: this.id,
              b: this.links[i].id
          });
        }

        // Also attempt to collect any intersections on the other side of this edge
        skipIds[this.links[i].id] = true;
        skipIds[this.id] = true;
        var results = this.links[i].test(plane, skipIds);

        if (results && results.length > 0) {
          Array.prototype.push.apply(intersections, results);
        }

      }
    }
    return intersections;
  }
};