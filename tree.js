// TODO: depending on the operation, sorts need to be reversed

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

var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

///
//  STL PROCESSING
///

var triangles = [], sliceZ = -Infinity, seenVerts = {};

// only create unique vertices
var upsertVert = function(coords, normal) {
  var key = Vertex.toString(coords);

  if (!seenVerts[key]) {
    seenVerts[key] = new Vertex(coords);

    // lets also track the top of the object
    if (coords[2] > sliceZ) {
      sliceZ = coords[2];
    }
  }

  return seenVerts[key];
};


var sortedVertices = [], sharedTriangles = {};
for (var i = 0; i<model.length; i++) {
  var facet = model[i];

  var a = upsertVert(facet.verts[0]);
  var b = upsertVert(facet.verts[1]);
  var c = upsertVert(facet.verts[2]);


  var triangle = new Triangle(a, b, c, facet.normal);

  [a, b, c].forEach(function(vertex) {
    if (!sharedTriangles[vertex.id]) {
      sharedTriangles[vertex.id] = [];
    }

    sharedTriangles[vertex.id].push(triangle);
  });

  triangles.push(triangle);
}

var sortShared = function(a, b) {
  return (a.id > b.id) ? -1 : 1;
};

Object.keys(sharedTriangles).forEach(function(key) {
  sharedTriangles[key].sort(sortShared);
});

triangles.sort(function(a, b) {
  return (a.verts[0].position[2] < b.verts[0].position[2]) ? -1 : 1;
});

var groups = [], group = [];
var plane = new ZPlane(sliceZ)

var sharedTri = function(a, b, ignore) {
  var aa = sharedTriangles[a.id];
  var ab = sharedTriangles[b.id];

  for (var i = 0; i<aa.length; i++) {
    for (var j = 0; j<ab.length; j++) {
      if (aa[i].id === ab[j].id && ignore.indexOf(ab[j].id) === -1) {
        return aa[i];
      }
    }
  }

  return false;
}

var startTri = null, seenTriangles = {}, isectTests = [[0,1], [0, 2], [1, 2]];
var recurse = function(tri, last) {

  group = [];
  while (tri) {

    if (seenTriangles[tri.id]) {
      break;
    }

    seenTriangles[tri.id] = true;

    var isects = [];
    for (var i=0; i<isectTests.length; i++) {
      var test = isectTests[i];
      var isect = plane.intersect(tri.verts[test[0]], tri.verts[test[1]])
      if (isect) {
        // var vert = new Vertex(isect[0], isect[1], isect[2]);
        var vert = upsertVert(isect);
        vert.shared = test;
        isects.push(vert);
      }
    }

    if (isects.length === 3) {
      console.log('PARALLEL',
        sharedTriangles[tri.verts[0].id].length,
        sharedTriangles[tri.verts[1].id].length,
        sharedTriangles[tri.verts[2].id].length
      );
      break;
    } else if (isects.length === 2) {
      group.push(isects[0]);

      var shared = sharedTri(
        tri.verts[isects[0].shared[0]],
        tri.verts[isects[0].shared[1]],
        [tri.id, last, startTri]
      );

      if (!shared) {
        shared = sharedTri(
          tri.verts[isects[1].shared[0]],
          tri.verts[isects[1].shared[1]],
          [tri.id, last, startTri]
        );
      }

      if (shared && shared.id !== tri.id && shared.id !== startTri) {
        last = tri.id;
        tri = shared;
      } else {
        if (group.length > 0) {
          groups.push(group);
          group = [];
        }

        break;
      }
    } else {
      break;
    }
  }
}

var tick = function(stop) {

  var l = triangles.length;
  groups.length = 0;
  group.length = 0;
  seenTriangles = {};
  var z = plane.position[2], triVerts;
  while (l--) {
    startTri = triangles[l].id;

    if (!seenTriangles[startTri]) {
      triVerts = triangles[l].verts;

      if (triVerts[0].position[2] >= z) {
        recurse(triangles[l]);
      } else {
        break;
      }
    }
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(400, 300);
  ctx.scale(4, 4);
  var scale = 10;

  var hulls = groups.map(function(group, groupId) {
    var last = null, seen = {};

    var hull = group.map(function(point) {
      return Vec2.fromArray([point.position[0]*scale, point.position[1]*scale]);
    });

    var poly = Polygon(hull);

    if (poly.area() < 0) {
      poly.rewind(true);
    }

    return poly;
  });

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

    var points = subject.rewind(!subject.isHole).points;
    if (points && points.length) {

      ctx.moveTo(points[0].x, points[0].y)

      for (var k = 0; k<points.length; k++) {
        ctx.lineTo(points[k].x, points[k].y);
      }

      ctx.lineTo(points[0].x, points[0].y)
    }
  }

  ctx.closePath();
  ctx.lineWidth = .25;
  ctx.strokeStyle = "#FD871F"
  ctx.fillStyle = "rgba(250, 220, 150, .2)";
  ctx.stroke();
  ctx.fill();

  offsetHulls(hulls);

  plane.position[2] -= .01;

  ctx.restore();
  if (plane.position[2] > .01) {
    requestAnimationFrame(tick);
  } else {
    plane.position[2] = -1;
    requestAnimationFrame(tick);
  }
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
        result.forEach(renderClipperGroup);
      }
    }
  }
  return result;
}

function renderClipperGroup(r) {
  ctx.beginPath();
    ctx.moveTo(r[0].X, r[0].Y)
    for (var i=0; i<r.length; i++) {
      ctx.lineTo(r[i].X, r[i].Y);
    }
    ctx.closePath();
    ctx.lineWidth = .1;
    ctx.fillStyle = ctx.strokeStyle = "#2784FF"
  ctx.stroke();
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
  var co = new ClipperLib.ClipperOffset(.1, .1);

  var scale = 10000;
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


