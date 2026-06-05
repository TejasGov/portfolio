import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, ContactShadows, Center } from '@react-three/drei';
import { useDrag } from '@use-gesture/react';
import * as THREE from 'three';

import { CARS } from '../../data/carData';
CARS.forEach((car) => useGLTF.preload(car.modelPath));

// ─── Individual car model ────────────────────────────────────────────────────
// Each Model has its OWN rotation accumulator so they never share state
const Model = ({ path, isActive, layout, isMobile, viewportWidth, manualRotationRef }) => {
  const { scene } = useGLTF(path);
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  const outerRef = useRef();
  const innerRef = useRef();
  const autoYRef = useRef(0); // independent per-car auto rotation

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.envMapIntensity = 1.5;
        }
      }
    });
  }, [clonedScene]);

  const targetScale = isActive ? (isMobile ? 2.2 : 3.3) : 0.001;
  const targetX = isActive
    ? (isMobile ? 0 : (layout === 'right' ? viewportWidth * 0.25 : -viewportWidth * 0.25))
    : (layout === 'right' ? viewportWidth * 1.2 : -viewportWidth * 1.2);
  const targetZ = isActive ? 0 : -8;
  const targetY = isActive ? (isMobile ? -1.0 : -0.8) : -0.8;

  useFrame((state, delta) => {
    if (!outerRef.current) return;

    // Always lerp position/scale smoothly
    outerRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      delta * 5
    );
    outerRef.current.position.lerp(
      new THREE.Vector3(targetX, targetY, targetZ),
      delta * 5
    );

    // Always keep auto-rotation ticking so it's continuous when this car becomes active again
    autoYRef.current += delta * 0.15;

    if (innerRef.current) {
      innerRef.current.rotation.y = autoYRef.current + (isActive ? manualRotationRef.current : 0);
    }
  });

  return (
    <group ref={outerRef} scale={0.001} position={[targetX, targetY, targetZ]}>
      <group ref={innerRef}>
        <Center>
          <primitive object={clonedScene} />
        </Center>
      </group>
      {isActive && (
        <ContactShadows
          position={[0, -0.05, 0]}
          opacity={0.7}
          scale={8}
          blur={2}
          far={1.5}
        />
      )}
    </group>
  );
};

// ─── Scene root ───────────────────────────────────────────────────────────────
export default function CarShowcaseScene({ activeCarIndex, isMobile }) {
  const { viewport } = useThree();

  // Manual drag rotation — shared: only applied to the active car
  const manualRotationRef = useRef(0);

  const bind = useDrag(({ offset: [x] }) => {
    manualRotationRef.current = x * 0.01;
  });

  return (
    <>
      <Environment preset="studio" />

      {/* Invisible drag plane */}
      <mesh {...bind()} position={[0, 0, 5]} visible={false}>
        <planeGeometry args={[100, 100]} />
      </mesh>

      <group>
        {CARS.map((car, index) => (
          <Model
            key={car.id}
            path={car.modelPath}
            isActive={activeCarIndex === index}
            layout={car.layout}
            isMobile={isMobile}
            viewportWidth={viewport.width}
            manualRotationRef={manualRotationRef}
          />
        ))}
      </group>

      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 15, 10]} intensity={2} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={1} />
    </>
  );
}
