import Matter from 'https://esm.sh/matter-js';
import { Player } from './player.js';
import { PlatformManager } from './platforms.js';
import { Replay } from './replay.js';
import { Camera } from './camera.js';
import * as UI from './ui.js';
import * as Loader from './loader.js';

// Game constants
const restitution = 3.0;
const SAFE_ZONE_SCORE = 50;

// Game state variables
let engine, world;
let player, platformManager, replay, camera;
let ground, groundImg, platformImg, userAvatarImg;
let platformImages;
let inSafeZone = true;
let score = 0;
let gameState = 'loading';
let lastTime = 0;
let controls;
let audioCtx;
let bounceSoundBuffer;
let recorder;
let recordedChunks = [];
let recordedBlob = null;

export async function preload(gameControls) {
    controls = gameControls;
    UI.showScreen('loading');
    const { userAvatarImg: loadedAvatar, avatarLoadFailed } = await Loader.loadAvatar(UI.updateLoadingStatus);
    
    if (avatarLoadFailed) {
        gameState = 'error';
        return;
    }
    userAvatarImg = loadedAvatar;

    const { platformImg: pImg, groundImg: gImg, platformCracked1Img, platformCracked2Img, spikyPlatformImg, spikesImg } = await Loader.loadGameImages(UI.updateLoadingStatus);
    platformImg = pImg;
    groundImg = gImg;
    platformImages = {
        normal: pImg,
        cracked1: platformCracked1Img,
        cracked2: platformCracked2Img,
        spiky: spikyPlatformImg,
        spikes: spikesImg
    };
    
    UI.showScreen('start');
    gameState = 'start';
}

function playSound(buffer) {
    if (!audioCtx || !buffer) return;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
}

function startRecording() {
    recordedChunks = [];
    recordedBlob = null;
    if (typeof MediaRecorder === 'undefined' || !UI.canvas.captureStream) return;
    
    try {
        const stream = UI.canvas.captureStream(30);
        let mimeType = 'video/webm';
        if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
            mimeType = 'video/webm;codecs=vp9';
        }
        
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) recordedChunks.push(e.data);
        };
        recorder.onstop = () => {
             const finalMimeType = recorder.mimeType || mimeType;
             recordedBlob = new Blob(recordedChunks, { type: finalMimeType });
        };
        recorder.start();
    } catch(e) {
        console.warn("Failed to start recording", e);
    }
}

function stopRecording() {
    if (recorder && recorder.state === 'recording') {
        recorder.stop();
    }
}

function setupPhysics() {
    engine = Matter.Engine.create();
    world = engine.world;
    world.gravity.y = 1.2;
    world.gravity.x = 0;

    Matter.Events.on(engine, 'beforeUpdate', () => {
        if (!player || !platformManager) return;
        const playerBody = player.body;
        const playerBottom = playerBody.position.y + player.radius;

        platformManager.platforms.forEach(platform => {
            const platformTop = platform.body.position.y - platform.height / 2;
            if (playerBody.velocity.y > 0 && playerBottom < platformTop + 5) {
                platform.body.isSensor = false;
            } else if (playerBody.velocity.y <= 0) {
                platform.body.isSensor = true;
            }
        });

        if (ground) {
             const playerBottom = player.body.position.y + player.radius;
             const groundTop = ground.position.y - 30; // ground height is 60
             if (player.body.velocity.y >= 0 && playerBottom < groundTop + 10) {
                 ground.isSensor = false;
             } else {
                 ground.isSensor = true;
             }
        }
    });

    Matter.Events.on(engine, 'collisionStart', (event) => {
        for (const pair of event.pairs) {
            const isPlayerPlatform = (pair.bodyA.label === 'player' && pair.bodyB.label === 'platform') || (pair.bodyB.label === 'player' && pair.bodyA.label === 'platform');
            if (isPlayerPlatform) {
                const playerBody = pair.bodyA.label === 'player' ? pair.bodyA : pair.bodyB;
                const platformBody = pair.bodyA.label === 'platform' ? pair.bodyA : pair.bodyB;
                
                if (playerBody.velocity.y > 1) {
                    playSound(bounceSoundBuffer);
                    if (platformBody.parentObject) {
                        // Prevent breaking spiky platforms
                        if (!platformBody.parentObject.isSpiky) {
                            platformBody.parentObject.onHit(score);
                        }
                    }
                }
            }
        }
    });
}

export async function init() {
    if (gameState === 'error' || !userAvatarImg) {
        alert("Cannot start the game due to a loading error. Please refresh the page.");
        return;
    }

    lastTime = 0;
    setupPhysics();

    inSafeZone = true;
    const groundHeight = 60;
    ground = Matter.Bodies.rectangle(UI.canvas.width / 2, UI.canvas.height - groundHeight / 2, UI.canvas.width, groundHeight, { isStatic: true, label: 'ground', friction: 0.5 });
    Matter.World.add(world, ground);

    player = new Player(UI.canvas.width / 2, UI.canvas.height - 100, userAvatarImg, world, { restitution });
    platformManager = new PlatformManager(UI.canvas.width, UI.canvas.height, platformImages, world, { restitution });
    platformManager.generateInitialPlatforms();
    replay = new Replay();
    camera = new Camera(UI.canvas.height);

    if (audioCtx && !bounceSoundBuffer) {
        bounceSoundBuffer = await Loader.loadSound(audioCtx, 'boing.mp3');
    }
    
    score = 0;
    UI.updateScore(0);
    
    startRecording();

    UI.showScreen('game');
    if (gameState !== 'playing') {
        gameState = 'playing';
        requestAnimationFrame(gameLoop);
    }
}

export async function shareReplay() {
    if (!recordedBlob) {
        if (!recorder) {
             alert("Video recording is not supported on this device.");
             return;
        }
        
        // Ensure recording is stopped
        if (recorder.state === 'recording') {
             recorder.stop();
             // Brief wait for onstop
             await new Promise(r => setTimeout(r, 200));
        }

        if (!recordedBlob) {
             // Try waiting a bit more
             for(let i=0; i<5; i++) {
                if(recordedBlob) break;
                await new Promise(r => setTimeout(r, 200));
             }
             if(!recordedBlob) {
                alert("Recording not ready yet. Please try again.");
                return;
             }
        }
    }

    const originalText = UI.shareReplayButton.textContent;
    UI.shareReplayButton.disabled = true;
    UI.shareReplayButton.textContent = "Uploading...";

    try {
        const fileExtension = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([recordedBlob], `replay.${fileExtension}`, { type: recordedBlob.type });

        const url = await window.websim.upload(file);
        
        await window.websim.postComment({
            content: `Check out my replay! Score: ${score}`,
            images: [url]
        });
        
        UI.shareReplayButton.textContent = "Shared!";
        setTimeout(() => {
             UI.shareReplayButton.disabled = false;
             UI.shareReplayButton.textContent = originalText;
        }, 2000);
    } catch (error) {
        console.error("Error sharing replay:", error);
        UI.shareReplayButton.textContent = "Error";
        UI.shareReplayButton.disabled = false;
    }
}

function update(deltaTime) {
    player.update(controls.getTilt(), UI.canvas.width, deltaTime);

    // Gravity inversion logic
    if (ground) {
        const groundTopY = ground.position.y - 30; // ground is 60px high
        if (player.body.position.y > groundTopY) {
            world.gravity.y = -1.2;
        } else {
            world.gravity.y = 1.2;
        }
    } else {
        // When ground is removed, ensure gravity is normal
        world.gravity.y = 1.2;
    }

    Matter.Engine.update(engine, deltaTime * 1000);

    // Spike collision check
    for (const p of platformManager.platforms) {
        if (p.isSpiky && p.spikesOut) {
            const playerBounds = player.body.bounds;
            const platformBody = p.body;
            const spikeHeight = p.width * (platformImages.spikes.naturalHeight / platformImages.spikes.naturalWidth);
            
            const spikeBounds = {
                min: { x: platformBody.position.x - p.width / 2, y: platformBody.position.y - p.height / 2 - spikeHeight },
                max: { x: platformBody.position.x + p.width / 2, y: platformBody.position.y - p.height / 2 }
            };

            if (playerBounds.max.x > spikeBounds.min.x &&
                playerBounds.min.x < spikeBounds.max.x &&
                playerBounds.max.y > spikeBounds.min.y &&
                playerBounds.min.y < spikeBounds.max.y) {
                    gameState = 'gameOver';
                    stopRecording();
                    UI.showScreen('over', score, replay);
                    return; // Exit update loop early
            }
        }
    }

    camera.update(player, inSafeZone);
    const cameraY = camera.getY();

    score = Math.max(score, Math.floor(-cameraY / 10));
    UI.updateScore(score);

    if (inSafeZone && score >= SAFE_ZONE_SCORE) {
        inSafeZone = false;
        if (ground) {
            Matter.World.remove(world, ground);
            ground = null;
        }
    }

    platformManager.update(cameraY, player.body.position.y, score);
    
    if (!inSafeZone && player.body.position.y > cameraY + UI.canvas.height + player.height) {
        gameState = 'gameOver';
        stopRecording();
        UI.showScreen('over', score, replay);
    }
}

function draw() {
    const ctx = UI.canvas.getContext('2d');
    const cameraY = camera.getY();
    ctx.clearRect(0, 0, UI.canvas.width, UI.canvas.height);
    ctx.save();
    ctx.translate(0, -cameraY);

    platformManager.draw(ctx);
    
    if (ground && groundImg.complete) {
        const pos = ground.position;
        const width = UI.canvas.width;
        const height = 60;
        ctx.drawImage(groundImg, pos.x - width / 2, pos.y - height / 2, width, height);
    }

    player.draw(ctx);
    ctx.restore();
}

function drawReplay(deltaTime) {
    const frame = replay.getPlaybackFrame(deltaTime);
    if (!frame) return;

    // Fill background explicitly so it appears in the recorded video
    UI.replayCtx.fillStyle = '#3d5a80';
    UI.replayCtx.fillRect(0, 0, UI.replayCanvas.width, UI.replayCanvas.height);
    
    const scale = UI.replayCanvas.width / UI.canvas.width;
    UI.replayCtx.save();
    UI.replayCtx.scale(scale, scale);
    UI.replayCtx.translate(0, -frame.cameraY);

    for (const p of frame.platforms) {
        let pImg = platformImages.normal;
        if (p.isBreakable) {
            if (p.maxHits === 1 && p.hits === 1) pImg = platformImages.cracked2;
            else if (p.maxHits > 1) {
                if (p.hits === 1) pImg = platformImages.cracked1;
                else if (p.hits >= 2) pImg = platformImages.cracked2;
            }
        }
        UI.replayCtx.drawImage(pImg, p.x, p.y, p.width, p.height);
    }

    if (frame.ground && groundImg.complete) {
        const g = frame.ground;
        UI.replayCtx.drawImage(groundImg, g.x, g.y, g.width, g.height);
    }

    const playerFrame = frame.player;
    if (userAvatarImg && userAvatarImg.complete) {
        UI.replayCtx.save();
        UI.replayCtx.translate(playerFrame.x, playerFrame.y);
        UI.replayCtx.rotate(playerFrame.angle);

        UI.replayCtx.beginPath();
        UI.replayCtx.arc(0, 0, playerFrame.radius, 0, Math.PI * 2, true);
        UI.replayCtx.closePath();
        UI.replayCtx.clip();

        UI.replayCtx.drawImage(userAvatarImg, -playerFrame.radius, -playerFrame.radius, playerFrame.width, playerFrame.height);
        UI.replayCtx.restore();
    }

    UI.replayCtx.restore();
}


function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    const clampedDeltaTime = Math.min(deltaTime, 0.1);

    if (gameState === 'playing') {
        update(clampedDeltaTime);
        draw();
        replay.recordFrame(player, platformManager.platforms, camera.getY(), clampedDeltaTime, ground);
    } else if (gameState === 'gameOver' && replay.isPlaying) {
        drawReplay(clampedDeltaTime);
    }
    
    requestAnimationFrame(gameLoop);
}

export function createAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}