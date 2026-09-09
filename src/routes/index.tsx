import { createFileRoute } from "@tanstack/react-router";
import { useGame } from "@/lib/game/store";
import { Lobby } from "@/components/game/Lobby";
import { GameCanvas } from "@/components/game/GameCanvas";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Hemi Town 3026 — 3D Horror Survival on Hemi Testnet" },
      {
        name: "description",
        content:
          "Survive a haunted low-poly town, silence five cursed graves, upgrade from Stick Sword to shotgun, and record your score onchain on the Hemi testnet.",
      },
      { property: "og:title", content: "Hemi Town 3026 — 3D Horror Survival" },
      {
        property: "og:description",
        content:
          "Night horror in Hemi Town: zombie ghosts, jumpscares, weapon progression and onchain scores on Hemi testnet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const s = useGame();
  if (s.phase === "lobby") return <Lobby />;
  return <GameCanvas />;
}
