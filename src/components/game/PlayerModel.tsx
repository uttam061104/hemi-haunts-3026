import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

/** Refs for every animated part of the stylized low-poly survivor. */
export interface PlayerRig {
  root: RefObject<THREE.Group | null>;
  body: RefObject<THREE.Group | null>;
  head: RefObject<THREE.Group | null>;
  armL: RefObject<THREE.Group | null>;
  armR: RefObject<THREE.Group | null>;
  legL: RefObject<THREE.Group | null>;
  legR: RefObject<THREE.Group | null>;
  weapon: RefObject<THREE.Group | null>;
}

export function usePlayerRig(): PlayerRig {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const weapon = useRef<THREE.Group>(null);
  return useMemo(
    () => ({ root, body, head, armL, armR, legL, legR, weapon }),
    // refs are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}

export interface PlayerAnimInput {
  /** horizontal speed in m/s */
  speed: number;
  sprinting: boolean;
  /** 0..1 attack swing progress, 1 = just swung */
  swing: number;
  /** view pitch, radians */
  pitch: number;
  t: number;
  dt: number;
}

const state = { cycle: 0 };

export function animatePlayer(rig: PlayerRig, i: PlayerAnimInput) {
  const moving = i.speed > 0.4;
  const rate = moving ? (i.sprinting ? 11 : 7) : 2.2;
  state.cycle += i.dt * rate;
  const c = state.cycle;
  const amp = moving ? (i.sprinting ? 1.05 : 0.72) : 0.09;
  const lean = i.sprinting && moving ? 0.22 : moving ? 0.09 : 0;

  if (rig.body.current) {
    rig.body.current.rotation.x = lean;
    rig.body.current.rotation.z = Math.sin(c) * (moving ? 0.05 : 0.015);
    rig.body.current.position.y = 0.02 + Math.abs(Math.sin(c)) * (moving ? 0.07 : 0.015);
  }
  if (rig.head.current) {
    rig.head.current.rotation.x = THREE.MathUtils.clamp(-i.pitch * 0.45, -0.5, 0.5) - lean;
    rig.head.current.rotation.y = Math.sin(i.t * 0.7) * (moving ? 0.03 : 0.12);
  }
  const swingBack = i.swing * 1.4;
  if (rig.armR.current) {
    rig.armR.current.rotation.x = -Math.sin(c) * amp * 0.6 - 0.25 - swingBack;
    rig.armR.current.rotation.z = 0.12;
  }
  if (rig.armL.current) {
    rig.armL.current.rotation.x = Math.sin(c) * amp * 0.6 - 0.2;
    rig.armL.current.rotation.z = -0.12;
  }
  if (rig.legL.current) rig.legL.current.rotation.x = Math.sin(c) * amp;
  if (rig.legR.current) rig.legR.current.rotation.x = -Math.sin(c) * amp;
  if (rig.weapon.current) rig.weapon.current.rotation.x = -0.3 - swingBack * 0.8;
}

const SKIN = "#c79a73";
const CLOTH = "#2a2f38";
const CLOTH_DARK = "#1b1f26";
const BOOT = "#14161b";
const ACCENT = "#ff4b0f";

function Limb({
  length,
  width,
  color,
}: {
  length: number;
  width: number;
  color: string;
}) {
  return (
    <mesh position-y={-length / 2} castShadow>
      <boxGeometry args={[width, length, width]} />
      <meshStandardMaterial color={color} flatShading roughness={1} />
    </mesh>
  );
}

export function PlayerModel({ rig, weaponId }: { rig: PlayerRig; weaponId: string }) {
  return (
    <group ref={rig.root} visible={false}>
      <group ref={rig.body} position-y={0.92}>
        {/* hips */}
        <mesh position-y={-0.08} castShadow>
          <boxGeometry args={[0.5, 0.28, 0.32]} />
          <meshStandardMaterial color={CLOTH_DARK} flatShading roughness={1} />
        </mesh>
        {/* torso */}
        <mesh position-y={0.32} castShadow>
          <boxGeometry args={[0.56, 0.68, 0.34]} />
          <meshStandardMaterial color={CLOTH} flatShading roughness={1} />
        </mesh>
        {/* chest strap */}
        <mesh position={[0, 0.34, 0.18]} rotation-z={0.5}>
          <boxGeometry args={[0.1, 0.72, 0.03]} />
          <meshStandardMaterial color={ACCENT} flatShading roughness={0.8} />
        </mesh>
        {/* shoulders */}
        <mesh position={[-0.36, 0.6, 0]} castShadow>
          <boxGeometry args={[0.2, 0.2, 0.32]} />
          <meshStandardMaterial color={CLOTH_DARK} flatShading roughness={1} />
        </mesh>
        <mesh position={[0.36, 0.6, 0]} castShadow>
          <boxGeometry args={[0.2, 0.2, 0.32]} />
          <meshStandardMaterial color={CLOTH_DARK} flatShading roughness={1} />
        </mesh>

        {/* head + hood */}
        <group ref={rig.head} position-y={0.78}>
          <mesh castShadow>
            <boxGeometry args={[0.34, 0.36, 0.32]} />
            <meshStandardMaterial color={SKIN} flatShading roughness={1} />
          </mesh>
          {/* beanie / hood */}
          <mesh position-y={0.19} castShadow>
            <boxGeometry args={[0.38, 0.16, 0.36]} />
            <meshStandardMaterial color="#101318" flatShading roughness={1} />
          </mesh>
          <mesh position={[0, 0.19, 0.185]}>
            <planeGeometry args={[0.14, 0.08]} />
            <meshBasicMaterial color={ACCENT} toneMapped={false} />
          </mesh>
          {/* hood collar */}
          <mesh position={[0, -0.2, -0.06]} castShadow>
            <boxGeometry args={[0.42, 0.14, 0.34]} />
            <meshStandardMaterial color={CLOTH_DARK} flatShading roughness={1} />
          </mesh>
          {/* eyes */}
          <mesh position={[-0.08, 0.02, 0.165]}>
            <planeGeometry args={[0.08, 0.05]} />
            <meshBasicMaterial color="#0d0f12" toneMapped={false} />
          </mesh>
          <mesh position={[0.08, 0.02, 0.165]}>
            <planeGeometry args={[0.08, 0.05]} />
            <meshBasicMaterial color="#0d0f12" toneMapped={false} />
          </mesh>
          {/* beard */}
          <mesh position={[0, -0.13, 0.13]}>
            <boxGeometry args={[0.26, 0.12, 0.08]} />
            <meshStandardMaterial color="#8d8f92" flatShading roughness={1} />
          </mesh>
        </group>

        {/* arms */}
        <group ref={rig.armL} position={[-0.36, 0.6, 0]}>
          <Limb length={0.42} width={0.15} color={CLOTH} />
          <group position-y={-0.42}>
            <Limb length={0.36} width={0.14} color={CLOTH} />
            <mesh position-y={-0.42} castShadow>
              <boxGeometry args={[0.16, 0.15, 0.16]} />
              <meshStandardMaterial color={SKIN} flatShading roughness={1} />
            </mesh>
          </group>
        </group>
        <group ref={rig.armR} position={[0.36, 0.6, 0]}>
          <Limb length={0.42} width={0.15} color={CLOTH} />
          <group position-y={-0.42}>
            <Limb length={0.36} width={0.14} color={CLOTH} />
            <mesh position-y={-0.42} castShadow>
              <boxGeometry args={[0.16, 0.15, 0.16]} />
              <meshStandardMaterial color={SKIN} flatShading roughness={1} />
            </mesh>
            {/* weapon held in the right hand */}
            <group ref={rig.weapon} position={[0, -0.48, 0.06]}>
              <HeldWeapon id={weaponId} />
            </group>
          </group>
        </group>
      </group>

      {/* legs */}
      <group ref={rig.legL} position={[-0.15, 0.84, 0]}>
        <Limb length={0.44} width={0.18} color={CLOTH_DARK} />
        <group position-y={-0.44}>
          <Limb length={0.38} width={0.17} color={CLOTH_DARK} />
          <mesh position={[0, -0.46, 0.04]} castShadow>
            <boxGeometry args={[0.2, 0.16, 0.3]} />
            <meshStandardMaterial color={BOOT} flatShading roughness={1} />
          </mesh>
        </group>
      </group>
      <group ref={rig.legR} position={[0.15, 0.84, 0]}>
        <Limb length={0.44} width={0.18} color={CLOTH_DARK} />
        <group position-y={-0.44}>
          <Limb length={0.38} width={0.17} color={CLOTH_DARK} />
          <mesh position={[0, -0.46, 0.04]} castShadow>
            <boxGeometry args={[0.2, 0.16, 0.3]} />
            <meshStandardMaterial color={BOOT} flatShading roughness={1} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Third person weapon held in the hand. */
function HeldWeapon({ id }: { id: string }) {
  if (id === "pistol") {
    return (
      <group rotation-x={Math.PI / 2}>
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.07, 0.32, 0.1]} />
          <meshStandardMaterial color="#1c1e22" flatShading />
        </mesh>
      </group>
    );
  }
  if (id === "shotgun") {
    return (
      <group rotation-x={Math.PI / 2}>
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.045, 0.05, 1.1, 8]} />
          <meshStandardMaterial color="#16181c" flatShading />
        </mesh>
        <mesh position={[0, -0.06, 0.02]}>
          <boxGeometry args={[0.08, 0.35, 0.11]} />
          <meshStandardMaterial color="#3a2a1c" flatShading />
        </mesh>
      </group>
    );
  }
  if (id === "katana") {
    return (
      <group>
        <mesh position={[0, -0.62, 0]}>
          <boxGeometry args={[0.045, 1.2, 0.02]} />
          <meshStandardMaterial
            color="#b8b0a0"
            emissive={ACCENT}
            emissiveIntensity={0.4}
            flatShading
          />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.05, 0.28, 0.05]} />
          <meshStandardMaterial color="#0f1013" flatShading />
        </mesh>
      </group>
    );
  }
  if (id === "iron") {
    return (
      <group>
        <mesh position={[0, -0.52, 0]}>
          <boxGeometry args={[0.08, 0.95, 0.03]} />
          <meshStandardMaterial color="#8f949b" flatShading />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.26, 0.06, 0.06]} />
          <meshStandardMaterial color="#2a2118" flatShading />
        </mesh>
      </group>
    );
  }
  return (
    <mesh position={[0, -0.5, 0]}>
      <cylinderGeometry args={[0.04, 0.055, 1, 6]} />
      <meshStandardMaterial color="#4a3826" flatShading />
    </mesh>
  );
}
