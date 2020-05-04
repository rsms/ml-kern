export class Vec2 extends Array {
  add(f)    { checkNumArg(f) ; return new Vec2(this[0] + f, this[1] + f) }
  sub(f)    { checkNumArg(f) ; return new Vec2(this[0] - f, this[1] - f) }
  mul(f)    { checkNumArg(f) ; return new Vec2(this[0] * f, this[1] * f) }
  div(f)    { checkNumArg(f) ; return new Vec2(this[0] / f, this[1] / f) }

  addX(f)    { checkNumArg(f) ; return new Vec2(this[0] + f, this[1]) }
  addY(f)    { checkNumArg(f) ; return new Vec2(this[0], this[1] + f) }
  subX(f)    { checkNumArg(f) ; return new Vec2(this[0] - f, this[1]) }
  subY(f)    { checkNumArg(f) ; return new Vec2(this[0], this[1] - f) }
  mulX(f)    { checkNumArg(f) ; return new Vec2(this[0] * f, this[1]) }
  mulY(f)    { checkNumArg(f) ; return new Vec2(this[0], this[1] * f) }
  divX(f)    { checkNumArg(f) ; return new Vec2(this[0] / f, this[1]) }
  divY(f)    { checkNumArg(f) ; return new Vec2(this[0], this[1] / f) }

  add2(vec) { checkVec2Arg(vec) ; return new Vec2(this[0] + vec[0], this[1] + vec[1]) }
  sub2(vec) { checkVec2Arg(vec) ; return new Vec2(this[0] - vec[0], this[1] - vec[1]) }
  mul2(vec) { checkVec2Arg(vec) ; return new Vec2(this[0] * vec[0], this[1] * vec[1]) }
  div2(vec) { checkVec2Arg(vec) ; return new Vec2(this[0] / vec[0], this[1] / vec[1]) }

  distanceTo(v) { // euclidean distance between this and v
    return Math.sqrt(this.squaredDistanceTo(v))
  }
  squaredDistanceTo(v){
    let x = this[0] - v[0] , y = this[1] - v[1]
    return x * x + y * y
  }
  angle(v) { // angle from this to v in radians
    return Math.atan2(this[1] - v[1], this[0] - v[0]) // + Math.PI
  }
  magnitude() { // v^2 = x^2 + y^2
    return Math.sqrt(this[0] * this[0] + this[1] * this[1])
  }
  lerp(v, t) { // LERP - Linear intERPolation between this and v. t must be in range [0-1]
    let a = this, ax = a[0], ay = a[1]
    return new Vec2(ax + t * (v[0] - ax), ay + t * (v[1] - ay))
  }
  set(f) { checkNumArg(f) ; this[0] = f ; this[1] = f ; return this }
  set2(vec) { checkVec2Arg(vec) ; this[0] = vec[0] ; this[1] = vec[1] ; return this }
  abs() { return new Vec2(Math.abs(this[0]), Math.abs(this[1])) }
  clone() { return new Vec2(this) }
  toString() { return `(${this[0]} ${this[1]})` }
}

function checkNumArg(v) {
  if (typeof v != "number") {
    throw new Error("argument is not a number")
  }
}

function checkVec2Arg(v) {
  if (!Array.isArray(v)) {
    throw new Error("argument is not a Vec2 or Array")
  }
}
