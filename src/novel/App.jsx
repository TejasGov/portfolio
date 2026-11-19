import { Component, Suspense, lazy, useEffect } from 'react'
import { ScrollTrigger, startScroll } from './lib/scroll'
import Book from './Book'
import Prologue from './chapters/Prologue'
import ChapterOne from './chapters/ChapterOne'
import ChapterTwo from './chapters/ChapterTwo'
import ChapterThree from './chapters/ChapterThree'
import Epilogue from './chapters/Epilogue'
import Takeover from './stage/Takeover'

const Stage = lazy(() => import('./stage/Stage'))

/** If the 3D stage fails (driver, chunk load), the book still reads: render nothing in its place. */
class StageBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

const hasWebGL = (() => {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
})()

export default function App() {
  useEffect(() => {
    const stop = startScroll()
    // Fonts and images change heights after first paint; re-measure every trigger once they land.
    document.fonts?.ready.then(() => ScrollTrigger.refresh())
    addEventListener('load', () => ScrollTrigger.refresh(), { once: true })
    return stop
  }, [])

  return (
    <>
      {hasWebGL && (
        <StageBoundary>
          <Suspense fallback={null}>
            <Stage />
          </Suspense>
        </StageBoundary>
      )}
      <Takeover />
      <Book />
      <main className="relative z-10">
        <Prologue />
        <ChapterOne />
        <ChapterTwo />
        <ChapterThree />
        <Epilogue />
      </main>
      <div className="grain" aria-hidden="true" />
    </>
  )
}
