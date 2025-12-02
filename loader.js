const AVATAR_CACHE_KEY = 'gyroBouncerAvatarCache';

function imageToDataURL(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    return canvas.toDataURL('image/png');
}

function loadImageFromDataURL(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => {
            console.error("Failed to load image from data URL", err);
            localStorage.removeItem(AVATAR_CACHE_KEY);
            reject(err);
        };
        img.src = dataUrl;
    });
}

async function loadImageWithProxies(url) {
    const proxies = [
        { name: 'Direct', url: '' },
        { name: 'CORS Proxy 1', url: 'https://api.allorigins.win/raw?url=' },
        { name: 'CORS Proxy 2', url: 'https://corsproxy.io/?' },
    ];

    for (const proxy of proxies) {
        const proxyUrl = proxy.url + url;
        try {
            const img = new Image();
            img.crossOrigin = "anonymous";
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = proxyUrl;
            });
            console.log(`Successfully loaded image from: ${proxyUrl}`);
            return { image: img, source: proxy.name };
        } catch (error) {
            console.warn(`Failed to load image from: ${proxyUrl}`, error);
        }
    }
    return { image: null, source: 'failed' };
}

export async function loadAvatar(updateStatus) {
    let userAvatarImg = null;
    let avatarLoadFailed = false;
    let finalLoadingMessage = '';

    updateStatus('Initializing...');

    try {
        updateStatus('Connecting to server...');
        const room = new WebsimSocket();
        await room.initialize();
        const client = room.peers[room.clientId];
        if (client && client.avatarUrl) {
            updateStatus('Profile found. Checking for cached avatar...');
            const cachedAvatar = JSON.parse(localStorage.getItem(AVATAR_CACHE_KEY));
            if (cachedAvatar && cachedAvatar.url === client.avatarUrl) {
                console.log("Loading avatar from cache.");
                updateStatus('Loading avatar from local cache...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                userAvatarImg = await loadImageFromDataURL(cachedAvatar.dataUrl);
                finalLoadingMessage = 'Avatar loaded from cache.';
            } else {
                console.log("Fetching new avatar.");
                updateStatus('Fetching your avatar...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                const { image: fetchedImg, source } = await loadImageWithProxies(client.avatarUrl);
                if (fetchedImg) {
                    userAvatarImg = fetchedImg;
                    finalLoadingMessage = source === 'Direct' ? 'Avatar loaded directly.' : `Avatar loaded via ${source}.`;
                    updateStatus(finalLoadingMessage);
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    updateStatus('Caching avatar for next time...');
                    const dataUrl = imageToDataURL(userAvatarImg);
                    localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify({ url: client.avatarUrl, dataUrl }));
                    console.log("Avatar cached.");
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    avatarLoadFailed = true;
                }
            }

            if (!userAvatarImg) {
                avatarLoadFailed = true;
                updateStatus('Your avatar could not be loaded.');
                alert("Your avatar could not be loaded. Please try again or check your profile picture.");
            } else {
                updateStatus(finalLoadingMessage);
            }
        } else {
            avatarLoadFailed = true;
            updateStatus('No profile picture found.');
            alert("You don't seem to have a profile picture. Please set one to play.");
        }
    } catch (e) {
        avatarLoadFailed = true;
        console.error("Websim socket failed to initialize, cannot fetch avatar:", e);
        updateStatus('Could not connect to get your profile.');
        alert("Could not connect to get your profile. Please refresh and try again.");
    }

    return { userAvatarImg, avatarLoadFailed };
}

export async function loadGameImages(updateStatus) {
    updateStatus("Loading game assets...");
    const platformImg = new Image();
    platformImg.src = 'platform.png';
    const groundImg = new Image();
    groundImg.src = 'ground.png';
    const platformCracked1Img = new Image();
    platformCracked1Img.src = 'platform_cracked1.png';
    const platformCracked2Img = new Image();
    platformCracked2Img.src = 'platform_cracked2.png';
    const spikyPlatformImg = new Image();
    spikyPlatformImg.src = 'spiky_platform.png';
    const spikesImg = new Image();
    spikesImg.src = 'spikes.png';

    const assetsToLoad = [platformImg, groundImg, platformCracked1Img, platformCracked2Img, spikyPlatformImg, spikesImg];
    await Promise.all(assetsToLoad.map(img => {
        return new Promise((resolve) => {
            if (img.complete) {
                resolve();
            } else {
                img.onload = () => resolve();
                img.onerror = () => {
                    console.warn(`Failed to load image: ${img.src}`);
                    resolve();
                };
            }
        });
    }));

    updateStatus("Loading game assets... Ready!");
    await new Promise(resolve => setTimeout(resolve, 1500));
    return { platformImg, groundImg, platformCracked1Img, platformCracked2Img, spikyPlatformImg, spikesImg };
}

export async function loadSound(audioCtx, url) {
    if (!audioCtx) return null;
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        return audioBuffer;
    } catch (e) {
        console.error(`Failed to load sound: ${url}`, e);
        return null;
    }
}