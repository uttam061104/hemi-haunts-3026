# Hemi Town 3026 — 3D horror game

A browser-playable low-poly PS1-style horror game with a lobby, one haunted town map, zombie ghosts, weapon progression, jumpscares, and score recording on the Hemi testnet.

## Lobby

- Title screen with the cracked, dark Hemi symbol (from the uploaded logo) as the game mark.
- Player types a name, picks camera mode (first person / third person), and starts.
- "Connect wallet" button for Hemi testnet, plus a leaderboard panel.
- Settings: volume, mouse sensitivity, camera toggle (also switchable in-game with a key).

## The town

- One night-time town map: fog, moonlight, flickering street lamps, broken fences, a chapel, and a graveyard.
- Five haunted graves named Jeremy, Joshua, JCV, Pranjal, Akash. Approaching a grave triggers its own event: whispers, a name flash, a rising ghost, and a jumpscare.
- Clearing all five graves ends the run and submits the score.

## Player and enemies

- Player character built around the uploaded face photo, mapped onto a low-poly body so it reads in third person.
- Camera switch between first person and third person at any time.
- Zombie ghosts built from the second uploaded photo — pale, floating, translucent, several variants with different speed and damage.
- Waves get harder as more graves are cleared.

## Weapons

Progression unlocked by kills and grave clears:
1. Stick Sword (starter)
2. Iron Blade
3. Pistol
4. Cursed Katana
5. Shotgun

Each has its own damage, range, swing/fire rate, and sound.

## Atmosphere and audio

- Heavy fog, grain and vignette, dark palette with Hemi orange accents.
- Ambient wind and distant howls, footsteps, heartbeat when enemies are near, scream stingers on jumpscares, weapon sounds.
- Health, stamina, ammo, kill count, and grave counter on screen.

## Score on Hemi testnet

- Player connects MetaMask; the app prompts to add/switch to the Hemi testnet network.
- At the end of a run the score is written onchain and the leaderboard reads back from the chain.
- I need one thing from you: the score contract address on Hemi testnet. If you don't have one, I'll build the game with a local leaderboard and wire the onchain part the moment you give me the address.

## Technical notes

- React Three Fiber + Three.js on a client-only route; keyboard/mouse with pointer lock, touch controls for mobile.
- Player, zombie, and grave models built procedurally low-poly; uploaded photos used as face textures on billboards/planes.
- Logo becomes the favicon and the in-game entity symbol with a cracked, desaturated treatment.
- Wallet via injected EIP-1193 provider (MetaMask) + viem; leaderboard read/write through a small contract ABI.
- Sound generated as short synthesized/generated clips served from CDN assets.

## Build order

1. Lobby, name entry, styling, favicon, logo treatment.
2. Town scene, lighting, fog, movement, FPP/TPP camera.
3. Player model + weapons and combat.
4. Zombie ghosts, waves, graves, jumpscares.
5. Audio and HUD polish.
6. Wallet connect + onchain score and leaderboard.
