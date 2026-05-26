// =========================================================================
// PROCEDURAL FOOTSTEP AUDIO ENGINE (DUMB AUDIO EMITTER)
// =========================================================================
window.MazeAudioController = (function() {
  let audioCtx = null;

  // Web Audio Context initialization safety guard
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  // Generates unique noise buffers for sole friction textures
  function createNoiseBuffer(duration) {
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Internal component used by the walking function
  function playWalkImpact(isHeel) {
    const now = audioCtx.currentTime;

    // 1. Texture (Noise friction)
    const noise = audioCtx.createBufferSource();
    noise.buffer = createNoiseBuffer(0.4);

    const highpass = audioCtx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(isHeel ? 900 : 700, now);

    const noiseGain = audioCtx.createGain();
    const attackTime = isHeel ? 0.010 : 0.002;
    const peakVolume = isHeel ? 0.13 : 0.07;
    const decayTime = isHeel ? 0.05 : 0.07;

    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(peakVolume, now + attackTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + attackTime + decayTime);

    noise.connect(highpass);
    highpass.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    // 2. Weight (Physical thud)
    const thud = audioCtx.createOscillator();
    thud.type = 'triangle';

    const lowpass = audioCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(isHeel ? 150 : 110, now);

    const thudGain = audioCtx.createGain();
    thudGain.gain.setValueAtTime(0, now);
    thudGain.gain.linearRampToValueAtTime(isHeel ? 0.22 : 0.12, now + 0.005);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + (isHeel ? 0.10 : 0.14));

    thud.frequency.setValueAtTime(isHeel ? 120 : 90, now);
    thud.frequency.exponentialRampToValueAtTime(isHeel ? 65 : 50, now + 0.09);

    thud.connect(lowpass);
    lowpass.connect(thudGain);
    thudGain.connect(audioCtx.destination);

    noise.start(now);
    noise.stop(now + 0.2);
    thud.start(now);
    thud.stop(now + 0.2);
  }

  // Standalone Public Function 1
  function doWalkingStep() {
    initAudio();
    playWalkImpact(true); // Heel strike click
    
    setTimeout(() => {
      playWalkImpact(false); // Toe roll tap
    }, 115);
  }

  // Standalone Public Function 2
  function doRunningStep() {
    initAudio();
    const now = audioCtx.currentTime;

    // 1. Texture (Dull lowpass slap noise)
    const noise = audioCtx.createBufferSource();
    noise.buffer = createNoiseBuffer(0.3);

    const lowpassNoise = audioCtx.createBiquadFilter();
    lowpassNoise.type = 'lowpass';
    lowpassNoise.frequency.setValueAtTime(600, now);

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.08, now + 0.005);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    noise.connect(lowpassNoise);
    lowpassNoise.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    // 2. Weight (Boomy floor thud)
    const thud = audioCtx.createOscillator();
    thud.type = 'triangle';

    const lowpassThud = audioCtx.createBiquadFilter();
    lowpassThud.type = 'lowpass';
    lowpassThud.frequency.setValueAtTime(120, now);

    const thudGain = audioCtx.createGain();
    thudGain.gain.setValueAtTime(0, now);
    thudGain.gain.linearRampToValueAtTime(0.42, now + 0.008);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    thud.frequency.setValueAtTime(100, now);
    thud.frequency.exponentialRampToValueAtTime(45, now + 0.1);

    thud.connect(lowpassThud);
    lowpassThud.connect(thudGain);
    thudGain.connect(audioCtx.destination);

    noise.start(now);
    noise.stop(now + 0.15);
    thud.start(now);
    thud.stop(now + 0.2);
  }

  // Clean module export via shorthand property names
  return {
    doWalkingStep,
    doRunningStep
  };
})();
