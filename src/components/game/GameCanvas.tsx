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
        <fogExp2 attach="fog" args={["#05060a", 0.032]} />
        <ambientLight intensity={0.12} color="#5b6b8a" />
        <hemisphereLight args={["#243046", "#05060a", 0.25]} />
        <directionalLight
          position={[-30, 40, -20]}
          intensity={0.35}
          color="#7f93c9"
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
