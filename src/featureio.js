const log = console.log.bind(console)

// createWriter(filename) returns an object with two methods
// for writing a file of features in a streaming manner.
//
//   write(featureData)  -- write feature data
//   end()               -- finalize writing (closes file)
export function createWriter(filename, hintTotalCount) {
  const fs = require("fs")
  const spacingArray = new DataView(new ArrayBuffer(4))
  const headerBuf = Buffer.allocUnsafe(2*4)

  // Binary format:
  //   file   = header entry{<height>}
  //   header = <uint32 width> <uint32 height>
  //   entry  = <int32 * width>

  class FeatureDataWriter {
    constructor(filename) {
      this.fd = fs.openSync(filename, "w")
      this.height = 0
      this.width = -1
      this.writebuf = null
      this.writebufOffs = 0
    }
    writeHeader(pos) {
      headerBuf.writeUInt32LE(this.width, 0)
      headerBuf.writeUInt32LE(this.height, 4)
      fs.writeSync(this.fd, headerBuf, 0, headerBuf.length, pos)
    }
    writebufFlush() {
      fs.writeSync(this.fd, this.writebuf, 0, this.writebufOffs)
      this.writebufOffs = 0
    }
    write(floatArray) {
      if (this.width == -1) {
        this.width = floatArray.length
        this.height = 0
        const writebufBlockSize = 4096
        const writebufSize = Math.ceil((this.width * 4) / writebufBlockSize) * writebufBlockSize
        this.writebuf = Buffer.allocUnsafe(writebufSize)
        this.writebufOffs = 0
        this.writeHeader(/*filepos*/undefined)
      }
      const widthInBytes = this.width * 4
      const remainingSpace = this.writebuf.length - this.writebufOffs
      if (remainingSpace < widthInBytes) {
        this.writebufFlush()
      }
      for (let i = 0; i < this.width; i++) {
        this.writebuf.writeInt32LE(normFloatToInt32(floatArray[i]), this.writebufOffs)
        this.writebufOffs += 4
      }
      // this.writebufOffs += widthInBytes
      this.height++
    }
    end() {
      if (this.height > -1) {
        this.writebufFlush()
        this.writeHeader(/*filepos*/0)
      }
      fs.closeSync(this.fd)
    }
  }
  return new FeatureDataWriter(filename)
}


// normFloatToInt32 converts a normalized floating-point number in the range [-1-1] to an int32
function normFloatToInt32(f) {
  return (0x7FFFFFFF * f) | 0
}

// int32ToNormFloat converts an int32 to a normalized floating-point number
function int32ToNormFloat(i) {
  return i / 2147483647.0 /* 0x7FFFFFFF */
}


// readSync returns a Float64Array of size width*height where
// width is read from the file header and
// height is min(limit, height read from file header).
//
// Returns an object of the following shape:
//
//   interface FeatureDataR {
//     data: Float64Array           // all values in row-major order
//     width :number                // values of eah row
//     length :number               // number of rows, i.e. "height"
//     row(rowIndex) :Float64Array  // access subarray for row
//   }
//
// Values in the Float64Array are arranged in row-major order, meaning that all the values for
// entry N is at Float64Array[N:N+width].
// Illustrated example of width=4 height=3:
//
//  x | 0  1  2  3
// y  ------------
// 0  | 0  1  2  3
// 1  | 4  5  6  7
// 2  | 8  9 10 11
//
export function readSync(filename, limit) {
  if (!limit) { limit = Infinity }

  const fs = require("fs")
  const fd = fs.openSync(filename, "r")
  let buf = Buffer.allocUnsafe(8)

  fs.readSync(fd, buf, 0, 8)
  const width = buf.readUInt32LE(0)
  const height = Math.min(limit, buf.readUInt32LE(4))
  log({width, height})

  let floatArray = new Float64Array(width * height)
  const widthInBytes = width * 4
  buf = Buffer.allocUnsafe(widthInBytes)

  let yindex = 0
  for (let y = 0; y < height; y++) {
    let z = fs.readSync(fd, buf, 0, widthInBytes)
    if (z != widthInBytes) {
      // EOF
      break
    }
    const dv = new DataView(buf.buffer, buf.byteOffset, widthInBytes)
    for (let xindex = 0; xindex < width; xindex++) {
      let v = int32ToNormFloat(dv.getInt32(xindex*4, /*littleEndian*/true))
      floatArray[yindex + xindex] = v
    }
    yindex += width
  }

  return {
    data: floatArray,
    width,
    length: height,
    row(rowIndex) {
      const start = rowIndex * width
      return this.data.subarray(start, start + width)
    },
  }
}
