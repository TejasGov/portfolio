import { Canvas } from '@react-three/fiber'
import World from './World'

// Lazy chunk: three.js, the world and post-processing load after the first text paints.
export default function Scene({ veil }) {
  return (
    <Canvas
      style={{ position: 'fixed', inset: 0 }}
      dpr={[1, 1.75]}
      camera={{ fov: 42, near: 0.05, far: 2000, position: [0, 321, 34] }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      <World veil={veil} />
    </Canvas>
  )
}
