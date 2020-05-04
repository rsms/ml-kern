export class Color {
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

export default {
  red:    new Color(1, 0.1, 0, 1),
  orange: new Color(1, 0.5, 0, 1),
  green:  new Color(0, 0.7, 0.1, 1),
  teal:   new Color(0, 0.7, 0.7, 1),
  blue:   new Color(0, 0.55, 1, 1),
  pink:   new Color(1, 0.2, 0.7, 1),
}
