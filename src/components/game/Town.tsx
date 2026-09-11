import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { GRAVES, useGame } from "@/lib/game/store";
import { BEACON, WATER_TOWER, type TownData } from "./town";

const PALETTE = {
  road: "#2b2e36",
  soil: "#242a22",
  ground: "#1d2026",
  dark: "#14161c",
  stone: "#343943",
  orange: "#ff4b0f",
};

function Car({ rot }: { rot: number }) {
  return (
    <group rotation-y={rot}>
      <mesh position-y={0.6} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.8, 4]} />
        <meshStandardMaterial color="#3a3f46" flatShading roughness={0.85} metalness={0.15} />
      </mesh>
      <mesh position={[0, 1.25, -0.2]} castShadow>
        <boxGeometry args={[1.7, 0.7, 1.8]} />
        <meshStandardMaterial color="#22262c" flatShading roughness={0.7} />
      </mesh>
      {[
        [-0.95, -1.3],
        [0.95, -1.3],
        [-0.95, 1.3],
        [0.95, 1.3],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x!, 0.35, z!]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.35, 0.35, 0.25, 8]} />
          <meshStandardMaterial color="#101216" flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Tree({ s }: { s: number }) {
  return (
    <group scale={s}>
      <mesh position-y={1.6} castShadow>
        <cylinderGeometry args={[0.16, 0.28, 3.2, 6]} />
        <meshStandardMaterial color="#2a2117" flatShading roughness={1} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position-y={3.2 + i * 0.5} rotation-y={i * 0.7} castShadow>
          <coneGeometry args={[1.5 - i * 0.35, 1.5, 6]} />
          <meshStandardMaterial color={i % 2 ? "#26302a" : "#1e2823"} flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function WaterTower() {
  return (
    <group position={[WATER_TOWER.x, 0, WATER_TOWER.z]}>
      {[
        [-2, -2],
        [2, -2],
        [-2, 2],
        [2, 2],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x! * 0.9, 6, z! * 0.9]} rotation-x={z! > 0 ? 0.06 : -0.06} castShadow>
          <cylinderGeometry args={[0.18, 0.22, 12, 5]} />
          <meshStandardMaterial color={PALETTE.dark} flatShading roughness={1} />
        </mesh>
      ))}
      <mesh position-y={11.5} castShadow>
        <boxGeometry args={[5.4, 0.4, 5.4]} />
        <meshStandardMaterial color="#1a1d24" flatShading />
      </mesh>
      <mesh position-y={14.5} castShadow>
        <cylinderGeometry args={[3, 3.2, 5.6, 10]} />
        <meshStandardMaterial color="#3c414b" flatShading roughness={0.95} />
      </mesh>
      <mesh position-y={17.9}>
        <coneGeometry args={[3.3, 1.8, 10]} />
        <meshStandardMaterial color="#22262e" flatShading />
      </mesh>
      <mesh position={[0, 14.6, 3.25]}>
        <planeGeometry args={[3.6, 1.6]} />
        <meshBasicMaterial color={PALETTE.orange} toneMapped={false} transparent opacity={0.55} />
      </mesh>
      <pointLight position={[0, 12.5, 0]} color="#ff8a3d" intensity={120} distance={34} decay={2} />
    </group>
  );
}

function Beacon() {
  const s = useGame();
  const beamRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const online = s.beaconReady;
  const won = s.phase === "won";

  useFrame((_, dt) => {
    const t = performance.now() / 1000;
    if (ringRef.current) {
      ringRef.current.rotation.y += dt * (online ? 1.6 : 0.25);
      ringRef.current.position.y = 2.2 + Math.sin(t * 1.4) * 0.18;
    }
    if (beamRef.current) {
      const target = won ? 1 : online ? 0.35 : 0;
      const m = beamRef.current.material as THREE.MeshBasicMaterial;
      m.opacity += (target * 0.55 - m.opacity) * Math.min(1, dt * 2);
      beamRef.current.scale.x = beamRef.current.scale.z = won ? 1.6 : 1;
      beamRef.current.visible = m.opacity > 0.01;
    }
    if (lightRef.current) {
      const base = won ? 900 : online ? 320 : 60;
      lightRef.current.intensity = base + Math.sin(t * 6) * (online ? 60 : 10);
    }
  });

  return (
    <group position={[BEACON.x, 0, BEACON.z]}>
      <mesh position-y={0.25} receiveShadow>
        <cylinderGeometry args={[3.4, 3.8, 0.5, 12]} />
        <meshStandardMaterial color="#2c313a" flatShading roughness={1} />
      </mesh>
      <mesh position-y={1.3} castShadow>
        <cylinderGeometry args={[0.9, 1.2, 2.2, 8]} />
        <meshStandardMaterial color="#1a1d23" flatShading roughness={0.9} />
      </mesh>
      <mesh ref={ringRef} position-y={2.2}>
        <torusGeometry args={[1.25, 0.12, 6, 16]} />
        <meshBasicMaterial color={PALETTE.orange} toneMapped={false} />
      </mesh>
      <mesh position-y={3.1}>
        <octahedronGeometry args={[0.75, 0]} />
        <meshBasicMaterial
          color={online ? "#ffb066" : "#5a4136"}
          toneMapped={false}
          wireframe={!online}
        />
      </mesh>
      <mesh ref={beamRef} position-y={40} visible={false}>
        <cylinderGeometry args={[0.9, 1.6, 80, 10, 1, true]} />
        <meshBasicMaterial
          color={PALETTE.orange}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={lightRef} position={[0, 3.2, 0]} color="#ff6a1f" intensity={60} distance={won ? 90 : 40} decay={2} />
      <Html position={[0, 4.6, 0]} center distanceFactor={22} zIndexRange={[5, 0]}>
        <div className="grave-plate">{online ? "HEMI BEACON — ONLINE" : "HEMI BEACON"}</div>
      </Html>
    </group>
  );
}

export function Town({ data }: { data: TownData }) {
  const s = useGame();

  return (
    <group>
      {/* ground */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color={PALETTE.ground} roughness={1} />
      </mesh>

      {/* main street */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, -10]} receiveShadow>
        <planeGeometry args={[9, 120]} />
        <meshStandardMaterial color={PALETTE.road} roughness={1} />
      </mesh>
      {/* start area apron */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 30]} receiveShadow>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#333842" roughness={1} />
      </mesh>

      {/* graveyard soil */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, -54]} receiveShadow>
        <planeGeometry args={[64, 32]} />
        <meshStandardMaterial color={PALETTE.soil} roughness={1} />
      </mesh>

      {data.buildings.map((b, i) => (
        <group key={`b${i}`} position={[b.x, 0, b.z]}>
          <mesh position-y={b.h / 2} castShadow receiveShadow>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial
              color={`rgb(${Math.round(52 + b.tone * 52)}, ${Math.round(50 + b.tone * 48)}, ${Math.round(60 + b.tone * 52)})`}
              roughness={0.95}
              flatShading
            />
          </mesh>
          {b.roof === "cone" ? (
            <mesh position-y={b.h + 0.9} rotation-y={Math.PI / 4} castShadow>
              <coneGeometry args={[Math.max(b.w, b.d) * 0.78, 2.4, 4]} />
              <meshStandardMaterial color="#20232b" flatShading roughness={1} />
            </mesh>
          ) : (
            <mesh position-y={b.h + 0.15} castShadow>
              <boxGeometry args={[b.w + 0.5, 0.3, b.d + 0.5]} />
              <meshStandardMaterial color="#20232b" flatShading roughness={1} />
            </mesh>
          )}
          {b.lit && (
            <mesh position={[0, b.h * 0.55, b.d / 2 + 0.02]}>
              <planeGeometry args={[1.1, 1.4]} />
              <meshBasicMaterial color="#ffa martin" toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      ))}

      <WaterTower />
      <Beacon />

      {data.lamps.map((l, i) => (
        <group key={`l${i}`} position={[l.x, 0, l.z]}>
          <mesh position-y={2.6} castShadow>
            <cylinderGeometry args={[0.12, 0.16, 5.2, 5]} />
            <meshStandardMaterial color="#101218" flatShading />
          </mesh>
          <mesh position-y={5.3}>
            <boxGeometry args={[0.7, 0.5, 0.7]} />
            <meshBasicMaterial color="#ffc48a" toneMapped={false} />
          </mesh>
          <pointLight position={[0, 5.1, 0]} color="#ff9a4d" intensity={150} distance={30} decay={2} />
        </group>
      ))}

      {data.fences.map((f, i) => (
        <mesh key={`f${i}`} position={[f.x, 0.9, f.z]} rotation-y={f.rot} castShadow receiveShadow>
          <boxGeometry args={[f.len, 1.8, 0.28]} />
          <meshStandardMaterial color="#242832" flatShading roughness={1} />
        </mesh>
      ))}

      {data.props.map((p, i) => {
        if (p.kind === "car")
          return (
            <group key={`p${i}`} position={[p.x, 0, p.z]}>
              <Car rot={p.rot} />
            </group>
          );
        if (p.kind === "tree")
          return (
            <group key={`p${i}`} position={[p.x, 0, p.z]} rotation-y={p.rot}>
              <Tree s={p.s} />
            </group>
          );
        if (p.kind === "barrel")
          return (
            <mesh key={`p${i}`} position={[p.x, 0.55 * p.s, p.z]} rotation-y={p.rot} castShadow>
              <cylinderGeometry args={[0.42 * p.s, 0.42 * p.s, 1.1 * p.s, 8]} />
              <meshStandardMaterial color="#4a3a22" flatShading roughness={1} />
            </mesh>
          );
        if (p.kind === "crate")
          return (
            <mesh key={`p${i}`} position={[p.x, 0.45 * p.s, p.z]} rotation-y={p.rot} castShadow>
              <boxGeometry args={[0.9 * p.s, 0.9 * p.s, 0.9 * p.s]} />
              <meshStandardMaterial color="#3a2f21" flatShading roughness={1} />
            </mesh>
          );
        return (
          <mesh key={`p${i}`} position={[p.x, p.s * 0.28, p.z]} rotation-y={p.rot}>
            <dodecahedronGeometry args={[p.s * 0.5, 0]} />
            <meshStandardMaterial color="#20232a" flatShading roughness={1} />
          </mesh>
        );
      })}

      {data.signs.map((sg) => (
        <group key={sg.label} position={[sg.x, 0, sg.z]} rotation-y={sg.rot}>
          <mesh position-y={1.4} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 2.8, 5]} />
            <meshStandardMaterial color="#15181e" flatShading />
          </mesh>
          <Html position={[0, 2.9, 0]} center distanceFactor={20} zIndexRange={[4, 0]}>
            <div className="street-sign">{sg.label}</div>
          </Html>
        </group>
      ))}

      {GRAVES.map((g, i) => {
        const done = s.clearedFlags[i];
        return (
          <group key={g.name} position={[g.x, 0, g.z]}>
            <mesh position-y={0.15} receiveShadow>
              <boxGeometry args={[2.6, 0.3, 4]} />
              <meshStandardMaterial color="#2e323a" flatShading roughness={1} />
            </mesh>
            <mesh position={[0, 1.2, -1.6]} castShadow>
              <boxGeometry args={[2, 2.4, 0.35]} />
              <meshStandardMaterial color="#333741" flatShading roughness={0.9} />
            </mesh>
            <mesh position={[0, 2.5, -1.6]} castShadow>
              <cylinderGeometry args={[1, 1, 0.35, 8, 1, false, 0, Math.PI]} />
              <meshStandardMaterial color="#333741" flatShading roughness={0.9} />
            </mesh>
            <pointLight
              position={[0, 1.6, 0]}
              color={done ? "#4d6f7a" : PALETTE.orange}
              intensity={done ? 18 : 55}
              distance={14}
              decay={2}
            />
            <Html position={[0, 3.6, -1.6]} center distanceFactor={17} zIndexRange={[5, 0]}>
              <div className={done ? "grave-plate grave-plate--done" : "grave-plate"}>{g.name}</div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
