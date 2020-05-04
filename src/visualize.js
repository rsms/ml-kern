import { Canvas, red, orange, green, teal, blue, pink } from "./canvas"
import { Vec2 } from "./vec"
import { OTGlyphShapeFontSize, FeatureRayCount } from "./feature-extract"


let canvas = null
let featureExtractor = null
let shapes = []


export function setShapes(featureExtractor_, ...shapes_) {
  featureExtractor = featureExtractor_
  if (!featureExtractor) {
    shapes = []
  } else {
    shapes = Array.from(shapes_)
  }
  redrawCanvas()
}


export function redrawCanvas() {
  if (canvas) {
    canvas.needsDraw = true
  }
}


export function getCanvas() {
  return canvas
}


export function createCanvas(domElement) {
if (!domElement) {
  domElement = document.createElement("canvas")
  ;(document.body || document.documentElement).appendChild(domElement)
}
canvas = Canvas.create(domElement, (c, g) => {
  g.font = '11px Inter, sans-serif'

  // virtual canvas size; actual size is scaled
  const canvasSize = new Vec2(1024,512)

  c.transform = () => {
    // const scale = c.width / canvasSize
    // const scale = c.height / canvasSize
    const scale = Math.min(c.width/canvasSize[0], c.height/canvasSize[1])
    c.setOrigin(
      // (c.width - Math.min(c.width, c.height))/2,  // left-aligned within canvasSize
      40 + (c.width - canvasSize[0]*scale)/2,  // centered
      OTGlyphShapeFontSize * scale / 1.3
    )
    g.scale(scale, scale)
  }

  window.addEventListener("load", () => { c.needsDraw = true })

  c.draw = time => {
    if (featureExtractor && shapes.length > 0) {
      const font = featureExtractor.font
      const fontSize = canvasSize[0] * 0.3
      const glyphDrawScale = fontSize / OTGlyphShapeFontSize
      const fontScale = OTGlyphShapeFontSize / font.unitsPerEm

      if (shapes.length % 2 != 0) {
        // draw: parade
        let x = 0, spacing = 40
        for (let shape of shapes) {
          shape.draw(g, x, 0, fontSize, ["left","right"])
          x += shape.width * glyphDrawScale + spacing
        }
      } else {
        // draw: pairs
        const maxY = featureExtractor.maxY

        let x = 0
        for (let i = 0; i < shapes.length; i += 2) {
          let L = shapes[i], R = shapes[i + 1]
          x = drawPair(x, L, R)
          x = drawPair(x, R, L)
        }

        function drawPair(x, shape1, shape2) {
          // spacing = left-glyph-rsb + right-glyph-lsb + kerning
          const kerning = font.getKerningValue(shape1.glyph, shape2.glyph)
          const spacing = shape1.RSB + shape2.LSB + kerning
          // const spacingPct = spacing / font.unitsPerEm
          const spacingPct = spacing / featureExtractor.spaceBasis

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
      }

    }

    g.drawOrigin(red.alpha(0.7))
    // c.needsDraw = true
  } // draw
})
} // function createCanvas

