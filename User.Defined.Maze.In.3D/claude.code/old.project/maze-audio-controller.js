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

  let lastStepTimestamp = 0;
  let lastHitTimestamp = 0;
  let lastDoorTimestamp = 0;

  // Rolling ball persistent sound nodes
  let ballRollSource     = null;
  let ballRollGainNode   = null;
  let ballRollOscSource  = null;
  let ballRollOscGain    = null;
  let ballRollLfo        = null;

  function handleMovementAudioCadence(whichSound) {
    const now = performance.now();

    if (whichSound === 'walk' || whichSound === 'run') {
      const interval = whichSound === 'run' ? 330 : 530;
      if (now - lastStepTimestamp < interval) return;
      lastStepTimestamp = now;
      if (whichSound === 'run') doRunningStep(); else doWalkingStep();
    } else if (whichSound === 'ugh') {
      if (now - lastHitTimestamp < 500) return;
      lastHitTimestamp = now;
      doPlayerGotHit();
    } else if (whichSound === 'door') {
      if (now - lastDoorTimestamp < 600) return;
      lastDoorTimestamp = now;
      doSlidingDoor();
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

  // Internal component used by the walking function — ORIGINAL (commented out)
  /*
  function playWalkImpact(isHeel) {
    const now = audioCtx.currentTime;

    const noise = audioCtx.createBufferSource();
    noise.buffer = createNoiseBuffer(0.4);

    const highpass = audioCtx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(isHeel ? 400 : 250, now);

    const noiseGain = audioCtx.createGain();
    const attackTime = isHeel ? 0.025 : 0.002;
    const peakVolume = isHeel ? 0.13 : 0.07;
    const decayTime = isHeel ? 0.05 : 0.07;
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(peakVolume, now + attackTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + attackTime + decayTime);

    noise.connect(highpass);
    highpass.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    const thud = audioCtx.createOscillator();
    thud.type = 'triangle';

    const lowpass = audioCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(isHeel ? 120 : 110, now);

    const thudGain = audioCtx.createGain();
    thudGain.gain.setValueAtTime(0, now);
    thudGain.gain.linearRampToValueAtTime(isHeel ? 0.42 : 0.12, now + 0.005);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + (isHeel ? 0.10 : 0.14));

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

  function doWalkingStep_ORIGINAL() {
    initAudio();
    playWalkImpact(true);
    setTimeout(() => { playWalkImpact(false); }, 115);
  }
  */

  // Standalone Public Function 1 — single footfall on a hard floor
  function doWalkingStep() {
    initAudio();
    const now = audioCtx.currentTime;

    // Surface click — the hard contact of sole on floor
    const click = audioCtx.createBufferSource();
    click.buffer = createNoiseBuffer(0.08);

    const clickBp = audioCtx.createBiquadFilter();
    clickBp.type = 'bandpass';
    clickBp.frequency.setValueAtTime(1400, now);
    clickBp.Q.setValueAtTime(3, now);

    const clickGain = audioCtx.createGain();
    clickGain.gain.setValueAtTime(0, now);
    clickGain.gain.linearRampToValueAtTime(0.16, now + 0.003);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

    click.connect(clickBp);
    clickBp.connect(clickGain);
    clickGain.connect(audioCtx.destination);

    // Weight thud — body mass settling into the step
    const thud = audioCtx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(88, now);
    thud.frequency.exponentialRampToValueAtTime(40, now + 0.07);

    const thudLp = audioCtx.createBiquadFilter();
    thudLp.type = 'lowpass';
    thudLp.frequency.setValueAtTime(170, now);

    const thudGain = audioCtx.createGain();
    thudGain.gain.setValueAtTime(0, now);
    thudGain.gain.linearRampToValueAtTime(0.26, now + 0.005);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    thud.connect(thudLp);
    thudLp.connect(thudGain);
    thudGain.connect(audioCtx.destination);

    click.start(now); click.stop(now + 0.045);
    thud.start(now);  thud.stop(now + 0.10);
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

  // Standalone Public Function 5: ORIGINAL (commented out — sounds fart-like due to long breath sweep)
  /*
  function doPlayerGotHit() {
    initAudio();
    const now = audioCtx.currentTime;

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
    voiceGain.gain.linearRampToValueAtTime(0.5, now + 0.025);
    voiceGain.gain.setValueAtTime(0.5, now + 0.05);
    voiceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    voiceOsc.connect(formant1);
    voiceOsc.connect(formant2);
    formant1.connect(voiceGain);
    formant2.connect(voiceGain);
    voiceGain.connect(audioCtx.destination);

    const breath = audioCtx.createBufferSource();
    breath.buffer = createNoiseBuffer(1.5);

    const breathFilter = audioCtx.createBiquadFilter();
    breathFilter.type = 'bandpass';
    breathFilter.frequency.setValueAtTime(850, now + 0.05);
    breathFilter.frequency.linearRampToValueAtTime(350, now + 0.4);
    breathFilter.Q.setValueAtTime(3.5, now);

    const breathGain = audioCtx.createGain();
    breathGain.gain.setValueAtTime(0, now);
    breathGain.gain.linearRampToValueAtTime(0.15, now + 0.04);
    breathGain.gain.setValueAtTime(0.15, now + 0.07);
    breathGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    breath.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(audioCtx.destination);

    voiceOsc.start(now);
    voiceOsc.stop(now + 0.09);
    breath.start(now);
    breath.stop(now + 0.45);
  }
  */

  // Standalone Public Function 5: UGH — gut-punch / head-hit grunt
  function doPlayerGotHit() {
    initAudio();
    const now = audioCtx.currentTime;

    // Layer 1: Physical body thud — the hit landing
    const thud = audioCtx.createOscillator();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(110, now);
    thud.frequency.exponentialRampToValueAtTime(38, now + 0.05);

    const thudLp = audioCtx.createBiquadFilter();
    thudLp.type = 'lowpass';
    thudLp.frequency.setValueAtTime(220, now);

    const thudGain = audioCtx.createGain();
    thudGain.gain.setValueAtTime(0, now);
    thudGain.gain.linearRampToValueAtTime(0.48, now + 0.006);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    thud.connect(thudLp);
    thudLp.connect(thudGain);
    thudGain.connect(audioCtx.destination);

    // Layer 2: Impact crack — percussive attack texture
    const crack = audioCtx.createBufferSource();
    crack.buffer = createNoiseBuffer(0.15);

    const crackBp = audioCtx.createBiquadFilter();
    crackBp.type = 'bandpass';
    crackBp.frequency.setValueAtTime(380, now);
    crackBp.Q.setValueAtTime(2.5, now);

    const crackGain = audioCtx.createGain();
    crackGain.gain.setValueAtTime(0, now);
    crackGain.gain.linearRampToValueAtTime(0.22, now + 0.004);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);

    crack.connect(crackBp);
    crackBp.connect(crackGain);
    crackGain.connect(audioCtx.destination);

    // Layer 3: Vocal grunt — "UGH" (effort vowel, pitch drops under impact)
    const voice = audioCtx.createOscillator();
    voice.type = 'sawtooth';
    voice.frequency.setValueAtTime(158, now + 0.012);
    voice.frequency.linearRampToValueAtTime(95, now + 0.22);

    // F1 ~550 Hz: stressed "U" — jaw clenched under impact, higher than relaxed speech
    const f1 = audioCtx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.setValueAtTime(550, now);
    f1.Q.setValueAtTime(8, now);

    // F2 ~1100 Hz: second formant for "U" vowel
    const f2 = audioCtx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.setValueAtTime(1100, now);
    f2.Q.setValueAtTime(6, now);

    const voiceGain = audioCtx.createGain();
    voiceGain.gain.setValueAtTime(0, now);
    voiceGain.gain.linearRampToValueAtTime(0.40, now + 0.018);
    voiceGain.gain.setValueAtTime(0.40, now + 0.055);
    voiceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    voice.connect(f1);
    voice.connect(f2);
    f1.connect(voiceGain);
    f2.connect(voiceGain);
    voiceGain.connect(audioCtx.destination);

    // Layer 4: Short glottal close-off — the "gh" at the end, tight and brief
    const ghNoise = audioCtx.createBufferSource();
    ghNoise.buffer = createNoiseBuffer(0.3);

    const ghBp = audioCtx.createBiquadFilter();
    ghBp.type = 'bandpass';
    ghBp.frequency.setValueAtTime(820, now + 0.08);
    ghBp.frequency.linearRampToValueAtTime(620, now + 0.24);
    ghBp.Q.setValueAtTime(6, now);

    const ghGain = audioCtx.createGain();
    ghGain.gain.setValueAtTime(0, now);
    ghGain.gain.linearRampToValueAtTime(0.065, now + 0.10);
    ghGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    ghNoise.connect(ghBp);
    ghBp.connect(ghGain);
    ghGain.connect(audioCtx.destination);

    thud.start(now);       thud.stop(now + 0.08);
    crack.start(now);      crack.stop(now + 0.055);
    voice.start(now + 0.012); voice.stop(now + 0.26);
    ghNoise.start(now + 0.08); ghNoise.stop(now + 0.28);
  }

  // Starts a looping rolling sound representing a heavy ball on a hard floor
  function startBallRollingSound() {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    stopBallRollingSound();

    const now = audioCtx.currentTime;
    const sr  = audioCtx.sampleRate;

    // Looping white noise buffer (2 seconds)
    const loopBuffer = audioCtx.createBuffer(1, sr * 2, sr);
    const loopData   = loopBuffer.getChannelData(0);
    for (let i = 0; i < loopData.length; i++) loopData[i] = Math.random() * 2 - 1;

    ballRollSource        = audioCtx.createBufferSource();
    ballRollSource.buffer = loopBuffer;
    ballRollSource.loop   = true;

    // Single lowpass at 200 Hz — strips all hissing, keeps only the low rumble body
    const rumble = audioCtx.createBiquadFilter();
    rumble.type  = 'lowpass';
    rumble.frequency.setValueAtTime(200, now);

    // Triangle oscillator at 90 Hz — tonal floor-contact thud (audible on most speakers)
    ballRollOscSource      = audioCtx.createOscillator();
    ballRollOscSource.type = 'triangle';
    ballRollOscSource.frequency.setValueAtTime(90, now);

    // Fixed mix level for the oscillator relative to the noise rumble
    ballRollOscGain = audioCtx.createGain();
    ballRollOscGain.gain.setValueAtTime(0.55, now);

    // LFO at 4 Hz — rhythmic rolling thump, like contact points hitting the floor
    ballRollLfo      = audioCtx.createOscillator();
    ballRollLfo.type = 'sine';
    ballRollLfo.frequency.setValueAtTime(4, now);

    const lfoDepth = audioCtx.createGain();
    lfoDepth.gain.setValueAtTime(0.42, now); // ±0.42

    // Shared pulse gate: DC 0.55 ± 0.42 → swells 0.13 → 0.97 and back, 4x/sec
    const pulseGain = audioCtx.createGain();
    pulseGain.gain.setValueAtTime(0.55, now);
    ballRollLfo.connect(lfoDepth);
    lfoDepth.connect(pulseGain.gain);

    // Master distance gain — the only node updated each frame
    ballRollGainNode = audioCtx.createGain();
    ballRollGainNode.gain.setValueAtTime(0, now);

    // Graph: [noise->rumble] + [osc->oscGain] -> pulseGain -> masterGain -> output
    ballRollSource.connect(rumble);
    rumble.connect(pulseGain);

    ballRollOscSource.connect(ballRollOscGain);
    ballRollOscGain.connect(pulseGain);

    pulseGain.connect(ballRollGainNode);
    ballRollGainNode.connect(audioCtx.destination);

    ballRollSource.start(now);
    ballRollOscSource.start(now);
    ballRollLfo.start(now);
  }

  // Called every animation frame — swells masterGain as ball closes in on player
  function updateBallRollingSoundVolume(ballZ) {
    if (!audioCtx || !ballRollGainNode) return;
    const safeZ = Math.max(0.15, ballZ);
    // ~0.06 at z=11 (faint), ~0.75 at z=0.5 (loud)
    const vol = Math.min(0.85, 0.55 / Math.pow(safeZ + 0.2, 0.9));
    const now = audioCtx.currentTime;
    ballRollGainNode.gain.linearRampToValueAtTime(vol, now + 0.05);
  }

  // Fades out and cleans up all rolling sound nodes
  function stopBallRollingSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    if (ballRollGainNode) {
      ballRollGainNode.gain.cancelScheduledValues(now);
      ballRollGainNode.gain.linearRampToValueAtTime(0, now + 0.15);
    }
    const srcRef = ballRollSource;
    const oscRef = ballRollOscSource;
    const lfoRef = ballRollLfo;
    ballRollSource   = null;
    ballRollOscSource = null;
    ballRollLfo      = null;
    ballRollGainNode = null;
    ballRollOscGain  = null;
    setTimeout(() => {
      if (srcRef) try { srcRef.stop(); } catch(e) {}
      if (oscRef) try { oscRef.stop(); } catch(e) {}
      if (lfoRef) try { lfoRef.stop(); } catch(e) {}
    }, 250);
  }

  // Clean module export via shorthand property names
  return {
    handleMovementAudioCadence,
    startBallRollingSound,
    updateBallRollingSoundVolume,
    stopBallRollingSound,
//    doWalkingStep,
//    doRunningStep,
//   doShuffleStep,
//    doSlidingDoor,
//    doPlayerGotHit,
  };
})();
