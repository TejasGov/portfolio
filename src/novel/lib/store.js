/*
 * Shared, non-React state read every frame by the WebGL stage and written by scroll triggers.
 * `scene` picks what the pixels are doing; `p` values are 0..1 progress through each chapter.
 */
export const store = {
  prologue: 0, // booth → beam → hall → the takeover
  work: 0, // through the five screenings
  epilogue: 0,
  night: true, // is a night (WebGL) chapter on screen?
  mouse: { x: 0, y: 0, active: 0 },
  hud: [], // DOM nodes the stage positions each frame
  listeners: new Set(),
  set(key, value) {
    if (this[key] === value) return
    this[key] = value
    this.listeners.forEach(fn => fn(key, value))
  },
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', e => {
    store.mouse.x = (e.clientX / innerWidth) * 2 - 1
    store.mouse.y = -(e.clientY / innerHeight) * 2 + 1
    store.mouse.active = 1
  }, { passive: true })
}
