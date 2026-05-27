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
    noise.buffer = createNoiseBuffer(0.5);

    const bandpass = audioCtx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(420, now);

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.04, now + 0.06);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.40);

    noise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    // 2. Drag Weight (Faint, non-boomy floor contact)
    const thud = audioCtx.createOscillator();
    thud.type = 'triangle';

    const lowpass = audioCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(80, now);

    const thudGain = audioCtx.createGain();
    thudGain.gain.setValueAtTime(0, now);
    thudGain.gain.linearRampToValueAtTime(0.015, now + 0.04);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    thud.frequency.setValueAtTime(65, now);

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

  // Standalone Public Function 4: REFINED SLIDING DOOR
  function doSlidingDoor() {
    initAudio();
    const now = audioCtx.currentTime;
    const duration = 0.25; 

    // Slide Friction
    const noise = audioCtx.createBufferSource();
    noise.buffer = createNoiseBuffer(1.5); // Uses internal safe noise buffer generator

    const slideFilter = audioCtx.createBiquadFilter();
    slideFilter.type = 'bandpass';
    slideFilter.frequency.setValueAtTime(900, now);
    slideFilter.frequency.linearRampToValueAtTime(400, now + duration);
    slideFilter.Q.setValueAtTime(4, now);

    const slideGain = audioCtx.createGain();
    slideGain.gain.setValueAtTime(0, now);
    slideGain.gain.linearRampToValueAtTime(0.2, now + 0.04); 
    slideGain.gain.setValueAtTime(0.2, now + duration - 0.02);
    slideGain.gain.linearRampToValueAtTime(0.0, now + duration); 

    noise.connect(slideFilter);
    slideFilter.connect(slideGain);
    slideGain.connect(audioCtx.destination);

    // Slam Tonal Weight
    const slamOsc = audioCtx.createOscillator();
    slamOsc.type = 'square';

    const slamFilter = audioCtx.createBiquadFilter();
    slamFilter.type = 'lowpass';
    slamFilter.frequency.setValueAtTime(180, now + duration); 

    const slamGain = audioCtx.createGain();
    slamGain.gain.setValueAtTime(0, now);
    slamGain.gain.setValueAtTime(0, now + duration);
    slamGain.gain.linearRampToValueAtTime(0.6, now + duration + 0.002); 
    slamGain.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.15); 

    slamOsc.frequency.setValueAtTime(140, now + duration);
    slamOsc.frequency.exponentialRampToValueAtTime(50, now + duration + 0.08);

    slamOsc.connect(slamFilter);
    slamFilter.connect(slamGain);
    slamGain.connect(audioCtx.destination);

    // Slam Impact Noise
    const slamNoise = audioCtx.createBufferSource();
    slamNoise.buffer = createNoiseBuffer(1.5);

    const slamNoiseFilter = audioCtx.createBiquadFilter();
    slamNoiseFilter.type = 'bandpass';
    slamNoiseFilter.frequency.setValueAtTime(250, now + duration);
    slamNoiseFilter.Q.setValueAtTime(2, now + duration);

    const slamNoiseGain = audioCtx.createGain();
    slamNoiseGain.gain.setValueAtTime(0, now);
    slamNoiseGain.gain.setValueAtTime(0, now + duration);
    slamNoiseGain.gain.linearRampToValueAtTime(0.35, now + duration + 0.005);
    slamNoiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.22); 

    slamNoise.connect(slamNoiseFilter);
    slamNoiseFilter.connect(slamNoiseGain);
    slamNoiseGain.connect(audioCtx.destination);

    noise.start(now);
    noise.stop(now + duration);
    
    slamOsc.start(now + duration);
    slamOsc.stop(now + duration + 0.2);

    slamNoise.start(now + duration);
    slamNoise.stop(now + duration + 0.3);
  }

  // Standalone Public Function 5: SEPARATED HIT TONE & TRUE DYING GASP
  function doPlayerGotHit() {
    initAudio();
    const now = audioCtx.currentTime;

    // PARTS 1 & 2: THE INITIAL HIT (Vocal Tone)
    const voiceOsc = audioCtx.createOscillator();
    voiceOsc.type = 'sawtooth'; 
    
    voiceOsc.frequency.setValueAtTime(130, now);
    voiceOsc.frequency.linearRampToValueAtTime(95, now + 0.08);

    const formant1 = audioCtx.createBiquadFilter();
    formant1.type = 'bandpass';
    formant1.frequency.setValueAtTime(480, now);
    formant1.Q.setValueAtTime(8, now); 

    const formant2 = audioCtx.createBiquadFilter();
    formant2.type = 'bandpass';
    formant2.frequency.setValueAtTime(920, now);
    formant2.Q.setValueAtTime(6, now);

    const voiceGain = audioCtx.createGain();
    voiceGain.gain.setValueAtTime(0, now);
    
    // PART 1: Brief rise from no sound to maximum intensity
    voiceGain.gain.linearRampToValueAtTime(0.5, now + 0.025);
    
    // PART 2: Max Ugh holds briefly then drops away cleanly
    voiceGain.gain.setValueAtTime(0.5, now + 0.05);
    voiceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08); 

    voiceOsc.connect(formant1);
    voiceOsc.connect(formant2);
    formant1.connect(voiceGain);
    formant2.connect(voiceGain);
    voiceGain.connect(audioCtx.destination);

    // PART 3: THE DECAY (Sliding Door Air Movement Architecture)
    const breath = audioCtx.createBufferSource();
    breath.buffer = createNoiseBuffer(1.5);

    const breathFilter = audioCtx.createBiquadFilter();
    breathFilter.type = 'bandpass';
    
    // Mimicking the sliding door's exact frequency slide profile for realistic air movement
    breathFilter.frequency.setValueAtTime(850, now + 0.05); 
    breathFilter.frequency.linearRampToValueAtTime(350, now + 0.4);
    breathFilter.Q.setValueAtTime(3.5, now); 

    const breathGain = audioCtx.createGain();
    breathGain.gain.setValueAtTime(0, now);
    
    // The breath builds smoothly behind the max hit punch...
    breathGain.gain.linearRampToValueAtTime(0.15, now + 0.04);
    
    // ...then handles Part 3 independently as a soft, fading air trail
    breathGain.gain.setValueAtTime(0.15, now + 0.07);
    breathGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42); 

    breath.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(audioCtx.destination);

    // Independent node execution timelines
    voiceOsc.start(now);
    voiceOsc.stop(now + 0.09); // Shuts down voice early to keep the decay pure
    breath.start(now);
    breath.stop(now + 0.45);   // Soft trailing air release finishes out the sound
  }

  // Clean module export via shorthand property names
  return {
    doWalkingStep,
    doRunningStep,
    doShuffleStep,
    doSlidingDoor,
    doPlayerGotHit,
  };
})();
