// Deterministic low-poly town layout. No Math.random at module scope.

export interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  tone: number;
}

export interface Lamp {
  x: number;
  z: number;
}

export interface TownData {
  buildings: Box[];
  lamps: Lamp[];
  fences: { x: number; z: number; rot: number; len: number }[];
  rubble: { x: number; z: number; s: number }[];
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const WORLD_LIMIT = 78;

export function buildTown(): TownData {
  const rnd = lcg(30263026);
  const buildings: Box[] = [];
  const lamps: Lamp[] = [];
  const fences: { x: number; z: number; rot: number; len: number }[] = [];
  const rubble: { x: number; z: number; s: number }[] = [];

  // Two rows of houses along a north-south main street.
  for (let i = 0; i < 9; i++) {
    const z = 22 - i * 9;
    for (const side of [-1, 1]) {
      const w = 6 + rnd() * 4;
      const d = 6 + rnd() * 3;
      const h = 5 + rnd() * 6;
      buildings.push({
        x: side * (10 + rnd() * 3),
        z: z + rnd() * 2,
        w,
        d,
        h,
        tone: 0.4 + rnd() * 0.6,
      });
    }
    lamps.push({ x: i % 2 === 0 ? -5.5 : 5.5, z });
  }

  // Side alley block
  for (let i = 0; i < 5; i++) {
    buildings.push({
      x: -26 - rnd() * 6,
      z: 18 - i * 10,
      w: 7 + rnd() * 4,
      d: 7 + rnd() * 3,
      h: 4 + rnd() * 5,
      tone: 0.3 + rnd() * 0.5,
    });
    buildings.push({
      x: 26 + rnd() * 6,
      z: 14 - i * 10,
      w: 7 + rnd() * 4,
      d: 7 + rnd() * 3,
      h: 4 + rnd() * 5,
      tone: 0.3 + rnd() * 0.5,
    });
  }

  // Chapel at the graveyard gate
  buildings.push({ x: -18, z: -34, w: 12, d: 14, h: 12, tone: 0.55 });

  // Graveyard wall segments
  for (let i = 0; i < 10; i++) {
    fences.push({ x: -30 + i * 6.6, z: -38, rot: 0, len: 5.4 });
    fences.push({ x: -30 + i * 6.6, z: -70, rot: 0, len: 5.4 });
  }
  for (let i = 0; i < 6; i++) {
    fences.push({ x: -32, z: -40 - i * 5.4, rot: Math.PI / 2, len: 5.2 });
    fences.push({ x: 34, z: -40 - i * 5.4, rot: Math.PI / 2, len: 5.2 });
  }

  lamps.push({ x: -22, z: -40 }, { x: 20, z: -44 }, { x: -2, z: -58 });

  for (let i = 0; i < 60; i++) {
    rubble.push({
      x: (rnd() - 0.5) * 130,
      z: (rnd() - 0.5) * 140 - 15,
      s: 0.3 + rnd() * 1.1,
    });
  }

  return { buildings, lamps, fences, rubble };
}
