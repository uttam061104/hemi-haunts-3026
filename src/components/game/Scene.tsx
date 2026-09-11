import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  GRAVES,
  WEAPONS,
  gameStore,
  useGameValue,
  type HitMarker,
  type Stage,
} from "@/lib/game/store";
import { computeScore } from "@/lib/game/scoring";
import { sfx, setMuted } from "@/lib/game/audio";
import {
  ATTACK_RANGE,
  eliteTeleport,
  makeGhost,
  resetGhost,
  updateGhost,
  type Ghost,
} from "@/lib/game/ai";
import { blocked, resolveCircle } from "@/lib/game/collision";
import { requestPointerLock, releasePointerLock, setGameCanvas } from "@/lib/game/pointer";
import { buildTown, BEACON, SPAWN } from "./town";
import { Town } from "./Town";
import { PlayerModel, animatePlayer, usePlayerRig } from "./PlayerModel";

const EYE = 1.7;
const RADIUS = 0.7;
const POOL = 26;
const WALK = 4.4;
const SPRINT = 8.3;
const BEACON_RADIUS = 4.2;

/** Ghost face texture with a procedural fallback if the SVG cannot decode. */
function useGhostTexture(): THREE.Texture {
  return useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(
      "/assets/ghost-face.svg",
      undefined,
      undefined,
      () => {
        const c = document.createElement("canvas");
        c.width = c.height = 256;
        const g = c.getContext("2d");
        if (g) {
          const grad = g.createRadialGradient(128, 112, 10, 128, 112, 120);
          grad.addColorStop(0, "#dfeef2");
          grad.addColorStop(1, "rgba(20,28,34,0)");
          g.fillStyle = grad;
          g.fillRect(0, 0, 256, 256);
          g.fillStyle = "#05060a";
          g.beginPath();
          g.ellipse(96, 108, 18, 26, 0, 0, 7);
          g.ellipse(160, 108, 18, 26, 0, 0, 7);
          g.fill();
          g.fillStyle = "#ff4b0f";
          g.beginPath();
          g.arc(96, 110, 6, 0, 7);
          g.arc(160, 110, 6, 0, 7);
          g.fill();
        }
        tex.image = c;
        tex.needsUpdate = true;
      },
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function rand() {
  return Math.random();
}

export function Scene() {
  const { camera, gl } = useThree();
  const town = useMemo(() => buildTown(), []);
  const colliders = town.colliders;
  const ghostTex = useGhostTexture();
  const rig = usePlayerRig();

  const runId = useGameValue((s) => s.runId);
  const weaponId = useGameValue((s) => WEAPONS[s.weaponIndex]?.id ?? "stick");

  // ---- high frequency state lives in refs ----
  const pos = useRef(new THREE.Vector3(SPAWN.x, 0, SPAWN.z));
  const vel = useRef(new THREE.Vector3());
  const yaw = useRef(0);
  const pitch = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const firing = useRef(false);
  const cooldown = useRef(0);
  const swing = useRef(0);
  const health = useRef(100);
  const stamina = useRef(100);
  const exhausted = useRef(false);
  const ammo = useRef(0);
  const kills = useRef(0);
  const elapsed = useRef(0);
  const hudTimer = useRef(0);
  const stepTimer = useRef(0);
  const beatTimer = useRef(0);
  const ambienceTimer = useRef(12);
  const spawnTimer = useRef(6);
  const shake = useRef(0);
  const hurtFlash = useRef(0);
  const muzzle = useRef(0);
  const torchFail = useRef(0);
  const markerId = useRef(1);
  const markers = useRef<HitMarker[]>([]);

  const stage = useRef<Stage>("explore");
  const wave = useRef<{ grave: number; remaining: number; total: number } | null>(null);
  const cleared = useRef<boolean[]>([false, false, false, false, false]);
  const bossDefeated = useRef(false);
  const extractionSpawns = useRef(0);
  const jumpscaresUsed = useRef(0);
  const lastJumpscare = useRef(0);

  const ghosts = useRef<Ghost[]>(Array.from({ length: POOL }, makeGhost));
  const boss = useRef<Ghost>(makeGhost());
  const ghostRefs = useRef<(THREE.Group | null)[]>([]);
  const bossRef = useRef<THREE.Group>(null);
  const vmRef = useRef<THREE.Group>(null);
  const muzzleRef = useRef<THREE.PointLight>(null);
  const torchRef = useRef<THREE.SpotLight>(null);
  const torchTargetRef = useRef<THREE.Object3D>(null);

  // ---------- full reset whenever a run starts ----------
  useEffect(() => {
    pos.current.set(SPAWN.x, 0, SPAWN.z);
    vel.current.set(0, 0, 0);
    yaw.current = 0;
    pitch.current = 0;
    keys.current = {};
    firing.current = false;
    cooldown.current = 0;
    swing.current = 0;
    health.current = 100;
    stamina.current = 100;
    exhausted.current = false;
    ammo.current = 0;
    kills.current = 0;
    elapsed.current = 0;
    hudTimer.current = 0;
    stepTimer.current = 0;
    beatTimer.current = 0;
    ambienceTimer.current = 12;
    spawnTimer.current = 6;
    shake.current = 0;
    hurtFlash.current = 0;
    muzzle.current = 0;
    torchFail.current = 0;
    markers.current = [];
    stage.current = "explore";
    wave.current = null;
    cleared.current = [false, false, false, false, false];
    bossDefeated.current = false;
    extractionSpawns.current = 0;
    jumpscaresUsed.current = 0;
    lastJumpscare.current = 0;
    ghosts.current.forEach(resetGhost);
    resetGhost(boss.current);
    camera.position.set(SPAWN.x, EYE, SPAWN.z);
    setMuted(false);
  }, [runId, camera]);

  // ---------- input + pointer lock ----------
  useEffect(() => {
    const canvas = gl.domElement;
    setGameCanvas(canvas);

    const pause = () => {
      const s = gameStore.get();
      if (s.phase !== "playing" || s.paused) return;
      firing.current = false;
      keys.current = {};
      setMuted(true);
      gameStore.set({ paused: true, resumeBlocked: false });
      releasePointerLock();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const s = gameStore.get();
      if (e.code === "Escape") {
        pause();
        return;
      }
      if (s.phase !== "playing" || s.paused) return;
      keys.current[e.code] = true;
      if (e.code === "KeyV") gameStore.set({ camera: s.camera === "fpp" ? "tpp" : "fpp" });
      if (e.code === "KeyE") interact();
      if (/^Digit[1-5]$/.test(e.code)) {
        const idx = Number(e.code.slice(5)) - 1;
        if (idx <= s.unlocked) {
          gameStore.set({ weaponIndex: idx });
          sfx.swing();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    const onMove = (e: MouseEvent) => {
      const s = gameStore.get();
      if (document.pointerLockElement !== canvas || s.paused || s.phase !== "playing") return;
      const sens = 0.0022 * s.sensitivity;
      yaw.current -= e.movementX * sens;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - e.movementY * sens,
        -Math.PI / 2.4,
        Math.PI / 2.4,
      );
    };
    const onDown = () => {
      const s = gameStore.get();
      if (s.phase !== "playing") return;
      if (document.pointerLockElement !== canvas) {
        void requestPointerLock();
        return;
      }
      if (!s.paused) firing.current = true;
    };
    const onUp = () => {
      firing.current = false;
    };
    const onLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      const s = gameStore.get();
      if (locked) {
        setMuted(false);
        gameStore.set({ pointerLocked: true, paused: false, resumeBlocked: false });
      } else {
        firing.current = false;
        keys.current = {};
        if (s.phase === "playing") {
          setMuted(true);
          gameStore.set({ pointerLocked: false, paused: true });
        } else {
          gameStore.set({ pointerLocked: false });
        }
      }
    };
    const onLockError = () => {
      gameStore.set({ resumeBlocked: true, pointerLocked: false });
    };
    const onBlur = () => pause();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("pointerlockchange", onLockChange);
    document.addEventListener("pointerlockerror", onLockError);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("pointerlockerror", onLockError);
      setGameCanvas(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  // ---------- spawning ----------
  function freeSlot(): Ghost | null {
    return ghosts.current.find((g) => !g.active) ?? null;
  }

  function spawnGhost(opts: {
    waveGhost: boolean;
    distance?: number;
    angle?: number;
    grave?: number;
  }) {
    const g = freeSlot();
    if (!g) return;
    const grave = opts.grave !== undefined ? GRAVES[opts.grave] : undefined;
    const tier = cleared.current.filter(Boolean).length;
    const angle = opts.angle ?? rand() * Math.PI * 2;
    const d = opts.distance ?? 16 + rand() * 12;

    let x = pos.current.x + Math.cos(angle) * d;
    let z = pos.current.z + Math.sin(angle) * d;
    // never spawn inside geometry
    for (let attempt = 0; attempt < 6 && blocked(x, z, colliders, 1); attempt++) {
      const a = rand() * Math.PI * 2;
      x = pos.current.x + Math.cos(a) * d;
      z = pos.current.z + Math.sin(a) * d;
    }

    resetGhost(g);
    g.active = true;
    g.pos.set(x, 0, z);
    g.wave = opts.waveGhost;
    g.maxHp = (70 + tier * 26 + (opts.waveGhost ? 26 : 0)) * (grave?.hpMul ?? 1);
    g.hp = g.maxHp;
    g.speed = (1.9 + rand() * 0.7 + tier * 0.16) * (grave?.speedMul ?? 1);
    g.dmg = (7 + tier * 2.2) * (grave?.dmgMul ?? 1);
    g.atkCdBase = grave?.atkCd ?? 1.15;
    g.atkCd = g.atkCdBase * 0.5;
    g.phase = rand() * 6.28;
    g.scale = 0.9 + rand() * 0.45;
    g.state = "chase";
  }

  function spawnBoss() {
    const b = boss.current;
    resetGhost(b);
    const grave = GRAVES[4]!;
    b.active = true;
    b.elite = true;
    b.wave = true;
    b.pos.set(grave.x, 0, grave.z - 6);
    b.maxHp = 1500;
    b.hp = b.maxHp;
    b.speed = 3.5;
    b.dmg = 22;
    b.atkCdBase = 1.25;
    b.atkCd = 1.5;
    b.scale = 2.3;
    b.state = "chase";
    b.teleportCd = 8;
    sfx.bossRoar();
    triggerJumpscare(true);
  }

  function triggerJumpscare(force = false) {
    const now = performance.now();
    if (!force) {
      if (jumpscaresUsed.current >= 3) return;
      if (now - lastJumpscare.current < 25000) return;
      jumpscaresUsed.current += 1;
    }
    lastJumpscare.current = now;
    shake.current = Math.max(shake.current, 0.35);
    sfx.scream();
    gameStore.set({ jumpscare: Date.now() });
  }

  // ---------- interaction ----------
  function interact() {
    const s = gameStore.get();
    if (s.phase !== "playing" || s.paused) return;

    // Beacon extraction takes priority once it is online.
    if (stage.current === "extraction" && s.nearBeacon) {
      finishRun(true);
      return;
    }
    if (stage.current !== "explore") return;
    const idx = s.nearGrave;
    if (idx < 0 || cleared.current[idx] || wave.current) return;

    const grave = GRAVES[idx]!;
    sfx.graveWake();
    sfx.whisper();
    if (idx === 0) triggerJumpscare(true);

    if (grave.modifier === "elite") {
      stage.current = "boss";
      wave.current = { grave: idx, remaining: 1, total: 1 };
      for (let i = 0; i < grave.ghosts; i++) spawnGhost({ waveGhost: false, grave: idx });
      spawnBoss();
      gameStore.set({
        stage: "boss",
        bossActive: true,
        bossHp: 1,
        waveIndex: idx + 1,
        waveRemaining: 1,
        waveTotal: 1,
        objective: "Destroy the thing that answered Akash",
        message: `${grave.name} — ${grave.tagline}`,
      });
      return;
    }

    const count = grave.ghosts;
    stage.current = "wave";
    wave.current = { grave: idx, remaining: count, total: count };
    if (grave.modifier === "ambush") {
      for (let i = 0; i < count; i++) {
        const close = i < 3;
        spawnGhost({
          waveGhost: true,
          grave: idx,
          angle: (i / count) * Math.PI * 2 + rand() * 0.4,
          distance: close ? 7 + rand() * 3 : 16 + rand() * 10,
        });
      }
    } else {
      for (let i = 0; i < count; i++) {
        spawnGhost({ waveGhost: true, grave: idx, distance: 12 + rand() * 12 });
      }
    }
    if (grave.modifier === "darkness") torchFail.current = 0.01;

    gameStore.set({
      stage: "wave",
      waveIndex: idx + 1,
      waveRemaining: count,
      waveTotal: count,
      objective: `Survive the wave — ${grave.name}`,
      message: `${grave.name} — ${grave.tagline}`,
    });
  }

  // ---------- combat ----------
  const dirTmp = new THREE.Vector3();
  const fromTmp = new THREE.Vector3();
  const toTmp = new THREE.Vector3();
  const projTmp = new THREE.Vector3();

  function pushMarker(g: Ghost, value: number, crit: boolean) {
    projTmp.set(g.pos.x, 1.6 + g.scale * 0.4, g.pos.z).project(camera);
    if (projTmp.z > 1) return;
    markers.current.push({
      id: markerId.current++,
      x: (projTmp.x * 0.5 + 0.5) * 100,
      y: (-projTmp.y * 0.5 + 0.5) * 100,
      value,
      crit,
      born: performance.now(),
    });
    if (markers.current.length > 10) markers.current.shift();
  }

  function damageGhost(g: Ghost, amount: number, crit: boolean, knockDir: THREE.Vector3) {
    g.hp -= amount;
    g.flash = 1;
    g.hurtT = crit ? 0.28 : 0.16;
    const weapon = WEAPONS[gameStore.get().weaponIndex]!;
    const kb = weapon.knockback * (crit ? 1.6 : 1) * (g.elite ? 0.25 : 1);
    g.knock.set(knockDir.x * kb, 0, knockDir.z * kb);
    pushMarker(g, Math.round(amount), crit);
    if (crit) sfx.crit();
    else sfx.hit();
    if (g.hp <= 0) killGhost(g);
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
    shake.current = Math.max(shake.current, weapon.shake);

    camera.getWorldDirection(dirTmp);
    fromTmp.set(pos.current.x, EYE, pos.current.z);

    if (weapon.ranged) {
      ammo.current -= 1;
      if (weapon.id === "shotgun") sfx.shotgun();
      else sfx.gunshot();
      muzzle.current = 0.07;
    } else {
      sfx.swing();
    }

    const targets: { g: Ghost; dist: number }[] = [];
    const consider = (g: Ghost) => {
      if (!g.active || g.state === "dying") return;
      toTmp.set(g.pos.x - fromTmp.x, 1.2 - fromTmp.y + g.scale * 0.5, g.pos.z - fromTmp.z);
      const dist = toTmp.length();
      toTmp.normalize();
      if (dist <= weapon.range && toTmp.dot(dirTmp) > Math.cos(weapon.spread)) {
        targets.push({ g, dist });
      }
    };
    ghosts.current.forEach(consider);
    consider(boss.current);
    targets.sort((a, b) => a.dist - b.dist);

    let hits = 0;
    for (const t of targets) {
      if (hits >= weapon.pellets) break;
      hits += 1;
      const crit = rand() < 0.16;
      const falloff = weapon.ranged ? Math.max(0.55, 1 - t.dist / (weapon.range * 1.6)) : 1;
      const dmg = weapon.damage * falloff * (crit ? 2 : 1);
      toTmp.set(t.g.pos.x - fromTmp.x, 0, t.g.pos.z - fromTmp.z).normalize();
      damageGhost(t.g, dmg, crit, toTmp);
      if (crit) shake.current = Math.max(shake.current, weapon.shake * 1.6);
    }
  }

  function killGhost(g: Ghost) {
    g.state = "dying";
    g.dying = 0;
    g.hp = 0;
    kills.current += 1;
    sfx.ghostDeath();

    if (g.elite) {
      bossDefeated.current = true;
      g.active = false;
      onBossDefeated();
      return;
    }
    if (g.wave && wave.current && stage.current === "wave") {
      wave.current.remaining -= 1;
      if (wave.current.remaining <= 0) onWaveCleared(wave.current.grave);
      else gameStore.set({ waveRemaining: wave.current.remaining });
    }
  }

  function onWaveCleared(idx: number) {
    cleared.current[idx] = true;
    wave.current = null;
    stage.current = "explore";
    const gravesCleared = cleared.current.filter(Boolean).length;
    const unlocked = Math.min(WEAPONS.length - 1, gravesCleared);
    const weapon = WEAPONS[unlocked]!;
    if (weapon.ammo > 0) ammo.current += weapon.ammo;
    // partial recovery, never a full heal
    health.current = Math.min(100, health.current + 18);
    torchFail.current = 0;
    sfx.unlock();
    const remaining = GRAVES.filter((_, i) => !cleared.current[i]);
    gameStore.set({
      stage: "explore",
      gravesCleared,
      clearedFlags: [...cleared.current],
      unlocked,
      weaponIndex: unlocked,
      waveIndex: 0,
      waveRemaining: 0,
      waveTotal: 0,
      objective: remaining.length
        ? `Wake the next grave — ${remaining.map((g) => g.name).join(", ")}`
        : "Wake the last grave — Akash",
      message: `${GRAVES[idx]!.name} rests again. ${weapon.name} unlocked.`,
    });
  }

  function onBossDefeated() {
    wave.current = null;
    cleared.current[4] = true;
    stage.current = "extraction";
    extractionSpawns.current = 0;
    const gravesCleared = cleared.current.filter(Boolean).length;
    const unlocked = WEAPONS.length - 1;
    ammo.current += WEAPONS[unlocked]!.ammo;
    health.current = Math.min(100, health.current + 25);
    sfx.beacon();
    gameStore.set({
      stage: "extraction",
      bossActive: false,
      bossHp: 0,
      gravesCleared,
      clearedFlags: [...cleared.current],
      unlocked,
      weaponIndex: unlocked,
      beaconReady: true,
      waveIndex: 0,
      waveRemaining: 0,
      waveTotal: 0,
      objective: "HEMI BEACON ONLINE — reach the extraction point",
      message: "HEMI BEACON ONLINE. Get to the extraction point.",
    });
  }

  function finishRun(extraction: boolean) {
    const graves = cleared.current.filter(Boolean).length;
    const breakdown = computeScore({
      kills: kills.current,
      graves,
      boss: bossDefeated.current,
      extraction,
      health: health.current,
      time: elapsed.current,
    });
    releasePointerLock();
    setMuted(false);
    firing.current = false;
    if (extraction) sfx.win();
    else sfx.gameOver();
    gameStore.finish(
      {
        score: breakdown.total,
        breakdown,
        kills: kills.current,
        graves,
        time: elapsed.current,
        health: Math.max(0, health.current),
        extraction,
      },
      extraction ? "won" : "dead",
    );
  }

  function hurtPlayer(amount: number) {
    if (amount <= 0) return;
    health.current -= amount;
    hurtFlash.current = 1;
    shake.current = Math.max(shake.current, 0.22);
    sfx.hurt();
    if (health.current <= 0) {
      health.current = 0;
      finishRun(false);
    }
  }

  // ---------- main loop ----------
  const camTmp = new THREE.Vector3();
  const eyeTmp = new THREE.Vector3();
  const moveTmp = new THREE.Vector3();
  const fwdTmp = new THREE.Vector3();
  const rightTmp = new THREE.Vector3();
  const desiredCam = new THREE.Vector3();

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const s = gameStore.get();
    if (s.phase !== "playing" || s.paused) return;

    elapsed.current += dt;

    // ---- movement ----
    fwdTmp.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    rightTmp.set(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
    moveTmp.set(0, 0, 0);
    if (keys.current["KeyW"] || keys.current["ArrowUp"]) moveTmp.add(fwdTmp);
    if (keys.current["KeyS"] || keys.current["ArrowDown"]) moveTmp.sub(fwdTmp);
    if (keys.current["KeyD"] || keys.current["ArrowRight"]) moveTmp.add(rightTmp);
    if (keys.current["KeyA"] || keys.current["ArrowLeft"]) moveTmp.sub(rightTmp);

    const wantsSprint = !!(keys.current["ShiftLeft"] || keys.current["ShiftRight"]);
    const moving = moveTmp.lengthSq() > 0;
    if (exhausted.current && stamina.current > 35) exhausted.current = false;
    const sprinting = wantsSprint && moving && !exhausted.current && stamina.current > 0;
    const speed = sprinting ? SPRINT : WALK;
    if (moving) moveTmp.normalize().multiplyScalar(speed);
    vel.current.lerp(moveTmp, 1 - Math.exp(-14 * dt));

    camTmp.copy(pos.current).addScaledVector(vel.current, dt);
    resolveCircle(camTmp, RADIUS, colliders);
    pos.current.set(camTmp.x, 0, camTmp.z);

    stamina.current = THREE.MathUtils.clamp(
      stamina.current + (sprinting ? -24 : moving ? 10 : 18) * dt,
      0,
      100,
    );
    if (stamina.current <= 0) exhausted.current = true;

    const horizSpeed = Math.hypot(vel.current.x, vel.current.z);
    if (horizSpeed > 1.2) {
      stepTimer.current -= dt * (sprinting ? 1.65 : 1);
      if (stepTimer.current <= 0) {
        stepTimer.current = 0.48;
        sfx.footstep(sprinting);
      }
    }

    // ---- camera ----
    eyeTmp.set(pos.current.x, EYE, pos.current.z);
    shake.current = Math.max(0, shake.current - dt * 2.2);
    if (s.camera === "fpp") {
      camera.position.copy(eyeTmp);
    } else {
      // step back from the eye until we hit geometry, so the camera never clips
      let back = 5;
      for (let i = 0; i < 8; i++) {
        const bx = eyeTmp.x + Math.sin(yaw.current) * back;
        const bz = eyeTmp.z + Math.cos(yaw.current) * back;
        if (!blocked(bx, bz, colliders, 0.5)) break;
        back -= 0.55;
      }
      back = Math.max(1.6, back);
      desiredCam.set(
        eyeTmp.x + Math.sin(yaw.current) * back,
        EYE + 1.35 - pitch.current * 2,
        eyeTmp.z + Math.cos(yaw.current) * back,
      );
      camera.position.lerp(desiredCam, 1 - Math.exp(-16 * dt));
    }
    if (shake.current > 0.001) {
      camera.position.x += (rand() - 0.5) * shake.current * 0.6;
      camera.position.y += (rand() - 0.5) * shake.current * 0.6;
    }
    camera.lookAt(
      eyeTmp.x - Math.sin(yaw.current) * Math.cos(pitch.current) * 10,
      eyeTmp.y + Math.sin(pitch.current) * 10,
      eyeTmp.z - Math.cos(yaw.current) * Math.cos(pitch.current) * 10,
    );

    // ---- flashlight ----
    if (torchRef.current && torchTargetRef.current) {
      camera.getWorldDirection(dirTmp);
      torchRef.current.target = torchTargetRef.current;
      torchRef.current.position.copy(camera.position);
      torchTargetRef.current.position.copy(camera.position).addScaledVector(dirTmp, 14);
      torchRef.current.updateMatrixWorld();
      let intensity = 190 + Math.sin(performance.now() / 140) * 12;
      // Joshua: the light gives out in bursts
      if (torchFail.current > 0) {
        torchFail.current += dt;
        const cyc = torchFail.current % 4;
        if (cyc < 1.1) intensity *= 0.12 + Math.abs(Math.sin(cyc * 22)) * 0.25;
        else if (cyc < 1.5) intensity *= 0.5;
      }
      torchRef.current.intensity = intensity;
    }

    // ---- player body ----
    if (rig.root.current) {
      rig.root.current.position.set(pos.current.x, 0, pos.current.z);
      const visible = s.camera === "tpp";
      rig.root.current.visible = visible;
      if (visible) {
        const faceYaw = moving ? Math.atan2(vel.current.x, vel.current.z) + Math.PI : yaw.current;
        const cur = rig.root.current.rotation.y;
        let diff = faceYaw - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        rig.root.current.rotation.y = cur + diff * (1 - Math.exp(-12 * dt));
        animatePlayer(rig, {
          speed: horizSpeed,
          sprinting,
          swing: swing.current,
          pitch: pitch.current,
          t: performance.now() / 1000,
          dt,
        });
      }
    }

    // ---- viewmodel ----
    swing.current = Math.max(0, swing.current - dt * 4);
    if (vmRef.current) {
      const show = s.camera === "fpp";
      vmRef.current.visible = show;
      if (show) {
        vmRef.current.position.copy(camera.position);
        vmRef.current.quaternion.copy(camera.quaternion);
        vmRef.current.translateX(0.42);
        vmRef.current.translateY(
          -0.44 + Math.sin(performance.now() / 420) * 0.012 - horizSpeed * 0.004,
        );
        vmRef.current.translateZ(-1.0 + swing.current * 0.32);
        vmRef.current.rotateX(swing.current * 0.85);
        vmRef.current.scale.setScalar(0.58);
      }
    }
    muzzle.current = Math.max(0, muzzle.current - dt);
    if (muzzleRef.current) {
      muzzleRef.current.intensity = muzzle.current > 0 ? 260 : 0;
      muzzleRef.current.position.copy(camera.position);
    }

    // ---- attacking ----
    cooldown.current -= dt;
    if (firing.current && cooldown.current <= 0) attack();

    // ---- spawning by stage ----
    const activeCount = ghosts.current.reduce((n, g) => n + (g.active ? 1 : 0), 0);
    spawnTimer.current -= dt;
    if (spawnTimer.current <= 0) {
      const graves = cleared.current.filter(Boolean).length;
      if (stage.current === "explore" && activeCount < 3 + graves) {
        spawnTimer.current = Math.max(4, 10 - graves * 1.1);
        spawnGhost({ waveGhost: false });
      } else if (stage.current === "boss" && activeCount < 4) {
        spawnTimer.current = 9;
        spawnGhost({ waveGhost: false, grave: 4 });
      } else if (
        stage.current === "extraction" &&
        activeCount < 7 &&
        extractionSpawns.current < 12
      ) {
        spawnTimer.current = 2.6;
        extractionSpawns.current += 1;
        spawnGhost({ waveGhost: false, distance: 14 + rand() * 8 });
      } else {
        spawnTimer.current = 2;
      }
    }

    // ---- distant ambience ----
    ambienceTimer.current -= dt;
    if (ambienceTimer.current <= 0) {
      ambienceTimer.current = 14 + rand() * 16;
      if (activeCount > 0) sfx.ghostDistant();
    }

    // ---- ghosts ----
    let nearest = 999;
    let damage = 0;
    let attackSound = false;
    const all = ghosts.current;
    for (let i = 0; i < all.length; i++) {
      const g = all[i]!;
      const node = ghostRefs.current[i];
      if (!g.active) {
        if (node) node.visible = false;
        continue;
      }
      const res = updateGhost(g, dt, pos.current, colliders, all, rand);
      damage += res.damage;
      if (res.attacked) attackSound = true;
      const d = Math.hypot(pos.current.x - g.pos.x, pos.current.z - g.pos.z);
      if (d < nearest) nearest = d;
      if (d < 3 && g.state === "attack" && rand() < 0.0015) triggerJumpscare();
      if (node) {
        node.visible = true;
        const bob = Math.sin(performance.now() / 500 + g.phase) * 0.2;
        const dieK = g.state === "dying" ? 1 - g.dying / 0.55 : 1;
        node.position.set(g.pos.x, 1.1 + bob - (1 - dieK) * 0.8, g.pos.z);
        node.scale.setScalar(g.scale * (0.4 + dieK * 0.6));
        node.lookAt(camera.position.x, node.position.y, camera.position.z);
        const face = node.children[1] as THREE.Mesh | undefined;
        if (face) {
          const m = face.material as THREE.MeshBasicMaterial;
          m.opacity = 0.9 * dieK;
          m.color.setRGB(1 + g.flash * 1.6, 1 - g.flash * 0.3, 1 - g.flash * 0.4);
        }
      }
    }

    // ---- boss ----
    const b = boss.current;
    if (b.active) {
      if (eliteTeleport(b, dt, pos.current, colliders, rand)) sfx.bossPhase();
      const res = updateGhost(b, dt, pos.current, colliders, all, rand);
      damage += res.damage;
      if (res.attacked) attackSound = true;
      const d = Math.hypot(pos.current.x - b.pos.x, pos.current.z - b.pos.z);
      if (d < nearest) nearest = d;
    }
    if (bossRef.current) {
      bossRef.current.visible = b.active;
      if (b.active) {
        const bob = Math.sin(performance.now() / 420) * 0.28;
        bossRef.current.position.set(b.pos.x, 2.1 + bob, b.pos.z);
        bossRef.current.rotation.y = b.facing;
        bossRef.current.scale.setScalar(b.scale * (1 + b.flash * 0.06));
      }
    }

    if (attackSound) sfx.ghostAttack();
    hurtPlayer(damage);
    if (gameStore.get().phase !== "playing") return;

    // ---- danger + heartbeat ----
    const lowHp = health.current < 30;
    const danger = THREE.MathUtils.clamp(1 - nearest / 20, 0, 1);
    const beatIntensity = lowHp ? 1.4 : danger;
    if (danger > 0.4 || lowHp || stage.current === "extraction") {
      beatTimer.current -= dt;
      if (beatTimer.current <= 0) {
        beatTimer.current = lowHp ? 0.7 : 1.3 - danger * 0.8;
        sfx.heartbeat(beatIntensity);
      }
    }
    hurtFlash.current = Math.max(0, hurtFlash.current - dt * 1.6);

    // ---- proximity prompts ----
    let nearGrave = -1;
    if (stage.current === "explore") {
      for (let i = 0; i < GRAVES.length; i++) {
        const g = GRAVES[i]!;
        if (cleared.current[i]) continue;
        if (Math.hypot(g.x - pos.current.x, g.z - pos.current.z) < 5) nearGrave = i;
      }
    }
    const beaconDist = Math.hypot(BEACON.x - pos.current.x, BEACON.z - pos.current.z);
    const nearBeacon = stage.current === "extraction" && beaconDist < BEACON_RADIUS;

    // ---- HUD sync (10 Hz) ----
    hudTimer.current -= dt;
    if (hudTimer.current <= 0) {
      hudTimer.current = 0.1;
      const now = performance.now();
      const live = markers.current.filter((m) => now - m.born < 900);
      const markersChanged = live.length !== markers.current.length || live.length > 0;
      markers.current = live;
      gameStore.set({
        health: Math.max(0, Math.round(health.current)),
        stamina: Math.round(stamina.current),
        exhausted: exhausted.current,
        ammo: ammo.current,
        kills: kills.current,
        nearGrave,
        nearBeacon,
        danger: Math.round(danger * 20) / 20,
        hurtFlash: Math.round(hurtFlash.current * 10) / 10,
        elapsed: Math.round(elapsed.current * 10) / 10,
        beaconDistance: Math.round(beaconDist),
        bossHp: b.active ? Math.max(0, b.hp / b.maxHp) : 0,
        ...(markersChanged ? { markers: [...live] } : {}),
      });
    }
  });

  return (
    <group>
      <Town data={town} />

      <PlayerModel rig={rig} weaponId={weaponId} />

      {/* first person weapon */}
      <group ref={vmRef}>
        <WeaponModel id={weaponId} />
      </group>
      <pointLight ref={muzzleRef} color="#ffd9a0" intensity={0} distance={30} decay={2} />

      {/* handheld torch */}
      <object3D ref={torchTargetRef} />
      <spotLight
        ref={torchRef}
        color="#ffe3c2"
        intensity={190}
        distance={60}
        angle={0.68}
        penumbra={0.5}
        decay={1.3}
      />

      {/* ghost pool */}
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
              emissive="#25404b"
              emissiveIntensity={0.8}
            />
          </mesh>
          <mesh position-y={0.55}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={ghostTex} transparent opacity={0.9} toneMapped={false} />
          </mesh>
          <pointLight color="#6fd8ff" intensity={3} distance={5} />
        </group>
      ))}

      {/* elite boss */}
      <group ref={bossRef} visible={false}>
        <mesh position-y={-0.7}>
          <coneGeometry args={[0.78, 2.6, 8]} />
          <meshStandardMaterial
            color="#5a2a1a"
            transparent
            opacity={0.62}
            flatShading
            emissive="#ff3b00"
            emissiveIntensity={1.3}
          />
        </mesh>
        <mesh position-y={0.55} scale={1.25}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={ghostTex} transparent opacity={0.96} toneMapped={false} />
        </mesh>
        <mesh position-y={0.05}>
          <icosahedronGeometry args={[0.42, 0]} />
          <meshBasicMaterial color="#ff7a1f" toneMapped={false} />
        </mesh>
        <mesh position={[-0.28, 0.62, 0.42]}>
          <sphereGeometry args={[0.1, 6, 6]} />
          <meshBasicMaterial color="#ff2a00" toneMapped={false} />
        </mesh>
        <mesh position={[0.28, 0.62, 0.42]}>
          <sphereGeometry args={[0.1, 6, 6]} />
          <meshBasicMaterial color="#ff2a00" toneMapped={false} />
        </mesh>
        <pointLight color="#ff4b0f" intensity={90} distance={22} decay={2} />
      </group>
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
          <meshStandardMaterial
            color="#b8b0a0"
            emissive="#ff3d00"
            emissiveIntensity={0.4}
            flatShading
          />
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

export { ATTACK_RANGE };
