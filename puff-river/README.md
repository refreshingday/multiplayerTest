# Puff River

A bright 3D rafting game for one to four captains. Soft, rounded human stick figures lie face down over a round board, facing its center, with their lower bodies hanging into the water. Outward farts push the shared raft inward. Built with HTML, JavaScript and Three.js; no build step.

## Solo or a crew

- **Let’s float** starts the original solo voyage. The whole circle is yours. The practice selector previews smaller territories with one active captain.
- **Host a raft** reserves a six-digit room. Share the code or invite link with up to three friends.
- Friends choose **Join a raft** or open the invite link. Everyone taps **Ready to float**.
- Each actual crew gets equal territories: 360°, 180°, 120°, or 90°. Captains cannot cross into another seat’s territory.
- Drag the joystick toward your part of the edge. Hold the round puff button (or Space) to fart outward. A/D or Left/Right also move around the edge.
- Each captain has independent puff power. Release to regenerate. Collected beans restore 30 power to every active captain.
- All captains share the raft, its three hearts, beans and the 800 m finish. Rocks, logs, whirlpools, banks and marked rapids remain active.

Open the same game URL on each phone, on the **same Wi-Fi**. Pairing uses the free public PeerJS signaling service and requires internet access; gameplay uses direct WebRTC data channels. As in Neon Outpost, this version has no STUN or TURN relay, so guest Wi-Fi/client isolation or separate mobile networks can prevent a connection. Three.js and PeerJS are vendored with MIT notices.

## Pause and reconnection

P/Escape or the top pause/crew button pauses the shared voyage. Switching tabs also pauses safely; returning players tap Ready together. Restart requires every active captain’s vote.

Brief connection interruptions reserve the original seat for up to two minutes. The host preserves position, fuel, progress, hearts, pickups and tilt. Returning guests authenticate using the private resume token from initial pairing, receive a fresh authoritative state and acknowledge synchronization before automatic recovery. Manual pauses remain paused. If recovery expires, remaining captains can Ready to continue; the original territories stay in place until a new voyage. Keep all game tabs open. Closing the host ends the room; host migration and restoring closed/reloaded tabs are not supported.

Room codes use a Puff River-specific namespace, separate from Neon Outpost. The connection layer is adapted from its four-player room and peer modules. The host simulates the boat and collisions at 60 Hz. Guests immediately predict their own captain, replay unacknowledged movement ticks after host snapshots, and smooth shared boat/remote captain motion. Reliable actions and unreliable redundant input/snapshot channels have bounded queues and stale-input checks.

## Run and verify

`npm start` serves this directory on http://localhost:5173. Requires a WebGL-capable browser. `npm test` runs gameplay, multiplayer, pairing/reconnection and real Three.js scene checks with mocked GPU/browser/transport boundaries.

The tests cover equal territories, recoil, tilt, deterministic bends, accurate visible shoreline contact, four independent clients, input loss/reordering, prediction, Ready/pause/restart consensus, shared collision and pickup authority, seat reuse, fifth-player rejection, simultaneous reconnects, invalid reconnect credentials, bounded packets, and the four characters’ poses and centered camera. Real four-phone Wi-Fi pairing, GPU rendering, audio and touch feel still require device testing.

## Presentation

The game fills the viewport and keeps the raft centered through frequent broad river bends. All HUD and crew information stays at the top. Only the joystick and circular fart button appear at the bottom. The face-down pose, submerged legs, outward gas jets, safe shoreline geometry and damped board roll are preserved from the solo game.

Play: https://refreshingday.github.io/multiplayerTest/puff-river/
