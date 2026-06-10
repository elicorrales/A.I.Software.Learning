// GEMINI.3 ball-sounds.js
import { GameInterface } from './interface.js';

let audioCtx = null;
let noiseSource = null;
let lfoSource = null;
let lowpassFilter = null;
let scrapeFilter = null;
let rollingGainMod = null;
let mainGainNode = null;

export const BallSoundSystem = {
  /**
   * Initializes a heavy, physical stone-rolling procedural sound graph.
   */
  init() {
    if (audioCtx) return; 

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // 1. GENERATE DEEP BROWNIAN (RED) NOISE FOR HEAVY CORE MASS
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Accumulator loop dampens high frequencies naturally, producing a deep floor rumble
      data[i] = (lastOut + (0.06 * white)) / 1.06;
      lastOut = data[i];
      data[i] *= 5.5; // Compensate for low-end attenuation volume drop
      
      // Procedurally inject microscopic surface anomalies/stone cracks
      if (Math.random() < 0.0015) {
        data[i] += (Math.random() * 2 - 1) * 0.35;
      }
    }

    noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    // 2. FIXED RESONANT FILTERS (Prevents the sweeping wind whistle)
    // Deep structural rumble filter
    lowpassFilter = audioCtx.createBiquadFilter();
    lowpassFilter.type = 'lowpass';
    lowpassFilter.frequency.setValueAtTime(110, audioCtx.currentTime);
    lowpassFilter.Q.setValueAtTime(2.5, audioCtx.currentTime);

    // Stone-on-stone friction grit filter (Captures the contact scrape)
    scrapeFilter = audioCtx.createBiquadFilter();
    scrapeFilter.type = 'bandpass';
    scrapeFilter.frequency.setValueAtTime(450, audioCtx.currentTime);
    scrapeFilter.Q.setValueAtTime(1.8, audioCtx.currentTime);

    // 3. ROTATIONAL CHURN MODULATION (Turns a constant hiss into a rolling object)
    rollingGainMod = audioCtx.createGain();
    rollingGainMod.gain.setValueAtTime(0.65, audioCtx.currentTime);

    lfoSource = audioCtx.createOscillator();
    lfoSource.type = 'sine';
    lfoSource.frequency.setValueAtTime(6.8, audioCtx.currentTime); // 6.8 Hz rotational frequency

    const lfoGain = audioCtx.createGain();
    lfoGain.gain.setValueAtTime(0.28, audioCtx.currentTime); // Volumetric texture ripple depth

    // Connect LFO modulation pipeline straight into the structural gain layer
    lfoSource.connect(lfoGain);
    lfoGain.connect(rollingGainMod.gain);

    // 4. MAIN DISTANCE ATTENUATOR NODE
    mainGainNode = audioCtx.createGain();
    mainGainNode.gain.setValueAtTime(0, audioCtx.currentTime);

    // Assembly Line Pipeline:
    // Core Noise -> Low Rumble & High Scrape Filters -> Churn Modulator -> Distance Volume -> Destination
    noiseSource.connect(lowpassFilter);
    lowpassFilter.connect(rollingGainMod);
    
    noiseSource.connect(scrapeFilter);
    const scrapeGain = audioCtx.createGain();
    scrapeGain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    scrapeFilter.connect(scrapeGain);
    scrapeGain.connect(rollingGainMod);

    rollingGainMod.connect(mainGainNode);
    mainGainNode.connect(audioCtx.destination);

    // Ignite procedural generation components simultaneously
    noiseSource.start(0);
    lfoSource.start(0);
  },

  /**
   * Tracks structural boundaries and scales overall volume without sweeping core pitches.
   */
  update() {
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const context = GameInterface.getBirdsEyeContext();
    const player = context.player;
    const ball = context.ball;
    const maxDistance = context.constants.hallLength;

    const inSameCorridor = !player.inTunnel && !ball.inTunnel && Math.floor(player.hall) === Math.floor(ball.hall);
    const inSameTunnelPipeline = player.inTunnel && ball.inTunnel && player.tunnelId === ball.tunnelId;

    if ((inSameCorridor || inSameTunnelPipeline) && ball.isAlive) {
      const deltaZ = Math.abs(player.localZ - ball.localZ);
      
      let targetVolume = 1.0 - (deltaZ / maxDistance);
      targetVolume = Math.max(0.0, Math.min(1.0, targetVolume));

      // Quadratic falloff provides a crisp geometric volume curve over distance
      const dynamicGain = Math.pow(targetVolume, 2) * 0.75; 

      // Apply fixed low-end muffling only when far away, keeping core frequencies anchored
      const distanceMuffleIdx = 85 + (targetVolume * 35);

      mainGainNode.gain.setTargetAtTime(dynamicGain, audioCtx.currentTime, 0.08);
      lowpassFilter.frequency.setTargetAtTime(distanceMuffleIdx, audioCtx.currentTime, 0.12);
    } else {
      // Return smoothly to total silence if spaces separate
      mainGainNode.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.06);
    }
  }
};
