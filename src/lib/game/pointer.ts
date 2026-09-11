// Single owner of the pointer lock so the HUD can resume without reaching
// into the Three.js canvas itself.

let canvas: HTMLCanvasElement | null = null;

export function setGameCanvas(c: HTMLCanvasElement | null) {
  canvas = c;
}

export function isLocked(): boolean {
  return typeof document !== "undefined" && !!canvas && document.pointerLockElement === canvas;
}

/** Returns false when the browser refuses the lock (e.g. too soon after exit). */
export async function requestPointerLock(): Promise<boolean> {
  if (!canvas) return false;
  if (isLocked()) return true;
  try {
    const result = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    if (result && typeof result.then === "function") await result;
    return true;
  } catch {
    return false;
  }
}

export function releasePointerLock() {
  if (typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock();
}
