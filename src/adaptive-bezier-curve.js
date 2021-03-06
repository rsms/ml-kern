/*
adaptive-bezier-curve by Matt DesLauriers

Modified BSD License
====================================================
Anti-Grain Geometry - Version 2.4
Copyright (C) 2002-2005 Maxim Shemanarev (McSeem)

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:

  1. Redistributions of source code must retain the above copyright
     notice, this list of conditions and the following disclaimer.

  2. Redistributions in binary form must reproduce the above copyright
     notice, this list of conditions and the following disclaimer in
     the documentation and/or other materials provided with the
     distribution.

  3. The name of the author may not be used to endorse or promote
     products derived from this software without specific prior
     written permission.

THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR
IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT,
INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING
IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
*/

function clone(point) { //TODO: use gl-vec2 for this
  return [point[0], point[1]]
}

function vec2(x, y) {
  return [x, y]
}


let opt = {}

var RECURSION_LIMIT = typeof opt.recursion === 'number' ? opt.recursion : 8
var FLT_EPSILON = typeof opt.epsilon === 'number' ? opt.epsilon : 1.19209290e-7
var PATH_DISTANCE_EPSILON = typeof opt.pathEpsilon === 'number' ? opt.pathEpsilon : 1.0

var curve_angle_tolerance_epsilon = typeof opt.angleEpsilon === 'number' ? opt.angleEpsilon : 0.01
var m_angle_tolerance = opt.angleTolerance || 0
var m_cusp_limit = opt.cuspLimit || 0

export function adaptiveBezierCurve(start, c1, c2, end, scale, points) {
  if (!points)
    points = []

  scale = typeof scale === 'number' ? scale : 1.0
  var distanceTolerance = PATH_DISTANCE_EPSILON / scale
  distanceTolerance *= distanceTolerance
  begin(start, c1, c2, end, points, distanceTolerance)
  return points
}


////// Based on:
////// https://github.com/pelson/antigrain/blob/master/agg-2.4/src/agg_curves.cpp

function begin(start, c1, c2, end, points, distanceTolerance) {
  points.push(clone(start))
  var x1 = start[0],
    y1 = start[1],
    x2 = c1[0],
    y2 = c1[1],
    x3 = c2[0],
    y3 = c2[1],
    x4 = end[0],
    y4 = end[1]
  recursive(x1, y1, x2, y2, x3, y3, x4, y4, points, distanceTolerance, 0)
  points.push(clone(end))
}

function recursive(x1, y1, x2, y2, x3, y3, x4, y4, points, distanceTolerance, level) {
  if(level > RECURSION_LIMIT)
    return

  var pi = Math.PI

  // Calculate all the mid-points of the line segments
  //----------------------
  var x12   = (x1 + x2) / 2
  var y12   = (y1 + y2) / 2
  var x23   = (x2 + x3) / 2
  var y23   = (y2 + y3) / 2
  var x34   = (x3 + x4) / 2
  var y34   = (y3 + y4) / 2
  var x123  = (x12 + x23) / 2
  var y123  = (y12 + y23) / 2
  var x234  = (x23 + x34) / 2
  var y234  = (y23 + y34) / 2
  var x1234 = (x123 + x234) / 2
  var y1234 = (y123 + y234) / 2

  if(level > 0) { // Enforce subdivision first time
    // Try to approximate the full cubic curve by a single straight line
    //------------------
    var dx = x4-x1
    var dy = y4-y1

    var d2 = Math.abs((x2 - x4) * dy - (y2 - y4) * dx)
    var d3 = Math.abs((x3 - x4) * dy - (y3 - y4) * dx)

    var da1, da2

    if(d2 > FLT_EPSILON && d3 > FLT_EPSILON) {
      // Regular care
      //-----------------
      if((d2 + d3)*(d2 + d3) <= distanceTolerance * (dx*dx + dy*dy)) {
        // If the curvature doesn't exceed the distanceTolerance value
        // we tend to finish subdivisions.
        //----------------------
        if(m_angle_tolerance < curve_angle_tolerance_epsilon) {
          points.push(vec2(x1234, y1234))
          return
        }

        // Angle & Cusp Condition
        //----------------------
        var a23 = Math.atan2(y3 - y2, x3 - x2)
        da1 = Math.abs(a23 - Math.atan2(y2 - y1, x2 - x1))
        da2 = Math.abs(Math.atan2(y4 - y3, x4 - x3) - a23)
        if(da1 >= pi) da1 = 2*pi - da1
        if(da2 >= pi) da2 = 2*pi - da2

        if(da1 + da2 < m_angle_tolerance) {
          // Finally we can stop the recursion
          //----------------------
          points.push(vec2(x1234, y1234))
          return
        }

        if(m_cusp_limit !== 0.0) {
          if(da1 > m_cusp_limit) {
            points.push(vec2(x2, y2))
            return
          }

          if(da2 > m_cusp_limit) {
            points.push(vec2(x3, y3))
            return
          }
        }
      }
    }
    else {
      if(d2 > FLT_EPSILON) {
        // p1,p3,p4 are collinear, p2 is considerable
        //----------------------
        if(d2 * d2 <= distanceTolerance * (dx*dx + dy*dy)) {
          if(m_angle_tolerance < curve_angle_tolerance_epsilon) {
            points.push(vec2(x1234, y1234))
            return
          }

          // Angle Condition
          //----------------------
          da1 = Math.abs(Math.atan2(y3 - y2, x3 - x2) - Math.atan2(y2 - y1, x2 - x1))
          if(da1 >= pi) da1 = 2*pi - da1

          if(da1 < m_angle_tolerance) {
            points.push(vec2(x2, y2))
            points.push(vec2(x3, y3))
            return
          }

          if(m_cusp_limit !== 0.0) {
            if(da1 > m_cusp_limit) {
              points.push(vec2(x2, y2))
              return
            }
          }
        }
      }
      else if(d3 > FLT_EPSILON) {
        // p1,p2,p4 are collinear, p3 is considerable
        //----------------------
        if(d3 * d3 <= distanceTolerance * (dx*dx + dy*dy)) {
          if(m_angle_tolerance < curve_angle_tolerance_epsilon) {
            points.push(vec2(x1234, y1234))
            return
          }

          // Angle Condition
          //----------------------
          da1 = Math.abs(Math.atan2(y4 - y3, x4 - x3) - Math.atan2(y3 - y2, x3 - x2))
          if(da1 >= pi) da1 = 2*pi - da1

          if(da1 < m_angle_tolerance) {
            points.push(vec2(x2, y2))
            points.push(vec2(x3, y3))
            return
          }

          if(m_cusp_limit !== 0.0) {
            if(da1 > m_cusp_limit)
            {
              points.push(vec2(x3, y3))
              return
            }
          }
        }
      }
      else {
        // Collinear case
        //-----------------
        dx = x1234 - (x1 + x4) / 2
        dy = y1234 - (y1 + y4) / 2
        if(dx*dx + dy*dy <= distanceTolerance) {
          points.push(vec2(x1234, y1234))
          return
        }
      }
    }
  }

  // Continue subdivision
  //----------------------
  recursive(x1, y1, x12, y12, x123, y123, x1234, y1234, points, distanceTolerance, level + 1)
  recursive(x1234, y1234, x234, y234, x34, y34, x4, y4, points, distanceTolerance, level + 1)
}
