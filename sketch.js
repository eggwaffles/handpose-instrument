let handPose;
let video;
let hands = [];

let osc;
let playing = false;
let instrument = 0;
let audioStarted = false; // Flag to ensure audio starts only once

function preload() {
  // Load the handPose model
  handPose = ml5.handPose();
}

function setup() {
  createCanvas(640, 480);
  // Create the webcam video and hide it
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  // Start detecting hands from the webcam video
  handPose.detectStart(video, gotHands);

  // Create an oscillator to make the synth sound
  osc = new p5.Oscillator('sine');
  osc.amp(0); // Set initial amplitude to 0 to prevent sound at startup

  textSize(24);
  textAlign(CENTER, CENTER);
}

function draw() {
  // Draw the webcam video
  translate(width, 0);
  scale(-1.0, 1.0);
  image(video, 0, 0, width, height);

  // Draw all the tracked hand points
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    for (let j = 0; j < hand.keypoints.length; j++) {
      let keypoint = hand.keypoints[j];
      fill(0, 255, 0);
      noStroke();
      circle(keypoint.x, keypoint.y, 10);
    }
  }

  // Instrument selection based on hand gestures
  if (isLeftPalmOpen()) {
    instrument = 0;
  } else if (leftTwoRaised()) {
    instrument = 2;
  } else if (leftIndexRaised()) {
    instrument = 1;
  } else {
    instrument = 0;
  }

  playSynth(instrument);

  // Display instruction if audio hasn't started
  if (!audioStarted) {
    fill(255, 0, 0);
    text('Click to start audio', width / 2, height / 2);
  }
}

function playSynth(instrument) {
  if (instrument === 0) {
    stopSynth();
  } else if (instrument === 1) {
    if (!playing || osc.getType() !== 'sine') {
      osc.setType('sine');
      osc.freq(440); // Frequency for the sine wave
      osc.amp(0.5, 0.05); // Fade in amplitude to 0.5 over 0.05 seconds
      playing = true;
    }
  } else if (instrument === 2) {
    if (!playing || osc.getType() !== 'square') {
      osc.setType('square');
      osc.freq(660); // Frequency for the square wave
      osc.amp(0.5, 0.05); // Fade in amplitude to 0.5 over 0.05 seconds
      playing = true;
    }
  }
}

// Function to stop the synth sound
function stopSynth() {
  if (playing) {
    osc.amp(0, 0.05); // Fade out amplitude to 0 over 0.05 seconds
    playing = false;
  }
}

// Check if the left index finger is raised
function leftIndexRaised() {
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];

    // Check if the hand is the left hand (mirrored)
    if (hand.handedness === "Right") {
      let indexTip = hand.keypoints.find(point => point.name === "index_finger_tip");
      let thumbTip = hand.keypoints.find(point => point.name === "thumb_tip");
      let middleBase = hand.keypoints.find(point => point.name === "middle_finger_mcp");

      if (indexTip && thumbTip && middleBase) {
        // Check if the index finger is raised
        if (indexTip.y < thumbTip.y && indexTip.y < middleBase.y && !isLeftPalmOpen()) {
          return true;
        }
      }
    }
  }
  return false;
}

// Check if the left index and middle fingers are raised
function leftTwoRaised() {
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];

    if (hand.handedness === "Right") {
      let indexTip = hand.keypoints.find(point => point.name === "index_finger_tip");
      let indexBase = hand.keypoints.find(point => point.name === "index_finger_mcp");
      let middleTip = hand.keypoints.find(point => point.name === "middle_finger_tip");
      let middleBase = hand.keypoints.find(point => point.name === "middle_finger_mcp");

      if (indexTip && indexBase && middleTip && middleBase) {
        // Check if both fingers are raised
        if (indexTip.y < indexBase.y && middleTip.y < middleBase.y && !isLeftPalmOpen()) {
          return true;
        }
      }
    }
  }
  return false;
}

// Check if the left palm is open
function isLeftPalmOpen() {
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];

    if (hand.handedness === "Right") {
      let fingerTips = [
        "index_finger_tip",
        "middle_finger_tip",
        "ring_finger_tip",
        "pinky_tip",
        "thumb_tip"
      ];

      let fingerBases = [
        "index_finger_mcp",
        "middle_finger_mcp",
        "ring_finger_mcp",
        "pinky_mcp",
        "thumb_cmc"
      ];

      let isOpen = true;

      // Check if all fingertips are above their respective bases
      for (let j = 0; j < fingerTips.length; j++) {
        let tip = hand.keypoints.find(point => point.name === fingerTips[j]);
        let base = hand.keypoints.find(point => point.name === fingerBases[j]);

        if (tip && base) {
          if (tip.y > base.y) {
            isOpen = false;
            break;
          }
        }
      }
      if (isOpen) {
        return true;
      }
    }
  }
  return false;
}

// Callback function when hands are detected
function gotHands(results) {
  hands = results;
}

// Start the audio context and oscillator on user interaction
function mousePressed() {
  if (!audioStarted) {
    userStartAudio();
    osc.start();
    audioStarted = true;
  }
}

// Support for touch devices
function touchStarted() {
  if (!audioStarted) {
    userStartAudio();
    osc.start();
    audioStarted = true;
  }
}

