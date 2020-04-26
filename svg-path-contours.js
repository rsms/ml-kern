/*
The MIT License (MIT)
Copyright (c) 2014 Matt DesLauriers

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE
OR OTHER DEALINGS IN THE SOFTWARE.
*/
window.svgPathContours = (() => {

// import adaptiveBezierCurve, normalizeSvgPath, absSvgPath

function vec2Copy(out, a) {
  out[0] = a[0]
  out[1] = a[1]
  return out
}

function set(out, x, y) {
  out[0] = x
  out[1] = y
  return out
}

var tmp1 = [0,0],
  tmp2 = [0,0],
  tmp3 = [0,0]

function bezierTo(points, scale, start, seg) {
  adaptiveBezierCurve(
    start,
    set(tmp1, seg[1], seg[2]),
    set(tmp2, seg[3], seg[4]),
    set(tmp3, seg[5], seg[6]),
    scale,
    points
  )
}

/*function pointsToFloat32Array(points) {
  let a = new Float32Array(points.length * 2)
  for (let i = 0; i < points.length; i++) {
    a[i] = points[i][0]
    a[i * 2] = points[i][1]
  }
  return a
}

return function contours(svg, scale) {
  var paths = []
  var points = []
  var pen = [0, 0]
  normalizeSvgPath(absSvgPath(svg)).forEach((segment, i, self) => {
    if (segment[0] === 'M') {
      let [, x, y] = segment
      pen[0] = x
      pen[1] = y
      if (points.length > 0) {
        paths.push(pointsToFloat32Array(points))
        points.length = 0
        // points = []
      }
    } else if (segment[0] === 'C') {
      bezierTo(points, scale, pen, segment)
      set(pen, segment[5], segment[6])
    } else {
      throw new Error('illegal type in SVG: '+segment[0])
    }
  })
  if (points.length > 0) {
    paths.push(pointsToFloat32Array(points))
  }
  return paths
}*/

return function contours(svg, scale) {
  var paths = []
  var points = []
  var pen = [0, 0]
  normalizeSvgPath(absSvgPath(svg)).forEach((segment, i, self) => {
    if (segment[0] === 'M') {
      let [, x, y] = segment
      pen[0] = x
      pen[1] = y
      if (points.length > 0) {
        paths.push(points)
        points = []
      }
    } else if (segment[0] === 'C') {
      bezierTo(points, scale, pen, segment)
      set(pen, segment[5], segment[6])
    } else {
      throw new Error('illegal type in SVG: '+segment[0])
    }
  })
  if (points.length > 0) {
    paths.push(points)
  }
  return paths
}

})()
