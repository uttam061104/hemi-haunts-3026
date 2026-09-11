import { useSyncExternalStore } from "react";
import { computeScore, type ScoreBreakdown } from "./scoring";

/** Top level flow. */
export type Phase = "lobby" | "playing" | "dead" | "won";
/** Sub-state while phase === "playing". */
export type Stage = "explore" | "wave" | "boss" | "extraction";
export type CameraMode = "fpp" | "tpp";

export interface Weapon {
  id: string;
  name: string;
  damage: number;
  range: number;
  cooldown: number;
  spread: number; // radians of aim cone
  ranged: boolean;
  pellets: number;
  ammo: number; // ammo granted on unlock (0 = melee, infinite)
  knockback: number;
  shake: number;
}

export const WEAPONS: Weapon[] = [
  {
    id: "stick",
    name: "Stick Sword",
    damage: 34,
    range: 3.4,
    cooldown: 0.5,
    spread: 0.7,
    ranged: false,
    pellets: 1,
    ammo: 0,
    knockback: 2.2,
    shake: 0.06,
  },
  {
    id: "iron",
    name: "Iron Blade",
    damage: 62,
    range: 3.8,
    cooldown: 0.45,
    spread: 0.7,
    ranged: false,
    pellets: 1,
    ammo: 0,
    knockback: 3,
    shake: 0.09,
  },
  {
    id: "pistol",
    name: "Pistol",
    damage: 58,
    range: 48,
    cooldown: 0.3,
    spread: 0.07,
    ranged: true,
    pellets: 1,
    ammo: 48,
    knockback: 2,
    shake: 0.12,
  },
  {
    id: "katana",
    name: "Cursed Katana",
    damage: 120,
    range: 4.4,
    cooldown: 0.3,
    spread: 0.8,
    ranged: false,
    pellets: 2,
    ammo: 0,
    knockback: 4,
    shake: 0.13,
  },
  {
    id: "shotgun",
    name: "Shotgun",
    damage: 55,
    range: 24,
    cooldown: 0.8,
    spread: 0.3,
    ranged: true,
    pellets: 5,
    ammo: 30,
    knockback: 6,
    shake: 0.3,
  },
];

export type GraveModifier = "intro" | "darkness" | "speed" | "ambush" | "elite";

export interface GraveDef {
  name: string;
  x: number;
  z: number;
  ghosts: number;
  modifier: GraveModifier;
  tagline: string;
  /** multipliers applied to the wave */
  speedMul: number;
  hpMul: number;
  dmgMul: number;
  atkCd: number;
}

export const GRAVES: GraveDef[] = [
  {
    name: "Jeremy",
    x: -14,
    z: -46,
    ghosts: 4,
    modifier: "intro",
    tagline: "Slow risers. Learn the swing.",
    speedMul: 0.78,
    hpMul: 0.85,
    dmgMul: 0.75,
    atkCd: 1.35,
  },
  {
    name: "Joshua",
    x: -4,
    z: -52,
    ghosts: 5,
    modifier: "darkness",
    tagline: "Your light is failing. Keep moving.",
    speedMul: 1.0,
    hpMul: 1.0,
    dmgMul: 1.1,
    atkCd: 1.05,
  },
  {
    name: "JCV",
    x: 8,
    z: -47,
    ghosts: 6,
    modifier: "speed",
    tagline: "They are fast. Do not let them circle you.",
    speedMul: 1.42,
    hpMul: 0.95,
    dmgMul: 1.0,
    atkCd: 0.72,
  },
  {
    name: "Pranjal",
    x: 18,
    z: -55,
    ghosts: 7,
    modifier: "ambush",
    tagline: "Ambush. They come from every side.",
    speedMul: 1.12,
    hpMul: 1.05,
    dmgMul: 1.05,
    atkCd: 0.95,
  },
  {
    name: "Akash",
    x: 0,
    z: -62,
    ghosts: 3,
    modifier: "elite",
    tagline: "Something bigger answered.",
    speedMul: 1.1,
    hpMul: 1.1,
    dmgMul: 1.1,
    atkCd: 0.9,
  },
];

export interface HitMarker {
  id: number;
  x: number; // percent of viewport
  y: number;
  value: number;
  crit: boolean;
  born: number;
}

export interface RunResult {
  score: number;
  breakdown: ScoreBreakdown;
  kills: number;
  graves: number;
  time: number;
  health: number;
  extraction: boolean;
}

export interface HudState {
  phase: Phase;
  stage: Stage;
  runId: number;
  playerName: string;
  camera: CameraMode;

  health: number;
  stamina: number;
  exhausted: boolean;
  ammo: number;
  kills: number;
  gravesCleared: number;
  clearedFlags: boolean[];
  weaponIndex: number;
  unlocked: number;

  nearGrave: number; // -1 none
  nearBeacon: boolean;
  waveIndex: number; // 1-based grave number of the active wave, 0 = none
  waveRemaining: number;
  waveTotal: number;

  objective: string;
  message: string;
  jumpscare: number; // timestamp trigger id
  danger: number; // 0..1 proximity of nearest ghost
  hurtFlash: number;
  markers: HitMarker[];

  bossActive: boolean;
  bossHp: number; // 0..1
  beaconReady: boolean;
  beaconDistance: number;

  elapsed: number;
  score: number;
  result: RunResult | null;

  volume: number;
  sensitivity: number;
  paused: boolean;
  pointerLocked: boolean;
  resumeBlocked: boolean;
}

const base: Omit<HudState, "volume" | "sensitivity" | "playerName" | "camera" | "runId"> = {
  phase: "lobby",
  stage: "explore",
  health: 100,
  stamina: 100,
  exhausted: false,
  ammo: 0,
  kills: 0,
  gravesCleared: 0,
  clearedFlags: [false, false, false, false, false],
  weaponIndex: 0,
  unlocked: 0,
  nearGrave: -1,
  nearBeacon: false,
  waveIndex: 0,
  waveRemaining: 0,
  waveTotal: 0,
  objective: "Find the five graves in the cemetery",
  message: "",
  jumpscare: 0,
  danger: 0,
  hurtFlash: 0,
  markers: [],
  bossActive: false,
  bossHp: 0,
  beaconReady: false,
  beaconDistance: 0,
  elapsed: 0,
  score: 0,
  result: null,
  paused: false,
  pointerLocked: false,
  resumeBlocked: false,
};

const initial: HudState = {
  ...base,
  runId: 0,
  playerName: "",
  camera: "fpp",
  volume: 0.7,
  sensitivity: 1,
};

let state: HudState = initial;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const gameStore = {
  get: () => state,
  set(patch: Partial<HudState>) {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof HudState)[]) {
      if (state[key] !== patch[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    state = { ...state, ...patch };
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  /** Full reset — bumps runId so the scene wipes every ref it owns. */
  startRun(name: string, camera: CameraMode) {
    state = {
      ...base,
      runId: state.runId + 1,
      playerName: name,
      camera,
      volume: state.volume,
      sensitivity: state.sensitivity,
      phase: "playing",
      message: "Wake the graves. Put down what comes back.",
    };
    emit();
  },
  restart() {
    gameStore.startRun(state.playerName || "Wanderer", state.camera);
  },
  toLobby() {
    state = {
      ...base,
      runId: state.runId + 1,
      playerName: state.playerName,
      camera: state.camera,
      volume: state.volume,
      sensitivity: state.sensitivity,
      phase: "lobby",
    };
    emit();
  },
  finish(result: RunResult, phase: "won" | "dead") {
    state = {
      ...state,
      phase,
      paused: false,
      pointerLocked: false,
      bossActive: false,
      result,
      score: result.score,
      kills: result.kills,
      gravesCleared: result.graves,
      health: Math.max(0, Math.round(result.health)),
      elapsed: result.time,
    };
    emit();
  },
};

export function useGame(): HudState {
  return useSyncExternalStore(
    gameStore.subscribe,
    () => state,
    () => state,
  );
}

export { computeScore };
