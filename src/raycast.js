export function raycastX(hitTesters, rayStartX, y, step, maxDistance) {
  let distance = 0
  let absstep = Math.abs(step)
  let x = rayStartX
  for (; distance < maxDistance; x += step) {
    // log("test", x,y)
    for (let hitTester of hitTesters) {
      if (hitTester.test(x, y)) {
        // log("hit", x)
        return x
      }
    }
    distance += absstep
  }
  return x
}


// PolyPointHitTester tests if a point is inside a polygon
export class PolyPointHitTester {
  // from http://alienryderflex.com/polygon/
  constructor(polygon) {
    this.length = polygon.length / 2
    this.polygon = polygon
    this.constant = new Float64Array(this.length)
    this.multiple = new Float64Array(this.length)
    // precompute
    let j = this.length - 1;
    for (let i = 0; i < this.length; i++) {
      let x = polygon[i*2]
        , y = polygon[i*2 + 1]
        , nx = polygon[j*2]
        , ny = polygon[j*2 + 1]

      if (ny == y) {
        this.constant[i] = x
        this.multiple[i] = 0
      } else {
        this.constant[i] = (
          x
          - (y * nx) / (ny - y)
          + (y * x) / (ny - y)
        )
        this.multiple[i] = (nx - x) / (ny - y)
      }
      j = i
    }
  }


  test(x, y) {
    let oddNodes = 0, current = this.polygon[this.polygon.length-1] > y
    for (let i = 0; i < this.length; i++) {
      let previous = current
      current = this.polygon[i*2 + 1] > y
      if (current != previous) {
        oddNodes ^= y * this.multiple[i] + this.constant[i] < x
      }
    }
    return !!oddNodes
  }

  // test(x, y) {
  //   let j = this.length - 1
  //   let oddNodes = 0
  //   for (let i = 0; i < this.length; i++) {
  //     let cy = this.polygon[i*2 + 1]
  //     let ny = this.polygon[j*2 + 1]
  //     if (cy < y && ny >= y || ny < y && cy >= y) {
  //       oddNodes ^= (y * this.multiple[i] + this.constant[i]) < x
  //     }
  //     j = i
  //   }
  //   return !!oddNodes
  // }
}
