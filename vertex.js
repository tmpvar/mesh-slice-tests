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

Triangle.prototype.sortByZ = function() {
  // TODO SORT: reverse sort if milling/printing
  this.verts.sort(function(a, b) {
    return a.position[2] > b.position[2] ? -1 : 1;
  });
};

Triangle.prototype.intersectPlane = function(plane, intersections) {

  // a triangle has 3 vertices that construct 3 line segments
  var cntFront=0, cntBack=0;
  for (var j=0; j<3; ++j) {
    var distance = plane.distanceToPoint(this.verts[j].position);
    if (distance<0) {
      ++cntBack;
    } else {
      ++cntFront;
    }
  }

  // Complete miss
  if (cntBack === 3) {
    return -1;
  } else if (cntFront === 3) {
    return 1;
  }

  var lines = [0,1,1,2,2,0]; // CCW Triangle
  var intersectPoints = [];
  for (var i=0; i<3; ++i) {
    var a = this.verts[lines[i*2+0]];
    var b = this.verts[lines[i*2+1]];
    var da = plane.distanceToPoint(a.position);
    var db = plane.distanceToPoint(b.position);

    if (da * db < 0) {
      var s = Vec2.clean(da / (da - db)); // intersection factor (between 0 and 1)
      var bMinusa = vec3.subtract(b.position, a.position, vec3.createFrom(0, 0, 0));

      intersectPoints.push(
        vec3.add(a.position,
          vec3.multiply(
            bMinusa,
            vec3.createFrom(s, s, s),
            vec3.createFrom(0, 0, 0)
          ),
          vec3.createFrom(0, 0, 0)
        )
      );

    } else if (!da) { // plane falls exactly on one of the three Triangle vertices
      if (intersectPoints.length<2) {
        intersectPoints.push(a);
      }

    } else if (!db) { // plane falls exactly on one of the three Triangle vertices
      if (intersectPoints.length<2) {
        intersectPoints.push(b);
      }
    }
  }

  if (intersectPoints.length === 2) {
    // Output the intersecting line segment object
    intersections.push([
      new Intersection(intersectPoints[1], a, b),
      new Intersection(intersectPoints[0], a, b)
    ]);

    return 0;
  }
  return -2;
};


function Intersection(isect, a, b) {
  this.position = isect;
  this.a = a;
  this.b = b;
}

function Vertex(x, y, z) {
  this.position = vec3.createFrom(x, y, z);
  var key = this.key();
  this.id = Vertex.id++;
}

Vertex.id = 0;


Vertex.toString = function(coordArray) {

  return '(' + [coordArray[0], coordArray[1], coordArray[2]].join(',') + ')'
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
    var isect = vec3.add(
      start.position,
      vec3.multiply(
        line,
        vec3.createFrom(res, res, res),
        vec3.createFrom(0,0,0)
      ),
      vec3.createFrom(0,0,0)
    );

    var ret = new Intersection(isect, start, end);
    ret.ratio = res;
    return ret;
  }
}

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
  },

  test1 : function(plane, intersections) {
    intersections = intersections || [];

    if (this.seen) {
      return intersections;
    }

    this.seen = true;

    var links = this.links, l = links.length, link, z = plane.position[2];
    for (var i = 0; i<l; i++) {
      link = links[i];

      // don't even bother with links that we've already traversed
      if (link.seen) {
        continue;
      }

      if (near(link.position[2], z)) {
        console.log('on top');
      }

      if (!link.inRange(z, this)) {
        continue;
      }

      // Do not follow links that are parallel to the
      // cutting plane
      if (near(this.position[2], link.position[2])) {
        continue;
      }

      var isect = planeline(plane, this, link)
      if (!isect) {
        continue;
      }

      intersections.push(isect);

      // now, pivot to a point on the triangle that
      // will intersect the plane

      var shared = this.findSharedLinksWith(link);
      if (shared) {
        if (shared.length === 2) {
          var isect2 = planeline(plane, shared[0], link)
          var isect3 = planeline(plane, shared[1], link)


          if (isect2) {
            shared[0].test(plane, intersections)
          } else if (isect2) {
            shared[1].test(plane, intersections)
          } else {
            link.test(plane, intersections);
          }
        } else {
          console.log('different amount');
        }


        // isect = planeline(plane, this, link)

        // if (isect) {
        //   intersections.push(isect);
        //   link.test(plane, intersections)
        // }
      }
    }
    return intersections;
  },

  test : function(plane, intersections) {

    intersections = intersections || [];

    // // avoid extra computation
    if (this.seen) {
      return false;
    }

    this.seen = true;

    for (var i=0; i<this.links.length; i++) {
      var link = this.links[i];
      var isect = planeline(plane, this, link);

      if (isect && link.test(plane, intersections)) {
        var found = false;
        link.findSharedLinksWith(this).map(function(shared) {
          found = found || shared.test(plane, intersections);
        }.bind(this));

        if (found) {
          intersections.push(isect);
        }
      }
    }

    return intersections;
  },


  test1 : function(plane, intersections) {
    intersections = intersections || [];

    // // avoid extra computation
    if (this.seen) {
      return intersections;
    }

    this.seen = true;

    for (var i=0; i<this.links.length; i++) {
      var link = this.links[i];
      var shared = link.findSharedLinkWith(this);

      var isects = [[this, shared], [this, link], [link, shared]].map(function(a) {
        var isect = planeline(plane, a[0], a[1]);
        if (isect) {
          intersections.push(isect);
        }
      })
      if (isects.length === 2) {
        isects.map(function(isect) {
          isect.a.test(plane, intersections);
        });
      } else {
        link.test(plane, intersections);
      }

      //var tri = new Triangle(this, shared, link);
      //var r = tri.intersectPlane(plane, intersections);
      // if (r === 0) {
      //   link.test(plane, intersections);
      // }
    }

    return intersections;
  },

  test1 : function(plane, intersections) {
    intersections = intersections || [];

    // // avoid extra computation
    if (this.seen) {
      return intersections;
    }

    this.seen = true;

    for (var i=0; i<this.links.length; i++) {
      var link = this.links[i];
      var shared = link.findSharedLinkWith(this);

      var tri = new Triangle(this, shared, link);
      var r = tri.intersectPlane(plane, intersections);
      if (r === 0) {
        link.test(plane, intersections);
      }
    }

    return intersections;
  },

  test5: function(plane, intersections) {

    var where = this, last = this, z = plane.position[2];
    // while (where.seen !== true) {


    //   for (var i=0; i<this.links.length; i++) {
    //     var link = where.links[i];

    //     if (link.inRange(z, where)) {
    //       var isect = planeline(plane, where, link);
    //       if (isect) {
    //         intersections.push(isect);
    //         var shared = where.findSharedLinkWith(link);
    //         if (shared) {
    //           where.seen = true;
    //           link.test(plane, intersections);
    //         }
    //       }
    //     }
    //   }

      // // find all the links that this vert shares a point with
      var sharedPoints = where.links.map(function(link) {
        if (where.inRange(z, link)) {
          var isect = planeline(plane, where, link);
          if (isect) {
            intersections.push(isect);
          }

          var shared = where.findSharedLinkWith(link);

          if (isect && shared && link.inRange(z, shared)) {
            var isect2 = planeline(plane, where, shared);
            var isect3 = planeline(plane, link, shared);

            if (isect2) {
              intersections.push(isect2);
            }

            if (isect3) {
              intersections.push(isect3);
            }

            //shared.test(plane, intersections);
            where.test(plane, intersections);
          }

          return shared;
        }
      }).filter(Boolean);

      // console.log(sharedPoints.length);
    //}
  },


  test1 : function(plane, intersections) {
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

      var sliceZ = plane.position[2], isect = false;
      // skip cases that are obviously out of range
      if (!this.inRange(sliceZ, link)) {
        //console.log('out of range');
        //link.seen = true;
        continue;
      } else if (link.position[2] === sliceZ) {
        isect = new Intersection(link.position, link, this);
      } else if (this.position[2] === sliceZ) {
        isect = new Intersection(this.position, this, link);
      } else {
        isect = planeline(plane, this, link)
      }

      if (isect) {
        // Now, find another leg of this triangle by checking the
        // linkage between this and link and children
        var shared = this.findSharedLinkWith(link);
        if (shared) {
          var isect2 = planeline(plane, this, shared);
          if (!isect2) {
            var isect2 = planeline(plane, link, shared);
          }

          if (isect2) {
            intersections.push(isect);
            intersections.push(isect2);

            shared.test(plane, intersections);
          } else {
            console.error('weird situation, shared linkage did not intersect');
          }
        }
      }
    }
    return intersections;
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
  var num = vec3.dot(
    this.n,
    vec3.subtract(
      this.position,
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
    this.n,
    line,
    vec3.createFrom(0, 0, 0)
  );

  var res = num/den;
  if (!isNaN(res) && 0 <= res && res <= 1.0) {
    var isect = vec3.add(
      start.position,
      vec3.multiply(
        line,
        vec3.createFrom(res, res, res),
        vec3.createFrom(0,0,0)
      ),
      vec3.createFrom(0,0,0)
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
