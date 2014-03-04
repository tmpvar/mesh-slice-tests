// TODO: depending on the operation, sorts need to be reversed

// CONFIG
var clipperScale = 1000;

// TODO: this needs to be configurable _and_
//       needs to take into account stepover

var amount = 20;
var modelScale = 100

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
var hullworks = new HullWorks();

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
  slicer.markHoles(hulls);

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  ctx.save();
  ctx.translate(500, 300);
  ctx.scale(.5, .5);
  ctx.lineWidth = 2;
  var scale = 100;

  ctx.beginPath();

  for (var i = 0; i<hulls.length; i++) {
    var points = hulls[i].points;
    if (points && points.length) {
      renderPath(points, false);
    }
  }

  ctx.closePath();

  ctx.strokeStyle = "#FD871F"
  ctx.fillStyle = "rgba(250, 220, 150, .2)";
  ctx.stroke();
  ctx.fill();

  var offsetHulls = hullworks.offset(hulls, amount);

  for (var i=0; i<offsetHulls.length; i++) {
    var hullArray = offsetHulls[i];
    if (hullArray) {
      for (var j = 0; j<hullArray.length; j++) {
        renderPath(hullArray[j]);
      }
    }
  }

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

function renderPath(r, createPath) {
  if (createPath !== false) {
    ctx.beginPath();
  }
  ctx.moveTo(r[0].X || r[0].x, r[0].Y || r[0].y)
  for (var i=0; i<r.length; i++) {
    ctx.lineTo(r[i].X || r[i].x, r[i].Y || r[i].y);
  }
  ctx.lineTo(r[0].X || r[0].x, r[0].Y || r[0].y);

  if (createPath !== false) {
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle = "#2784FF"
    ctx.stroke();
  }
}


tick();
