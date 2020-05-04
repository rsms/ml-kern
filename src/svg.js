/**
 * parse an svg path data string. Generates an Array
 * of commands where each command is an Array of the
 * form `[command, arg1, arg2, ...]`
 *
 * @param {String} path
 * @return {Array}
 */
export function parse(path) {
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
