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

    // --- WALKING TEXTURE FILTER MODIFICATION ---
    // HEEL: Uses 900Hz for a crisp, sharp initial skeletal strike.
    // TOE:  Dropped from 700Hz to 250Hz to remove the snappy "snare drum" rattle,
    //       creating a warmer, muffled leather/brush sliding scuff.
    highpass.frequency.setValueAtTime(isHeel ? 400 : 250, now);

    const noiseGain = audioCtx.createGain();

    // --- WALKING TEXTURE TIMING & VOLUME MANIPULATION ---
    // HEEL: Slower attack (10ms) and louder peak (0.13) for structural impact force.
    // TOE:  Instant attack (2ms) and quieter peak (0.07) for trailing friction.
    const attackTime = isHeel ? 0.025 : 0.002;
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

    // --- WALKING WEIGHT FILTER MODIFICATION ---
    // HEEL: Changed from 150Hz to 120Hz to match the running filter depth.
    // TOE:  Kept at 110Hz.
    lowpass.frequency.setValueAtTime(isHeel ? 120 : 110, now);

    const thudGain = audioCtx.createGain();
    thudGain.gain.setValueAtTime(0, now);

    // --- WALKING WEIGHT TIMING & VOLUME MANIPULATION ---
    // HEEL: Cranked peak volume up from 0.22 to 0.42 to match the running impact force.
    // TOE:  Kept at 0.12.
    thudGain.gain.linearRampToValueAtTime(isHeel ? 0.42 : 0.12, now + 0.005);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + (isHeel ? 0.10 : 0.14));

    // --- WALKING WEIGHT PITCH SWEEP ---
    // HEEL: Changed from 120Hz->65Hz to a deeper 100Hz->45Hz curve to replicate the running boom.
    // TOE:  Kept at 90Hz->50Hz.
    thud.frequency.setValueAtTime(isHeel ? 100 : 90, now);
    thud.frequency.exponentialRampToValueAtTime(isHeel ? 45 : 50, now + 0.09);

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
    //doShuffleStep();

    initAudio();
    playWalkImpact(true); // Heel strike click

    setTimeout(() => {
      playWalkImpact(false); // Toe roll tap
    }, 115);

  }

  // Standalone Public Function 3
  function doShuffleStep() {
    initAudio();
    const now = audioCtx.currentTime;

    // 1. Drag Texture (Elongated white noise friction)
    const noise = audioCtx.createBufferSource();
    noise.buffer = createNoiseBuffer(0.5); // Slightly crisper duration

    const bandpass = audioCtx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(420, now); // Raised from 300 to 420 to remove low-end mud

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.04, now + 0.06); // Halved volume from 0.08 to 0.04
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.40);

    noise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    // 2. Drag Weight (Faint, non-boomy floor contact)
    const thud = audioCtx.createOscillator();
    thud.type = 'triangle';

    const lowpass = audioCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(80, now); // Lowered ceiling to trap lingering rumble

    const thudGain = audioCtx.createGain();
    thudGain.gain.setValueAtTime(0, now);
    thudGain.gain.linearRampToValueAtTime(0.015, now + 0.04); // Dropped significantly from 0.05 for a paper-thin presence
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    thud.frequency.setValueAtTime(65, now); // Subtle low pitch tracking

    thud.connect(lowpass);
    lowpass.connect(thudGain);
    thudGain.connect(audioCtx.destination);

    noise.start(now);
    noise.stop(now + 0.45);
    thud.start(now);
    thud.stop(now + 0.3);
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
