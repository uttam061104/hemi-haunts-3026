import { useSyncExternalStore } from "react";

export type Phase = "lobby" | "playing" | "dead" | "won";
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
}

export const WEAPONS: Weapon[] = [
  {
    id: "stick",
    name: "Stick Sword",
    damage: 34,
    range: 3.2,
    cooldown: 0.5,
    spread: 0.7,
    ranged: false,
    pellets: 1,
    ammo: 0,
  },
  {
    id: "iron",
    name: "Iron Blade",
    damage: 60,
    range: 3.6,
    cooldown: 0.45,
    spread: 0.7,
    ranged: false,
    pellets: 1,
    ammo: 0,
  },
  {
    id: "pistol",
    name: "Pistol",
    damage: 55,
    range: 45,
    cooldown: 0.32,
    spread: 0.06,
    ranged: true,
    pellets: 1,
    ammo: 40,
  },
  {
    id: "katana",
    name: "Cursed Katana",
    damage: 120,
    range: 4.2,
    cooldown: 0.3,
    spread: 0.8,
    ranged: false,
    pellets: 1,
    ammo: 0,
  },
  {
    id: "shotgun",
    name: "Shotgun",
    damage: 55,
    range: 22,
    cooldown: 0.8,
    spread: 0.28,
    ranged: true,
    pellets: 4,
    ammo: 24,
  },
];

export interface GraveDef {
  name: string;
  x: number;
  z: number;
  ghosts: number;
}

export const GRAVES: GraveDef[] = [
  { name: "Jeremy", x: -14, z: -46, ghosts: 4 },
  { name: "Joshua", x: -4, z: -52, ghosts: 5 },
  { name: "JCV", x: 8, z: -47, ghosts: 6 },
  { name: "Pranjal", x: 18, z: -55, ghosts: 7 },
  { name: "Akash", x: 0, z: -62, ghosts: 8 },
];

export interface HudState {
  phase: Phase;
  playerName: string;
  camera: CameraMode;
  health: number;
  stamina: number;
  ammo: number;
  kills: number;
  gravesCleared: number;
  clearedFlags: boolean[];
  weaponIndex: number;
  unlocked: number;
  nearGrave: number; // -1 none
  waveRemaining: number;
  message: string;
  jumpscare: number; // timestamp trigger id
  danger: number; // 0..1 proximity of nearest ghost
  score: number;
  volume: number;
  sensitivity: number;
  paused: boolean;
}

const initial: HudState = {
  phase: "lobby",
  playerName: "",
  camera: "fpp",
  health: 100,
  stamina: 100,
  ammo: 0,
  kills: 0,
  gravesCleared: 0,
  clearedFlags: [false, false, false, false, false],
  weaponIndex: 0,
  unlocked: 0,
  nearGrave: -1,
  waveRemaining: 0,
  message: "",
  jumpscare: 0,
  danger: 0,
  score: 0,
  volume: 0.7,
  sensitivity: 1,
  paused: false,
};

let state: HudState = initial;
const listeners = new Set<() => void>();

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
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  resetRun(name: string, camera: CameraMode) {
    state = {
      ...initial,
      playerName: name,
      camera,
      volume: state.volume,
      sensitivity: state.sensitivity,
      phase: "playing",
      message: "Find the five graves. Press E at a grave to wake what sleeps there.",
    };
    listeners.forEach((l) => l());
  },
};

export function useGame(): HudState {
  return useSyncExternalStore(
    gameStore.subscribe,
    () => state,
    () => state,
  );
}

export function computeScore(s: HudState): number {
  return s.kills * 100 + s.gravesCleared * 750 + Math.max(0, Math.round(s.health)) * 5;
}
