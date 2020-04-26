const Vec2 = (()=>{
class Vec2 extends Array {
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
  angleTo(v) { // angle from this to v in radians
    return Math.atan2(this[1] - v[1], this[0] - v[0]) + Math.PI
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
  if (!(v instanceof Vec2)) {
    throw new Error("argument is not a Vec2")
  }
}

return Vec2
})()


// colors
class Color {
  constructor(r,g,b,a) {
    this.r = r ; this.g = g ; this.b = b ; this.a = a
  }
  alpha(a) {
    return new Color(this.r, this.g, this.b, a)
  }
  toString() {
    return `rgba(${this.r*255},${this.g*255},${this.b*255},${this.a})`
  }
}

const red    = new Color(1, 0.1, 0, 1)
const orange = new Color(1, 0.5, 0, 1)
const green  = new Color(0, 0.7, 0.1, 1)
const teal   = new Color(0, 0.7, 0.7, 1)
const blue   = new Color(0, 0.55, 1, 1)
const pink   = new Color(1, 0.1, 1, 1)


class Canvas {
  constructor(domSelector) {
    const c = this
    c.canvas = document.querySelector(domSelector)
    if (!c.canvas) {
      throw new Error(`canvas with DOM selector ${JSON.stringify(domSelector)} not found`)
    }
    const g = c.g = c.canvas.getContext("2d")
    c._origWidth = c.canvas.width
    c._origHeight = c.canvas.height
    c.initialTransform = c.g.getTransform()
    c.origin = new Vec2(0,0)
    c.hasViewportChange = true  // causes transform() to be called on first draw

    g.font = '11px Inter, sans-serif'

    c.updateSize()
    window.addEventListener("resize", c.updateSize.bind(c), {passive:true,capture:false})

    function strokeOrFill(style, strokeWidth, f) {
      if (!style) {
        // no fill or stroke
        f()
      } else if (strokeWidth > 0) {
        // stroke
        g.lineWidth = strokeWidth
        g.strokeStyle = style || "black"
        f()
        g.stroke()
      } else {
        // fill
        g.fillStyle = style || "black"
        f()
        g.fill()
      }
    }

    // drawing functions
    g.draw = {
      circle(pos, radius) {
        g.beginPath()
        g.arc(pos[0], pos[1], radius || 1.5, 0, 2 * Math.PI)
      },
      rhombus(pos, radius) {
        radius += 1  // to match disc
        g.beginPath()
        g.moveTo(pos[0], pos[1]-radius)
        g.lineTo(pos[0]+radius, pos[1])
        g.lineTo(pos[0], pos[1]+radius)
        g.lineTo(pos[0]-radius, pos[1])
        g.lineTo(pos[0], pos[1]-radius)
      },
      line(start, end) {
        g.beginPath()
        g.moveTo(start[0], start[1])
        g.lineTo(end[0], end[1])
      },
      plus(pos, size) {
        g.beginPath()
        g.moveTo(pos[0], pos[1] - size)
        g.lineTo(pos[0], pos[1] + size)
        g.moveTo(pos[0] - size, pos[1])
        g.lineTo(pos[0] + size, pos[1])
      },
      bezier(start, c1, c2, end) {
        g.beginPath()
        g.moveTo(start[0], start[1])
        g.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], end[0], end[1])
      },
      triangle(a, b, c) {
        g.beginPath()
        g.moveTo(a[0], a[1])
        g.lineTo(b[0], b[1])
        g.lineTo(c[0], c[1])
      },
    }

    // transform functions
    g.withTranslation = this.withTranslation.bind(this)
    g.withScale = this.withScale.bind(this)
    g.withTransform = this.withTransform.bind(this)

    // complete drawing functions with fill/stroke
    g.drawCircle = (pos, radius, style, strokeWidth) => {
      strokeOrFill(style, strokeWidth, () => g.draw.circle(pos, radius))
    }
    g.drawRhombus = (pos, radius, style, strokeWidth) => {
      strokeOrFill(style, strokeWidth, () => g.draw.rhombus(pos, radius))
    }
    g.drawLine = (start, end, style, strokeWidth) => {
      g.lineWidth = strokeWidth || 1
      g.strokeStyle = style || "black"
      g.draw.line(start, end)
      g.stroke()
    }
    g.drawPlus = (pos, size, style, strokeWidth) => {
      size = size || 16
      g.lineWidth = strokeWidth || 1
      g.strokeStyle = style || "black"
      g.draw.plus(pos, size)
      g.stroke()
    }
    g.drawBezier = (start, c1, c2, end, style, strokeWidth, options) => {
      if (options && options.handles) {
        let handleStyle = typeof options.handles == "boolean" ? style : options.handles
        g.drawDisc(c1, 2, handleStyle, 1)
        g.drawDisc(c2, 2, handleStyle, 1)
      }
      g.lineWidth = strokeWidth || 1
      g.strokeStyle = style || "black"
      g.draw.bezier(start, c1, c2, end)
      g.stroke()
    }
    g.drawOrigin = (style) => {
      style = style || "red"
      const size = 16 * g.dp
      const pos = [0,0]
      g.drawPlus(pos, size, style, g.dp)
      g.drawCircle(pos, g.dp*2, style)
    }
    g.drawTriangle = (a, b, c, style, strokeWidth) => {
      strokeOrFill(style, strokeWidth, () => {
        g.draw.triangle(a, b, c)
      })
    }
  }

  px(v) {
    return Math.round(v * this.pixelScale) / this.pixelScale
  }

  setOrigin(x, y) {
    this.origin[0] = x
    this.origin[1] = y
    this.resetTransform()
  }

  resetTransform() {
    this.g.setTransform(this.initialTransform)  // maybe just the identity matrix..?
    this.g.scale(this.pixelScale, this.pixelScale)
    this.g.translate(this.origin[0], this.origin[1])
    this._transformChanged()
    this.needsDraw = true
  }

  updateSize() {
    const canvas = this.canvas
    const style = canvas.style

    // clear adjustments and measure size
    style.zoom = null
    style.minWidth = null
    style.minHeight = null
    canvas.width  = this._origWidth
    canvas.height = this._origHeight
    let r = canvas.getBoundingClientRect()

    // update size
    this.width  = Math.round(r.width)
    this.height = Math.round(r.height)
    this.pixelScale = window.devicePixelRatio
    canvas.width  = Math.round(this.width * this.pixelScale)
    canvas.height = Math.round(this.height * this.pixelScale)
    style.minWidth  = canvas.width + "px"
    style.minHeight = canvas.height + "px"
    style.zoom = 1/this.pixelScale

    // udpate transform and mark viewport changed
    this.resetTransform()
    this.hasViewportChange = true
  }

  getScale() {
    let tm = this.g.getTransform()
    return tm.d / this.pixelScale // tm.d is scaleY
  }

  _transformChanged() {
    let tm = this.g.getTransform()
    this.g.dp = 1 / (tm.d / this.pixelScale)  // tm.d is scaleY
  }

  // transform is called when the viewport has changed.
  // Perform any coordinate space transforms here.
  transform() {}

  drawIfNeeded(time) {
    const c = this
    if (c.hasViewportChange) {
      c.hasViewportChange = false
      c.transform()
    }
    if (c.needsDraw) {
      c.needsDraw = false
      c.g.clearRect(-c.origin[0], -c.origin[1], c.width, c.height)
      c.draw(time)
    }
  }

  withTranslation(x, y, f) {
    this.withTransform([1, 0, x, 0, 1, y /* g,h,i ignored */], f)
  }

  withScale(x, y, f) {
    this.withTransform([x, 0, 0, 0, y, 0 /* g,h,i ignored */], f)
  }

  withTransform(m3, f) {  // m3 is a 3x3 matrix, opengl style [a,b,c,d,e,f,g,h,i]
    let tm = this.g.getTransform()
    this.g.transform(m3[0], m3[3], m3[1], m3[4], m3[2], m3[5])
    this._transformChanged()
    try {
      f()
    } finally {
      this.g.setTransform(tm)
      this._transformChanged()
    }
  }

}

;(()=>{

let canvases = new Set()

Canvas.create = function(domSelector, init, draw) {
  const c = new Canvas(domSelector)
  c.draw = draw
  init(c, c.g)
  canvases.add(c)
  if (canvases.size == 1) {
    drawAll(typeof performance != "undefined" ? performance.now() : 0)
  }
  return c
}

Canvas.destroy = function(c) {
  canvases.delete(c)
}

function drawAll(time) {
  for (let c of canvases) {
    c.drawIfNeeded(time)
  }
  if (canvases.size > 0) {
    requestAnimationFrame(drawAll)
  }
}


})();
