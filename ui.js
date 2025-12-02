import QRCode from 'qrcode';

export const canvas = document.getElementById('game-canvas');
export const replayCanvas = document.getElementById('replay-canvas');
export const replayCtx = replayCanvas.getContext('2d');

export const loadingScreen = document.getElementById('loading-screen');
export const loadingStatus = document.getElementById('loading-status');
export const startScreen = document.getElementById('start-screen');
export const gameOverScreen = document.getElementById('game-over-screen');
export const startButton = document.getElementById('start-button');
export const restartButton = document.getElementById('restart-button');
export const shareReplayButton = document.getElementById('share-replay-button');
export const scoreDisplay = document.getElementById('score-display');
export const scoreEl = document.getElementById('score');
export const finalScoreEl = document.getElementById('final-score');
export const highScoreEl = document.getElementById('high-score');

export function setupDesktopUI() {
    document.body.classList.add('is-desktop');
    const qrCanvas = document.getElementById('qr-code');
    if (qrCanvas) {
         QRCode.toCanvas(qrCanvas, 'https://bouncer.on.websim.com', { width: 180, margin: 1 }, function (error) {
            if (error) console.error(error);
            console.log('QR code generated!');
        });
    }
}

export function updateLoadingStatus(text) {
    loadingStatus.textContent = text;
}

export function resizeCanvases() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const replayRect = replayCanvas.getBoundingClientRect();
    replayCanvas.width = replayRect.width * window.devicePixelRatio;
    replayCanvas.height = replayRect.height * window.devicePixelRatio;
}

export function showScreen(state, score = 0, replay) {
    loadingScreen.classList.add('hidden');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreDisplay.classList.add('hidden');

    // Reset share button state
    shareReplayButton.disabled = false;
    shareReplayButton.textContent = "Share Replay";

    if (state === 'loading') {
        loadingScreen.classList.remove('hidden');
    } else if (state === 'start') {
        startScreen.classList.remove('hidden');
    } else if (state === 'game') {
        scoreDisplay.classList.remove('hidden');
    } else if (state === 'over') {
        finalScoreEl.textContent = score;
        let highScore = parseInt(localStorage.getItem('gyroBouncerHighScore')) || 0;
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('gyroBouncerHighScore', highScore);
        }
        highScoreEl.textContent = highScore;
        gameOverScreen.classList.remove('hidden');
        resizeCanvases(); // Ensure replay canvas is sized correctly when shown
        if (replay) {
            replay.startPlayback();
        }
    }
}

export function updateScore(score) {
    scoreEl.textContent = score;
}