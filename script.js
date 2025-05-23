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
let currentSongIndex = 0;
let canSwitchSong = true;

const songs = ["Xtal.mp3", "Gatorade.mp3", "Peroxide.mp3", "TrueLove.mp3", "KillEverything.mp3", "Dysti.mp3", "NewsorSomething.mp3", "PizzicatoFive.mp3", "smokedope2016.mp3", "basedgod.mp3"];
const backgrounds = [
    "wp6844498-aphex-twin-wallpapers.png",
    "arizona.png",
    "e.png",
    "truelove.jpg",
    "killeverything.webp",
    "dysti.jpg",
    "newsorsomething.webp",
    "Pizzicatofive.jpg",
    "smokedope2016.jpg",
    "basedgod.jpg"
];


videoElement.addEventListener('loadedmetadata', () => {
    cameraCanvas.width = videoElement.videoWidth;
    cameraCanvas.height = videoElement.videoHeight;
});

const hands = new Hands({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 2,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6,
    modelComplexity: 1
});

// 🎵 Audio Processing
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let source = audioCtx.createMediaElementSource(audioElement);
const panner = audioCtx.createStereoPanner();

source.connect(panner);
const analyser = audioCtx.createAnalyser();

panner.connect(analyser);
analyser.connect(audioCtx.destination);
analyser.fftSize = 256;

const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

hands.onResults(results => {
    cameraCtx.clearRect(0, 0, cameraCanvas.width, cameraCanvas.height);
    handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

    const handsDetected = results.multiHandLandmarks;

    if (handsDetected.length >= 1) {
        handsDetected.forEach((hand, i) => {
            const thumbTip = hand[4];
            const wrist = hand[0];
            const indexTip = hand[8];
            const middleTip = hand[12];
            const ringTip = hand[16];
            const pinkyTip = hand[20];

            const foldedThreshold = 0.1;
            const thumbUpThreshold = 0.2;
            const thumbDownThreshold = -0.2;

            const isThumbUp = (wrist.y - thumbTip.y) > thumbUpThreshold;
            const isThumbDown = (wrist.y - thumbTip.y) < thumbDownThreshold;

            const isIndexFolded = Math.abs(indexTip.y - wrist.y) < foldedThreshold;
            const isMiddleFolded = Math.abs(middleTip.y - wrist.y) < foldedThreshold;
            const isRingFolded = Math.abs(ringTip.y - wrist.y) < foldedThreshold;
            const isPinkyFolded = Math.abs(pinkyTip.y - wrist.y) < foldedThreshold;

            const isThumbsUp = isThumbUp && isIndexFolded && isMiddleFolded && isRingFolded && isPinkyFolded;
            const isThumbsDown = isThumbDown && isIndexFolded && isMiddleFolded && isRingFolded && isPinkyFolded;

            if ((isThumbsUp || isThumbsDown) && canSwitchSong) {
                canSwitchSong = false;
                setTimeout(() => canSwitchSong = true, 1500);
            
                if (isThumbsUp) {
                    currentSongIndex = (currentSongIndex + 1) % songs.length;
                } else if (isThumbsDown) {
                    currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
                }
            
                spawnHearts();
                audioElement.pause();
                audioElement.currentTime = 0;
            
                audioElement.src = songs[currentSongIndex];
                audioElement.load();
                audioElement.play();
            
                document.body.style.backgroundImage = `url('${backgrounds[currentSongIndex]}')`;
            }
            
            const scaleFactor = 1.5;
            hand.forEach(point => {
                if (isCameraTrackingEnabled) {
                    cameraCtx.fillStyle = "white";
                    cameraCtx.beginPath();
                    cameraCtx.arc(point.x * cameraCanvas.width, point.y * cameraCanvas.height, 6, 0, 2 * Math.PI);
                    cameraCtx.fill();
                }

                handCtx.fillStyle = i === 0 ? "black" : "red";
                handCtx.beginPath();
                handCtx.arc(
                    (point.x - 0.5) * handCanvas.width * scaleFactor + handCanvas.width / 2,
                    (point.y - 0.5) * handCanvas.height * scaleFactor + handCanvas.height / 2,
                    6, 0, 2 * Math.PI
                );
                handCtx.fill();
            });
        });

        const mainHand = handsDetected[0];
        const indexFingerTip = mainHand[8];
        const middleFingerTip = mainHand[12];
        const ringFingerTip = mainHand[16];
        const pinkyFingerTip = mainHand[20];
        const thumbTip = mainHand[4];
        const wrist = mainHand[0];

        let volume = Math.max(0, Math.min(1, 1 - indexFingerTip.y));
        audioElement.volume = volume;
        volumeDisplay.innerText = `Volume: ${Math.round(volume * 100)}%`;
        volumeFill.style.width = `${volume * 100}%`;

        let pinchDistance = Math.abs(thumbTip.x - middleFingerTip.x);
        if (pinchDistance < 0.05) {
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

        const panValue = (wrist.x - 0.5) * 2;
        panner.pan.value = Math.max(-1, Math.min(1, panValue));
    }
});

camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
});
camera.start();

function spawnHearts() {
    const heartContainer = document.getElementById("heart-container");
    for (let i = 0; i < 15; i++) {
        const heart = document.createElement("div");
        heart.className = "heart";
        heart.style.left = `${Math.random() * 100}%`;
        heart.style.top = `${80 + Math.random() * 10}%`;
        heartContainer.appendChild(heart);
        setTimeout(() => heart.remove(), 2000);
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

document.addEventListener("click", () => {
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
});

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
    toggleTutorialButton.innerText = tutorialContent.classList.contains("visible") ? "Hide Tutorial" : "Show Tutorial";
});

const toggleTrackingButton = document.getElementById("toggle-tracking");
toggleTrackingButton.addEventListener("click", () => {
    isCameraTrackingEnabled = !isCameraTrackingEnabled;
    toggleTrackingButton.innerText = isCameraTrackingEnabled ? "Disable Camera Tracking" : "Enable Camera Tracking";
});
