function ZPlane(sliceZ) {
  this.position = vec3.fromValues(0,0,sliceZ);
  this.v1 = vec3.fromValues(2, 0, sliceZ);
  this.v2 = vec3.fromValues(0, 2, sliceZ);
  this.normal = vec3.fromValues(0, 0, 1);
}

ZPlane.prototype.intersect = function(start, end) {

  var tmp = vec3.fromValues(0, 0, 0)
  var num = vec3.dot(
    this.normal,
    vec3.subtract(
      tmp,
      this.position,
      start.position
    )
  );

  var line = vec3.subtract(
    tmp,
    end.position,
    start.position
  );

  var den = vec3.dot(this.normal,line);

  var res = num/den;
  if (!isNaN(res) && 0 <= res && res <= 1.0) {
    var isect = vec3.add(
      tmp,
      start.position,
      vec3.multiply(
        tmp,
        line,
        vec3.fromValues(res, res, res)
      )
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