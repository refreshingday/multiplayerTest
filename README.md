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

The current page loads app-v4.js and prediction-v4.js. Earlier client files are retained for already-open pages; reload both phones before starting a new room.

## Pause timing fix
A regression reproduced an unwanted Ready popup after about 30 seconds when the host had repeated brief rendering hitches: discarded simulation time accumulated unacknowledged guest inputs. The host now retains elapsed time and catches up in bounded batches. Brief visible frame hitches and focus changes do not force a pause; focus loss clears held controls. Hidden tabs, manual pauses, sustained update loss, or a visible freeze longer than two seconds still stop play safely. Stale remote firing stops within a quarter second. The input history tolerates up to two seconds and remains below the transport packet size limit. Regression checks compare the old failure with the fixed clock using the original buffer size, plus multi-minute simulations and pause/resume safeguards.
