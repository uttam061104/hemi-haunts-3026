export interface RunStats {
  kills: number;
  graves: number;
  boss: boolean;
  extraction: boolean;
  health: number;
  time: number; // seconds
}

export interface ScoreBreakdown {
  kills: number;
  graves: number;
  boss: number;
  extraction: number;
  health: number;
  time: number;
  total: number;
}

export const SCORE = {
  kill: 100,
  grave: 750,
  boss: 2500,
  extraction: 3000,
  healthPer: 5,
} as const;

export function computeScore(s: RunStats): ScoreBreakdown {
  const kills = s.kills * SCORE.kill;
  const graves = s.graves * SCORE.grave;
  const boss = s.boss ? SCORE.boss : 0;
  const extraction = s.extraction ? SCORE.extraction : 0;
  const health = s.extraction ? Math.max(0, Math.round(s.health)) * SCORE.healthPer : 0;
  // Faster runs score better; only rewarded on a successful extraction.
  const time = s.extraction ? Math.max(0, Math.round(2400 - s.time * 4)) : 0;
  return {
    kills,
    graves,
    boss,
    extraction,
    health,
    time,
    total: kills + graves + boss + extraction + health + time,
  };
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
