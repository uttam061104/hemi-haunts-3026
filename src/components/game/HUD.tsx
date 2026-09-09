import { useEffect, useState } from "react";
import { GRAVES, WEAPONS, gameStore, useGame } from "@/lib/game/store";
import { sfx } from "@/lib/game/audio";
import {
  explorerTx,
  hasWallet,
  saveLocalScore,
  submitScoreOnchain,
  getConnectedAddress,
} from "@/lib/hemi";
import ghostFace from "@/assets/ghost-face.webp.asset.json";
import hemiLogo from "@/assets/hemi-logo.png.asset.json";

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  return (
    <div className="h-2.5 w-44 overflow-hidden rounded-sm border border-white/15 bg-black/60">
      <div
        className={`h-full transition-[width] duration-200 ${className}`}
        style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }}
      />
    </div>
  );
}

export function HUD() {
  const s = useGame();
  const [scare, setScare] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!s.jumpscare) return;
    setScare(true);
    const t = window.setTimeout(() => setScare(false), 900);
    return () => window.clearTimeout(t);
  }, [s.jumpscare]);

  const weapon = WEAPONS[s.weaponIndex]!;
  const finished = s.phase === "dead" || s.phase === "won";

  async function submit() {
    setSubmitting(true);
    setError(null);
    const entry = {
      name: s.playerName || "Unknown",
      score: s.score,
      kills: s.kills,
      graves: s.gravesCleared,
      ts: Date.now(),
    };
    try {
      const hash = await submitScoreOnchain(entry);
      const address = await getConnectedAddress();
      saveLocalScore({ ...entry, hash, ...(address ? { address } : {}) });
      setTxHash(hash);
    } catch (e) {
      saveLocalScore(entry);
      setError(e instanceof Error ? e.message : "Could not record the score onchain.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-mono">
      <div className="hud-grain" />
      <div className="hud-vignette" style={{ opacity: 0.55 + s.danger * 0.4 }} />
      {s.danger > 0.6 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ boxShadow: `inset 0 0 180px rgba(255,60,0,${(s.danger - 0.6) * 0.9})` }}
        />
      )}

      {/* top left stats */}
      <div className="absolute left-5 top-5 space-y-2 text-xs uppercase tracking-widest text-white/80">
        <div className="flex items-center gap-2">
          <span className="w-14 text-white/50">Life</span>
          <Bar value={s.health} max={100} className="bg-red-600" />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 text-white/50">Stam</span>
          <Bar value={s.stamina} max={100} className="bg-emerald-500" />
        </div>
        <div className="text-white/60">
          Graves {s.gravesCleared}/{GRAVES.length} &nbsp;•&nbsp; Kills {s.kills}
        </div>
        {s.waveRemaining > 0 && (
          <div className="text-[#ff4b0f]">Restless: {s.waveRemaining} left</div>
        )}
      </div>

      {/* top right grave list */}
      <div className="absolute right-5 top-5 text-right text-xs uppercase tracking-widest">
        <div className="mb-1 flex items-center justify-end gap-2 text-white/50">
          <img src={hemiLogo.url} alt="" className="h-4 w-4 opacity-70 grayscale" />
          Hemi Town 3026
        </div>
        {GRAVES.map((g, i) => (
          <div key={g.name} className={s.clearedFlags[i] ? "text-white/25 line-through" : "text-white/70"}>
            {g.name}
          </div>
        ))}
      </div>

      {/* weapon */}
      <div className="absolute bottom-5 right-5 text-right text-xs uppercase tracking-widest">
        <div className="text-lg text-[#ff4b0f]">{weapon.name}</div>
        <div className="text-white/60">{weapon.ranged ? `Ammo ${s.ammo}` : "Melee"}</div>
        <div className="mt-2 space-y-0.5">
          {WEAPONS.map((w, i) => (
            <div
              key={w.id}
              className={
                i > s.unlocked
                  ? "text-white/20"
                  : i === s.weaponIndex
                    ? "text-white"
                    : "text-white/45"
              }
            >
              {i + 1}. {i > s.unlocked ? "locked" : w.name}
            </div>
          ))}
        </div>
      </div>

      {/* controls hint */}
      <div className="absolute bottom-5 left-5 text-[11px] uppercase tracking-widest text-white/35">
        WASD move • Shift sprint • Click attack • V camera ({s.camera.toUpperCase()}) • E grave • Esc pause
      </div>

      {/* crosshair */}
      {s.phase === "playing" && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-4 w-4 rounded-full border border-[#ff4b0f]/70" />
        </div>
      )}

      {/* message */}
      {s.message && s.phase === "playing" && (
        <div className="absolute left-1/2 top-[18%] w-[80%] max-w-lg -translate-x-1/2 text-center text-sm text-white/75">
          {s.message}
        </div>
      )}

      {/* grave prompt */}
      {s.nearGrave >= 0 && s.phase === "playing" && (
        <div className="absolute left-1/2 top-[58%] -translate-x-1/2 text-center text-sm uppercase tracking-widest text-[#ff4b0f]">
          Press E — grave of {GRAVES[s.nearGrave]!.name}
        </div>
      )}

      {/* jumpscare */}
      {scare && (
        <div className="jumpscare pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70">
          <img src={ghostFace.url} alt="" className="h-[70vh] max-w-none opacity-95 contrast-150 grayscale" />
        </div>
      )}

      {/* pause */}
      {s.paused && s.phase === "playing" && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-center">
          <h2 className="text-2xl uppercase tracking-[0.3em] text-[#ff4b0f]">Paused</h2>
          <p className="text-sm text-white/60">Click anywhere to go back into the dark.</p>
        </div>
      )}

      {/* end of run */}
      {finished && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center">
          <h2 className="text-3xl uppercase tracking-[0.3em] text-[#ff4b0f]">
            {s.phase === "won" ? "You left Hemi Town" : "Hemi Town kept you"}
          </h2>
          <p className="text-sm text-white/60">
            {s.playerName} — {s.kills} ghosts down, {s.gravesCleared}/{GRAVES.length} graves silenced
          </p>
          <p className="text-5xl text-white">{s.score}</p>

          {txHash ? (
            <a
              className="text-sm text-[#ff4b0f] underline"
              href={explorerTx(txHash)}
              target="_blank"
              rel="noreferrer"
            >
              Score recorded on Hemi testnet — view transaction
            </a>
          ) : (
            <button
              onClick={() => void submit()}
              disabled={submitting || !hasWallet()}
              className="rounded-sm border border-[#ff4b0f] px-6 py-2 text-sm uppercase tracking-widest text-[#ff4b0f] transition hover:bg-[#ff4b0f] hover:text-black disabled:opacity-40"
            >
              {submitting ? "Signing…" : "Record score on Hemi testnet"}
            </button>
          )}
          {!hasWallet() && (
            <p className="text-xs text-white/40">
              Install MetaMask to write your score onchain. It is saved locally either way.
            </p>
          )}
          {error && <p className="max-w-md text-xs text-red-400">{error}</p>}

          <button
            onClick={() => {
              sfx.swing();
              gameStore.set({ phase: "lobby" });
            }}
            className="mt-2 text-xs uppercase tracking-widest text-white/50 underline"
          >
            Back to lobby
          </button>
        </div>
      )}
    </div>
  );
}
