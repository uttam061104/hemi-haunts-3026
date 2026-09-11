// Axis-aligned box collision helpers shared by the player and the ghosts.

export interface Collider {
  x: number;
  z: number;
  w: number;
  d: number;
}

export const WORLD_LIMIT = 78;

export function insideCollider(x: number, z: number, c: Collider, pad: number): boolean {
  return (
    x > c.x - c.w / 2 - pad &&
    x < c.x + c.w / 2 + pad &&
    z > c.z - c.d / 2 - pad &&
    z < c.z + c.d / 2 + pad
  );
}

/** True when a point (with radius pad) overlaps any collider. */
export function blocked(x: number, z: number, colliders: Collider[], pad: number): boolean {
  for (const c of colliders) if (insideCollider(x, z, c, pad)) return true;
  return false;
}

/**
 * Pushes a point out of every collider it overlaps along the shallowest axis,
 * then clamps it to the world bounds. Mutates and returns the target.
 */
export function resolveCircle(
  target: { x: number; z: number },
  radius: number,
  colliders: Collider[],
): { x: number; z: number } {
  for (const c of colliders) {
    const minX = c.x - c.w / 2 - radius;
    const maxX = c.x + c.w / 2 + radius;
    const minZ = c.z - c.d / 2 - radius;
    const maxZ = c.z + c.d / 2 + radius;
    if (target.x > minX && target.x < maxX && target.z > minZ && target.z < maxZ) {
      const dx = Math.min(target.x - minX, maxX - target.x);
      const dz = Math.min(target.z - minZ, maxZ - target.z);
      if (dx < dz) target.x = target.x - minX < maxX - target.x ? minX : maxX;
      else target.z = target.z - minZ < maxZ - target.z ? minZ : maxZ;
    }
  }
  target.x = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, target.x));
  target.z = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, target.z));
  return target;
}

/** Cheap line-of-sight test by sampling the segment against the colliders. */
export function hasLineOfSight(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  colliders: Collider[],
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const dist = Math.hypot(dx, dz);
  const steps = Math.min(24, Math.max(2, Math.round(dist / 2)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocked(ax + dx * t, az + dz * t, colliders, 0.2)) return false;
  }
  return true;
}
