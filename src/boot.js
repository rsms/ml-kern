// load source-map in nodejs
try { require("source-map-support").install() } catch(_){}

// patch browser to look like node so that opentype.js doesn't fail to load
var global = (
  typeof global != "undefined" ? global :
  typeof self != "undefined" ? self :
  typeof window != "undefined" ? window :
  this
)
if (!global.module) {
  global.module = {}
}
