import { FontFeatureExtractor } from "./feature-extract"
import * as featureio from "./featureio"
import * as visualize from "./visualize"

const NODEJS = typeof process != "undefined"
const WEB_BROWSER = typeof document != "undefined"

const log = console.log.bind(console)


function cli_usage() {
  const argv = process.argv.slice(1)
  console.error(`usage: ${argv[0]} <input-font-file> <output-json-file>`)
  process.exit(1)
}

async function main() {
  if (!WEB_BROWSER && (process.argv.length < 4 || process.argv.includes("-h"))) {
    cli_usage()
  }

  // XXX DEBUG
  if (NODEJS) {
    require("./train").testTrain()
    return
  }

  let fe = new FontFeatureExtractor()

  const fontFile = (
    WEB_BROWSER ? "fonts/Inter-Regular.otf" :
    // WEB_BROWSER ? "fonts/HelveticaNeueLTStd-Roman.otf" :
    // WEB_BROWSER ? "fonts/Georgia.ttf" :
    process.argv[2]
  )
  WEB_BROWSER && log("loading font")
  const font = await fe.loadFont(fontFile)

  const glyphPairIterator = createGlyphPairIterator(font)

  if (WEB_BROWSER) {
    visualize.createCanvas("canvas")
    for (let pair of glyphPairIterator) {
      // log("computing features of pair", pair)
      let data = fe.computeFeaturesForGlyphPair(pair[0], pair[1])
      log("features:", data.spacing, data.features)
      if (WEB_BROWSER) {
        visualize.setShapes(fe, data.L, data.R)
        // wait for a key stroke
        // TODO: ArrowLeft to go backwards
        await keyStrokeEvent("Enter", " ", "ArrowRight")
        // await new Promise(r => setTimeout(r, 1000))
      }
    }
  } else {
    const outfile = process.argv[3]
    // const fontName = (
    //   nameEntryStr(font.names.fontFamily) + " " +
    //   nameEntryStr(font.names.fontSubfamily)
    // )
    log(`computing ${glyphPairIterator.length} pairs, writing to ${outfile}`)
    console.time("completed in")
    let w = featureio.createWriter(outfile, glyphPairIterator.length)
    let tmpFloat64Array = null
    // let limit = 2
    for (let pair of glyphPairIterator) {
      tmpFloat64Array = fe.computeFeaturesForGlyphPair(pair[0], pair[1], tmpFloat64Array).values
      w.write(tmpFloat64Array)
      // log("features:", data.spacing, data.features)
      // if (--limit == 0) break
    }
    w.end()
    console.timeEnd("completed in")
    // if (limit) { log("featureio.readSync =>", featureio.readSync(outfile)) }
  }
}


function nameEntryStr(name) {
  return (name.en || name[Object.keys(name)]).trim()
}


function keyStrokeEvent(...keyNames) {
  return new Promise(resolve => {
    keyNames = new Set(keyNames)
    function handler(ev) {
      // log(ev.key)
      if (keyNames.has(ev.key)) {
        document.removeEventListener("keydown", handler)
        resolve(ev.key)
        ev.stopPropagation()
        ev.preventDefault()
      }
    }
    document.addEventListener("keydown", handler)
  })
}


function unicodeIsPrivateSpace(cp) {
  return cp >= 0xE000 && cp < 0xF900
}


function numUniquePairs(count) {
  // includes self+self
  return count*(count+1)/2
}


function createGlyphPairIterator(font) {
  // load and filter glyphs to include
  const glyphs = Object.values(font.glyphs.glyphs).filter(g => {
    // exclude glyphs like .notdef and .null
    if (g.name[0] == ".") { return false }

    // exclude glyphs without codepoint mappings (e.g. component-only glyphs)
    if (!g.unicode) { return false }

    // exclude glyphs with only private-space codepoint mapping(s)
    if (g.unicodes.every(unicodeIsPrivateSpace)) { return false }

    // exclude empty glyphs
    const bbox = g.path.getBoundingBox()
    if (bbox.x1 == 0 && bbox.x2 == 0) { return false }

    // include all other glyphs
    return true
  })
  const nglyphs = glyphs.length

  // triangle visitation
  //
  // A = 1
  // 1  2  3
  // 1  1  1
  //
  // A = 2
  // 2  3
  // 2  2
  //
  // A = 3
  // 3
  // 3
  //
  // for (let i = 0; i < count; i++) {
  //   A = glyphs[j]
  //   for (let j = i; j < count; j++) {
  //     B = glyphs[j]
  //   }
  // }
  //
  return {
    length: numUniquePairs(nglyphs),
    [Symbol.iterator]() {
      // interator state
      let i = 0        // primary index
      let j = nglyphs  // secondary index
      // result object, to avoid GC thrash. [0]=glyphs[i], [1]=glyphs[j]
      const res = { value: [null,null] }
      return { next() {
        if (i >= nglyphs) {
          return { done:true }
        }
        if (j >= nglyphs) {
          j = i
          res.value[0] = glyphs[i++]
        }
        res.value[1] = glyphs[j++]
        let k = `${i},${j}`
        return res
      } }
    }
  }
}


main().catch(err => {
  console.error(err.stack||String(err))
  NODEJS && process.exit(1)
})
