// tesselate creates triangles from vertices
export function tesselate(polygons) {
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
