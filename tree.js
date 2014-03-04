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
var modelScale = 100
for (var i = 0; i<model.length; i++) {
  var facet = model[i];

  model[i].verts[0][0] *= modelScale;
  model[i].verts[0][1] *= modelScale;
  model[i].verts[0][2] *= modelScale;

  model[i].verts[1][0] *= modelScale;
  model[i].verts[1][1] *= modelScale;
  model[i].verts[1][2] *= modelScale;

  model[i].verts[2][0] *= modelScale;
  model[i].verts[2][1] *= modelScale;
  model[i].verts[2][2] *= modelScale;

  slicer.addTriangle(model[i].verts);
}

var sliceZ = slicer.bounds.max[2]-.001;

var tick = function(stop) {
  var start = Date.now();
  var hulls = slicer.slice(sliceZ);

  //console.log('hulls', hulls.length, '@', sliceZ, 'took', Date.now() - start);

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  ctx.save();
  ctx.translate(500, 300);
  ctx.scale(.5, .5);
  ctx.lineWidth = 2;
  var scale = 100;

  hulls.sort(function(a, b) {
    return (a.area() > b.area()) ? -1 : 1;
  });

  var holes = 0;

  ctx.beginPath();

  for (var i = 0; i<hulls.length; i++) {

    var subject = hulls[i];

    if (subject.isHole) {
      continue;
    }

    subject.isHole = false
    var area = subject.area();

    for (var j = 0; j < i; j++) {
      if (hulls[j].area() < area) {
        break;
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
  console.log('elapsed', Date.now() - start);

  sliceZ -= 1;
  ctx.restore();
  if (sliceZ > 1) {
    requestAnimationFrame(tick);
  } else if (sliceZ > 0) {
    sliceZ = -1;
    requestAnimationFrame(tick);
  } else {
    console.log('DONE');
  }
};

var clipperScale = 1000;
var amount = 20;

function offsetHulls(hulls) {
  var result = null;

  var ignore = {}, paths = new Array(hulls.length);

  for (var j = 0; j<hulls.length; j++) {
    var path = new Array(hulls[j].points.length);
    var points = hulls[j].points;
    for (var k = 0; k<points.length; k++) {
      path[k] = { X: points[k].x, Y: points[k].y };
    }

    if (!hulls[j].isHole) {
      var offsetPath = offsetHull([path], amount);
      if (!result) {
        result = offsetPath;
      } else {
        result = union(offsetPath, result);
      }

      if (result && result.length) {
        result.forEach(renderClipperGroup);
      }
    } else {
      paths[j] = path;
    }
  }

  // Holes
  for (var j = 0; j<paths.length; j++) {
    if (ignore[j] || !paths[j]) {
      continue;
    }
    var result = offsetHull([paths[j]], -amount);

    renderClipperGroup(result[0]);

    var sential = 10000;
    while (result && sential--) {

      var offset = offsetHull([result[result.length-1]], -amount);

      if (!offset.length || !offset[0] || ClipperLib.Clipper.Area(offset[0]) <= 0) {
        break;
      }

      // TODO: if the hull is a hole, and a raytrace into the
      // original mesh turns up empty, then we can ignore it as well.
      //
      // Why? when we are cutting out holes that traverse the depth of
      //      the model, there is no point in stepping in on every layer.
      //
      //  The same is true for contours. Just because it's not a hole
      //  does not mean that we should only do one iteration.

      result = xor(offset, result);
      renderClipperGroup(offset[0]);
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
  var co = new ClipperLib.ClipperOffset(0, 0);

  ClipperLib.JS.ScaleUpPaths(paths, clipperScale)
  co.AddPaths(paths,
    ClipperLib.JoinType.jtMiter,
    ClipperLib.EndType.etClosedPolygon
  );

  var result = new ClipperLib.Paths();
  co.Execute(result, offset * clipperScale);
  ClipperLib.JS.ScaleDownPaths(result, clipperScale)
  return ClipperLib.JS.Clean(result, 1);
}

tick();
