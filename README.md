# Neon Outpost

Free 3D top-down cooperative robot arena for two phones on the same Wi-Fi.

Play: https://refreshingday.github.io/multiplayerTest/

## Joining
- Host taps **Host a game**, then shares the six-digit room code or the room link.
- Friend taps **Join a friend** and enters the six digits. A room link joins automatically.
- Both players tap **Ready**.

Room matching uses the free public PeerJS Cloud signaling service; internet access is needed while joining. It automatically exchanges connection information. Gameplay then uses the existing direct WebRTC connection with reliable controls and a separate unordered channel for updates. The temporary matching connection and cloud connection are closed after pairing. No STUN or TURN is used; Wi-Fi must allow direct device communication. Public matching service availability is outside this project's control.

**Manual pairing** remains available in the menu if matching is unavailable. It exchanges the full invite and reply without a signaling service.

## Responsive gameplay
The guest predicts its own movement at 60 simulation ticks per second using the same speed, arena bounds and crate collisions as the host. Input ticks are numbered and resent until the host acknowledges processing them. Each authoritative snapshot corrects the guest position, then the guest replays only unacknowledged ticks; small visual corrections fade smoothly. Other players and enemies render smoothly between snapshots, and bullets advance locally between updates. A local muzzle flash responds immediately to firing; damage, bullet hits, health, waves, and scores remain host-authoritative.

Controls: left stick moves, right stick aims and fires. Desktop: WASD or arrows, mouse, click or space to fire. Solo mode is available.

Play pauses on hidden tabs, stale input, stale snapshots, or interrupted connections. Both players must choose Ready to resume. A restart requires both votes.

## Hosting
GitHub Pages: Settings → Pages → Deploy from a branch → main → /(root) → Save.
No build step is needed.

Three.js 0.160.1 and PeerJS 1.5.5 are loaded from jsDelivr. MIT notices are included in LICENSE-THREE.txt and LICENSE-PEERJS.txt. Textures and models are generated in code.
PeerJS documentation: https://peerjs.com/client/faq

Source, prediction, session sequencing and mocked pairing checks are run before publishing. Actual phone rendering, public-service pairing and Wi-Fi latency still require device testing.

The current page loads app-v8.js, game-core-v8.js, prediction-v8.js, fire-fx-v8.js, arena-fx-v8.js and mobile-v8.css. Earlier client files are retained for already-open pages; reload both phones before starting a new room.

## Pause timing fix
A regression reproduced an unwanted Ready popup after about 30 seconds when the host had repeated brief rendering hitches: discarded simulation time accumulated unacknowledged guest inputs. The host now retains elapsed time and catches up in bounded batches. Brief visible frame hitches and focus changes do not force a pause; focus loss clears held controls. Hidden tabs, manual pauses, sustained update loss, or a visible freeze longer than two seconds still stop play safely. Stale remote firing stops within a quarter second. The input history tolerates up to two seconds and remains below the transport packet size limit. Regression checks compare the old failure with the fixed clock using the original buffer size, plus multi-minute simulations and pause/resume safeguards.

## Fire magic attack
Hold the right stick, mouse button or Space to gather fire for 0.30 seconds, then cast; keep holding for repeated casts. Releasing early cancels charging. The hand core grows during charge, the projectile streams flames, and confirmed impacts produce a flash, sparks, a white enemy flash and brief flinch. Hits ignite enemies for 1.2 seconds. Normal hits show 3, critical hits show a larger gold 6!, and burning ticks show 1. Enemy health is tuned for the slower, heavier attack.

The guest predicts charging and casting immediately. The host alone chooses critical hits and applies impact damage, burns and score. Numbered input replay also reconstructs charge state; cast IDs prevent duplicate local/confirmed effects. Synthesized charge, whoosh and impact sounds unlock after a tap/key press; the speaker button mutes them. There are no new external art or audio files.

Effects use fixed pools: 384 batched particles, 40 projectile slots, 24 damage-number sprites, 16 impact bursts, and at most 8 audio voices. Core snapshots retain a short bounded impact event history for unreliable updates. Packet-size, burn, critical, prediction, collision, effect-pool and simulated-stutter checks run before publishing; real phone visuals and sound still require a device test.


## Mobile combat and powerful pickups
The camera follows the local player at a closer zoom in portrait and landscape. Larger thumb controls, safe-area padding, readable input fields and a compact HUD support phone play. Players and enemies show temporary overhead health bars after damage; the local HUD also has a persistent health meter. The robot body squashes while charging, stretches on release and returns to rest.

Glowing, labeled pickups begin after three seconds and spawn every six seconds while fewer than three remain. Uncollected pickups expire after 25 seconds. Walk within reach to collect one. All seven types rotate: Twin Fire (two projectiles), Haste (double movement speed), Inferno (double impact damage), Rapid Cast (double charging/cooldown rate), Piercing (projectiles pass through enemies), Blast Wave (area damage on impact), and Aegis (contact-damage immunity). Effects last 18 seconds, combine across types, and collecting the same effect refreshes it. Restart clears all upgrades. The HUD shows each active effect and its remaining duration.

The host owns pickup placement, collection and damage. Guest input prediction includes movement speed, buff expiry, rapid charging and twin-shot feedback. Powered damage numbers match actual damage. Protocol version 7 requires both phones to reload and create a new room. Automated simulation and mocked rendering checks cover upgrades, expiry, prediction, health bars, casting transforms, multiplayer pause/restart, packet bounds and a sustained all-upgrade combat run. Actual mobile visuals, audio and touch ergonomics require testing on phones.


## Overdrive waves, individual scores and permanent builds
Waves now contain exactly three times the previous enemy quota, with a 36-enemy simultaneous cap, half the previous spawn interval and 15% faster enemies. Enemy HP remains 6 + floor(wave / 2). Spawns have a short entrance telegraph.

The scoreboard tracks each player's points, kills and actual damage, including burns and splash. Kill credit goes to the finisher; damage credit records each contribution. Team score is the sum. Clear a wave to freeze the arena and choose one permanent upgrade from ten: Ember Might (damage), Wind Walker (movement), Quick Cast (cast rate), Phoenix Heart (maximum health), Stone Skin (damage reduction), Wild Spark (critical chance), Forked Flame (extra projectiles), Soul Spear (piercing), Sunburst (explosive hits) and Life Siphon (healing on kills). Ranks and caps appear on cards. Both players choose independently; the next wave starts after both choices. Builds persist for the run, combine with temporary pickups and reset on restart.

Mobile polish adds individual score cards, max-health-aware bars, a radar, wave and pickup announcements, a build summary, saved personal bests and center-touch casting. Hit feedback includes white/red material flashes, squash, stagger, rebound, a red edge overlay, damage numbers and bounded camera shake. Reduced-motion settings suppress shake. Spawn markers, pickup glows and shield rings remain pooled.

Input epochs and held controls reset at upgrade phase transitions; heartbeats and snapshots continue while selecting. Pause/resume preserves choices. Outgoing snapshot numbers are compacted while authoritative simulation remains precise. Integration checks cover both choice orders, a 35-second wait, duplicate/stale picks, pause recovery, restart, attribution and packet bounds. A dense snapshot is below 27 KB; repeated simulated host stutters stay bounded for three minutes. Actual phone rendering, sound and touch ergonomics still require a device test. Reload both phones and create a fresh room after updating to protocol 8.


## Enemy variants, friendly knockback and wave transitions
Current waves have twice the v7 quota (6 × min(32, 5 + wave × 3)); enemy HP remains 6 + floor(wave / 2). The simultaneous enemy cap stays 36. Four types mix from wave one: orange Stalkers chase, smaller green Runners move faster, purple Spitters wind up and fire red bolts while maintaining range, and red Chargers visibly wind up before a short dash. Hostile projectiles have a separate 12-shot pool and never consume the player projectile allowance.

Player projectiles can hit the other player, causing a short wall-safe push only. They do not damage, burn, award score, trigger damage numbers or heal the attacker. A separate push event and sequence synchronize guest displacement without input replay erasing it. Self-hits are ignored. Shield immunity still protects against enemy attacks.

Wave progression is explicit: a two-second wave introduction, combat, then a two-second Wave Cleared transition after BOTH the unspawned quota and every living enemy reach zero. Combat projectiles clear at the boundary; pending spawns prevent early completion. Real pauses freeze countdowns. After the clear transition, each player receives three distinct random host-generated permanent upgrade offers, excluding maxed powers. Choices are validated against that player's current offers, and both players must finish before the next numbered wave introduction begins. Restart resets the run to wave one.

All seven temporary buffs and ten permanent powers have generated circular vector icons in buff-icons-v8.js. Active buffs show a duration ring and seconds; permanent icons show rank. Tap an icon for a short effect description. Upgrade cards use the matching icons and concise descriptions. World pickups use the same circular designs. Icons are accessible buttons with 44-pixel touch targets; long builds scroll horizontally.

Verification covers the two-second clear delay, queued-spawn guard, burn final kills, distinct random offers and rejecting unoffered powers, all enemy behaviors, harmless knockback in both directions, guest reconciliation, pause/restart flow, icon UI references and mocked rendering. A dense snapshot including all entity pools stays below 30 KB. A mixed-enemy simulation stays finite and bounded; three minutes of simulated host stutters do not trigger a spurious pause. Real phone rendering and touch feel still need device testing. Both phones must reload and create a fresh room for protocol 8.
