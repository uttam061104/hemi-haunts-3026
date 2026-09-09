import { useEffect, useState } from "react";
import { gameStore, useGame } from "@/lib/game/store";
import { resumeAudio, setVolume, sfx, startAmbient } from "@/lib/game/audio";
import { connectWallet, getConnectedAddress, hasWallet, readLeaderboard, type ScoreEntry } from "@/lib/hemi";
import hemiLogo from "@/assets/hemi-logo.png.asset.json";

export function Lobby() {
  const s = useGame();
  const [name, setName] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const [board, setBoard] = useState<ScoreEntry[]>([]);
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => {
    setBoard(readLeaderboard());
    setName(window.localStorage.getItem("hemi-town-name") ?? "");
    void getConnectedAddress().then(setAddress);
  }, []);

  function start(camera: "fpp" | "tpp") {
    const finalName = name.trim() || "Wanderer";
    window.localStorage.setItem("hemi-town-name", finalName);
    resumeAudio();
    startAmbient();
    setVolume(s.volume);
    sfx.whisper();
    gameStore.resetRun(finalName, camera);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08090b] font-mono text-white">
      <div className="hud-grain" />
      <div className="hud-vignette" style={{ opacity: 0.8 }} />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <img
          src={hemiLogo.url}
          alt=""
          className="cracked-mark h-[70vh] w-[70vh] max-w-none opacity-[0.10]"
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-8 px-6 py-16">
        <header className="text-center">
          <div className="flex items-center justify-center gap-4">
            <img src={hemiLogo.url} alt="Hemi" className="cracked-mark h-14 w-14" />
            <h1 className="text-4xl font-bold uppercase tracking-[0.35em] text-[#ff4b0f] sm:text-6xl">
              Hemi Town
            </h1>
          </div>
          <p className="mt-3 text-sm uppercase tracking-[0.5em] text-white/45">3026</p>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/55">
            Five graves. Five names. Something under this town remembers every one of them.
            Wake them, put them down, and get out before the fog closes.
          </p>
        </header>

        <div className="grid w-full gap-6 md:grid-cols-2">
          <section className="rounded-sm border border-white/10 bg-black/50 p-6">
            <label className="text-xs uppercase tracking-widest text-white/45">Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 18))}
              placeholder="Wanderer"
              className="mt-2 w-full rounded-sm border border-white/15 bg-black/60 px-3 py-2 text-lg text-white outline-none focus:border-[#ff4b0f]"
            />

            <div className="mt-5 space-y-3 text-xs uppercase tracking-widest text-white/45">
              <div>
                <div className="mb-1">Volume</div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={s.volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    gameStore.set({ volume: v });
                    setVolume(v);
                  }}
                  className="w-full accent-[#ff4b0f]"
                />
              </div>
              <div>
                <div className="mb-1">Mouse sensitivity</div>
                <input
                  type="range"
                  min={0.3}
                  max={2.5}
                  step={0.1}
                  value={s.sensitivity}
                  onChange={(e) => gameStore.set({ sensitivity: Number(e.target.value) })}
                  className="w-full accent-[#ff4b0f]"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => start("fpp")}
                className="rounded-sm bg-[#ff4b0f] px-6 py-3 text-sm font-bold uppercase tracking-[0.25em] text-black transition hover:bg-[#ff6a35]"
              >
                Enter — first person
              </button>
              <button
                onClick={() => start("tpp")}
                className="rounded-sm border border-[#ff4b0f]/70 px-6 py-3 text-sm uppercase tracking-[0.25em] text-[#ff4b0f] transition hover:bg-[#ff4b0f]/10"
              >
                Enter — third person
              </button>
              <p className="text-[11px] uppercase tracking-widest text-white/30">
                Switch camera any time with V
              </p>
            </div>
          </section>

          <section className="rounded-sm border border-white/10 bg-black/50 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-widest text-white/45">Hemi testnet</h2>
              {address ? (
                <span className="text-xs text-emerald-400">
                  {address.slice(0, 6)}…{address.slice(-4)}
                </span>
              ) : (
                <button
                  onClick={async () => {
                    setWalletError(null);
                    try {
                      setAddress(await connectWallet());
                    } catch (e) {
                      setWalletError(e instanceof Error ? e.message : "Wallet connection failed.");
                    }
                  }}
                  disabled={!hasWallet()}
                  className="rounded-sm border border-[#ff4b0f] px-3 py-1 text-xs uppercase tracking-widest text-[#ff4b0f] disabled:opacity-40"
                >
                  Connect wallet
                </button>
              )}
            </div>
            {!hasWallet() && (
              <p className="mt-2 text-[11px] text-white/35">
                No wallet detected — install MetaMask to record runs onchain.
              </p>
            )}
            {walletError && <p className="mt-2 text-[11px] text-red-400">{walletError}</p>}

            <h3 className="mt-6 text-xs uppercase tracking-widest text-white/45">Leaderboard</h3>
            <ol className="mt-3 space-y-1 text-sm">
              {board.length === 0 && (
                <li className="text-white/30">No survivors recorded yet.</li>
              )}
              {board.map((e, i) => (
                <li key={`${e.ts}-${i}`} className="flex justify-between gap-3 text-white/70">
                  <span className="truncate">
                    {i + 1}. {e.name} {e.hash ? "⛓" : ""}
                  </span>
                  <span className="text-[#ff4b0f]">{e.score}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <footer className="text-[11px] uppercase tracking-[0.3em] text-white/25">
          Built for Hemi Arcade 2
        </footer>
      </div>
    </div>
  );
}
