import React from "react";
import { GrainGradient } from "@paper-design/shaders-react";

export function GradientBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: -10 }}>
      <GrainGradient
        style={{ height: "100%", width: "100%" }}
        colorBack="hsl(0, 0%, 0%)"
        softness={0.76}
        intensity={0.45}
        noise={0}
        shape="corners"
        offsetX={0}
        offsetY={0}
        scale={1}
        rotation={0}
        speed={1}
        colors={["hsl(120, 100%, 50%)", "hsl(210, 100%, 50%)", "hsl(225, 73%, 57%)", "hsl(280, 100%, 50%)", "hsl(290, 100%, 65%)", "hsl(300, 100%, 50%)"]}
      />
    </div>
  );
}
