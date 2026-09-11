// Lightweight steering AI for the ghosts. No pathfinding library: desired
// direction + obstacle probing + separation is enough for a small town.

import * as THREE from "three";
import { blocked, hasLineOfSight, resolveCircle, type Collider } from "./collision";

export type GhostState = "idle" | "search" | "chase" | "attack" | "hurt" | "dying";

export interface Ghost {
  active: boolean;
  elite: boolean;
  wave: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  atkCdBase: number;
  atkCd: number;
  state: GhostState;
  stateT: number;
  hurtT: number;
  flash: number;
  knock: THREE.Vector3;
  wander: THREE.Vector3;
  wanderT: number;
  phase: number;
  scale: number;
  dying: number;
  teleportCd: number;
  lastSeen: THREE.Vector3;
  facing: number;
}

export const GHOST_RADIUS = 0.55;
export const DETECT_RADIUS = 26;
export const ATTACK_RANGE = 2.1;

export function makeGhost(): Ghost {
  return {
    active: false,
    elite: false,
    wave: false,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    hp: 0,
    maxHp: 1,
    speed: 2,
    dmg: 8,
    atkCdBase: 1.1,
    atkCd: 0,
    state: "idle",
    stateT: 0,
    hurtT: 0,
    flash: 0,
    knock: new THREE.Vector3(),
    wander: new THREE.Vector3(),
    wanderT: 0,
    phase: 0,
    scale: 1,
    dying: 0,
    teleportCd: 6,
    lastSeen: new THREE.Vector3(),
    facing: 0,
  };
}

export function resetGhost(g: Ghost) {
  g.active = false;
  g.elite = false;
  g.wave = false;
  g.pos.set(0, 0, 0);
  g.vel.set(0, 0, 0);
  g.knock.set(0, 0, 0);
  g.hp = 0;
  g.state = "idle";
  g.stateT = 0;
  g.hurtT = 0;
  g.flash = 0;
  g.dying = 0;
  g.wanderT = 0;
  g.teleportCd = 6;
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const desired = new THREE.Vector3();

function probeFree(
  x: number,
  z: number,
  dirX: number,
  dirZ: number,
  colliders: Collider[],
  reach: number,
): boolean {
  return !blocked(x + dirX * reach, z + dirZ * reach, colliders, GHOST_RADIUS);
}

export interface GhostUpdate {
  /** damage the ghost landed on the player this frame */
  damage: number;
  /** true when the ghost just started an attack (for sfx) */
  attacked: boolean;
}

/**
 * Advances one ghost. Returns damage dealt to the player this frame.
 */
export function updateGhost(
  g: Ghost,
  dt: number,
  player: THREE.Vector3,
  colliders: Collider[],
  all: Ghost[],
  rand: () => number,
): GhostUpdate {
  const out: GhostUpdate = { damage: 0, attacked: false };
  if (!g.active) return out;

  g.stateT += dt;
  g.flash = Math.max(0, g.flash - dt * 4);

  // --- death animation ---
  if (g.state === "dying") {
    g.dying += dt;
    if (g.dying > 0.55) g.active = false;
    return out;
  }

  const dx = player.x - g.pos.x;
  const dz = player.z - g.pos.z;
  const dist = Math.hypot(dx, dz) || 0.0001;
  const sees = dist < DETECT_RADIUS && hasLineOfSight(g.pos.x, g.pos.z, player.x, player.z, colliders);

  // --- hit stun ---
  if (g.hurtT > 0) {
    g.hurtT -= dt;
    g.state = "hurt";
  } else if (g.state === "hurt") {
    g.state = "chase";
    g.stateT = 0;
  }

  // --- state transitions ---
  if (g.state !== "hurt") {
    if (sees) {
      g.lastSeen.set(player.x, 0, player.z);
      g.state = dist < ATTACK_RANGE ? "attack" : "chase";
    } else if (g.state === "chase" || g.state === "attack") {
      g.state = "search";
      g.stateT = 0;
    } else if (g.state === "search" && g.stateT > 6) {
      g.state = "idle";
      g.stateT = 0;
    } else if (g.state === "idle" && dist < DETECT_RADIUS * 0.55) {
      // heard something even without line of sight
      g.state = "search";
      g.lastSeen.set(player.x, 0, player.z);
      g.stateT = 0;
    }
  }

  // --- desired direction ---
  desired.set(0, 0, 0);
  let moveSpeed = 0;

  if (g.state === "chase") {
    desired.set(dx / dist, 0, dz / dist);
    moveSpeed = g.speed;
  } else if (g.state === "attack") {
    desired.set(dx / dist, 0, dz / dist);
    moveSpeed = g.speed * 0.25;
    g.atkCd -= dt;
    if (g.atkCd <= 0) {
      g.atkCd = g.atkCdBase;
      out.damage = g.dmg;
      out.attacked = true;
    }
  } else if (g.state === "search") {
    const sx = g.lastSeen.x - g.pos.x;
    const sz = g.lastSeen.z - g.pos.z;
    const sd = Math.hypot(sx, sz);
    if (sd > 1.5) {
      desired.set(sx / sd, 0, sz / sd);
      moveSpeed = g.speed * 0.7;
    } else {
      g.wanderT -= dt;
      if (g.wanderT <= 0) {
        g.wanderT = 1.5 + rand() * 2;
        const a = rand() * Math.PI * 2;
        g.wander.set(Math.cos(a), 0, Math.sin(a));
      }
      desired.copy(g.wander);
      moveSpeed = g.speed * 0.45;
    }
  } else if (g.state === "idle") {
    g.wanderT -= dt;
    if (g.wanderT <= 0) {
      g.wanderT = 2 + rand() * 3;
      const a = rand() * Math.PI * 2;
      g.wander.set(Math.cos(a), 0, Math.sin(a));
    }
    desired.copy(g.wander);
    moveSpeed = g.speed * 0.32;
  }

  // --- obstacle steering: probe ahead, side-step if blocked ---
  if (moveSpeed > 0 && desired.lengthSq() > 0) {
    desired.normalize();
    const reach = 1.8;
    if (!probeFree(g.pos.x, g.pos.z, desired.x, desired.z, colliders, reach)) {
      let solved = false;
      for (const angle of [0.7, -0.7, 1.4, -1.4, 2.2, -2.2]) {
        const cx = Math.cos(angle) * desired.x - Math.sin(angle) * desired.z;
        const cz = Math.sin(angle) * desired.x + Math.cos(angle) * desired.z;
        if (probeFree(g.pos.x, g.pos.z, cx, cz, colliders, reach)) {
          desired.set(cx, 0, cz);
          solved = true;
          break;
        }
      }
      if (!solved) desired.set(-desired.x, 0, -desired.z);
    }
  }

  // --- separation from other ghosts ---
  tmpA.set(0, 0, 0);
  for (const o of all) {
    if (o === g || !o.active || o.state === "dying") continue;
    const ox = g.pos.x - o.pos.x;
    const oz = g.pos.z - o.pos.z;
    const od = Math.hypot(ox, oz);
    if (od > 0.001 && od < 1.7) {
      tmpA.x += (ox / od) * (1.7 - od);
      tmpA.z += (oz / od) * (1.7 - od);
    }
  }

  // --- integrate ---
  tmpB.set(desired.x * moveSpeed + tmpA.x * 2.2, 0, desired.z * moveSpeed + tmpA.z * 2.2);
  if (g.hurtT > 0) tmpB.multiplyScalar(0.15);
  g.vel.lerp(tmpB, 1 - Math.exp(-9 * dt));

  g.pos.x += (g.vel.x + g.knock.x) * dt;
  g.pos.z += (g.vel.z + g.knock.z) * dt;
  g.knock.multiplyScalar(Math.exp(-7 * dt));
  resolveCircle(g.pos, GHOST_RADIUS, colliders);

  if (g.vel.lengthSq() > 0.05) g.facing = Math.atan2(g.vel.x, g.vel.z);

  return out;
}

/** Elite-only short phase hop toward the player. */
export function eliteTeleport(
  g: Ghost,
  dt: number,
  player: THREE.Vector3,
  colliders: Collider[],
  rand: () => number,
): boolean {
  g.teleportCd -= dt;
  if (g.teleportCd > 0) return false;
  const dist = Math.hypot(player.x - g.pos.x, player.z - g.pos.z);
  if (dist < 7 || dist > 34) return false;
  g.teleportCd = 7 + rand() * 4;
  const a = rand() * Math.PI * 2;
  const r = 5 + rand() * 3;
  const nx = player.x + Math.cos(a) * r;
  const nz = player.z + Math.sin(a) * r;
  if (blocked(nx, nz, colliders, GHOST_RADIUS + 0.3)) return false;
  g.pos.set(nx, 0, nz);
  g.vel.set(0, 0, 0);
  return true;
}
