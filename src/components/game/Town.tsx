import * as THREE from "three";
import { Html } from "@react-three/drei";
import { GRAVES } from "@/lib/game/store";
import type { TownData } from "./town";

export function Town({ data }: { data: TownData }) {
  return (
    <group>
      {/* ground */}
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <planeGeometry args={[220, 220, 1, 1]} />
        <meshStandardMaterial color="#23262c" roughness={1} />
      </mesh>

      {/* main street */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, -10]}>
        <planeGeometry args={[9, 110]} />
        <meshStandardMaterial color="#31343c" roughness={1} />
      </mesh>

      {/* graveyard soil */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, -54]}>
        <planeGeometry args={[64, 32]} />
        <meshStandardMaterial color="#262a1f" roughness={1} />
      </mesh>

      {data.buildings.map((b, i) => (
        <group key={`b${i}`} position={[b.x, 0, b.z]}>
          <mesh position-y={b.h / 2} castShadow receiveShadow>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial
              color={`rgb(${Math.round(58 + b.tone * 46)}, ${Math.round(54 + b.tone * 40)}, ${Math.round(64 + b.tone * 44)})`}
              roughness={0.95}
              flatShading
            />
          </mesh>
          {/* roof */}
          <mesh position-y={b.h + 0.7} rotation-y={Math.PI / 4}>
            <coneGeometry args={[Math.max(b.w, b.d) * 0.78, 2.2, 4]} />
            <meshStandardMaterial color="#1c1e26" flatShading roughness={1} />
          </mesh>
          {/* a lit window or two */}
          {i % 3 === 0 && (
            <mesh position={[0, b.h * 0.55, b.d / 2 + 0.02]}>
              <planeGeometry args={[1.1, 1.4]} />
              <meshBasicMaterial color="#ff4b0f" toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      ))}

      {data.lamps.map((l, i) => (
        <group key={`l${i}`} position={[l.x, 0, l.z]}>
          <mesh position-y={2.6}>
            <cylinderGeometry args={[0.12, 0.16, 5.2, 5]} />
            <meshStandardMaterial color="#0c0d10" flatShading />
          </mesh>
          <mesh position-y={5.3}>
            <boxGeometry args={[0.7, 0.5, 0.7]} />
            <meshBasicMaterial color="#ffb066" toneMapped={false} />
          </mesh>
          <pointLight position={[0, 5.1, 0]} color="#ff8a3d" intensity={260} distance={34} decay={2} />
        </group>
      ))}

      {data.fences.map((f, i) => (
        <mesh key={`f${i}`} position={[f.x, 0.9, f.z]} rotation-y={f.rot}>
          <boxGeometry args={[f.len, 1.8, 0.25]} />
          <meshStandardMaterial color="#1e2028" flatShading roughness={1} />
        </mesh>
      ))}

      {data.rubble.map((r, i) => (
        <mesh key={`r${i}`} position={[r.x, r.s * 0.3, r.z]} rotation-y={i}>
          <dodecahedronGeometry args={[r.s * 0.5, 0]} />
          <meshStandardMaterial color="#1a1c1f" flatShading roughness={1} />
        </mesh>
      ))}

      {GRAVES.map((g, i) => (
        <group key={g.name} position={[g.x, 0, g.z]}>
          <mesh position-y={0.15}>
            <boxGeometry args={[2.6, 0.3, 4]} />
            <meshStandardMaterial color="#2b2e34" flatShading roughness={1} />
          </mesh>
          <mesh position={[0, 1.2, -1.6]} castShadow>
            <boxGeometry args={[2, 2.4, 0.35]} />
            <meshStandardMaterial color="#2a2c30" flatShading roughness={0.9} />
          </mesh>
          <mesh position={[0, 2.5, -1.6]}>
            <cylinderGeometry args={[1, 1, 0.35, 8, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color="#2a2c30" flatShading roughness={0.9} />
          </mesh>
          <pointLight position={[0, 1.6, 0]} color="#ff4b0f" intensity={40} distance={12} />
          <Html position={[0, 3.4, -1.6]} center distanceFactor={16} zIndexRange={[5, 0]}>
            <div className="grave-plate">{g.name}</div>
          </Html>
        </group>
      ))}
    </group>
  );
}
