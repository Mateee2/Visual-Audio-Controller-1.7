const videoElement = document.getElementById('video');
const audioElement = document.getElementById('audio');
const volumeDisplay = document.getElementById('volume-display');
const volumeFill = document.getElementById('volume-fill');
const visualizerCanvas = document.getElementById('visualizer');
const visualizerCtx = visualizerCanvas.getContext('2d');
const handCanvas = document.getElementById('hand-tracking');
const handCtx = handCanvas.getContext('2d');
const cameraCanvas = document.getElementById('camera-canvas');
const cameraCtx = cameraCanvas.getContext('2d');

let camera = null;
let isAudioPlaying = true;
let isCameraTrackingEnabled = true;

videoElement.addEventListener('loadedmetadata', () => {
    cameraCanvas.width = videoElement.videoWidth;
    cameraCanvas.height = videoElement.videoHeight;
});

// Load MediaPipe Hands
const hands = new Hands({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6,
    modelComplexity: 1
});

hands.onResults(results => {
    cameraCtx.clearRect(0, 0, cameraCanvas.width, cameraCanvas.height);
    handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

    if (results.multiHandLandmarks.length > 0) {
        const handsDetected = results.multiHandLandmarks;

        if (handsDetected.length >= 1) {
            const hand = handsDetected[0];

            const thumbTip = hand[4];
            const wrist = hand[0];
            const indexTip = hand[8];
            const middleTip = hand[12];
            const ringTip = hand[16];
            const pinkyTip = hand[20];

            const foldedThreshold = 0.1;
            const thumbUpThreshold = 0.2;

            const isThumbUp = (wrist.y - thumbTip.y) > thumbUpThreshold;
            const isIndexFolded = Math.abs(indexTip.y - wrist.y) < foldedThreshold;
            const isMiddleFolded = Math.abs(middleTip.y - wrist.y) < foldedThreshold;
            const isRingFolded = Math.abs(ringTip.y - wrist.y) < foldedThreshold;
            const isPinkyFolded = Math.abs(pinkyTip.y - wrist.y) < foldedThreshold;

            if (isThumbUp && isIndexFolded && isMiddleFolded && isRingFolded && isPinkyFolded) {
                spawnHearts(); // 💖
            }
        }

        const hand = handsDetected[0]; // Still proceed with primary hand

        const indexFingerTip = hand[8];
        const thumbTip = hand[4];
        const middleFingerTip = hand[12];
        const wrist = hand[0];

        // Volume Control
        let volume = Math.max(0, Math.min(1, 1 - indexFingerTip.y)); // Map Y position to volume
        audioElement.volume = volume;

        // Update UI
        volumeDisplay.innerText = `Volume: ${Math.round(volume * 100)}%`;
        volumeFill.style.width = `${volume * 100}%`;

        // Play/Pause Detection
        let distance = Math.abs(thumbTip.x - middleFingerTip.x);
        if (distance < 0.05) {
            if (isAudioPlaying) {
                audioElement.pause();
                isAudioPlaying = false;
                volumeDisplay.innerText = "Paused 🎵";
            }
        } else {
            if (!isAudioPlaying) {
                audioElement.play();
                isAudioPlaying = true;
                volumeDisplay.innerText = `Volume: ${Math.round(volume * 100)}%`;
            }
        }

        // 🎧 Stereo Panning
        const panValue = (wrist.x - 0.5) * 2;
        panner.pan.value = Math.max(-1, Math.min(1, panValue));

        // ✍️ Draw hand points on both canvases
        const scaleFactor = 1.5;
        hand.forEach(point => {
            // Draw on camera overlay (only if enabled)
            if (isCameraTrackingEnabled) {
                cameraCtx.fillStyle = "white";
                cameraCtx.beginPath();
                cameraCtx.arc(
                    point.x * cameraCanvas.width,
                    point.y * cameraCanvas.height,
                    6, 0, 2 * Math.PI
                );
                cameraCtx.fill();
            }

            // Draw on separate hand tracking canvas
            handCtx.fillStyle = "black";
            handCtx.beginPath();
            handCtx.arc(
                (point.x - 0.5) * handCanvas.width * scaleFactor + handCanvas.width / 2,
                (point.y - 0.5) * handCanvas.height * scaleFactor + handCanvas.height / 2,
                6, 0, 2 * Math.PI
            );
            handCtx.fill();
        });
    }
});

// Initialize Camera
camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
});
camera.start();

// 🎵 Audio Processing
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioCtx.createAnalyser();
const source = audioCtx.createMediaElementSource(audioElement);

// 🎚️ Stereo Panner
const panner = audioCtx.createStereoPanner();
source.connect(panner);
panner.connect(analyser);
analyser.connect(audioCtx.destination);
analyser.fftSize = 256;

const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

function spawnHearts() {
    const heartContainer = document.getElementById("heart-container");

    for (let i = 0; i < 15; i++) {
        const heart = document.createElement("div");
        heart.className = "heart";
        heart.style.left = `${Math.random() * 100}%`;
        heart.style.top = `${80 + Math.random() * 10}%`;
        heartContainer.appendChild(heart);

        setTimeout(() => {
            heart.remove();
        }, 2000);
    }
}

function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    analyser.getByteFrequencyData(dataArray);

    visualizerCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

    const barWidth = (visualizerCanvas.width / bufferLength) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        let barHeight = dataArray[i] * 0.8;

        let gradient = visualizerCtx.createLinearGradient(0, 0, 0, visualizerCanvas.height);
        gradient.addColorStop(0, "rgb(0, 0, 0)");
        gradient.addColorStop(1, "rgb(0, 0, 0)");

        visualizerCtx.fillStyle = gradient;
        visualizerCtx.shadowBlur = 10;
        visualizerCtx.shadowColor = "rgba(255, 255, 255, 0.5)";

        visualizerCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 2;
    }
}

drawVisualizer();

// Start AudioContext on interaction
document.addEventListener("click", () => {
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
});

// UI Buttons
const toggleCameraButton = document.getElementById("toggle-camera");
toggleCameraButton.addEventListener("click", () => {
    if (videoElement.classList.contains("hidden")) {
        videoElement.classList.remove("hidden");
        cameraCanvas.classList.remove("hidden");
        toggleCameraButton.innerText = "Hide Camera";
    } else {
        videoElement.classList.add("hidden");
        cameraCanvas.classList.add("hidden");
        toggleCameraButton.innerText = "Show Camera";
    }
});

const toggleTutorialButton = document.getElementById("toggle-tutorial");
const tutorialContent = document.getElementById("tutorial-content");

toggleTutorialButton.addEventListener("click", () => {
    tutorialContent.classList.toggle("visible");
    if (tutorialContent.classList.contains("visible")) {
        toggleTutorialButton.innerText = "Hide Tutorial";
    } else {
        toggleTutorialButton.innerText = "Show Tutorial";
    }
});

const toggleTrackingButton = document.getElementById("toggle-tracking");
toggleTrackingButton.addEventListener("click", () => {
    isCameraTrackingEnabled = !isCameraTrackingEnabled;
    toggleTrackingButton.innerText = isCameraTrackingEnabled
        ? "Disable Camera Tracking"
        : "Enable Camera Tracking";
});
