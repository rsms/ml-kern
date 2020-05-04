#!/usr/bin/env node
const fs = require('fs')
const Path = require('path')
const { SourceMapConsumer, SourceMapGenerator } = require('source-map')

const log = console.log.bind(console)

function usage() {
  console.error(`usage: jsmerge.js <outfile> <infile1> [<infileN> ...]`)
  console.error(`Merges all files together with sourcemap`)
  process.exit(1)
}

async function main(argv) {
  if (argv.some(s => s.startsWith("-h") || s.startsWith("--h"))) {
    return usage()
  }
  if (argv.length < 4) {
    return usage()
  }
  let outfile = argv[2]
  let infiles = argv.slice(3)
  await mergeFiles(infiles, outfile, "../src")
}

const sourceMappingURLBuf1 = Buffer.from("//# sourceMappingURL=", "utf8")
const sourceMappingURLBuf2 = Buffer.from("//#sourceMappingURL=", "utf8")


async function loadSourceMap(filename, source, isSecondLevel) {
  let m = /(?:\n|;|^)\/\/#\s*sourceMappingURL\s*=([^\r\n]+)/g.exec(source)
  if (m) {
    let sourceMapFile = Path.resolve(Path.dirname(filename), m[1])
    let rawSourceMap = JSON.parse(fs.readFileSync(sourceMapFile, "utf8"))
    rawSourceMap.file = filename
    return await new SourceMapConsumer(rawSourceMap)
  } else if (!isSecondLevel) {
    log(`no sourcemap found in ${filename}`)
  } // else: This is okay and will likely fail for source-level files
  return null
}


async function loadSourceMapInFile(filename) {
  let contents = await fs.promises.readFile(filename, "utf8")
  return await loadSourceMap(filename, contents, /*isSecondLevel*/true)
}


async function loadSourceFile(filename) {
  let contents = await fs.promises.readFile(filename, "utf8")
  let map = await loadSourceMap(filename, contents)
  if (map) {
    contents = stripSourceMappingURLComment(contents)
  }
  return {
    filename,
    contents,
    map,
  }
}


async function mergeFiles(infiles, outfile, sourceRoot) {
  let files = await Promise.all(infiles.map(loadSourceFile))

  log("jsmerge", files.map(f => f.filename).join(" + "), "=>", outfile)


  // relative path from outfile's perspective
  const outdir = Path.resolve(outfile, "..")
  function reloutpath(abspath) {
    return Path.relative(outdir, abspath)
  }


  // Load source maps for second-degree source files.
  // This resolves source positions for original source files when intermediate build
  // products are used, like for instance with TypeScript.
  let secondDegreeMaps = new Map()
  let secondDegreeMapPromises = []
  let sourceFilenames = new Map()
  let sourceFilenames2 = new Map()
  for (let f of files) {
    // note: extra ".." since esbuild does not change source paths
    // TODO: read sourceRoot is available (note: esbuild doesn't write one.)
    const dir = Path.resolve(f.filename, "..", "..")

    f.map.eachMapping(m => {
      if (m.source && !secondDegreeMaps.has(m.source)) {

        let absSourcePath = Path.resolve(dir, m.source)
        sourceFilenames.set(m.source, reloutpath(absSourcePath))
        // log("* ", m.source, "=>", reloutpath(absSourcePath))

        secondDegreeMaps.set(m.source, {})
        secondDegreeMapPromises.push(loadSourceMapInFile(m.source).then(map2 => {
          secondDegreeMaps.set(m.source, map2)
          if (map2) {
            let dir2 = Path.resolve(absSourcePath, "..")
            map2.eachMapping(m2 => {
              if (!sourceFilenames2.has(m2.source)) {

                let absSourcePath2 = Path.resolve(dir2, m2.source)
                sourceFilenames2.set(m2.source, reloutpath(absSourcePath2))
                // log("**", m2.source, "=>", reloutpath(absSourcePath2))

              }
            })
          }
        }))
      }
    })
  }
  await Promise.all(secondDegreeMapPromises)


  // this will become the unified source map
  let outmap = new SourceMapGenerator({ file: outfile })
  let lineoffs = 0
  let outsource = ""

  // copy mappings from input files to unified outmap
  for (let f of files) {
    f.map.eachMapping(m => {
      let mapping = {
        source: sourceFilenames.get(m.source) || m.source,
        generated: {
          line:   m.generatedLine + lineoffs,
          column: m.generatedColumn,
        },
        original: {
          line:   m.originalLine,
          column: m.originalColumn,
        },
        name: m.name,
      }

      let secondMap = secondDegreeMaps.get(m.source)
      if (secondMap) {
        // use second-degree source mapping
        let orig = secondMap.originalPositionFor({
          line: m.originalLine,
          column: m.originalColumn,
        })
        if (orig && orig.line) {
          mapping.original = { line: orig.line, column: orig.column }
          mapping.source = sourceFilenames2.get(orig.source) || orig.source
          mapping.name = orig.name
        }
      }

      outmap.addMapping(mapping)
    })

    let contents = stringWithTrailingNewline(f.contents)
    lineoffs += countLines(contents)
    outsource += contents
  }

  let outmapfile = outfile + ".map"
  outsource = outsource.trimEnd("\n") + `\n//# sourceMappingURL=${Path.basename(outmapfile)}\n`

  return Promise.all([
    fs.promises.writeFile(outmapfile, outmap.toString(), {encoding:"utf8"}),
    fs.promises.writeFile(outfile, outsource, {encoding:"utf8"}),
  ])
}


function countLines(s) {
  let lines = 0
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) == 0xA) {
      lines++
    }
  }
  return lines
}


function stringWithTrailingNewline(s) {
  if (s.charCodeAt(s.length-1) != 0xA) {
    s = s + "\n"
  }
  return s
}


function stripSourceMappingURLComment(s) {
  return s.replace(/\n\/\/#\s*sourceMappingURL\s*=[^\r\n]*/g, "\n")
}


main(process.argv).catch(err => {
  console.error(err.stack||String(err))
  process.exit(1)
})
