function debug(a) {
  console.log(JSON.stringify(a, null, '  '))
}

var verts = [], sliceZ = Infinity;
for (var i = 0; i<model.length; i+=9) {

  if (model[i+2] < sliceZ) {
    sliceZ = model[i+2];
  }

  if (model[i+5] < sliceZ) {
    sliceZ = model[i+5];
  }

  if (model[i+8] < sliceZ) {
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

var tick = function() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  var zPlane = {
    n : vec3.cross(
          vec3.subtract(
            vec3.createFrom(1, -6, sliceZ),
            vec3.createFrom(-4, 2, sliceZ), {}
          ),
          vec3.subtract(
            vec3.createFrom(-2, 4, sliceZ),
            vec3.createFrom(-4, 2, sliceZ), {}
          ),
          {}
        ),
    position : vec3.createFrom(0,0,sliceZ)
  };

  zPlane.d = vec3.dot(zPlane.n, vec3.createFrom(-4, 2, sliceZ));

  var collided = {}, seen = {}, intersectionGroups = [];
  for (var i = 0; i<verts.length; i++) {
    var vert = verts[i];
    if (!seen[vert.id]) {
      seen[vert.id] = true;

      var intersect = vert.test(zPlane, {});
      if (intersect && intersect.length > 0) {
        intersect.forEach(function(obj, group) {
          seen[obj.a] = true;
          seen[obj.b] = true;
        });

        intersectionGroups.push(intersect);
      }

    }
  }

  if (!intersectionGroups.length) {
    return console.log('DONE');
  }

  ctx.save();
  ctx.translate(300, 300);

  ctx.strokeStyle = "orange";
  ctx.moveTo(intersectionGroups[0][0].position[0], intersectionGroups[0][0].position[1]);

  var hulls = intersectionGroups.map(function(group, groupId) {

    // calculate the convex hull
    group.sort(function(a, b) {
      return b.position[0] - a.position[0] + b.position[1] - a.position[1];
    });

    var convexHull = chainHull_2D(group).map(function(point) {
      return Vec2.fromArray([point.position[0]*300, point.position[1]*300]);
    });


    ctx.lineWidth = 2;
    ctx.strokeStyle = ctx.fillStyle = "#FD871F";
    ctx.beginPath();
      convexHull.forEach(function(vert) {
        ctx.lineTo(vert.x, vert.y);
      });
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    return convexHull;
  });

  offsetHulls(hulls)


  sliceZ+=.001;
  ctx.restore();
  requestAnimationFrame(tick);
};

function offsetHulls(hulls) {
  var result = null;
  for (var i = 10; i<100; i+=10) {
    for (var j = 0; j<hulls.length; j++) {

      var paths = hulls[j].map(function(vert) {
        return { X: vert.x, Y: vert.y };
      });


      offsetted_paths = offsetHull([paths], i)
      if (!result) {
        result = offsetted_paths;
      } else {
        result = union(offsetted_paths, result);
      }
    }

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

function offsetHull(paths, offset) {
  var co = new ClipperLib.ClipperOffset(2, 0.25);
  // // ClipperLib.EndType = {etOpenSquare: 0, etOpenRound: 1, etOpenButt: 2, etClosedPolygon: 3, etClosedLine : 4 };
  co.AddPaths(paths,
    ClipperLib.JoinType.jtRound,
    ClipperLib.EndType.etClosedPolygon
  );

  var offsetted_paths = new ClipperLib.Paths();
  co.Execute(offsetted_paths, offset);
  return offsetted_paths;
}

tick();
// TODO: identify holes
// TODO: cleanup the skipIds nonsense
