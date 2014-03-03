function Triangle(a, b, c, normal) {
  this.verts = [a, b, c];
  this.normal = normal;

  this.sortByZ();
  this.id = Triangle.id++;
}

Triangle.id = 0;

Triangle.prototype.sortByZAscending = function(a, b) {
  return a.position[2] > b.position[2] ? -1 : 1;
};

Triangle.prototype.sortByZ = function() {
  // TODO SORT: reverse sort if milling/printing
  this.verts.sort(this.sortByZAscending);
};

Triangle.prototype.toString = function() {
  return '[' + this.id + ':' + [this.verts[0].id, this.verts[1].id, this.verts[2].id].join(',') + ']';
}
