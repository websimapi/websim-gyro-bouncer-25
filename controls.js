export class Controls {
    constructor() {
        this.tilt = 0;
        this.isIOS = typeof DeviceOrientationEvent.requestPermission === 'function';
    }
    
    #addEventListeners() {
        window.addEventListener('deviceorientation', (event) => {
            // gamma is the left-to-right tilt in degrees, where right is positive
            let tiltLR = event.gamma;
            // Cap the tilt value for sensitivity control
            this.tilt = Math.max(-45, Math.min(45, tiltLR));
        });
    }

    async requestPermission() {
        if (!this.isIOS) {
            this.#addEventListeners();
            return true; // Non-iOS devices don't need permission
        }

        try {
            const permissionState = await DeviceOrientationEvent.requestPermission();
            if (permissionState === 'granted') {
                this.#addEventListeners();
                return true;
            }
            return false;
        } catch (error) {
            console.error("Permission request for device orientation failed.", error);
            return false;
        }
    }

    getTilt() {
        return this.tilt;
    }
}

