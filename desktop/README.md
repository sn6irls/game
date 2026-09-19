# Desktop Games / 바탕화면 꾸미기

Open index.html to play. For web hosting, upload this folder with its directory structure intact. Opening index.html directly without a server is also supported.

- assets/: runtime images and image credits.
- css/: desktop and minigame styles.
- js/: game logic, effects, audio, local renderer and offline image bundle.
- ART-CREDITS.md and LICENSE-THREE.txt: attribution and license information.

Choose English or Korean through Start → Settings. The browser title follows the language.
Captures are JPEG files named image_1.jpg, image_2.jpg, etc. The gallery holds the latest 12 captures with small preview thumbnails. Notes are temporary and have no file-export button.

Hammer damage persists until restart. At 60% revealed screen area, a brief blue screen resets the desktop without the boot sequence. Jelly is limited to seven bodies. Animated glitter is limited to 600 sparkles; painted marks remain visible.

XP audio is embedded in js/xp-sounds.js. Tool effects are generated and cached with Web Audio in js/game.js. Browsers may require the first user interaction before allowing audio playback.

Release archive: Desktop-Games.zip. Extract the archive, then upload its contents to your static web host. index.html must be at the hosting root. No build command, server runtime, or installation is required.

The release includes runtime files and licenses only. Original artwork and development checks are kept outside this archive.
