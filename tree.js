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

var slicer = new MeshSlicePolygon();

for (var i = 0; i<model.length; i++) {
  var facet = model[i];

  slicer.addTriangle(
    model[i].verts[0],
    model[i].verts[1],
    model[i].verts[2]
  );
}

var sliceZ = slicer.bounds.max[2]-.0001;

var tick = function(stop) {

  var groups = slicer.slice(sliceZ);
  console.log('groups', groups.length, '@', sliceZ);
  if (!groups.length) {
    return console.log('DONE');
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(500, 300);
  ctx.scale(.5, .5);
  ctx.lineWidth = 2;
  var scale = 100;

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

  ctx.strokeStyle = "#FD871F"
  ctx.fillStyle = "rgba(250, 220, 150, .2)";
  ctx.stroke();
  ctx.fill();

  offsetHulls(hulls);

  sliceZ -= .001;

  ctx.restore();
  if (sliceZ > .05) {
    requestAnimationFrame(tick);
  } else {
    sliceZ = -1;
    requestAnimationFrame(tick);
  }
};

function offsetHulls(hulls) {
  var result = null;
  var amount = 20;
  for (var i = amount; i<200; i+=amount) {
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

  ClipperLib.JS.Lighten(ret, 0.1);

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

  ClipperLib.JS.Lighten(ret, 0.1);
  return ret;
}

function offsetHull(paths, offset) {
  var co = new ClipperLib.ClipperOffset(1, 100);

  var scale = 1000;
  ClipperLib.JS.ScaleUpPaths(paths, scale);

  co.AddPaths(paths,
    ClipperLib.JoinType.jtSquare,
    ClipperLib.EndType.etClosedPolygon
  );

  var result = new ClipperLib.Paths();
  co.Execute(result, offset * scale);

  ClipperLib.JS.ScaleDownPaths(result, scale)

  return result;
}

tick();
