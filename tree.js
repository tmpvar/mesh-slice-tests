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
    v2 : vec3.createFrom(0, 2, sliceZ)
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

  var collided = {}, seen = {}, intersectionGroups = [];
  for (var i = 0; i<verts.length; i++) {
    verts[i].seen = false;
  }

  for (var i = 0; i<verts.length; i++) {

    var vert = verts[i];
    if (!vert.seen) {

      var intersect = vert.test(zPlane);
      if (intersect && intersect.length > 0) {
        intersectionGroups.push(intersect);
      }
    }
  }


  console.log('found %d intersections; lengths:', intersectionGroups.length)
  intersectionGroups.map(function(i) {
    console.log('   ', i.length);
  });

  if (!intersectionGroups.length) {
    return console.log('DONE');
  }

  ctx.save();
  ctx.translate(400, 300);
  ctx.scale(4, 4);
  var scale = 10;
  ctx.strokeStyle = "orange";
  ctx.moveTo(
    intersectionGroups[0][0].position[0],
    intersectionGroups[0][0].position[1]
  );


  var hulls = intersectionGroups.map(function(group, groupId) {

    // var convexHull = chainHull_2D(group).map(function(point) {
    var hull = group.map(function(point) {
      return Vec2.fromArray([point.position[0]*scale, point.position[1]*scale]);
    }).filter(Boolean);

    return Polygon(hull).clean().rewind(true);
  });

  hulls.sort(function(a, b) {

    return (a.area() > b.area()) ? -1 : 1;
  });

  hulls.map(function(h) {
    var h = hulls[2];
    console.log('hull length', h.points.length);
    if (h.points.length) {
      console.log(h.area());
      ctx.beginPath();
        ctx.moveTo(h.point(0).x, h.point(0).y);

        h.each(function(p, c) {
          console.log(c.x, c.y)
          ctx.lineTo(c.x, c.y);
        });
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }
  });
  return;

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

    ctx.lineWidth = .25;
    ctx.strokeStyle = ctx.fillStyle = "#FD871F";
    var points = subject.rewind(!subject.isHole);
    if (points && points.length) {
      ctx.moveTo(subject.point(0).x, subject.point(0).y)
      subject.each(function(c) {
        ctx.lineTo(c.x, c.y);
      });
    }
  }

  ctx.closePath();
  ctx.stroke();
  //ctx.fill();

  //offsetHulls(hulls);

  sliceZ-=.001;
  ctx.restore();
  !stop && setTimeout(function() {
    tick(true);
  }, 1000);
  //requestAnimationFrame(tick);
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

      result = ClipperLib.JS.Clean(result, 0.25);

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

  return ret;
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

  return ret;
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
