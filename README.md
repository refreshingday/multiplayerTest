# Neon Outpost

Free 3D top-down cooperative robot arena for up to four phones on the same Wi-Fi.

Play: https://refreshingday.github.io/multiplayerTest/

## Joining
- Host taps **Host a game**, then shares the six-digit room code or the room link.
- Friend taps **Join a friend** and enters the six digits. A room link joins automatically.
- Everyone taps **Ready**.

Room matching uses the free public PeerJS Cloud signaling service; internet access is needed while joining. It automatically exchanges connection information. Gameplay then uses the existing direct WebRTC connection with reliable controls and a separate unordered channel for updates. Pairing data channels close after a direct gameplay link opens; the small PeerJS cloud connection remains available in the background so returning players can reconnect automatically. No STUN or TURN is used; Wi-Fi must allow direct device communication. Public matching service availability is outside this project's control.

**Manual pairing** remains available in the menu if matching is unavailable. It exchanges the full invite and reply without a signaling service.

## Responsive gameplay
The guest predicts its own movement at 60 simulation ticks per second using the same speed, arena bounds and crate collisions as the host. Input ticks are numbered and resent until the host acknowledges processing them. Each authoritative snapshot corrects the guest position, then the guest replays only unacknowledged ticks; small visual corrections fade smoothly. Other players and enemies render smoothly between snapshots, and bullets advance locally between updates. A local muzzle flash responds immediately to firing; damage, bullet hits, health, waves, and scores remain host-authoritative.

Choose Fire, Electric, Ice or Grass before playing. Controls: the right stick moves; aiming, charging, and firing are automatic. Desktop: WASD or arrows to move. Each player targets the closest living enemy with a clear projectile path, within fireball range. Spawning enemies are ignored. No target means no cast. Solo mode is available.

Play pauses on hidden tabs, stale input, stale snapshots, or interrupted connections. Both players must choose Ready to resume. A restart requires both votes.

## Hosting
GitHub Pages: Settings → Pages → Deploy from a branch → main → /(root) → Save.
No build step is needed.

Three.js 0.160.1 and PeerJS 1.5.5 are loaded from jsDelivr. MIT notices are included in LICENSE-THREE.txt and LICENSE-PEERJS.txt. Textures and models are generated in code.
PeerJS documentation: https://peerjs.com/client/faq

Source, prediction, session sequencing and mocked pairing checks are run before publishing. Actual phone rendering, public-service pairing and Wi-Fi latency still require device testing.

The current page loads app-v18.js, room-v17.js, peer-v17.js, game-core-v17.js, prediction-v17.js, fire-fx-v18.js, arena-fx-v17.js, wizard-models-v17.js, enemy-models-v12.js, wave-map-v11.js, buff-icons-v14.js and mobile-v18.css. Reload every phone and start a new room after updating.

## Pause timing fix
A regression reproduced an unwanted Ready popup after about 30 seconds when the host had repeated brief rendering hitches: discarded simulation time accumulated unacknowledged guest inputs. The host now retains elapsed time and catches up in bounded batches. Brief visible frame hitches and focus changes do not force a pause; focus loss clears held controls. Hidden tabs, manual pauses, sustained update loss, or a visible freeze longer than two seconds still stop play safely. Stale remote firing stops within a quarter second. The input history tolerates up to two seconds and remains below the transport packet size limit. Regression checks compare the old failure with the fixed clock using the original buffer size, plus multi-minute simulations and pause/resume safeguards.

## Fire magic attack
Hold the right stick, mouse button or Space to gather fire for 0.30 seconds, then cast; keep holding for repeated casts. Releasing early cancels charging. The hand core grows during charge, the projectile streams flames, and confirmed impacts produce a flash, sparks, a white enemy flash and brief flinch. Fire hits deal 3 damage, or 6 on a critical hit, with no burn or damage over time. Enemy health is tuned for the slower, heavier attack.

The guest predicts charging and casting immediately. The host alone chooses critical hits and applies impact damage, poison and score. Numbered input replay also reconstructs charge state; cast IDs prevent duplicate local/confirmed effects. Synthesized charge, whoosh and impact sounds unlock after a tap/key press; the speaker button mutes them. There are no new external art or audio files.

Effects use fixed pools: 384 batched particles, 56 projectile slots and 4 charging slots, 24 damage-number sprites, 16 impact bursts, and at most 8 audio voices. Core snapshots retain a short bounded impact event history for unreliable updates. Packet-size, poison, critical, prediction, collision, effect-pool and simulated-stutter checks run before publishing; real phone visuals and sound still require a device test.


## Mobile combat and powerful pickups
The camera follows the local player at a closer zoom in portrait and landscape. Larger thumb controls, safe-area padding, readable input fields and a compact HUD support phone play. Players and enemies show temporary overhead health bars after damage; the local HUD also has a persistent health meter. The robot body squashes while charging, stretches on release and returns to rest.

Glowing, labeled pickups begin after three seconds and spawn every six seconds while fewer than three remain. Uncollected pickups expire after 25 seconds. Walk within reach to collect one. All seven types rotate: Twin Fire (two projectiles), Haste (double movement speed), Inferno (double impact damage), Rapid Cast (double charging/cooldown rate), Piercing (projectiles pass through enemies), Blast Wave (area damage on impact), and Aegis (contact-damage immunity). Effects last 18 seconds, combine across types, and collecting the same effect refreshes it. Restart clears all upgrades. The HUD shows each active effect and its remaining duration.

The host owns pickup placement, collection and damage. Guest input prediction includes movement speed, buff expiry, rapid charging and twin-shot feedback. Powered damage numbers match actual damage. Protocol version 7 requires both phones to reload and create a new room. Automated simulation and mocked rendering checks cover upgrades, expiry, prediction, health bars, casting transforms, multiplayer pause/restart, packet bounds and a sustained all-upgrade combat run. Actual mobile visuals, audio and touch ergonomics require testing on phones.


## Overdrive waves, individual scores and permanent builds
Waves now contain exactly three times the previous enemy quota, with a 36-enemy simultaneous cap, half the previous spawn interval and 15% faster enemies. Enemy HP remains 6 + floor(wave / 2). Spawns have a short entrance telegraph.

The scoreboard tracks each player's points, kills and actual damage, including poison and splash. Kill credit goes to the finisher; damage credit records each contribution. Team score is the sum. Clear a wave to freeze the arena and choose one permanent upgrade from ten: Ember Might (damage), Wind Walker (movement), Quick Cast (cast rate), Phoenix Heart (maximum health), Stone Skin (damage reduction), Wild Spark (critical chance), Forked Flame (extra projectiles), Soul Spear (piercing), Sunburst (explosive hits) and Life Siphon (healing on kills). Ranks and caps appear on cards. Both players choose independently; the next wave starts after both choices. Builds persist for the run, combine with temporary pickups and reset on restart.

Mobile polish adds individual score cards, max-health-aware bars, a radar, wave and pickup announcements, a build summary, saved personal bests and center-touch casting. Hit feedback includes white/red material flashes, squash, stagger, rebound, a red edge overlay, damage numbers and bounded camera shake. Reduced-motion settings suppress shake. Spawn markers, pickup glows and shield rings remain pooled.

Input epochs and held controls reset at upgrade phase transitions; heartbeats and snapshots continue while selecting. Pause/resume preserves choices. Outgoing snapshot numbers are compacted while authoritative simulation remains precise. Integration checks cover both choice orders, a 35-second wait, duplicate/stale picks, pause recovery, restart, attribution and packet bounds. A dense snapshot is below 27 KB; repeated simulated host stutters stay bounded for three minutes. Actual phone rendering, sound and touch ergonomics still require a device test. Reload both phones and create a fresh room after updating to protocol 9.


## Enemy variants, friendly knockback and wave transitions
Current waves have twice the v7 quota (6 × min(32, 5 + wave × 3)); enemy HP remains 6 + floor(wave / 2). The simultaneous enemy cap stays 36. Four types mix from wave one: orange Stalkers chase, smaller green Runners move faster, purple Spitters wind up and fire red bolts while maintaining range, and red Chargers visibly wind up before a short dash. Hostile projectiles have a separate 12-shot pool and never consume the player projectile allowance.

Player projectiles can hit the other player, causing a short wall-safe push only. They do not damage, apply status effects, award score, trigger damage numbers or heal the attacker. A separate push event and sequence synchronize guest displacement without input replay erasing it. Self-hits are ignored. Shield immunity still protects against enemy attacks.

Wave progression is explicit: a two-second wave introduction, combat, then a two-second Wave Cleared transition after BOTH the unspawned quota and every living enemy reach zero. Combat projectiles clear at the boundary; pending spawns prevent early completion. Real pauses freeze countdowns. After the clear transition, each player receives three distinct random host-generated permanent upgrade offers, excluding maxed powers. Choices are validated against that player's current offers, and both players must finish before the next numbered wave introduction begins. Restart resets the run to wave one.

All seven temporary buffs and ten permanent powers have generated circular vector icons in buff-icons-v8.js. Active buffs show a duration ring and seconds; permanent icons show rank. Tap an icon for a short effect description. Upgrade cards use the matching icons and concise descriptions. World pickups use the same circular designs. Icons are accessible buttons with 44-pixel touch targets; long builds scroll horizontally.

Verification covers the two-second clear delay, queued-spawn guard, poison final kills, distinct random offers and rejecting unoffered powers, all enemy behaviors, harmless knockback in both directions, guest reconciliation, pause/restart flow, icon UI references and mocked rendering. A dense snapshot including all entity pools stays below 30 KB. A mixed-enemy simulation stays finite and bounded; three minutes of simulated host stutters do not trigger a spurious pause. Real phone rendering and touch feel still need device testing. Both phones must reload and create a fresh room for protocol 9.


## Four-player squads and progressive enemy unlocks
Six-digit rooms now support a host plus up to three guests. The host lobby shows the shared code and connected count. Have everyone join before tapping Ready; the room locks when all currently connected players are ready. Each guest has an independent direct WebRTC connection to the host, input history, acknowledgements and player identity. There is no guest-to-guest networking or additional gameplay server. The host keeps its free matching connection available throughout the session for authenticated reconnection; starting the round locks out new players while preserving returning player seats. Manual invite/reply pairing remains a two-player fallback; solo play is unchanged.

Cyan, Violet, Gold and Rose have distinct actors, score cards, charging effects, shields and health bars. Readiness, visibility pauses, restart voting and three-offer permanent upgrades include every active member. Leaving pauses the room and removes that seat; remaining players can Ready to continue, including nonconsecutive seats. A disconnected upgrade voter cannot block the next wave. The host leaving ends the room. Mid-round joining is closed; form a fresh room to add players after starting. Player projectile capacity is shared fairly across active casters without increasing transport or effect limits.

Enemy types unlock progressively: wave 1 only Stalkers, wave 2 introduces Runners, wave 3 Spitters and wave 4 Chargers. The first spawn in each early wave guarantees the newly introduced type. Later waves mix all four. Enemy HP, current wave quotas, two-second completion transitions, friendly knockback and temporary/permanent buff rules remain as in v8.

Tests cover four independent app clients, three direct links, targeted snapshots and sender identity, fifth-player rejection, lobby seat reuse, signaling cleanup without losing gameplay, four-player movement/casting, consensus Ready/restart/upgrade flow, hidden-tab recovery, disconnect handling, enemy unlock gates, shared projectile quotas, four-player effect pools and dense packet bounds. A dense four-player snapshot remains below 31 KB; three minutes of simulated host stutters remain bounded. Solo and manual two-player flows also pass. These are simulations and mocked rendering/connection tests; actual four-phone Wi-Fi and rendering still require device testing. Reload every phone and create a fresh room for protocol 9.

## Automatic combat
The host and every guest use the same target selection after moving. Guests predict charge and cast effects locally without waiting for a snapshot; the host remains authoritative for projectiles, hits, and damage. Targeting skips blocked enemies and retargets as enemies move or die. Releasing the right stick stops movement while automatic attacks continue. Restart a room after reloading every phone when updating from an older client.


## Double enemy pressure and changing arenas
Wave totals are doubled (wave 1: 96, wave 2: 132), enemy spawn intervals are halved, and the active enemy cap increases from 36 to 72. Enemy health and progressive type unlocks stay unchanged. Health bars and spawn telegraphs cover all 72 enemy slots; projectile and particle pools remain bounded.

The host generates a fresh arrangement of four crates and two short walls at the beginning of each wave. The starting plaza stays clear; layouts avoid current players and pickups, reserve space along the arena edge for enemy spawns, and keep wide corridors between obstacles. Coordinates and dimensions are quantized before sharing, so every phone uses identical geometry. Movement prediction, target line of sight, both projectile types, knockback, radar and rendered objects all use this shared layout.

Six procedural visual themes change floor patterns, crate and wall textures, lighting accents and background colors. Consecutive waves always use different themes. Existing meshes are reused and theme materials/textures are cached. The two-second wave introduction shows the new arena theme before combat starts.

Automatic targeting considers living, fully spawned enemies only. It does not target players and does not add teammate avoidance; incidental friendly hits still cause knockback without damage.

Checks cover generated-layout safety and path connectivity, dynamic wall collisions in authority and prediction, enemy-only targeting, all three guest clients receiving identical layouts and themes, wave transitions, doubled enemy limits, and bounded visual resources. These are simulation and mocked graphics checks; actual phone performance still needs device testing. Reload every phone and start a fresh room for this version.

## Distinct enemy creatures
Players retain the original robot model. Enemies now use separate low-poly creature models: spiked beetle Stalkers, winged Runners, floating tentacled Spitters, and armored horned Chargers. Their silhouettes, accents and movement details distinguish them at the mobile camera scale. Creature actors use shared geometry and materials with a fixed 72-actor pool; changing enemy types reuses part meshes. Hit flashes and squash reactions restore the correct creature colors, and reduced-motion settings disable extra creature movement.

Model and mocked render checks cover all four silhouettes, hit-flash recovery, changing enemy types, four player robots alongside 72 creatures, guest rendering, hidden actors after wave clear, and bounded geometry/material/mesh allocation. Actual phone rendering still requires device testing. This visual update uses the existing gameplay protocol.

## Enemy-count tuning
Enemy totals per wave are reduced by 20% from the previous release, rounded to whole enemies: wave 1 has 77 (previously 96), wave 2 has 106 (previously 132), and the capped wave total is 307 (previously 384). This affects initial games, restarts and subsequent waves. Other enemy attributes and wave progression use the existing rules.


## Four elemental wizards, faster pickups and wider camera
Choose a wizard on the menu or in the lobby before Ready. Choices are remembered locally, synchronized by the host, locked for the run, and retained across restarts. Multiple players may choose the same wizard; seat-color rings and scoreboard labels identify teammates.

- Fire deals 3 impact damage (6 on a critical hit), without burn.
- Electric chains half the direct-hit damage to up to two nearby enemies within 3 units, respecting walls.
- Ice slows enemy movement, including dashes, by 45% for 2 seconds and pierces one enemy by default, allowing each projectile to hit two enemies. Permanent piercing upgrades add to this class bonus; the temporary Piercing pickup retains its full-arena piercing allowance.
- Grass deals 2 impact damage (4 on a critical hit) and applies poison for 3 seconds, crediting its caster. Six half-second ticks ramp through 1, 1, 2, 2, 3, 3 damage. Damage upgrades scale impact and poison; critical hits only increase impact. Repeated hits refresh the duration without resetting the ramp or postponing the next tick.

Every class has a colored wizard outfit, charge effect, projectile and trail. Electric hits draw brief chain arcs; slowed and poisoned enemies have status colors and particles. Projectile collisions, damage, status effects and scores remain host-authoritative; guests predict elemental charging and casts immediately.

Temporary pickups now first appear after 1.5 seconds and then every 3 seconds of combat (previously 3 and 6). Collected effects last 9 combat seconds instead of 18, with a six-pickup ground limit so extra spawns are not blocked by the old three-pickup cap. Timers freeze outside combat. Ground lifetime remains 25 seconds. Buff countdown rings and banners use the new duration. Shields display an expanding activation pulse, a persistent cyan wireframe bubble and floor ring, and fade/blink near expiry. Shield visuals disappear when protection ends.

The gameplay camera displays 30% more world width and height in both portrait and landscape. Controls remain movement-only with automatic enemy targeting.

Verification includes elemental damage/status rules, caster score credit, buff timing/capacity/expiry, four independent clients selecting and changing classes, Ready acknowledgment gating, class persistence, local guest spell prediction, wizard and shield visual pools, lightning reset, and camera bounds. These are simulations and mocked visual checks; actual phone performance and appearance still need device testing. Protocol 14 requires all phones to reload and start a fresh room.

Lobby selections are resent if another player joining changes the session epoch, so an in-flight character choice cannot leave Ready disabled.


## Automatic reconnection for six-digit rooms
Brief direct-link interruptions no longer remove the player or reset the game. The host pauses the arena when the dropout is detected and reserves the original seat for up to two minutes. The returning guest retries automatically with bounded backoff, rebuilds its direct link, and authenticates with a private random resume credential delivered during initial pairing. New players cannot take reserved seats or join a running round using only the room code.

The host retains player identity, wizard, position, health, score, kills, damage, permanent upgrades, temporary buff timers, enemies, wave progress and any pending upgrade offers. A fresh synchronization barrier clears stale movement history; the host waits for every active guest to acknowledge the authoritative snapshot before automatically resuming a game that was running. Manually paused games stay paused. A manual pause during recovery cancels automatic resume. Each guest recovers independently, and the squad waits until all active members have synced. Late messages from replaced links are ignored.

A small signaling connection now stays available throughout room play and reconnects in the background if it drops. Gameplay remains direct WebRTC; no gameplay server or relay is added. Same-Wi-Fi support remains the current reliable connection mode; this does not add STUN/TURN support for mobile-data networks. Signaling internet access is needed to rebuild a failed direct connection. Keep the host and guest game tabs open. Closing/reloading the host ends the session; automatic recovery does not migrate the host or restore a closed tab. Manual invite/reply mode retains its existing behavior and needs fresh codes if its direct connection fully closes.

Explicitly leaving removes a connected guest immediately. Ending the host room notifies connected guests. If recovery cannot succeed within two minutes, the reserved seat is released and the remaining group can Ready to continue. Guests see a reconnecting screen while the arena is paused.

Verification covers initial four-player pairing, authenticated seat recovery, simultaneous guest dropouts, stale-link rejection, invalid credentials, locked-room admission, signaling reconnection and recreation, retry backoff, timeouts, explicit leave/end, preserved gameplay and upgrade state, prediction acknowledgments, and manual-pause behavior. These are mocked transport and gameplay simulations; real phone Wi-Fi switching and browser suspension still need device testing. Reload all phones and create a fresh room for protocol 15.

Recovery snapshots support bounded messages up to 64 KiB, including dense 72-enemy arenas with elemental status effects; channel backpressure and inbound size limits remain enforced.


## Elemental combat update (protocol 16)
Fire now deals impact damage only. Poison has a 2-damage base impact and grows more painful over time, as detailed above. Electric projectiles are extruded jagged lightning bolts with flickering branches; ice uses a crystal spear with trailing fins; poison uses a pulsing glob with orbiting bubbles and separate droplet tails. Charging, trails, impacts, and predicted guest casts use the corresponding elemental forms and particle shapes. Shared effect pools reuse geometry and materials.

Run `npm ci` and `npm test` for the 28 Node checks. These cover damage and poison timing, refresh and expiry, upgrade scaling and attribution, ice and lightning behavior, friendly knockback, four-player prediction, dense snapshots, wave progression, actual Three.js geometry and effect-pool reuse, and version-17 wiring. Rendering checks use Three.js without a GPU; phone appearance, shader compilation, sound, touch, and real four-device networking still require device testing.

Reload every phone and create a fresh room. Protocol 16 rooms are isolated from older versions; two-minute automatic reconnection remains available.


## Ice piercing (protocol 17)
Ice projectiles pierce one enemy by default and stop on their second enemy hit. Both hits retain full impact damage and the existing slow. Piercing upgrades stack with the class bonus. Regression checks cover actual casts hitting two targets without hitting a third, other classes retaining their existing impact limit, and stacking with permanent and temporary upgrades. Reload every phone and start a fresh protocol-17 room.


## Clearer combat view (current: UI 18, protocol 17)
Temporary and permanent buff circles are reduced from 44 to 32 pixels. Upgrades stay in a compact group at the upper left; the player leaderboard is a single column at the upper right in portrait and landscape. Wave and pickup announcements sit higher, with a separate landscape placement, and floating damage numbers begin above wizard hats. The gameplay camera shows 20% more world width and height than the previous view; the menu camera is unchanged. UI 18 remains compatible with protocol-17 rooms. Reload each phone to load the updated presentation.
