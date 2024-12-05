let handPose;
let video;
let hands = [];

let oscillators = [];
let playing = false;
let instrument = 0;
let audioStarted = false;
let graphicsLayer;

let bassOsc, bassEnv, bassPlaying = false; // Variables for bass beat

function preload() {
  // Load the handPose model
  handPose = ml5.handPose();
}

function setup() {
  createCanvas(640, 480);
  // Create a separate graphics layer
  graphicsLayer = createGraphics(640, 480);

  // Create the webcam video and hide it
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  // Start detecting hands from the webcam video
  handPose.detectStart(video, gotHands);

  // Create oscillators for a chord (C major: C, E, G notes)
  let frequencies = [130.81, 155.56, 196.00]; // C, Eb, G in Hz (one octave lower)
  for (let i = 0; i < frequencies.length; i++) {
    let osc = new p5.Oscillator('sine');
    osc.freq(frequencies[i]);
    osc.amp(0);  // Set initial amplitude to 0
    osc.start(); // Start the oscillator but set amplitude to 0 to avoid sound on startup
    oscillators.push(osc);
  }

  bassOsc = new p5.Oscillator('sine');
  bassOsc.freq(60); // Low frequency for a bass drum sound
  bassOsc.amp(0); // Start with zero amplitude
  bassOsc.start(); // Start the oscillator

  bassEnv = new p5.Envelope();
  bassEnv.setADSR(0.001, 0.2, 0.0, 0.1); // Quick attack and short decay for a punchy bass beat
  bassOsc.amp(bassEnv); // Attach the envelope to the oscillator

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

  // synth on instrument 1
  if (instrument === 1) {
    playSynth();
  } else {
    stopSynth();
  }

  // beat on instrument 2
  if (instrument === 2 && rightisPinched()) {
    playPercussion();
  } else {
    stopPercussion();
  }

  // If audio hasn't started, display the instruction on the separate graphics layer
  if (!audioStarted) {
    graphicsLayer.clear(); // Clear previous frame
    translate(width, 0);
    scale(-1.0, 1.0);
    graphicsLayer.fill(255, 255, 255);
    graphicsLayer.textSize(24);
    graphicsLayer.textAlign(CENTER, CENTER);
    graphicsLayer.text('Click to start', width / 2, height / 2);
  } else {
    graphicsLayer.clear(); // Clear the message once audio starts
  }

  // Draw the graphics layer on top of the main canvas
  image(graphicsLayer, 0, 0);
}

function playSynth() {
  let indexDistance = calculateIndexTipDistance();
  let fingersUp = countRightHandFingersUp(); // Get the number of fingers up on the right hand (excluding thumb)

  // Determine base frequencies for a chord (C major chord used here)
  let baseFrequencies = [261.63, 329.63, 392.00]; // C, E, G in Hz

  // Determine the waveform type based on the number of fingers up
  let waveType = 'sine'; // Default to sine wave

  if (fingersUp === 0) {
    waveType = 'sine'; // 0 fingers up: sine wave
  } else if (fingersUp === 1) {
    waveType = 'triangle'; // 1 finger up: triangle wave
  } else if (fingersUp === 2) {
    waveType = 'sawtooth'; // 2 fingers up: sawtooth wave
  } else if (fingersUp === 3) {
    waveType = 'square'; // 3 fingers up: square wave
  } else if (fingersUp === 4) {
    waveType = 'sine'; // 4 fingers up: sine wave (or any other type, based on your choice)
  }

  if (indexDistance !== null) {
    let { dx, dy } = indexDistance;

    // Map dx to volume (amplitude)
    let volume = map(-dx, 80, 500, 0.1, 0.7);
    volume = constrain(volume, 0, 0.7); // Make sure volume is within a safe range

    // Map dy to frequency adjustment
    let frequencyOffset = map(-dy, -200, 200, -40, 40); // Map dy to a frequency offset in Hz (-50 to +50 Hz)
    frequencyOffset = constrain(frequencyOffset, -40, 40); // Ensure frequency offset is within a safe range

    // Adjust frequencies and play the oscillators
    for (let i = 0; i < oscillators.length; i++) {
      oscillators[i].setType(waveType); // Set the waveform type
      let adjustedFrequency = baseFrequencies[i % baseFrequencies.length] + frequencyOffset;

      oscillators[i].freq(adjustedFrequency); // Set the adjusted frequency
      oscillators[i].amp(volume, 0.1); // Adjust the volume smoothly over 0.1 seconds
    }
  }

  if (!playing) {
    playing = true;
  }
}

// Function to stop the synth sound
function stopSynth() {
  if (playing) {
    for (let i = 0; i < oscillators.length; i++) {
      oscillators[i].amp(0, 0.8); // Fade out amplitude to 0 over 0.05 seconds
    }
    playing = false;
  }
}

function playPercussion() {
  if (rightisPinched()) {
    let indexDistance = calculateIndexTipDistance();

    if (indexDistance !== null) {
      let { dx } = indexDistance;

      // Map dx to volume (amplitude) of the bass
      let volume = map(-dx, 50, 300, 0.1, 1.0);
      volume = constrain(volume, 0, 1.0); // Ensure the volume stays in a valid range (0 to 1)

      if (bassEnv && bassOsc) {
        bassOsc.amp(volume, 0.1); // Set the overall volume with a short fade time
        bassEnv.play(bassOsc); // Trigger the envelope on the bass oscillator
        bassPlaying = true; // Ensure `bassPlaying` is set to true
      }
    }
  }
}

// Function to stop the bass beat
function stopPercussion() {
  if (bassPlaying) {
    bassEnv.triggerRelease(); // Release the envelope
    bassOsc.amp(0, 0.1); // Explicitly set the amplitude to 0 with a short fade
    bassPlaying = false;
  }
}

// Check if the left index finger is raised
function leftIndexRaised() {
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];

    if (hand.handedness === "Right") {
      let indexTip = hand.keypoints.find(point => point.name === "index_finger_tip");
      let thumbTip = hand.keypoints.find(point => point.name === "thumb_tip");
      let middleBase = hand.keypoints.find(point => point.name === "middle_finger_mcp");

      if (indexTip && thumbTip && middleBase) {
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

function countRightHandFingersUp() {
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];

    // Check if the hand is the right hand (mirrored, i.e., actually the right hand)
    if (hand.handedness === "Left") {
      let fingerTips = [
        "index_finger_tip",
        "middle_finger_tip",
        "ring_finger_tip",
        //"pinky_tip"
      ];

      let fingerBases = [
        "index_finger_mcp",
        "middle_finger_mcp",
        "ring_finger_mcp",
        //"pinky_mcp"
      ];

      let fingersUp = 0;

      // Check each finger (index, middle, ring, pinky) to see if it's raised
      for (let j = 0; j < fingerTips.length; j++) {
        let tip = hand.keypoints.find(point => point.name === fingerTips[j]);
        let base = hand.keypoints.find(point => point.name === fingerBases[j]);

        if (tip && base && tip.y < base.y) {
          fingersUp++;
        }
      }

      // Assign and return a number from 0 to 4 based on how many fingers are up (excluding the thumb)
      return fingersUp; // This will be a number between 0 and 4
    }
  }

  return 0; // Default to 0 if no right hand is detected or no fingers are up
}

function calculateIndexTipDistance() {
  let leftIndexTip = null;
  let rightIndexTip = null;

  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];

    // Determine which hand is being processed
    if (hand.handedness === "Right") {
      // This is actually the left hand due to mirroring
      leftIndexTip = hand.keypoints.find(point => point.name === "index_finger_tip");
    } else if (hand.handedness === "Left") {
      // This is actually the right hand due to mirroring
      rightIndexTip = hand.keypoints.find(point => point.name === "index_finger_tip");
    }
  }

  // Calculate dx and dy if both index tips are detected
  if (leftIndexTip && rightIndexTip) {
    let dx = rightIndexTip.x - leftIndexTip.x;
    let dy = rightIndexTip.y - leftIndexTip.y;
    return { dx, dy };
  } else {
    // Return null if one or both hands are not detected
    return null;
  }
}

function rightisPinched() {
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];

    // Check if the hand is the right hand (mirrored)
    if (hand.handedness === "Left") {
      let thumbTip = hand.keypoints.find(point => point.name === "thumb_tip");
      let indexTip = hand.keypoints.find(point => point.name === "index_finger_tip");

      if (thumbTip && indexTip) {
        let distance = dist(thumbTip.x, thumbTip.y, indexTip.x, indexTip.y);
        
        // If the distance between thumb tip and index tip is below 30 pixels, consider it a pinch
        if (distance < 30) {
          return true;
        }
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
    audioStarted = true;
  }
}

// Support for touch devices
function touchStarted() {
  if (!audioStarted) {
    userStartAudio();
    audioStarted = true;
  }
}