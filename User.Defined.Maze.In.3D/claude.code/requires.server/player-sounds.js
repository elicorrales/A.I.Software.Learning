// GEMINI.3 player-sounds.js
let audioCtx = null;
let mainGainNode = null;
let alternatingFoot = false; 

// ── CENTRALIZED THROTTLING REGISTRY ──
const soundCooldowns = {
  step: 0.0,
  complain: 0.0
};

const COOLDOWN_INTERVALS = {
  step: 0.50,      
  complain: 0.70   // Perfectly timed to match the new elongated grunt duration
};

export const PlayerSoundSystem = {
  /**
   * Initializes a streamlined, direct audio graph with no delay loops.
   */
  init() {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    mainGainNode = audioCtx.createGain();
    mainGainNode.gain.setValueAtTime(0.6, audioCtx.currentTime); 
    mainGainNode.connect(audioCtx.destination);
  },

  /**
   * Centralized gateway throttling hub. 
   */
  requestSound(type) {
    if (soundCooldowns[type] > 0.0) return;

    if (type === 'step') {
      this.triggerFootstep();
    } else if (type === 'complain') {
      this.triggerComplaint();
    }

    soundCooldowns[type] = COOLDOWN_INTERVALS[type];
  },

  /**
   * Synthesizes an expressive, elongated vocal grunt with a subtle trailing exhale.
   */
  triggerComplaint() {
    const now = audioCtx.currentTime;
    const vocalDuration = 0.38; // Lengthened from 0.22 to let the "uh" breathe
    const totalDuration = 0.50; // Total timeline for the soft air fadeout

    // ── 1. THE IMPACT SWELL (Elongated Vocal Thud) ──
    const osc = audioCtx.createOscillator();
    const oscFilter = audioCtx.createBiquadFilter();
    const oscGain = audioCtx.createGain();

    osc.type = 'triangle'; 
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.20); // Slower frequency drop

    oscFilter.type = 'bandpass';
    oscFilter.frequency.setValueAtTime(260, now);
    oscFilter.Q.setValueAtTime(2.5, now); // Slightly widened for a richer vocal tone

    // Envelope: Rapid 50ms rise to peak, followed by a longer, heavy decay
    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.linearRampToValueAtTime(0.55, now + 0.05); 
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + vocalDuration);

    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(mainGainNode);

    // ── 2. THE ESCAPING AIR (Subtle Background Exhale) ──
    const noiseBufferSize = audioCtx.sampleRate * totalDuration;
    const noiseBuffer = audioCtx.createBuffer(1, noiseBufferSize, audioCtx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBufferSize; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    const airSource = audioCtx.createBufferSource();
    airSource.buffer = noiseBuffer;

    const airFilter = audioCtx.createBiquadFilter();
    airFilter.type = 'lowpass'; // Swapped to lowpass to cut harsh high-end friction hiss
    airFilter.frequency.setValueAtTime(600, now);
    airFilter.frequency.exponentialRampToValueAtTime(400, now + totalDuration);
    airFilter.Q.setValueAtTime(1.0, now);

    const airGain = audioCtx.createGain();
    // Heavily reduced peak volume (0.06) so it sits softly behind the vocal grunt
    airGain.gain.setValueAtTime(0.001, now);
    airGain.gain.linearRampToValueAtTime(0.06, now + 0.08); 
    airGain.gain.exponentialRampToValueAtTime(0.001, now + totalDuration); 

    airSource.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(mainGainNode);

    // Execution Lifecycles
    osc.start(now);
    osc.stop(now + vocalDuration);

    airSource.start(now);
    airSource.stop(now + totalDuration);
  },

  /**
   * Synthesizes a singular, heavy, low-passed physical thud against the floor.
   */
  triggerFootstep() {
    const now = audioCtx.currentTime;

    const noiseBufferSize = audioCtx.sampleRate * 0.10; 
    const noiseBuffer = audioCtx.createBuffer(1, noiseBufferSize, audioCtx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBufferSize; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(140, now); 
    noiseFilter.Q.setValueAtTime(1.5, now);

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(1.8, now); 
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08); 

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(mainGainNode);

    const subOsc = audioCtx.createOscillator();
    const subGain = audioCtx.createGain();
    subOsc.type = 'sine';
    
    const targetHz = alternatingFoot ? 82 : 78;
    alternatingFoot = !alternatingFoot;

    subOsc.frequency.setValueAtTime(targetHz, now);
    subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.11); 

    subGain.gain.setValueAtTime(1.3, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14); 

    subOsc.connect(subGain);
    subGain.connect(mainGainNode);

    noiseSource.start(now);
    noiseSource.stop(now + 0.10);
    subOsc.start(now);
    subOsc.stop(now + 0.15);
  },

  /**
   * Manages the countdown timers uniformly across all active channels.
   */
  update(deltaTime, didActuallyMove, tryingToMove) {
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    for (const soundType in soundCooldowns) {
      if (soundCooldowns[soundType] > 0.0) {
        soundCooldowns[soundType] -= deltaTime;
      }
    }

    if (didActuallyMove) {
      this.requestSound('step');
    } else if (tryingToMove) {
      this.requestSound('complain');
    }
  }
};
