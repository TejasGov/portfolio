import { Canvas } from '@react-three/fiber'
import { View } from '@react-three/drei'

/**
 * One fixed, transparent WebGL canvas for the whole page. Each tableau is a drei <View> that
 * tracks its own DOM slot, so layout stays in CSS while everything shares one GL context.
 */
export default function Stage() {
  return (
    <Canvas
      className="stage-canvas"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
    >
      <View.Port />
    </Canvas>
  )
}

/** A slot in the page layout where a 3D tableau renders. */
export function TableauView({ className, children }) {
  return <View className={className}>{children}</View>
}
