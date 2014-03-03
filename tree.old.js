function debug(a) {
  console.log(JSON.stringify(a, null, '  '))
}
var finite = function(a) {
  return Math.abs(a) !== Infinity;
};

var validnum = function(a) {
  return finite(a) && !isNaN(a);
};

ClipperLib.Error = function(msg) { console.error(msg) };


var verts = [], sliceZ = -Infinity;
for (var i = 0; i<model.length; i+=9) {

  if (model[i+2] > sliceZ) {
    sliceZ = model[i+2];
  }

  if (model[i+5] > sliceZ) {
    sliceZ = model[i+5];
  }

  if (model[i+8] > sliceZ) {
    sliceZ = model[i+8];
  }

  var a = new Vertex(model[i], model[i+1], model[i+2]);
  var b = new Vertex(model[i+3], model[i+4], model[i+5]);
  var c = new Vertex(model[i+6], model[i+7], model[i+8]);

  // Setup Linkages
  a.addLink(b).addLink(c);
  b.addLink(a).addLink(c);
  c.addLink(a).addLink(b);

  verts.push(a);
  verts.push(b);
  verts.push(c);
}

var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
sliceZ -= .0001
var tick = function(stop) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  var zPlane = {
    position : vec3.createFrom(0,0,sliceZ),
    v1 : vec3.createFrom(2, 0, sliceZ),
    v2 : vec3.createFrom(0, 2, sliceZ),
    normal : vec3.createFrom(0, 0, 1)
  };

  zPlane.distanceToPoint = function(point) {
    return vec3.dot(
      point,
      this.normal
    ) - this.position[2];
  };

  zPlane.n = vec3.cross(
    vec3.subtract(
      zPlane.v1,
      zPlane.position,
      vec3.createFrom(0, 0, 0)
    ),
    vec3.subtract(
      zPlane.v2,
      zPlane.position,
      vec3.createFrom(0, 0, 0)
    ),
    vec3.createFrom(0, 0, 0)
  );

  var collided = {}, intersectionGroups = [];
  for (var i = 0; i<verts.length; i++) {
    verts[i].seen = false;
  }

  // First, lets find all of the intersections

  var intersections = [], seen = {};
  for (var i = 0; i<verts.length; i++) {
    var vert = verts[i];
    for (var j = 0; j<vert.links.length; j++) {
      var link = vert.links[j];

      var isect = planeline(zPlane, vert, link);
      if (isect) {

        isect.key = [isect.position[0],isect.position[1],isect.position[2]].join(',');
        if (!seen[isect.key]) {
          seen[isect.key] = isect;
        }
      }
    }
  }

  console.log('intersections:', Object.keys(seen).length);

  // Ok, now we have all of the intersections
  // start at [0] and walk the list, removing items from seen
  var intersectionGroups = [], keys = Object.keys(seen);
  while(keys.length) {
    var where = seen[keys[0]];

    var intersectionGroup = [];
    while (seen[where.key]) {
      delete seen[where.key];
      intersectionGroup.push(where);

      // find our next target
      for (var i=keys.length-1; i>=0; i--) {
        var isect = seen[keys[i]];
        if (!isect) {
          continue;
        }

        if (
          isect.a === where.a ||
          isect.b === where.a ||
          isect.a === where.b ||
          isect.b === where.b
        ) {
          if (seen[isect.key]) {
            where = isect;
            break;
          }
        }
      }
    }
    keys = Object.keys(seen);

    intersectionGroups.push(intersectionGroup);
  }

  console.log('groups:', intersectionGroups.length);

  if (!intersectionGroups.length) {
    return console.log('DONE');
  }

  ctx.save();
  ctx.translate(400, 300);
  ctx.scale(4, 4);
  var scale = 10;

  var vecNear = function(a, b, threshold) {
    return vec3.dist(a.position, b.position) < (threshold || 10)
  }

  var hulls = intersectionGroups.map(function(group, groupId) {
    var last = null, seen = {};

    var hull = group.map(function(point) {
      return Vec2.fromArray([point.position[0]*scale, point.position[1]*scale]);
    });

    var poly = Polygon(hull).clean();

    if (poly.area() < 0) {
      poly.rewind(true);
    }

    return poly;
  });



  // console.log('found %d intersections; lengths:', intersectionGroups.length)
  // hulls.map(function(i) {
  //   console.log('   ', i.length);
  //   i.each(function(v) {
  //     ctx.beginPath();
  //       ctx.arc(v.x, v.y, 2, Math.PI*2, false);
  //     ctx.closePath();
  //     ctx.fillStyle = "rgba(255, 255, 255, .1)";
  //     ctx.fill();
  //   })
  // });

  hulls.sort(function(a, b) {
    return (a.area() > b.area()) ? -1 : 1;
  });

  var holes = 0;
  ctx.beginPath();

  for (var i = 0; i<hulls.length; i++) {

    var subject = hulls[i];

    subject.isHole = false
    var area = subject.area();

    for (var j = 0; j < i; j++) {
      if (i === j || hulls[j].area() < area) {
        continue;
      }

      subject.isHole = hulls[j].containsPolygon(subject);
      break;
    }

    var points = subject.rewind(!subject.isHole);
    if (points && points.length) {


      ctx.moveTo(subject.point(0).x, subject.point(0).y)
      ctx.arc(subject.point(0).x, subject.point(0).y, 3, Math.PI*2, false);

      ctx.moveTo(subject.point(0).x, subject.point(0).y)
      subject.each(function(c) {
        ctx.lineTo(c.x, c.y);
      });
      ctx.lineTo(subject.point(0).x, subject.point(0).y)
    }
  }

  ctx.closePath();
  ctx.lineWidth = .25;
  ctx.strokeStyle = "#FD871F"
  ctx.fillStyle = "rgba(250, 220, 150, .2)";
  ctx.stroke();
  ctx.fill();

  //offsetHulls(hulls);

  sliceZ-=.01;
  ctx.restore();

  requestAnimationFrame(tick);
};

function offsetHulls(hulls) {
  var result = null;
  var amount = 5;
  for (var i = amount; i<10; i+=amount) {
    for (var j = 0; j<hulls.length; j++) {

      var paths = hulls[j].points.map(function(vert) {
        return { X: vert.x, Y: vert.y };
      });

      var offsetPaths = offsetHull([paths], hulls[j].isHole ? -i : i);

      if (!result) {
        result = offsetPaths;
      } else if (!hulls[j].isHole) {
        result = union(offsetPaths, result);
      } else {
        result = xor(offsetPaths, result);
      }

      result = ClipperLib.JS.Clean(result, 0.1);

    if (result && result.length) {
      result.forEach(function(r) {
        ctx.beginPath();
          ctx.moveTo(r[0].X, r[0].Y)
          r.forEach(function(point) {
            ctx.lineTo(point.X, point.Y);
          });
          ctx.closePath();
          ctx.lineWidth = 1;
          ctx.fillStyle = ctx.strokeStyle = "#2784FF"
        ctx.stroke();
      });
    }
    }
  }
  return result;
}

function union(a, b) {
  var cpr = new ClipperLib.Clipper();
  cpr.AddPaths(a, ClipperLib.PolyType.ptSubject, true);
  cpr.AddPaths(b, ClipperLib.PolyType.ptClip, true);

  var ret = new ClipperLib.Paths();

  cpr.Execute(
    ClipperLib.ClipType.ctUnion,
    ret,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero
  );

  return ClipperLib.JS.Clean(ret, 0.1);
}

function xor(a, b) {
  var cpr = new ClipperLib.Clipper();
  cpr.AddPaths(a, ClipperLib.PolyType.ptSubject, true);
  cpr.AddPaths(b, ClipperLib.PolyType.ptClip, true);

  var ret = new ClipperLib.Paths();

  cpr.Execute(
    ClipperLib.ClipType.ctXor,
    ret,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero
  );

  return ClipperLib.JS.Clean(ret, 0.1);
}

function offsetHull(paths, offset) {
  var co = new ClipperLib.ClipperOffset(0, .1);

  var scale = 1000;
  ClipperLib.JS.ScaleUpPaths(paths, scale);

  co.AddPaths(paths,
    ClipperLib.JoinType.jtMiter,
    ClipperLib.EndType.etClosedPolygon
  );

  var offsetted_paths = new ClipperLib.Paths();
  co.Execute(offsetted_paths, offset * scale);

  offsetted_paths = offsetted_paths.map(function(path) {
    return path.map(function(point) {
      Vec2.clean(point.X /= scale);
      Vec2.clean(point.Y /= scale);
      return point;
    });
  });

  return offsetted_paths;
}

tick();
// TODO: identify holes
// TODO: cleanup the skipIds nonsense
