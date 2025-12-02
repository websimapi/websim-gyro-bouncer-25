const CAMERA_SMOOTHING_FACTOR = 0.08;

export class Camera {
    constructor(canvasHeight) {
        this.y = 0;
        this.canvasHeight = canvasHeight;
    }

    update(player, inSafeZone) {
        const cameraTopThreshold = this.y + this.canvasHeight * 0.4;
        const cameraCenter = this.y + this.canvasHeight * 0.5;
        let targetCameraY = this.y;

        if (player.body.position.y < cameraTopThreshold) {
            targetCameraY = player.body.position.y - this.canvasHeight * 0.4;
        }

        if (inSafeZone && player.body.velocity.y > 0 && player.body.position.y > cameraCenter) {
            targetCameraY = player.body.position.y - this.canvasHeight * 0.5;
        }

        targetCameraY = Math.min(targetCameraY, 0);
        this.y += (targetCameraY - this.y) * CAMERA_SMOOTHING_FACTOR;

        if (Math.abs(this.y) < 0.1) {
            this.y = 0;
        }
    }

    getY() {
        return this.y;
    }

    reset() {
        this.y = 0;
    }
}

