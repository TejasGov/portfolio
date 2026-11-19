import { useEffect } from 'react'
import { ScrollTrigger } from './scroll'
import { store } from './store'

/** Feed a tall chapter's scroll progress (0 at its top, 1 at its bottom) into the store. */
export function useProgress(ref, key) {
  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: ref.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: self => store.set(key, self.progress),
      onRefresh: self => store.set(key, self.progress),
    })
    return () => st.kill()
  }, [ref, key])
}

const covering = new Set()
/** While a paper chapter fully covers the screen, the WebGL stage stops rendering. */
export function usePaper(ref) {
  useEffect(() => {
    const el = ref.current
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom bottom',
      onToggle: self => {
        if (self.isActive) covering.add(el)
        else covering.delete(el)
        store.set('night', covering.size === 0)
      },
    })
    return () => {
      st.kill()
      covering.delete(el)
      store.set('night', covering.size === 0)
    }
  }, [ref])
}

/** Report which chapter is on screen, for the running head. */
export function useRunningHead(ref, label) {
  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: ref.current,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: self => self.isActive && store.set('chapterLabel', label),
    })
    return () => st.kill()
  }, [ref, label])
}
