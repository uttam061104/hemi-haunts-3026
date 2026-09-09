import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Scene } from "./Scene";
import { HUD } from "./HUD";

export function GameCanvas() {
  return (
    <div className="fixed inset-0 bg-black">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.7, 24], fov: 72, near: 0.1, far: 220 }}
        gl={{ antialias: false }}
      >
        <color attach="background" args={["#05060a"]} />
        <fogExp2 attach="fog" args={["#070910", 0.016]} />
        <ambientLight intensity={0.55} color="#6b7ea6" />
        <hemisphereLight args={["#3d4c6b", "#0b0d12", 0.8]} />
        <directionalLight
          position={[-30, 40, -20]}
          intensity={0.9}
          color="#8fa3d6"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <HUD />
    </div>
  );
}
