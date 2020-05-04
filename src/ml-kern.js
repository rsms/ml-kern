const log = console.log.bind(console)

// OTGlyphShapeFontSize is the origin size and relates to polygon density etc.
// Changing this means also tuning svgPathContours(density)
const OTGlyphShapeFontSize = 512

// FeatureRayCount controls how many ray features to compute.
// A larger number means higher density.
const FeatureRayCount = 32

let font = null


const canvas = Canvas.create("canvas", (c, g) => {
  g.font = '11px Inter, sans-serif'

  // virtual canvas size; actual size is scaled
  const canvasSize = new Vec2(1024,512)

  c.transform = () => {
    // const scale = c.width / canvasSize
    // const scale = c.height / canvasSize
    const scale = Math.min(c.width/canvasSize[0], c.height/canvasSize[1])
    c.setOrigin(
      // (c.width - Math.min(c.width, c.height))/2,  // left-aligned within canvasSize
      (c.width - canvasSize[0]*scale)/2,  // centered
      OTGlyphShapeFontSize * scale / 1.3
    )
    g.scale(scale, scale)
  }

  c.draw = time => {
    const px = c.px.bind(c)

    if (font) {
      const fontSize = canvasSize[0] * 0.35
      const glyphDrawScale = fontSize / OTGlyphShapeFontSize
      const fontScale = OTGlyphShapeFontSize / font.unitsPerEm

      let shape1 = OTGlyphShape.get(font, "Å")
      let shape2 = OTGlyphShape.get(font, "j")

      // Deciding on an approach for vertical space; the feature sample space.
      //
      // box approach 1:
      // compute all glyphs in the same vertical space so that we can reuse a glyph shape
      // in multiple pair comparisons. This is prooobably a good idea. Perhaps not.
      // For short glyphs this will reduce their resolution.
      // Code for using the bounding box of the font:
      //const minY = -font.tables.head.yMax * fontScale
      //const maxY = -font.tables.head.yMin * fontScale
      // Code for using the ascender & descender of the font:
      const minY = -font.ascender  * fontScale
      const maxY = -font.descender * fontScale
      //
      // box approach 2:
      // Compute each pair with tightly-fitting y-axis extremes
      //
      // This is slower, since we need to compute the features for every pair, rather than
      // compute just once per glyph.
      // However, the resulting features are essentially normalized in terms of comparison
      // across fonts. I.e. say we sample two fonts with different ascender and descender
      // values. In this case then the feature data would be completely different for two
      // identical shapes, as seen in Figure 1.
      //
      // Figure 1: "box approach 1"; the issue with varying height:
      //
      // Font 1                           Font 2
      // minY —————————————————————————   minY —————————————————————————
      // f    ----------   ----------     f    ----------   ----------
      // f    ----------   ----------     f      \    /--   ----/\
      // f    ----------   ----------     f       \  /---   ---/——\
      // f      \    /--   ----/\         f        \/----   --/    \
      // f       \  /---   ---/——\        f    ----------   ----------
      // f        \/----   --/    \       f    ----------   ----------
      // f    ----------   ----------     f    ----------   ----------
      // maxY —————————————————————————   maxY —————————————————————————
      //
      //
      // Figure 2: "box approach 2"; normalizing height for each pair.
      //
      // Font 1                           Font 2
      // minY —————————————————————————   minY —————————————————————————
      // f      \    /--   ----/\         f      \    /--   ----/\
      // f       \  /---   ---/——\        f       \  /---   ---/——\
      // f        \/----   --/    \       f        \/----   --/    \
      // maxY —————————————————————————   maxY —————————————————————————
      //
      // Code for using the bounding box of the glyph pair:
      //const minY = Math.min(shape1.bbox.minY, shape2.bbox.minY)
      //const maxY = Math.max(shape1.bbox.maxY, shape2.bbox.maxY)

      if (shape1.features.left.length == 0 || shape2.features.left.length == 0) {
        // let minY = Math.min(shape1.bbox.minY, shape2.bbox.minY)
        // let maxY = Math.max(shape1.bbox.maxY, shape2.bbox.maxY)
        // perform raycasting to extract whistepace features
        shape1.computeFeatures(minY, maxY, /* includeRays for drawing = */ true)
        shape2.computeFeatures(minY, maxY, /* includeRays for drawing = */ true)
        log(`${shape1}.features`, shape1.features)
        log(`${shape2}.features`, shape2.features)
      }

      // draw: pairs
      let x = 0
      x = drawPair(x, shape1, shape2)
      x = drawPair(x, shape2, shape1)

      function drawPair(x, shape1, shape2) {
        // spacing = left-glyph-rsb + right-glyph-lsb + kerning
        const kerning = font.getKerningValue(shape1.glyph, shape2.glyph)
        const spacing = shape1.RSB + shape2.LSB + kerning
        const spacingPct = spacing / font.unitsPerEm

        // TODO: figure out what spacing% shuld be relative to in terms of the
        // result value [ML: labeled feature] Union bbox? UPM?
        // Needs to be a value that makes sense for all pairs of shapes.

        shape1.draw(g, x, 0, fontSize, "right")
        x += shape1.bbox.width * glyphDrawScale

        // spacing: visualize kerning
        // let spacingBetweenPairs = (spacing*fontScale) * glyphDrawScale
        // spacing: LSB & RSB
        let spacingBetweenPairs = (shape1.paddingRight + shape2.paddingLeft)*glyphDrawScale + 30
        let labelpos = new Vec2(x + spacingBetweenPairs/2, maxY*glyphDrawScale + 20)
        x += spacingBetweenPairs
        shape2.draw(g, x, 0, fontSize, "left")

        // text with kerning value
        const spacingText = (
          Math.round(spacing*100) == 0 ? "0" :
          `${(spacingPct*100).toFixed(1)}% (${spacing})`
        )
        g.fillStyle = "black"
        g.textAlign = "center"
        g.strokeStyle = "white"
        g.lineWidth = g.dp * 4
        g.font = `${Math.round(12 * g.dp)}px Inter, sans-serif`
        g.strokeText(spacingText, labelpos[0], labelpos[1])
        g.fillText(spacingText, labelpos[0], labelpos[1])
        // g.drawCircle(labelpos.addY(10), g.dp*2, "black")

        return x + shape2.width*glyphDrawScale + 40
      }


      // // draw: parade
      // let x = 0, spacing = 20
      // shape1.draw(g, x, 0, fontSize, "left")
      // x += shape1.width*glyphDrawScale + spacing

      // shape1.draw(g, x, 0, fontSize, "right")
      // x += shape1.width*glyphDrawScale + spacing

      // shape2.draw(g, x, 0, fontSize, "left")
      // x += shape2.width*glyphDrawScale + spacing

      // shape2.draw(g, x, 0, fontSize, "right")
      // x += shape2.width*glyphDrawScale + spacing
    }

    g.drawOrigin(red.alpha(0.7))
    // c.needsDraw = true
  } // draw
})


// once fonts load, redraw
window.addEventListener("load", () => {
  canvas.needsDraw = true
})



class PolyShape {
  constructor(paths, simplifyThreshold) {
    if (simplifyThreshold === undefined) {
      simplifyThreshold = 0.1
    }

    // convert curves into discrete points
    this.polygons = svgPathContours(paths, /*density*/0.3)

    // simplify polygons and convert to vertex arrays (plus compute bbox)
    const bbox = this.bbox = {
      minX: Infinity, minY: Infinity,
      maxX: -Infinity, maxY: -Infinity,
      width: 0, height: 0,
    }
    for (let i = 0; i < this.polygons.length; i++) {
      let points = this.polygons[i]
      if (simplifyThreshold > 0) {
        points = simplifyPath(points, simplifyThreshold)
      }
      let a = new Float64Array(points.length * 2)
      for (let i = 0; i < points.length; i++) {
        let [x, y] = points[i]
        a[i * 2] = x
        a[i * 2 + 1] = y
        bbox.minX = Math.min(bbox.minX, x)
        bbox.minY = Math.min(bbox.minY, y)
        bbox.maxX = Math.max(bbox.maxX, x)
        bbox.maxY = Math.max(bbox.maxY, y)
      }
      this.polygons[i] = a
    }

    // round bbox extremes
    bbox.minX = Math.floor(bbox.minX)
    bbox.minY = Math.floor(bbox.minY)
    bbox.maxX = Math.ceil(bbox.maxX)
    bbox.maxY = Math.ceil(bbox.maxY)

    // calc bbox width and height for convenience
    bbox.width = bbox.maxX - bbox.minX
    bbox.height = bbox.maxY - bbox.minY

    this.paddingLeft = 0  // i.e. sidebearing for fonts
    this.paddingRight = 0  // i.e. sidebearing for fonts

    // features (populated by computeFeatures)
    this.features = {
      left:      [], // : float[] -- velocity factors
      right:     [], // : float[] -- velocity factors
      leftRays:  [], // : [Vec2,Vec2][] -- ray lines
      rightRays: [], // : [Vec2,Vec2][] -- ray lines
    }
  }

  // computeFeatures takes the shape's polygons and computes the left and right
  // whitespace, described by lists of distances in the input shape's coordinate system.
  computeFeatures(minY, maxY, includeRays) {
    // raycast
    // console.time("computeFeatures")
    const yStride = Math.ceil((maxY-minY)/FeatureRayCount)
    const padding = 0  // some extra space around the bbox (for debugging)
    const minX = this.bbox.minX - padding
    const maxX = this.bbox.maxX + padding
    const maxDistance = maxX - minX  // stop ray from traveling further
    const hitTesters = this.polygons.map(polygon => new PolyPointHitTester(polygon))
    this.features.left.length = 0
    this.features.right.length = 0
    this.features.leftRays.length = 0
    this.features.rightRays.length = 0
    for (let y = minY, rayNum = 0; y <= maxY && rayNum < FeatureRayCount; y += yStride) {
      let xl = minX
      let xr = maxX
      let endl = raycastX(hitTesters, xl, y, 1, maxDistance)
      let endr = raycastX(hitTesters, xr, y, -1, maxDistance)
      // Encode features as normalized x-axis "velocity":
      this.features.left.push((endl-xl)/maxDistance)
      this.features.right.push((xr-endr)/maxDistance)
      if (includeRays) {
        // include rays, useful for drawing
        this.features.leftRays.push([ new Vec2(xl,y), new Vec2(endl,y) ])
        this.features.rightRays.push([ new Vec2(xr,y), new Vec2(endr,y) ])
      }
    }
    // console.timeEnd("computeFeatures")
    return this.features
  }

  get width() {
    return this.paddingLeft + this.bbox.width + this.paddingRight
  }

  draw(g, x, y, scale, featureSides /* "left"|"right"|(("left"|"right")[]) */, options) {
    options = Object.assign({
      // default options
      valueLabels: true,  // draw value labels
    }, options || {})
    // translate in caller coordinates and scale.
    // adjustX adjusts the bbox _after_ scaling (with scaling applied), in shape coordinates.
    let adjustX = -this.bbox.minX //+ this.paddingLeft
    g.withTransform([scale, 0, x + (adjustX * scale), 0, scale, y], () => {

      if (!Array.isArray(featureSides)) {
        featureSides = [ featureSides ]
      }

      // // draw triangles (requires tess2 to be loaded in env)
      // let tesselation = tesselate(this.polygons)
      // drawTriangles(g, tesselation.elements, tesselation.vertices)

      // draw full-width box
      g.lineWidth = g.dp
      g.strokeStyle = "rgba(0,200,200,0.5)"
      g.strokeRect(
        this.bbox.minX - this.paddingLeft,
        this.bbox.minY,
        this.width,
        this.bbox.height,
      )

      let polygonColors = [ red, blue, pink, orange ]

      // draw polygon lines
      for (let i = 0; i < this.polygons.length; i++) {
        let vertexes = this.polygons[i]
        let color = polygonColors[i % polygonColors.length]
        // log(`path ${i} colored ${color}`)
        g.lineWidth = g.dp
        g.strokeStyle = color
        g.beginPath()
        for (let j = 0; j < vertexes.length; j += 2) {
          let x = vertexes[j], y = vertexes[j + 1]
          if (j == 0) {
            g.moveTo(x, y)
          } else {
            g.lineTo(x, y)
          }
        }
        g.stroke()
      }

      // draw polygon points
      for (let i = 0; i < this.polygons.length; i++) {
        let vertexes = this.polygons[i]
        let color = polygonColors[i % polygonColors.length]
        // log(`path ${i} colored ${color}`)
        for (let j = 0; j < vertexes.length; j += 2) {
          g.drawCircle([ vertexes[j], vertexes[j + 1] ], g.dp*1.5, color)
        }
      }

      // draw feature rays
      if (g.pixelScale / g.dp < 1.3) {
        // don't show values if text will be too cramped
        options.valueLabels = false
      }
      for (let side of featureSides) {
        const rays = this.features[side + "Rays"]
        const values = this.features[side]
        const fontSize = 9 * g.dp
        const labelSpacing = side == "left" ? fontSize/-2 : fontSize/2
        g.fillStyle = green
        g.textAlign = side == "left" ? "right" : "left"
        g.font = `500 ${Math.round(fontSize)}px Inter, sans-serif`
        if (rays) for (let i = 0; i < rays.length; i++) {
          // draw ray
          let [pt1, pt2] = rays[i]
          g.drawArrow(pt2, pt1, green, g.dp)
          // draw value label
          if (options.valueLabels) {
            let value = values[i]
            let xspace = value < 0.015 ? labelSpacing*2 : labelSpacing
            let text = value == 1 ? "•" : Math.round(value*100)
            g.fillText(text, pt1[0] + xspace, pt1[1] + fontSize/3)
          }
        }
      }
    }) // transform
  }

  toString() {
    return (
      this.constructor.name +
      `(${Math.round(this.width)}×${this.bbox.height} ${this.polygons.length} polys)`
    )
  }
}


class OTGlyphShape extends PolyShape {
  constructor(font, glyph, simplifyThreshold) {
    // get flipped glyph.path
    let glyphPath = glyph.getPath(0, 0, OTGlyphShapeFontSize)

    // convert OpenType path object to list of SVG-like path segments
    let paths = otPathToPaths(glyphPath)
    super(paths, simplifyThreshold)
    this.font = font
    this.glyph = glyph
    this.glyphPath = glyphPath

    // sidebearings, which are in UPM (unscaled)
    const upmbbox = glyph.getBoundingBox()
    this.LSB = upmbbox.x1
    this.RSB = glyph.advanceWidth - upmbbox.x1 - (upmbbox.x2 - upmbbox.x1)

    // PolyShape padding, which are in polygon coordinates (scaled)
    const scale = OTGlyphShapeFontSize / font.unitsPerEm
    this.paddingLeft  = this.LSB*scale
    this.paddingRight = this.RSB*scale
  }

  draw(g, x, y, fontSize, featureSides) {
    // draw glyph shape
    const scale = fontSize / OTGlyphShapeFontSize
    // Draw actual glyph shape in addition to the polygon drawn by PolyShape.draw()
    // g.withScale(scale, scale, () => {
    // g.withTranslation(x, y, () => {
    //   this.glyphPath.fill = "rgba(0,0,0,0.2)"  // sets g.fillStyle
    //   this.glyphPath.draw(g)
    // })
    // })
    super.draw(g, x, y, scale, featureSides)
  }
}

OTGlyphShape.get = (()=>{
  const cache = new Map() // : Map<OTFont,Map<string,OTGlyphShape>>
  return (font, glyphname) => {
    // FIXME: glyphname is used as char; should be actual glyphname
    let m = cache.get(font)
    if (m) {
      let shape = m.get(glyphname)
      if (shape) {
        return shape
      }
    } else {
      m = new Map()
      cache.set(font, m)
    }
    let glyph = font.charToGlyph(glyphname)
    let shape = new OTGlyphShape(font, glyph)
    m.set(glyphname, shape)
    return shape
  }
})()



function raycastX(hitTesters, rayStartX, y, step, maxDistance) {
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
class PolyPointHitTester {
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


function otPathToPaths(otpath) {
  // convert from array of objects to array of arrays;
  // the format other functions like svgPathContours expects.
  return otpath.commands.map(s => {
    let t = s.type
    return (
      t == "Z" ? [t] :
      t == "Q" ? [t, s.x1, s.y1, s.x, s.y] :
      t == "C" ? [t, s.x1, s.y1, s.x2, s.y2, s.x, s.y] :
                 [t, s.x, s.y]
    )
  })
}


// opentype.load('fonts/Inter-Regular.otf', (err, _font) => {
opentype.load('fonts/Georgia.ttf', (err, _font) => {
  log("load-font", {err, _font})
  font = _font
  canvas.needsDraw = true
})



/**
 * parse an svg path data string. Generates an Array
 * of commands where each command is an Array of the
 * form `[command, arg1, arg2, ...]`
 *
 * @param {String} path
 * @return {Array}
 */
function parseSvg(path) {
  const num = /-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/ig
  const parseSvgLength = {a: 7, c: 6, h: 1, l: 2, m: 2, q: 4, s: 4, t: 2, v: 1, z: 0}
  const segment = /([astvzqmhlc])([^astvzqmhlc]*)/ig

  function parseValues(args) {
    var numbers = args.match(num)
    return numbers ? numbers.map(Number) : []
  }

  var data = []
  path.replace(segment, function(_, command, args){
    var type = command.toLowerCase()
    args = parseValues(args)

    // overloaded moveTo
    if (type == 'm' && args.length > 2) {
      data.push([command].concat(args.splice(0, 2)))
      type = 'l'
      command = command == 'm' ? 'l' : 'L'
    }

    while (true) {
      if (args.length == parseSvgLength[type]) {
        args.unshift(command)
        return data.push(args)
      }
      if (args.length < parseSvgLength[type]) throw new Error('malformed path data')
      data.push([command].concat(args.splice(0, parseSvgLength[type])))
    }
  })
  return data
}



// tesselate creates triangles from vertices
function tesselate(polygons) {
  return Tess2.tesselate({
    contours: polygons,
    windingRule: Tess2.WINDING_ODD,
    elementType: Tess2.POLYGONS,
    polySize: 3,
    vertexSize: 2
  })
}

function drawTriangles(g, elements, vertices) {
  for (let i = 0; i < elements.length; i += 3) {
    let a = elements[i], b = elements[i+1], c = elements[i+2]
    g.drawTriangle(
      [vertices[a*2], vertices[a*2+1]],
      [vertices[b*2], vertices[b*2+1]],
      [vertices[c*2], vertices[c*2+1]],
      "rgba(200,10,200,0.5)",
      1,
    )
  }
}

