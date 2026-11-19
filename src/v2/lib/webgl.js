// Without WebGL2 the page keeps its CSS tableau sketches instead of mounting the 3D stage.
export const hasWebGL = (() => {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
})()
