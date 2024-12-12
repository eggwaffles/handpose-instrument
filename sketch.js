let handPose;
let video;
let hands = [];

let oscillators = [];
let playing = false;
let instrument = 0;
let audioStarted = false;
let graphicsLayer;

let drumSounds = {}; 

function preload() {
  handPose = ml5.handPose();

  drumSounds = {
    hihat: 'drumset/hihat.mp3',
    snare: 'drumset/snare.mp3',
    kickdrum: 'drumset/kickdrum.mp3',
    floortom: 'drumset/floortom.mp3',
  };
}

function setup() {
  let canvas = createCanvas(640, 480);
  canvas.parent('sketch-container');
  graphicsLayer = createGraphics(640, 480);

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  handPose.detectStart(video, gotHands);

  let frequencies = [130.81, 155.56, 196.00];
  for (let i = 0; i < frequencies.length; i++) {
    let osc = new p5.Oscillator('sine');
    osc.freq(frequencies[i]);
    osc.amp(0);
    osc.start();
    oscillators.push(osc);
  }

  textSize(24);
  textAlign(CENTER, CENTER);
}

function draw() {
  translate(width, 0);
  scale(-1.0, 1.0);
  image(video, 0, 0, width, height);

  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    for (let j = 0; j < hand.keypoints.length; j++) {
      let keypoint = hand.keypoints[j];
      fill(255, 255, 255);
      noStroke();
      circle(keypoint.x, keypoint.y, 10);
    }
  }

  if (isLeftPalmOpen()) {
    instrument = 1; // Synth
  } else if (!isLeftPalmOpen()) {
    instrument = 2; // Percussion
  } else {
    instrument = 0; // No instrument
  }

  // synth on instrument 1
  if (instrument === 1) {
    playSynth();
  } else {
    stopSynth();
  }

  // beat on instrument 2
  if (instrument === 2 && rightisPinched() && !isPinching) {
    playDrumSound();
    isPinching = true;
  } else if (instrument !== 2 || !rightisPinched()) {
    isPinching = false;
  }

  if (!audioStarted) {
    graphicsLayer.clear();
    translate(width, 0);
    scale(-1.0, 1.0);
    graphicsLayer.fill(255, 255, 255);
    graphicsLayer.textSize(24);
    graphicsLayer.textAlign(CENTER, CENTER);
    graphicsLayer.text('Click to start', width / 2, height / 2);
  } else {
    graphicsLayer.clear();
  }

  image(graphicsLayer, 0, 0);
}

function playSynth() {
  let indexDistance = calculateIndexTipDistance();
  let fingersUp = countRightHandFingersUp();

  let baseFrequencies = [261.63, 329.63, 392.00];

  let waveType = 'sine';

  if (indexDistance !== null) {
    let { dx, dy } = indexDistance;

    let volume = map(-dx, 80, 500, 0.1, 0.7);
    volume = constrain(volume, 0, 0.7);

    let frequencyOffset = map(-dy, -200, 200, -40, 40);
    frequencyOffset = constrain(frequencyOffset, -40, 40);

    for (let i = 0; i < oscillators.length; i++) {
      oscillators[i].setType(waveType);
      let adjustedFrequency = baseFrequencies[i % baseFrequencies.length] + frequencyOffset;

      oscillators[i].freq(adjustedFrequency);
      oscillators[i].amp(volume, 0.1);
    }
  }

  if (!playing) {
    playing = true;
  }
}

function stopSynth() {
  if (playing) {
    for (let i = 0; i < oscillators.length; i++) {
      oscillators[i].amp(0, 0.8);
    }
    playing = false;
  }
}

function playDrumSound() {
  let quadrant = getRightHandQuadrant();

  let soundFile;
  if (quadrant === 1) {
    soundFile = drumSounds.hihat; // Quadrant 1: Hi-hat
  } else if (quadrant === 2) {
    soundFile = drumSounds.snare; // Quadrant 2: Snare
  } else if (quadrant === 3) {
    soundFile = drumSounds.floortom; // Quadrant 3: Floor tom
  } else if (quadrant === 4) {
    soundFile = drumSounds.kickdrum; // Quadrant 4: Kick drum
  }

  if (soundFile) {
    let newSound = loadSound(soundFile, function () {
      newSound.play(); // Play the new instance of the sound
    });
  }
}

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

    if (hand.handedness === "Right") {
      leftIndexTip = hand.keypoints.find(point => point.name === "index_finger_tip");
    } else if (hand.handedness === "Left") {
      rightIndexTip = hand.keypoints.find(point => point.name === "index_finger_tip");
    }
  }

  if (leftIndexTip && rightIndexTip) {
    let dx = rightIndexTip.x - leftIndexTip.x;
    let dy = rightIndexTip.y - leftIndexTip.y;
    return { dx, dy };
  } else {
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

function getRightHandQuadrant() {
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];

    // Check if the hand is the right hand
    if (hand.handedness === "Left") {
      let indexTip = hand.keypoints.find(point => point.name === "index_finger_tip"); // Use index finger tip as a reference point

      if (indexTip) {
        let x = indexTip.x;
        let y = indexTip.y;

        // Determine the quadrant
        if (x < width / 2 && y < height / 2) {
          return 2; // Quadrant 2 (Top Right)
        } else if (x >= width / 2 && y < height / 2) {
          return 1; // Quadrant 1 (Top Left)
        } else if (x < width / 2 && y >= height / 2) {
          return 4; // Quadrant 4 (Bottom Right)
        } else if (x >= width / 2 && y >= height / 2) {
          return 3; // Quadrant 3 (Bottom Left)
        }
      }
    }
  }

  return 0; // Return 0 if the right hand is not detected
}

function gotHands(results) {
  hands = results;
}

function mousePressed() {
  if (!audioStarted) {
    userStartAudio();
    audioStarted = true;
  }
}

function touchStarted() {
  if (!audioStarted) {
    userStartAudio();
    audioStarted = true;
  }
}


document.getElementById("startTutorial").addEventListener("click", startTutorial);

function startTutorial() {
  const TUTORIAL_STEP_DELAY = 7000; // Constant delay for each step
  let step = 0;

  const tutorialSteps = [
    { text: "Welcome to the Virtual Hand Instrument!", condition: () => true },
    {
      text: "Raise your left hand with an open palm to activate Synth Mode.",
      condition: () => isLeftPalmOpen(),
    },
    {
      text: "Raise your right hand and move it around to play the synthesizer.",
      condition: () => countRightHandFingersUp() > 0,
    },
    { 
      text: "Move your right hand horizontally to adjust volume and vertically to modify pitch.", 
      condition: () => true 
    },
    {
      text: "Close your left hand into a fist to activate Drum Mode.",
      condition: () => !isLeftPalmOpen(),
    },
    {
      text: "Pinch your right index and thumb to play a beat.",
      condition: () => rightisPinched(),
    },
    {
      text: "Pinch your right hand in the top left of the screen to play the Hi-hat.",
      condition: () => getRightHandQuadrant() === 1 && rightisPinched(),
    },
    {
      text: "Pinch your right hand in the top right to play the Snare.",
      condition: () => getRightHandQuadrant() === 2 && rightisPinched(),
    },
    {
      text: "Pinch your right hand in bottom left to play the Floor Tom.",
      condition: () => getRightHandQuadrant() === 3 && rightisPinched(),
    },
    {
      text: "Pinch your right hand in bottom right to play the Kick Drum.",
      condition: () => getRightHandQuadrant() === 4 && rightisPinched(),
    },
    { 
      text: "Experiment with gestures and movements to create your unique music!", 
      condition: () => true 
    },
    { 
      text: "Enjoy your session!", 
      condition: () => true 
    },
  ];

  const tutorialText = document.getElementById("tutorialText");
  const loadingBar = document.getElementById("loadingBar");

  function resetLoadingBar() {
    loadingBar.style.transition = "none";
    loadingBar.style.width = "0%";
  }

  function startLoadingBar() {
    loadingBar.style.transition = `width ${TUTORIAL_STEP_DELAY}ms linear`;
    loadingBar.style.width = "100%";
  }

  function nextStep() {
    if (step >= tutorialSteps.length) {
      tutorialText.innerText = "";
      resetLoadingBar();
      return;
    }

    const currentStep = tutorialSteps[step];
    tutorialText.innerText = currentStep.text;

    if (currentStep.condition) {
      const checkCondition = setInterval(() => {
        if (currentStep.condition()) {
          clearInterval(checkCondition);
          resetLoadingBar(); // Reset before starting
          startLoadingBar();

          setTimeout(() => {
            step++;
            resetLoadingBar();
            nextStep();
          }, TUTORIAL_STEP_DELAY);
        }
      }, 100);
    }
  }

  nextStep();
}
