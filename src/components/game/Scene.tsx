import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { GRAVES, WEAPONS, gameStore, computeScore } from "@/lib/game/store";
import { sfx } from "@/lib/game/audio";
import { buildTown, WORLD_LIMIT, type Box } from "./town";
import { Town } from "./Town";
import playerFace from "@/assets/player-face.webp.asset.json";
import ghostFace from "@/assets/ghost-face.webp.asset.json";

const EYE = 1.7;
const RADIUS = 0.7;
const POOL = 28;

interface Ghost {
  active: boolean;
  pos: THREE.Vector3;
  hp: number;
  speed: number;
  dmg: number;
  wave: boolean;
  atk: number;
  phase: number;
  scale: number;
}

function makeGhosts(): Ghost[] {
  return Array.from({ length: POOL }, () => ({
    active: false,
    pos: new THREE.Vector3(),
    hp: 0,
    speed: 2,
    dmg: 8,
    wave: false,
    atk: 0,
    phase: 0,
    scale: 1,
  }));
}

export function Scene() {
  const { camera, gl } = useThree();
  const town = useMemo(() => buildTown(), []);
  const textures = useTexture([playerFace.url, ghostFace.url]) as THREE.Texture[];
  const faceTex = textures[0]!;
  const ghostTex = textures[1]!;

  const pos = useRef(new THREE.Vector3(0, 0, 24));
  const vel = useRef(new THREE.Vector3());
  const yaw = useRef(0);
  const pitch = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const firing = useRef(false);
  const cooldown = useRef(0);
  const swing = useRef(0);
  const health = useRef(100);
  const stamina = useRef(100);
  const ammo = useRef(0);
  const kills = useRef(0);
  const hudTimer = useRef(0);
  const stepTimer = useRef(0);
  const beatTimer = useRef(0);
  const spawnTimer = useRef(5);
  const wave = useRef<{ grave: number; remaining: number } | null>(null);
  const cleared = useRef<boolean[]>([false, false, false, false, false]);
  const ghosts = useRef<Ghost[]>(makeGhosts());
  const ghostRefs = useRef<(THREE.Group | null)[]>([]);
  const playerRef = useRef<THREE.Group>(null);
  const vmRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const torchRef = useRef<THREE.SpotLight>(null);
  const torchTargetRef = useRef<THREE.Object3D>(null);
  const flash = useRef(0);

  const colliders: Box[] = town.buildings;

  // ---------- input ----------
  useEffect(() => {
    const canvas = gl.domElement;
    const onKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      const s = gameStore.get();
      if (s.phase !== "playing") return;
      if (e.code === "KeyV") {
        gameStore.set({ camera: s.camera === "fpp" ? "tpp" : "fpp" });
      }
      if (e.code === "KeyE") tryGrave();
      if (/^Digit[1-5]$/.test(e.code)) {
        const idx = Number(e.code.slice(5)) - 1;
        if (idx <= gameStore.get().unlocked) {
          gameStore.set({ weaponIndex: idx });
          sfx.swing();
        }
      }
      if (e.code === "Escape") document.exitPointerLock();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const sens = 0.0022 * gameStore.get().sensitivity;
      yaw.current -= e.movementX * sens;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - e.movementY * sens,
        -Math.PI / 2.4,
        Math.PI / 2.4,
      );
    };
    const onDown = () => {
      if (document.pointerLockElement !== canvas) {
        void canvas.requestPointerLock();
        return;
      }
      firing.current = true;
    };
    const onUp = () => {
      firing.current = false;
    };
    const onLockChange = () => {
      if (document.pointerLockElement !== canvas) {
        firing.current = false;
        if (gameStore.get().phase === "playing") gameStore.set({ paused: true });
      } else {
        gameStore.set({ paused: false });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    document.addEventListener("pointerlockchange", onLockChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.removeEventListener("pointerlockchange", onLockChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  // ---------- helpers ----------
  function spawnGhost(waveGhost: boolean, near?: THREE.Vector3, dist = 18) {
    const g = ghosts.current.find((x) => !x.active);
    if (!g) return;
    const angle = Math.random() * Math.PI * 2;
    const d = near ? 4 : dist + Math.random() * 10;
    const origin = near ?? pos.current;
    g.active = true;
    g.pos.set(origin.x + Math.cos(angle) * d, 0, origin.z + Math.sin(angle) * d);
    const tier = gameStore.get().gravesCleared;
    g.hp = 70 + tier * 30 + (waveGhost ? 30 : 0);
    g.speed = 1.9 + Math.random() * 0.9 + tier * 0.22;
    g.dmg = 7 + tier * 2.5;
    g.wave = waveGhost;
    g.atk = 0;
    g.phase = Math.random() * 6.28;
    g.scale = 0.9 + Math.random() * 0.5;
  }

  function tryGrave() {
    const s = gameStore.get();
    if (s.nearGrave < 0 || cleared.current[s.nearGrave] || wave.current) return;
    const grave = GRAVES[s.nearGrave]!;
    wave.current = { grave: s.nearGrave, remaining: grave.ghosts };
    for (let i = 0; i < grave.ghosts; i++) spawnGhost(true);
    spawnGhost(true, pos.current);
    sfx.scream();
    sfx.whisper();
    gameStore.set({
      jumpscare: Date.now(),
      message: `${grave.name} is awake. Put them back down.`,
      waveRemaining: grave.ghosts + 1,
    });
    if (wave.current) wave.current.remaining = grave.ghosts + 1;
  }

  function attack() {
    const s = gameStore.get();
    const weapon = WEAPONS[s.weaponIndex]!;
    if (weapon.ranged && ammo.current <= 0) {
      sfx.dryFire();
      cooldown.current = 0.4;
      return;
    }
    cooldown.current = weapon.cooldown;
    swing.current = 1;

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const from = new THREE.Vector3(pos.current.x, EYE, pos.current.z);

    if (weapon.ranged) {
      ammo.current -= 1;
      if (weapon.id === "shotgun") sfx.shotgun();
      else sfx.gunshot();
      flash.current = 0.06;
    } else {
      sfx.swing();
    }

    let hits = 0;
    const candidates = ghosts.current
      .filter((g) => g.active)
      .map((g) => {
        const to = new THREE.Vector3(g.pos.x - from.x, 1.1 - from.y + g.pos.y, g.pos.z - from.z);
        const dist = to.length();
        to.normalize();
        return { g, dist, dot: to.dot(dir) };
      })
      .filter((c) => c.dist <= weapon.range && c.dot > Math.cos(weapon.spread))
      .sort((a, b) => a.dist - b.dist);

    for (const c of candidates) {
      if (hits >= weapon.pellets) break;
      hits += 1;
      c.g.hp -= weapon.damage;
      sfx.hit();
      if (c.g.hp <= 0) killGhost(c.g);
    }
  }

  function killGhost(g: Ghost) {
    g.active = false;
    kills.current += 1;
    sfx.ghostDeath();
    if (g.wave && wave.current) {
      wave.current.remaining -= 1;
      if (wave.current.remaining <= 0) {
        const idx = wave.current.grave;
        cleared.current[idx] = true;
        wave.current = null;
        const gravesCleared = cleared.current.filter(Boolean).length;
        const unlocked = Math.min(WEAPONS.length - 1, gravesCleared);
        const weapon = WEAPONS[unlocked]!;
        if (weapon.ammo > 0) ammo.current += weapon.ammo;
        health.current = Math.min(100, health.current + 20);
        sfx.unlock();
        gameStore.set({
          gravesCleared,
          clearedFlags: [...cleared.current],
          unlocked,
          weaponIndex: unlocked,
          waveRemaining: 0,
          message:
            gravesCleared >= GRAVES.length
              ? "Every grave is silent. Get out."
              : `${GRAVES[idx]!.name} rests again. ${weapon.name} unlocked.`,
        });
        if (gravesCleared >= GRAVES.length) endRun("won");
      } else {
        gameStore.set({ waveRemaining: wave.current.remaining });
      }
    }
  }

  function endRun(phase: "won" | "dead") {
    const snapshot = {
      ...gameStore.get(),
      kills: kills.current,
      health: Math.max(0, health.current),
      gravesCleared: cleared.current.filter(Boolean).length,
    };
    document.exitPointerLock();
    if (phase === "won") sfx.win();
    else sfx.gameOver();
    gameStore.set({
      phase,
      kills: snapshot.kills,
      health: snapshot.health,
      score: computeScore(snapshot),
    });
  }

  function collide(next: THREE.Vector3) {
    for (const b of colliders) {
      const minX = b.x - b.w / 2 - RADIUS;
      const maxX = b.x + b.w / 2 + RADIUS;
      const minZ = b.z - b.d / 2 - RADIUS;
      const maxZ = b.z + b.d / 2 + RADIUS;
      if (next.x > minX && next.x < maxX && next.z > minZ && next.z < maxZ) {
        const dx = Math.min(next.x - minX, maxX - next.x);
        const dz = Math.min(next.z - minZ, maxZ - next.z);
        if (dx < dz) next.x = next.x - minX < maxX - next.x ? minX : maxX;
        else next.z = next.z - minZ < maxZ - next.z ? minZ : maxZ;
      }
    }
    next.x = THREE.MathUtils.clamp(next.x, -WORLD_LIMIT, WORLD_LIMIT);
    next.z = THREE.MathUtils.clamp(next.z, -WORLD_LIMIT, WORLD_LIMIT);
  }

  // ---------- loop ----------
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const state = gameStore.get();
    if (state.phase !== "playing") return;
    const locked = document.pointerLockElement === gl.domElement;

    // movement
    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
    const move = new THREE.Vector3();
    if (locked) {
      if (keys.current["KeyW"]) move.add(forward);
      if (keys.current["KeyS"]) move.sub(forward);
      if (keys.current["KeyD"]) move.add(right);
      if (keys.current["KeyA"]) move.sub(right);
    }
    const sprinting = !!keys.current["ShiftLeft"] && stamina.current > 1 && move.lengthSq() > 0;
    const speed = sprinting ? 8.4 : 4.4;
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed);
    vel.current.lerp(move, 1 - Math.exp(-14 * dt));

    const next = pos.current.clone().addScaledVector(vel.current, dt);
    collide(next);
    pos.current.copy(next);

    stamina.current = THREE.MathUtils.clamp(
      stamina.current + (sprinting ? -26 : 14) * dt,
      0,
      100,
    );

    // footsteps
    if (vel.current.length() > 1.2) {
      stepTimer.current -= dt * (sprinting ? 1.6 : 1);
      if (stepTimer.current <= 0) {
        stepTimer.current = 0.48;
        sfx.footstep();
      }
    }

    // camera
    const eye = new THREE.Vector3(pos.current.x, EYE, pos.current.z);
    if (state.camera === "fpp") {
      camera.position.copy(eye);
    } else {
      const back = new THREE.Vector3(
        Math.sin(yaw.current),
        0,
        Math.cos(yaw.current),
      ).multiplyScalar(4.6);
      const target = eye.clone().add(back);
      target.y = EYE + 1.4 - pitch.current * 2;
      const clamped = target.clone();
      collide(clamped);
      camera.position.lerp(new THREE.Vector3(clamped.x, target.y, clamped.z), 1 - Math.exp(-16 * dt));
    }
    const look = new THREE.Vector3(
      eye.x - Math.sin(yaw.current) * Math.cos(pitch.current) * 10,
      eye.y + Math.sin(pitch.current) * 10,
      eye.z - Math.cos(yaw.current) * Math.cos(pitch.current) * 10,
    );
    camera.lookAt(look);

    // torch follows the view
    if (torchRef.current && torchTargetRef.current) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      torchRef.current.target = torchTargetRef.current;
      torchRef.current.position.copy(camera.position);
      torchTargetRef.current.position.copy(camera.position).addScaledVector(dir, 12);
      torchRef.current.updateMatrixWorld();
      torchRef.current.intensity = 70 + Math.sin(performance.now() / 130) * 8;
    }

    // player body
    if (playerRef.current) {
      playerRef.current.position.set(pos.current.x, 0, pos.current.z);
      playerRef.current.rotation.y = yaw.current;
      playerRef.current.visible = state.camera === "tpp";
    }

    // weapon viewmodel
    swing.current = Math.max(0, swing.current - dt * 4);
    if (vmRef.current) {
      vmRef.current.position.copy(camera.position);
      vmRef.current.quaternion.copy(camera.quaternion);
      vmRef.current.translateX(0.5);
      vmRef.current.translateY(-0.52 + Math.sin(performance.now() / 420) * 0.012);
      vmRef.current.translateZ(-1.15 + swing.current * 0.35);
      vmRef.current.rotateX(swing.current * 0.9);
      vmRef.current.scale.setScalar(0.62);
      vmRef.current.visible = state.camera === "fpp";
    }
    flash.current = Math.max(0, flash.current - dt);
    if (flashRef.current) {
      flashRef.current.intensity = flash.current > 0 ? 40 : 0;
      flashRef.current.position.copy(camera.position);
    }

    // attacking
    cooldown.current -= dt;
    if (firing.current && cooldown.current <= 0 && locked) attack();

    // ambient spawning
    spawnTimer.current -= dt;
    const activeCount = ghosts.current.filter((g) => g.active).length;
    const ambientCap = 3 + state.gravesCleared * 2;
    if (spawnTimer.current <= 0 && activeCount < ambientCap) {
      spawnTimer.current = Math.max(3, 9 - state.gravesCleared * 1.2);
      spawnGhost(false);
    }

    // ghosts
    let nearest = 999;
    ghosts.current.forEach((g, i) => {
      const node = ghostRefs.current[i];
      if (!g.active) {
        if (node) node.visible = false;
        return;
      }
      const toPlayer = new THREE.Vector3(
        pos.current.x - g.pos.x,
        0,
        pos.current.z - g.pos.z,
      );
      const dist = toPlayer.length();
      nearest = Math.min(nearest, dist);
      if (dist > 1.5) {
        toPlayer.normalize().multiplyScalar(g.speed * dt);
        g.pos.add(toPlayer);
      }
      g.atk -= dt;
      if (dist < 1.9 && g.atk <= 0) {
        g.atk = 1.1;
        health.current -= g.dmg;
        sfx.hurt();
        if (Math.random() < 0.25) gameStore.set({ jumpscare: Date.now() });
        if (health.current <= 0) {
          health.current = 0;
          endRun("dead");
        }
      }
      if (node) {
        node.visible = true;
        const bob = Math.sin(performance.now() / 500 + g.phase) * 0.22;
        node.position.set(g.pos.x, 1.1 + bob, g.pos.z);
        node.scale.setScalar(g.scale);
        node.lookAt(camera.position.x, node.position.y, camera.position.z);
      }
    });

    // danger + heartbeat
    const danger = THREE.MathUtils.clamp(1 - nearest / 20, 0, 1);
    if (danger > 0.45) {
      beatTimer.current -= dt;
      if (beatTimer.current <= 0) {
        beatTimer.current = 1.3 - danger * 0.8;
        sfx.heartbeat();
      }
    }

    // grave proximity
    let nearGrave = -1;
    GRAVES.forEach((g, i) => {
      const d = Math.hypot(g.x - pos.current.x, g.z - pos.current.z);
      if (d < 4.5 && !cleared.current[i]) nearGrave = i;
    });

    // HUD sync
    hudTimer.current -= dt;
    if (hudTimer.current <= 0) {
      hudTimer.current = 0.1;
      gameStore.set({
        health: Math.max(0, Math.round(health.current)),
        stamina: Math.round(stamina.current),
        ammo: ammo.current,
        kills: kills.current,
        nearGrave,
        danger: Math.round(danger * 20) / 20,
      });
    }
  });

  const weaponId = WEAPONS[gameStore.get().weaponIndex]?.id ?? "stick";

  return (
    <group>
      <Town data={town} />

      {/* player character */}
      <group ref={playerRef} visible={false}>
        <mesh position-y={0.95} castShadow>
          <boxGeometry args={[0.75, 1.25, 0.45]} />
          <meshStandardMaterial color="#23262d" flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[0.62, 0.9, 0.4]} />
          <meshStandardMaterial color="#15171b" flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 1.82, 0]}>
          <boxGeometry args={[0.5, 0.55, 0.42]} />
          <meshStandardMaterial color="#3a2d24" flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 1.82, -0.22]} rotation-y={Math.PI}>
          <planeGeometry args={[0.56, 0.62]} />
          <meshBasicMaterial map={faceTex} transparent toneMapped={false} />
        </mesh>
      </group>

      {/* first person weapon */}
      <group ref={vmRef}>
        <WeaponModel id={weaponId} />
      </group>
      <pointLight ref={flashRef} color="#ffb066" intensity={0} distance={26} decay={2} />

      {/* handheld torch */}
      <object3D ref={torchTargetRef} />
      <spotLight
        ref={torchRef}
        color="#ffd9b0"
        intensity={70}
        distance={46}
        angle={0.62}
        penumbra={0.55}
        decay={1.4}
      />

      {/* ghosts */}
      {Array.from({ length: POOL }).map((_, i) => (
        <group
          key={i}
          visible={false}
          ref={(el) => {
            ghostRefs.current[i] = el;
          }}
        >
          <mesh position-y={-0.5}>
            <coneGeometry args={[0.62, 1.9, 7]} />
            <meshStandardMaterial
              color="#9fb3b8"
              transparent
              opacity={0.42}
              flatShading
              emissive="#20313a"
              emissiveIntensity={0.7}
            />
          </mesh>
          <mesh position-y={0.55}>
            <planeGeometry args={[0.95, 0.95]} />
            <meshBasicMaterial map={ghostTex} transparent opacity={0.92} toneMapped={false} />
          </mesh>
          <pointLight color="#5ad6ff" intensity={2.4} distance={5} />
        </group>
      ))}
    </group>
  );
}

function WeaponModel({ id }: { id: string }) {
  if (id === "pistol") {
    return (
      <group>
        <mesh position={[0, 0, -0.1]}>
          <boxGeometry args={[0.09, 0.12, 0.4]} />
          <meshStandardMaterial color="#1c1e22" flatShading />
        </mesh>
        <mesh position={[0, -0.14, 0.03]} rotation-x={0.3}>
          <boxGeometry args={[0.08, 0.22, 0.11]} />
          <meshStandardMaterial color="#2a2118" flatShading />
        </mesh>
      </group>
    );
  }
  if (id === "shotgun") {
    return (
      <group>
        <mesh position={[0, 0, -0.35]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.045, 0.05, 0.9, 8]} />
          <meshStandardMaterial color="#16181c" flatShading />
        </mesh>
        <mesh position={[0, -0.06, 0.18]} rotation-x={0.15}>
          <boxGeometry args={[0.1, 0.14, 0.45]} />
          <meshStandardMaterial color="#3a2a1c" flatShading />
        </mesh>
      </group>
    );
  }
  if (id === "katana") {
    return (
      <group rotation={[0.15, 0.2, 0.35]}>
        <mesh position={[0, 0.35, -0.35]}>
          <boxGeometry args={[0.05, 1.25, 0.02]} />
          <meshStandardMaterial color="#b8b0a0" emissive="#ff3d00" emissiveIntensity={0.35} flatShading />
        </mesh>
        <mesh position={[0, -0.22, -0.1]}>
          <boxGeometry args={[0.05, 0.34, 0.05]} />
          <meshStandardMaterial color="#0f1013" flatShading />
        </mesh>
      </group>
    );
  }
  if (id === "iron") {
    return (
      <group rotation={[0.1, 0.15, 0.3]}>
        <mesh position={[0, 0.3, -0.3]}>
          <boxGeometry args={[0.09, 1, 0.03]} />
          <meshStandardMaterial color="#8f949b" flatShading />
        </mesh>
        <mesh position={[0, -0.2, -0.08]}>
          <boxGeometry args={[0.28, 0.06, 0.06]} />
          <meshStandardMaterial color="#2a2118" flatShading />
        </mesh>
      </group>
    );
  }
  return (
    <group rotation={[0.1, 0.15, 0.28]}>
      <mesh position={[0, 0.25, -0.28]}>
        <cylinderGeometry args={[0.045, 0.06, 1.05, 6]} />
        <meshStandardMaterial color="#4a3826" flatShading />
      </mesh>
      <mesh position={[0.02, 0.72, -0.34]} rotation-z={0.2}>
        <coneGeometry args={[0.08, 0.3, 5]} />
        <meshStandardMaterial color="#6b5334" flatShading />
      </mesh>
    </group>
  );
}
