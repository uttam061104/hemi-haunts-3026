// Deterministic town layout. Landmarks are hand placed so the map is readable;
// only decoration is procedural. No Math.random at module scope.

import type { Collider } from "@/lib/game/collision";
import { WORLD_LIMIT } from "@/lib/game/collision";

export { WORLD_LIMIT };

export interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  tone: number;
  roof: "cone" | "flat";
  lit: boolean;
}

export interface Lamp {
  x: number;
  z: number;
}

export interface Fence {
  x: number;
  z: number;
  rot: number;
  len: number;
}

export type PropKind = "car" | "barrel" | "tree" | "crate" | "rubble";

export interface Prop {
  kind: PropKind;
  x: number;
  z: number;
  rot: number;
  s: number;
}

export interface SignPost {
  x: number;
  z: number;
  rot: number;
  label: string;
}

export interface TownData {
  buildings: Box[];
  lamps: Lamp[];
  fences: Fence[];
  props: Prop[];
  signs: SignPost[];
  colliders: Collider[];
}

/** Player spawn — the start area at the south end of Main Street. */
export const SPAWN = { x: 0, z: 30 };
/** Extraction beacon — back in town, north of the start area. */
export const BEACON = { x: 0, z: 12 };
/** Water tower landmark. */
export const WATER_TOWER = { x: -34, z: -4 };
/** Chapel at the graveyard gate. */
export const CHAPEL = { x: -18, z: -34, w: 12, d: 14, h: 12 };

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildTown(): TownData {
  const rnd = lcg(30263026);
  const buildings: Box[] = [];
  const lamps: Lamp[] = [];
  const fences: Fence[] = [];
  const props: Prop[] = [];
  const signs: SignPost[] = [];

  // --- Main street: two rows of houses running north from the start area ---
  for (let i = 0; i < 9; i++) {
    const z = 22 - i * 9;
    for (const side of [-1, 1]) {
      buildings.push({
        x: side * (10 + rnd() * 3),
        z: z + rnd() * 2,
        w: 6 + rnd() * 4,
        d: 6 + rnd() * 3,
        h: 5 + rnd() * 6,
        tone: 0.45 + rnd() * 0.55,
        roof: "cone",
        lit: i % 2 === 0,
      });
    }
    lamps.push({ x: i % 2 === 0 ? -5.5 : 5.5, z });
  }

  // --- Back alley: a tight block west of main street ---
  for (let i = 0; i < 5; i++) {
    buildings.push({
      x: -26 - rnd() * 5,
      z: 18 - i * 10,
      w: 7 + rnd() * 3,
      d: 7 + rnd() * 3,
      h: 4 + rnd() * 5,
      tone: 0.3 + rnd() * 0.4,
      roof: "flat",
      lit: i === 1,
    });
    buildings.push({
      x: 26 + rnd() * 5,
      z: 14 - i * 10,
      w: 7 + rnd() * 3,
      d: 7 + rnd() * 3,
      h: 4 + rnd() * 5,
      tone: 0.32 + rnd() * 0.4,
      roof: "flat",
      lit: i === 3,
    });
  }

  // --- Abandoned house: big, dark, off the east side ---
  buildings.push({ x: 24, z: -22, w: 14, d: 12, h: 9, tone: 0.25, roof: "cone", lit: false });

  // --- Chapel at the graveyard gate ---
  buildings.push({
    x: CHAPEL.x,
    z: CHAPEL.z,
    w: CHAPEL.w,
    d: CHAPEL.d,
    h: CHAPEL.h,
    tone: 0.62,
    roof: "cone",
    lit: true,
  });

  // --- Graveyard walls ---
  for (let i = 0; i < 10; i++) {
    fences.push({ x: -30 + i * 6.6, z: -38, rot: 0, len: 5.4 });
    fences.push({ x: -30 + i * 6.6, z: -70, rot: 0, len: 5.4 });
  }
  for (let i = 0; i < 6; i++) {
    fences.push({ x: -32, z: -40 - i * 5.4, rot: Math.PI / 2, len: 5.2 });
    fences.push({ x: 34, z: -40 - i * 5.4, rot: Math.PI / 2, len: 5.2 });
  }

  lamps.push(
    { x: -22, z: -40 },
    { x: 20, z: -44 },
    { x: -2, z: -58 },
    { x: -28, z: 6 },
    { x: 22, z: -16 },
    { x: 4, z: 26 },
  );

  // --- Signage for orientation ---
  signs.push(
    { x: 4.6, z: 26, rot: -0.3, label: "MAIN ST" },
    { x: -6.2, z: -2, rot: 0.4, label: "CHAPEL →" },
    { x: 5.4, z: -30, rot: 0.1, label: "CEMETERY" },
    { x: -20, z: 8, rot: 1.2, label: "BACK ALLEY" },
    { x: 2.6, z: 14, rot: -0.2, label: "BEACON" },
  );

  // --- Broken cars along the street ---
  const carSpots: [number, number, number][] = [
    [-4.2, 18, 0.15],
    [4.4, 4, -0.3],
    [-4.6, -12, 0.5],
    [3.9, -26, 2.9],
    [-22, -6, 1.1],
    [20, -34, 0.4],
  ];
  for (const [x, z, rot] of carSpots) props.push({ kind: "car", x, z, rot, s: 1 });

  // --- Barrels, crates, trees, rubble ---
  for (let i = 0; i < 14; i++) {
    props.push({
      kind: i % 3 === 0 ? "crate" : "barrel",
      x: (rnd() - 0.5) * 60,
      z: (rnd() - 0.5) * 70 + 2,
      rot: rnd() * 6.28,
      s: 0.85 + rnd() * 0.4,
    });
  }
  for (let i = 0; i < 26; i++) {
    const inYard = i % 2 === 0;
    props.push({
      kind: "tree",
      x: inYard ? (rnd() - 0.5) * 60 : (rnd() < 0.5 ? -1 : 1) * (38 + rnd() * 30),
      z: inYard ? -40 - rnd() * 30 : (rnd() - 0.5) * 90,
      rot: rnd() * 6.28,
      s: 0.8 + rnd() * 0.8,
    });
  }
  for (let i = 0; i < 70; i++) {
    props.push({
      kind: "rubble",
      x: (rnd() - 0.5) * 140,
      z: (rnd() - 0.5) * 145 - 10,
      rot: rnd() * 6.28,
      s: 0.3 + rnd() * 1.1,
    });
  }

  // --- Colliders: buildings, walls, water tower legs, cars ---
  const colliders: Collider[] = [];
  for (const b of buildings) colliders.push({ x: b.x, z: b.z, w: b.w, d: b.d });
  for (const f of fences) {
    const horizontal = Math.abs(Math.sin(f.rot)) < 0.5;
    colliders.push({
      x: f.x,
      z: f.z,
      w: horizontal ? f.len : 0.6,
      d: horizontal ? 0.6 : f.len,
    });
  }
  colliders.push({ x: WATER_TOWER.x, z: WATER_TOWER.z, w: 5.5, d: 5.5 });
  for (const p of props) {
    if (p.kind === "car") colliders.push({ x: p.x, z: p.z, w: 2.4, d: 4.4 });
    if (p.kind === "tree") colliders.push({ x: p.x, z: p.z, w: 1.1, d: 1.1 });
  }

  return { buildings, lamps, fences, props, signs, colliders };
}
