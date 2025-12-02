import Matter from 'https://esm.sh/matter-js';

const SPIKE_CYCLE_SECONDS = 3;
const SPIKE_OUT_SECONDS = 1;

class Platform {
    constructor(x, y, width, images, world, options, isBreakable = false, isSpiky = false, score = 0) {
        this.width = width;
        const image = images.normal;
        if (image && image.naturalWidth > 0) {
            this.height = width * (image.naturalHeight / image.naturalWidth);
        } else {
            this.height = 20; // Fallback height
        }
        this.images = images;
        this.isBreakable = isBreakable;
        this.isSpiky = isSpiky;
        this.spikesOut = false;
        this.spikeTimer = Math.random() * SPIKE_CYCLE_SECONDS; // Randomize start of cycle
        this.hits = 0;
        this.maxHits = (isBreakable && score >= 1000) ? 1 : 2;
        this.isBroken = false;
        
        this.body = Matter.Bodies.rectangle(x + width / 2, y + this.height / 2, this.width, this.height, {
            isStatic: true,
            restitution: options.restitution,
            friction: 0,
            label: 'platform'
        });
        this.body.parentObject = this; // Link body back to the platform instance
        Matter.World.add(world, this.body);
    }

    update(deltaTime) {
        if (!this.isSpiky) return;

        this.spikeTimer += deltaTime;
        if (this.spikeTimer >= SPIKE_CYCLE_SECONDS) {
            this.spikeTimer = 0;
        }

        this.spikesOut = this.spikeTimer < SPIKE_OUT_SECONDS;
    }

    draw(ctx) {
        let imageToDraw = this.images.normal;
        if (this.isSpiky) {
            imageToDraw = this.images.spiky;
        } else if (this.isBreakable) {
            if (this.maxHits === 1) {
                if (this.hits === 0) imageToDraw = this.images.cracked1; // Show cracked1 by default for 1-hit platforms
                else if (this.hits >= 1) imageToDraw = this.images.cracked2;
            } else { // maxHits is 2 or more
                if (this.hits === 1) imageToDraw = this.images.cracked1;
                else if (this.hits >= 2) imageToDraw = this.images.cracked2;
            }
        }
        const pos = this.body.position;
        ctx.drawImage(imageToDraw, pos.x - this.width / 2, pos.y - this.height / 2, this.width, this.height);

        if (this.isSpiky && this.spikesOut && this.images.spikes) {
            const spikeHeight = this.width * (this.images.spikes.naturalHeight / this.images.spikes.naturalWidth);
            ctx.drawImage(
                this.images.spikes,
                pos.x - this.width / 2,
                pos.y - this.height / 2 - spikeHeight,
                this.width,
                spikeHeight
            );
        }
    }

    onHit(score) {
        if (this.isSpiky) return; // Spiky platforms are not breakable
        if (!this.isBreakable || this.isBroken) return;

        this.maxHits = score < 1000 ? 2 : 1;
        this.hits++;

        if (this.hits >= this.maxHits) {
            this.isBroken = true;
        }
    }

    destroy(world) {
        Matter.World.remove(world, this.body);
    }
}

export class PlatformManager {
    constructor(canvasWidth, canvasHeight, images, world, options) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.platformImages = images;
        this.world = world;
        this.options = options;
        this.platforms = [];
        this.platformWidth = 100;
        this.minGap = 80;
        this.maxGap = 150;
        this.nextPlatformY = canvasHeight - 50;
        this.platformCount = 0;
    }

    generateInitialPlatforms() {
        // Clear existing platforms from world
        this.platforms.forEach(p => p.destroy(this.world));
        this.platforms = [];
        this.platformCount = 0;

        // Starting platform is now the ground, so generate the first one higher up
        this.nextPlatformY = this.canvasHeight - 200;
        this.addPlatform(this.canvasWidth / 2 - this.platformWidth / 2, this.nextPlatformY, 0);


        for (let i = 0; i < 20; i++) {
            this.generatePlatform(0);
        }
    }

    addPlatform(x, y, score = 0) {
        this.platformCount++;
        const isBreakable = this.platformCount > 5 && this.platformCount % 5 === 0;
        const isSpiky = score >= 1500 && Math.random() < 1/7;

        // A platform cannot be both spiky and breakable
        const finalIsBreakable = isSpiky ? false : isBreakable;

        const newPlatform = new Platform(x, y, this.platformWidth, this.platformImages, this.world, this.options, finalIsBreakable, isSpiky, score);
        this.platforms.push(newPlatform);
        return newPlatform;
    }

    generatePlatform(score = 0) {
        const y = this.nextPlatformY - (this.minGap + Math.random() * (this.maxGap - this.minGap));
        const x = Math.random() * (this.canvasWidth - this.platformWidth);
        this.addPlatform(x, y, score);
        this.nextPlatformY = y;
    }

    update(cameraY, playerY, score = 0) {
        // Generate new platforms as camera moves up
        if (this.nextPlatformY > cameraY - this.canvasHeight) {
            this.generatePlatform(score);
        }

        // Remove platforms that are off-screen below or broken
        const platformsToRemove = this.platforms.filter(p => p.body.position.y > cameraY + this.canvasHeight + 100 || p.isBroken);
        platformsToRemove.forEach(p => p.destroy(this.world));
        this.platforms = this.platforms.filter(p => p.body.position.y <= cameraY + this.canvasHeight + 100 && !p.isBroken);
    
        // Update individual platforms (like for spikes)
        this.platforms.forEach(p => p.update(1/60)); // Assuming 60fps for simplicity in update logic
    }

    draw(ctx) {
        for (const platform of this.platforms) {
            platform.draw(ctx);
        }
    }
}