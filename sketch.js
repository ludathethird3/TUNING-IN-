// Keep true until all final MP4 files have been uploaded.
const USE_PLACEHOLDERS = false;

// Full-screen flash opacity: 0–255.
const FLASH_OPACITY = 255;

const roles = ["left", "centre", "right"];

const placeholderFiles = {
  left: "channel1.mp4",
  centre: "channel2.mp4",
  right: "channel3.mp4"
};

const puzzlePatterns = [
  [400],
  [200, 200, 200],
  [200, 200, 200, 200, 200],
  [200, 100, 500],
  [500, 100, 100]
];

let channels = [];
let channel = 0;
let role = null;
let started = false;

const DOUBLE_TAP_MS = 300;
const TAP_MOVE_LIMIT = 25;
const DISTRACTION_PLAYS = 1;
const PUZZLE_PLAYS = 2;

let completedPlays = 0;

let pointerStart = null;
let lastTap = null;

const effectNames = [
  "normal",
  "invert",
  "posterize",
  "threshold",
  "pixelation",
  "rgb-split"
];

let effectIndex = 0;
let pixelBuffer;

let player;
let activeFile = "";
let loading = false;
let playbackError = "";
let playRequest = 0;

let feedbackPattern = [];
let feedbackStartedAt = 0;

function setup() {
  let canvas = createCanvas(360, 640);
  canvas.elt.style.touchAction = "none";

  // Small canvas used to create blocky pixelation.
  pixelBuffer = createGraphics(36, 64);
  pixelBuffer.pixelDensity(1);

  buildChannelList();

  // One player, reused for every channel.
  player = createVideo("channel1.mp4");
  player.hide();

  let video = player.elt;
  video.setAttribute("playsinline", "");
  video.setAttribute("preload", "metadata");

  video.muted = false;
  video.loop = true;

  video.addEventListener("waiting", function() {
    if (started) loading = true;
  });

  video.addEventListener("playing", function() {
    loading = false;
    playbackError = "";
  });
video.addEventListener("ended", function() {
  if (!started || !video.ended) return;

  completedPlays++;

  const playLimit =
    channels[channel].type === "puzzle"
      ? PUZZLE_PLAYS
      : DISTRACTION_PLAYS;

  console.log("Completed plays:", completedPlays, "/", playLimit);

  if (completedPlays >= playLimit) {
    lastTap = null;
    changeChannel();
    return;
  }

  // Replay without resetting the completed-play count.
  const request = playRequest;
  video.currentTime = 0;

  video.play().catch(function(error) {
    if (request !== playRequest) return;

    loading = false;
    playbackError = "Playback failed. Swipe Up to Continue.";
    console.error("REPLAY FAILED:", error);
  });
});

  video.addEventListener("error", function() {
    if (!started) return;

    loading = false;
    playbackError = "Could not load video. Swipe Up to Continue.";
    console.error("VIDEO LOAD FAILED:", activeFile);
  });

  const bounds = canvas.elt.getBoundingClientRect();

  const bounds = canvas.elt.getBoundingClientRect();

  const tapX =
    (event.clientX - bounds.left) * width / bounds.width;
  const tapY =
    (event.clientY - bounds.top) * height / bounds.height;

  const deltaX = tapX - pointerStart.x;
  const deltaY = tapY - pointerStart.y;
  const movement = Math.hypot(deltaX, deltaY);

  pointerStart = null;

  // Handle swipes.
  if (movement > TAP_MOVE_LIMIT) {
    if (!started) return;

    // Swipe up: change video on any channel.
    if (
      deltaY < -TAP_MOVE_LIMIT &&
      Math.abs(deltaY) > Math.abs(deltaX)
    ) {
      changeChannel();
      return;
    }

    // Swipe left or right: cycle distraction effects.
    if (
      Math.abs(deltaX) > TAP_MOVE_LIMIT &&
      Math.abs(deltaX) > Math.abs(deltaY) &&
      channels[channel].type === "distraction"
    ) {
      effectIndex = (effectIndex + 1) % effectNames.length;
      console.log("Effect:", effectNames[effectIndex]);
    }

    return;
  }

  // Single tap: change role.
  if (
    role !== null &&
    started &&
    tapX >= width - 120 &&
    tapY >= 0 &&
    tapY < 50
  ) {
    resetRole();
    return;
  }

  // Single tap: select a role.
  if (role === null) {
    if (tapX < width / 3) {
      role = "left";
    } else if (tapX < width * 2 / 3) {
      role = "centre";
    } else {
      role = "right";
    }

    return;
  }

  // Single tap: start playback.
  if (!started) {
    changeChannel();
  }
});
 
}

function buildChannelList() {
  channels = [];

// Seven distractions followed by one puzzle.
// Five groups = 35 distractions + 5 puzzles.
for (let group = 0; group < 5; group++) {
  for (let slot = 1; slot <= 7; slot++) {
    let distractionNumber = group * 7 + slot;

      channels.push({
        type: "distraction",
        file: "distraction (" + distractionNumber + ").mp4",
        placeholder:
          distractionNumber % 2 === 1
            ? "channel1.mp4"
            : "channel2.mp4"
      });
    }

    let puzzleNumber = String(group + 1).padStart(2, "0");
    let files = {};

    for (let position of roles) {
      files[position] =
        "puzzle" + puzzleNumber + "_" + position + ".mp4";
    }

    channels.push({
      type: "puzzle",
      files: files,
      vibration: puzzlePatterns[group]
    });
  }
}

function draw() {
  background(0);
  noStroke();

  // First screen: choose a role.
  if (role === null) {
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(24);
    text("Choose your position", width / 2, height / 3);

    textSize(18);
    text("LEFT", width / 6, height / 2);
    text("CENTRE", width / 2, height / 2);
    text("RIGHT", width * 5 / 6, height / 2);

    return;
  }

  // Second screen: tap to start.
  if (!started) {
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(24);
    text("Tap to start", width / 2, height / 2);

    return;
  }

  // Draw only when a video frame is available.
  if (
    !loading &&
    !playbackError &&
    player.elt.readyState >= 2
  ) {
    drawVideoWithEffect();
  } else {
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(18);

    text(
      playbackError || "Loading…",
      20,
      height / 2 - 40,
      width - 40,
      100
    );
  }

  // Change role — text only, no background.
fill(255);
textAlign(CENTER, CENTER);
textSize(16);
text("Change role", width - 60, 25);
  drawVisualFeedback();
}

function drawVideoWithEffect() {
  // Puzzle videos always remain normal.
  const effect =
    channels[channel].type === "distraction"
      ? effectNames[effectIndex]
      : "normal";

  if (effect === "pixelation") {
    pixelBuffer.image(
      player,
      0,
      0,
      pixelBuffer.width,
      pixelBuffer.height
    );

    // Enlarge without smoothing the pixel blocks.
    drawingContext.save();
    drawingContext.imageSmoothingEnabled = false;
    image(pixelBuffer, 0, 0, width, height);
    drawingContext.restore();

    return;
  }

  if (effect === "rgb-split") {
    const offset = 8;

    push();
    blendMode(BLEND);
    background(0);

    // Combine three shifted colour components.
    blendMode(ADD);

    tint(255, 0, 0);
    image(player, -offset, 0, width, height);

    tint(0, 255, 0);
    image(player, 0, 0, width, height);

    tint(0, 0, 255);
    image(player, offset, 0, width, height);

    pop();
    return;
  }

  image(player, 0, 0, width, height);

  if (effect === "invert") {
    filter(INVERT);
  } else if (effect === "posterize") {
    filter(POSTERIZE, 3);
  } else if (effect === "threshold") {
    filter(THRESHOLD, 0.5);
  }
}

function changeChannel() {
  if (!started) {
    started = true;

    // Request fullscreen directly from the start tap.
    if (
      !document.fullscreenElement &&
      document.documentElement.requestFullscreen
    ) {
      document.documentElement.requestFullscreen().catch(function(error) {
        console.log("Fullscreen unavailable:", error.message);
      });
    }
  } else {
    channel = (channel + 1) % channels.length;
  }

  playCurrentChannel();
}

function getChannelFile(entry) {
  if (USE_PLACEHOLDERS) {
    if (entry.type === "puzzle") {
      return placeholderFiles[role];
    }

    return entry.placeholder;
  }

  if (entry.type === "puzzle") {
    return entry.files[role];
  }

  return entry.file;
}

function playCurrentChannel() {
  // Reset effects and play count whenever the channel changes.
  effectIndex = 0;
  completedPlays = 0;

  let entry = channels[channel];

  startVisualFeedback(
    entry.type === "puzzle" ? entry.vibration : null
  );

  let filename = getChannelFile(entry);
  let video = player.elt;

  // Ignore results from older playback requests.
  let request = ++playRequest;

  video.pause();
  playbackError = "";
  loading = true;

  // Stop previous vibration, then play the puzzle pattern.
  if (navigator.vibrate) {
    navigator.vibrate(0);

    if (entry.type === "puzzle") {
      navigator.vibrate(entry.vibration);
    }
  }

  if (filename !== activeFile) {
    activeFile = filename;
    video.src = filename;
    video.load();
  } else if (video.readyState >= 1) {
    video.currentTime = 0;
  }

  video.loop = false;

  console.log(
    "Channel:",
    channel + 1,
    "Type:",
    entry.type,
    "File:",
    filename
  );

  video.play()
    .then(function() {
      if (request !== playRequest) return;

      loading = false;
    })
    .catch(function(error) {
      if (request !== playRequest) return;

      loading = false;
      playbackError = "Playback failed. Swipe Up to Continue.";
      console.error("PLAY FAILED:", filename, error);
    });
}

function resetRole() {
  // Invalidate unfinished playback requests.
  playRequest++;

  feedbackPattern = [];
  player.pause();

  if (navigator.vibrate) {
    navigator.vibrate(0);
  }

  pointerStart = null;
  lastTap = null;
  effectIndex = 0;

  role = null;
  started = false;
  channel = 0;
  loading = false;
  playbackError = "";
}

function startVisualFeedback(pattern) {
  feedbackPattern = pattern ? [...pattern] : [];
  feedbackStartedAt = millis();
}

function drawVisualFeedback() {
  if (feedbackPattern.length === 0) return;

  let elapsed = millis() - feedbackStartedAt;
  let segmentEnd = 0;

  for (let i = 0; i < feedbackPattern.length; i++) {
    segmentEnd += feedbackPattern[i] * 2;

    if (elapsed < segmentEnd) {
      // Even segments are flashes; odd segments are pauses.
      if (i % 2 === 0) {
        push();
        noStroke();
        fill(255, FLASH_OPACITY);
        rect(0, 0, width, height);
        pop();
      }

      return;
    }
  }

  feedbackPattern = [];
}