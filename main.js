import { Controls } from './controls.js';
import * as Game from './game.js';
import * as UI from './ui.js';

// --- Global Setup ---
const controls = new Controls();
const isDesktop = !('ontouchstart' in window) && navigator.maxTouchPoints < 1;

// --- Main Execution Logic ---
function main() {
    window.addEventListener('resize', UI.resizeCanvases);
    UI.resizeCanvases();

    if (isDesktop) {
        UI.setupDesktopUI();
        UI.showScreen('start');
        return; // Stop execution for desktop
    }

    // For mobile, start the main game loading process
    Game.preload(controls);
    requestAnimationFrame(gameLoop); // Start the loop immediately to handle replay animation
}

// --- Event Listeners ---
UI.startButton.addEventListener('click', () => {
    if (isDesktop) return;

    Game.createAudioContext();

    controls.requestPermission().then(granted => {
        if (granted) {
            Game.init();
        } else {
            alert('Motion sensor access is required to play this game.');
        }
    }).catch(console.error);
});

UI.restartButton.addEventListener('click', () => {
    Game.init();
});

UI.shareReplayButton.addEventListener('click', () => {
    Game.shareReplay();
});

// A minimal game loop caller, the real logic is in game.js
function gameLoop(timestamp) {
    // This wrapper is needed because requestAnimationFrame is called from the global scope,
    // but the actual gameLoop logic is now inside the Game module.
    // However, since game.js's gameLoop calls requestAnimationFrame on its own,
    // we only need to kick it off once. Let's adjust this.
    // The gameLoop is self-contained in game.js now.
    // This file only needs to start the process.
}

main();