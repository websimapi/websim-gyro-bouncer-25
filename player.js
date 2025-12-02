import Matter from 'https://esm.sh/matter-js';

const HORIZONTAL_FORCE = 0.0025; 
const MAX_HORIZONTAL_SPEED = 7;

export class Player {
    constructor(x, y, image, world, options) {
        this.width = 50;
        this.height = 50;
        this.radius = this.width / 2;
        this.image = image;
        this.scale = 1;
        
        this.body = Matter.Bodies.circle(x, y, this.radius, {
            restitution: options.restitution,
            friction: 0.1,
            frictionAir: 0.01,
            label: 'player',
            density: 0.002,
        });
        Matter.World.add(world, this.body);
    }

    update(tilt, canvasWidth, deltaTime) {
        // Horizontal movement via force
        const forceMagnitude = tilt * HORIZONTAL_FORCE;
        Matter.Body.applyForce(this.body, this.body.position, { x: forceMagnitude, y: 0 });

        // Cap horizontal velocity
        const clampedVx = Math.max(-MAX_HORIZONTAL_SPEED, Math.min(MAX_HORIZONTAL_SPEED, this.body.velocity.x));
        Matter.Body.setVelocity(this.body, { x: clampedVx, y: this.body.velocity.y });

        // Wall collision (teleport to other side)
        if (this.body.position.x > canvasWidth + this.radius) {
            Matter.Body.setPosition(this.body, { x: -this.radius, y: this.body.position.y });
        }
        if (this.body.position.x < -this.radius) {
            Matter.Body.setPosition(this.body, { x: canvasWidth + this.radius, y: this.body.position.y });
        }
    }

    draw(ctx) {
        if (this.image && this.image.complete) {
            const pos = this.body.position;
            const angle = this.body.angle;

            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(angle);

            // Use a circular clip to make the image round
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();

            // Draw the image centered
            ctx.drawImage(
                this.image,
                -this.radius,
                -this.radius,
                this.width,
                this.height
            );

            ctx.restore();
        }
    }
}

