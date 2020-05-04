import { raycastX, PolyPointHitTester } from "./raycast"
import * as opentype from "opentype.js"
import { svgPathContours } from "./svg-path-contours"
import { simplifyPath } from "./simplify-path"
import { Vec2 } from "./vec"
import { red, orange, green, teal, blue, pink } from "./canvas"

// OTGlyphShapeFontSize is the origin size and relates to polygon density etc.
// Changing this means also tuning svgPathContours(density)
export const OTGlyphShapeFontSize = 512

// FeatureRayCount controls how many ray features to compute.
// A larger number means higher density.
export const FeatureRayCount = 32



/*
interface FeatureData {
  // spacing is kerning & sidebearings combined; the space between two glyphs'
  // contour-bounding boxes. It's a percent of the font's UPM with the value range [0-1].
  // This is the value that the model outpus when predicting and the value that is
  // used as reference example input when training the model.
  spacing : float

  // features is a set of distances measuring the space between two glyphs' silhouettes
  // at discreete Y-axis position. The values are normalied in UPM space; range: [0-1].
  // The size of this array is exactly the constant FeatureRayCount.
  // Illustrated example:
  //
  // features[0]  --------------------
  // features[1]  --------------------
  // features[2]    \    /------/\
  // features[3]     \  /------/——\
  // features[4]      \/------/    \
  // features[5]  --------------------
  // features[6]  --------------------
  //
  // In this illustration the X-axis, the hyphens (---), represent the values
  // while the X-axis, the fN "features", represents the positions in this array.
  //
  features : Float64Array
}
*/


export class FontFeatureExtractor {
  constructor() {
    this.font = null
    this.minY = 0
    this.maxY = 0
    this.fontScale = 1.0  // OTGlyphShapeFontSize / font.unitsPerEm
    this.enableCanvasDrawing = true
    this.spaceBasis = 0.0  // Constant used to compute relative spacing
    this.glyphs = new Map()  // glyphname => OTGlyphShape
  }

  loadFont(filename) {
    return new Promise((resolve, reject) => {
      this.font = null
      opentype.load(filename, (err, font) => {
        if (err) return reject(err)
        this.font = font
        this.glyphs.clear()
        this.recomputeFontDependentData()
        resolve(font)
      })
    })
  }

  // if dstFloat64Array is not provided, a new Float64Array is allocated.
  // The array, being user provided or not, is returned as {values}
  computeFeaturesForGlyphPair(L, R, dstFloat64Array) {
    L = this.getGlyph(L)
    R = this.getGlyph(R)
    // perform raycasting to extract whistepace features
    if (!L.features.right) {
      L.computeFeatures(this.minY, this.maxY, /* includeRays */ this.enableCanvasDrawing)
    }
    if (!R.features.left) {
      R.computeFeatures(this.minY, this.maxY, /* includeRays */ this.enableCanvasDrawing)
    }
    if (!dstFloat64Array) {
      dstFloat64Array = new Float64Array(L.features.right.length + 1)
    }

    // spacing = L.RSB + R.LSB + kerning
    const kerning = this.font.getKerningValue(L.glyph, R.glyph)
    // // Normalize spacing to sum of bbox widths:
    // const spacing = ((L.RSB + R.LSB + kerning) * this.fontScale) /
    //                 (L.bbox.width + R.bbox.width)
    // Normalize spacing to average bbox width:
    // const spacing = ((L.RSB + R.LSB + kerning) * this.fontScale) /
    //                 ((L.bbox.width + R.bbox.width) / 2)
    //
    // Normalize spacing to spaceBasis: (see recomputeFontDependentData)
    const spacing = (L.RSB + R.LSB + kerning) / this.spaceBasis
    dstFloat64Array[0] = spacing

    // features = (L.features + R.features) / 2
    for (let i = 1; i < dstFloat64Array.length; i++) {
      dstFloat64Array[i] = (L.features.right[i] + R.features.left[i]) / 2
    }

    return {
      // feature data
      values: dstFloat64Array, // Float64Array of size FeatureRayCount+1
      // metadata (not features)
      L, R
    }
  }

  getGlyph(v) {
    if (typeof v == "string") {
      return this.getGlyphByText(v)
    } else if (typeof v == "number") {
      return this.getGlyphByIndex(v)
    } else if (v instanceof opentype.Glyph) {
      return this.getGlyphByIndex(v.index, v)
    } else if (v instanceof OTGlyphShape) {
      return v
    }
    throw new Error(`invalid argument; expected glyph, glyph index, glyph name or OTGlyphShape`)
  }

  getGlyphByText(singleCharText) {
    const glyphIndex = this.font.charToGlyphIndex(singleCharText)
    return this.getGlyphByIndex(glyphIndex)
  }

  getGlyphByName(glyphName) {
    const glyphIndex = this.font.nameToGlyphIndex(glyphName)
    return this.getGlyphByIndex(glyphIndex)
  }

  getGlyphByIndex(glyphIndex, g) {
    // singleCharText
    let shape = this.glyphs.get(glyphIndex)
    if (!shape) {
      if (!g) {
        g = this.font.glyphs.get(glyphIndex)
      }
      shape = new OTGlyphShape(this.font, g)
      this.glyphs.set(glyphIndex, shape)
    }
    return shape
  }


  recomputeFontDependentData() {
    // fontScale is used to translate from UPM to our local coordinate system
    this.fontScale = OTGlyphShapeFontSize / this.font.unitsPerEm

    // set spaceBasis
    // this.spaceBasis = this.font.charToGlyph(" ").advanceWidth  // SPACE
    this.spaceBasis = this.font.unitsPerEm

    //
    // Compute vertical bounds
    //
    // Deciding on an approach for vertical space; the feature sample space.
    //
    // box approach 1:
    // compute all glyphs in the same vertical space so that we can reuse a glyph shape
    // in multiple pair comparisons. This is prooobably a good idea. Perhaps not.
    // For short glyphs this will reduce their resolution.
    //
    // Code for using the bounding box of the font:
    // this.minY = -this.font.tables.head.yMax * this.fontScale
    // this.maxY = -this.font.tables.head.yMin * this.fontScale
    //
    // Code for using the ascender & descender of the font:
    this.minY = -this.font.ascender  * this.fontScale
    this.maxY = -this.font.descender * this.fontScale
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
    //this.minY = Math.min(shape1.bbox.minY, shape2.bbox.minY)
    //this.maxY = Math.max(shape1.bbox.maxY, shape2.bbox.maxY)
  }
}


export class PolyShape {
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
      left:      null, // : Float64Array  -- velocity factors (length=FeatureRayCount)
      right:     null, // : Float64Array  -- velocity factors (length=FeatureRayCount)
      leftRays:  null, // : [Vec2,Vec2][] -- ray lines
      rightRays: null, // : [Vec2,Vec2][] -- ray lines
    }
  }

  // computeFeatures takes the shape's polygons and computes the left and right
  // whitespace, described by lists of distances in the input shape's coordinate system.
  computeFeatures(minY, maxY, includeRays) {
    // raycast
    // console.time("computeFeatures")
    const height = maxY - minY
    const yStride = Math.ceil(height/FeatureRayCount)
    const padding = 0  // some extra space around the bbox (for debugging)
    const minX = this.bbox.minX - padding
    const maxX = this.bbox.maxX + padding
    const maxDistance = maxX - minX  // stop ray from traveling further
    const hitTesters = this.polygons.map(polygon => new PolyPointHitTester(polygon))
    const UPM = this.font.unitsPerEm
    const fontScale = OTGlyphShapeFontSize / UPM
    this.features.left  = new Float64Array(FeatureRayCount)
    this.features.right = new Float64Array(FeatureRayCount)
    this.features.leftRays = []
    this.features.rightRays = []
    for (let y = minY, rayNum = 0; y <= maxY && rayNum < FeatureRayCount; y += yStride) {
      let endl = raycastX(hitTesters, minX, y, 1, maxDistance)
      let endr = raycastX(hitTesters, maxX, y, -1, maxDistance)
      // Encode features as normalized x-axis "velocity":
      // this.features.left[rayNum]  = (endl-minX) / maxDistance
      // this.features.right[rayNum] = (maxX-endr) / maxDistance
      // // Encode features as normalized height "velocity":
      // this.features.left[rayNum]  = (endl-minX) / height
      // this.features.right[rayNum] = (maxX-endr) / height
      // Encode features as normalized UPM:
      this.features.left[rayNum]  = (endl - minX) / fontScale / UPM
      this.features.right[rayNum] = (maxX - endr) / fontScale / UPM
      if (includeRays) {
        // include rays, useful for drawing
        this.features.leftRays.push([ new Vec2(minX,y), new Vec2(endl,y) ])
        this.features.rightRays.push([ new Vec2(maxX,y), new Vec2(endr,y) ])
      }
      rayNum++
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
      if (g.pixelScale / g.dp < 0.8) {
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
            let text = value == 1 ? "•" : Math.round(value*100) // %
            // let text = String(Math.round(value*100)/100)
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


export class OTGlyphShape extends PolyShape {
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
