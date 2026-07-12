/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Procedural Retro Sound Engine (Web Audio API)
 * ==========================================================================
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bpm = 100;
    this.isPlayingMusic = false;
    this.loadedBuffers = {};
    this.musicSource = null;
    this.beatIntervalId = null;
    this.onLoadProgress = null;
    
    // Charge SFX oscillator & state
    this.chargeOsc = null;
    this.chargeLfo = null;
    this.chargeGain = null;
    
    // Laser SFX state
    this.laserOsc = null;
    this.laserLfo = null;
    this.laserGain = null;
    
    // Listeners for beat-sync visualization
    this.beatCallbacks = [];
    
    // Dynamic intensity state for music syncing
    this.intensityState = 'IDLE'; // 'IDLE', 'TELEGRAPH', 'ATTACK', 'RECOVERY', 'WOW'
    
    // Store tracks scheduled to play before the AudioContext is resumed/gesture-enabled
    this.pendingTrack = null;

    // Volume parameters and persistence
    this.musicVolume = parseFloat(localStorage.getItem('orbital_bound_music_vol') ?? '0.7');
    this.sfxVolume = parseFloat(localStorage.getItem('orbital_bound_sfx_vol') ?? '0.7');
    this.musicGain = null;
    this.sfxGain = null;
  }

  init() {
    if (this.ctx) return;
    
    // Create AudioContext (standard or webkit fallback)
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime); // Master volume limit
    this.masterGain.connect(this.ctx.destination);

    // Sub-gain nodes for Music and SFX volume control
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      return this.ctx.resume().then(() => {
        if (this.pendingTrack) {
          const { url, bpm } = this.pendingTrack;
          this.pendingTrack = null;
          this.playTrack(url, bpm);
        }
      });
    } else if (this.pendingTrack) {
      const { url, bpm } = this.pendingTrack;
      this.pendingTrack = null;
      this.playTrack(url, bpm);
    }
    return Promise.resolve();
  }

  setMusicVolume(vol) {
    // Clamp to 0..1
    this.musicVolume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('orbital_bound_music_vol', this.musicVolume.toString());
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
  }

  setSfxVolume(vol) {
    // Clamp to 0..1
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('orbital_bound_sfx_vol', this.sfxVolume.toString());
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  setBPM(bpm) {
    this.bpm = bpm;
  }

  setIntensityState(state) {
    this.intensityState = state;
  }

  // --- Retro Sound Effect Synthesis ---

  /**
   * Generates a noise buffer for explosions and high-hats
   */
  createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Sound: Quick retro pitch arpeggio on dash release
   */
  playDash() {
    this.init();
    this.resume();
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
    
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    osc.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Sound: Continuous rising charge oscillator
   */
  startCharge() {
    this.init();
    this.resume();
    if (this.chargeOsc) return;

    const now = this.ctx.currentTime;
    
    // Main pitch oscillator
    this.chargeOsc = this.ctx.createOscillator();
    this.chargeOsc.type = 'sawtooth';
    this.chargeOsc.frequency.setValueAtTime(100, now);
    
    // Vibrato (LFO)
    this.chargeLfo = this.ctx.createOscillator();
    this.chargeLfo.frequency.setValueAtTime(12, now); // Vibrato speed
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(15, now); // Vibrato depth (Hz)
    
    // Volume envelope
    this.chargeGain = this.ctx.createGain();
    this.chargeGain.gain.setValueAtTime(0.01, now);
    this.chargeGain.gain.exponentialRampToValueAtTime(0.3, now + 0.1);
    
    // Connections
    this.chargeLfo.connect(lfoGain);
    lfoGain.connect(this.chargeOsc.frequency);
    
    this.chargeOsc.connect(this.chargeGain);
    this.chargeGain.connect(this.sfxGain);
    
    this.chargeLfo.start(now);
    this.chargeOsc.start(now);
  }

  updateChargePitch(chargePercent) {
    if (!this.chargeOsc) return;
    const now = this.ctx.currentTime;
    
    // Rise from 100Hz to 600Hz as charge grows
    const targetFreq = 100 + chargePercent * 500;
    this.chargeOsc.frequency.setTargetAtTime(targetFreq, now, 0.05);
    
    // Increase volume/intensity slightly
    const targetVolume = 0.1 + chargePercent * 0.25;
    this.chargeGain.gain.setTargetAtTime(targetVolume, now, 0.05);
  }

  stopCharge() {
    if (!this.chargeOsc) return;
    const now = this.ctx.currentTime;
    
    const osc = this.chargeOsc;
    const lfo = this.chargeLfo;
    const gain = this.chargeGain;
    
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    
    setTimeout(() => {
      try {
        osc.stop();
        lfo.stop();
      } catch (e) {}
    }, 100);
    
    this.chargeOsc = null;
    this.chargeLfo = null;
    this.chargeGain = null;
  }

  /**
   * Sound: Heavy impact (noise explosion + retro pulse)
   */
  playHit() {
    this.init();
    this.resume();
    
    const now = this.ctx.currentTime;
    
    // 1. Noise Burst for crunch
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(600, now);
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    
    // 2. Heavy low-pitched pulse
    const synth = this.ctx.createOscillator();
    synth.type = 'triangle';
    synth.frequency.setValueAtTime(200, now);
    synth.frequency.exponentialRampToValueAtTime(60, now + 0.15);
    
    const synthGain = this.ctx.createGain();
    synthGain.gain.setValueAtTime(0.6, now);
    synthGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    synth.connect(synthGain);
    synthGain.connect(this.sfxGain);
    
    noise.start(now);
    synth.start(now);
    
    noise.stop(now + 0.2);
    synth.stop(now + 0.2);
  }

  /**
   * Sound: Player hurt (grunting retro drop)
   */
  playHurt() {
    this.init();
    this.resume();
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(40, now + 0.3);
    
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    osc.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start(now);
    osc.stop(now + 0.3);
  }

  /**
   * Sound: Player heal (rising retro chime)
   */
  playHealSFX() {
    this.init();
    this.resume();
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.25);
    
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    
    osc.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start(now);
    osc.stop(now + 0.26);
  }

  /**
   * Sound: Giant explosion for boss deaths
   */
  playBossExplode() {
    this.init();
    this.resume();
    
    const now = this.ctx.currentTime;
    
    // Low frequency rumbler
    const lowOsc = this.ctx.createOscillator();
    lowOsc.type = 'sawtooth';
    lowOsc.frequency.setValueAtTime(100, now);
    lowOsc.frequency.linearRampToValueAtTime(10, now + 1.2);
    
    const lowGain = this.ctx.createGain();
    lowGain.gain.setValueAtTime(0.8, now);
    lowGain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
    
    lowOsc.connect(lowGain);
    lowGain.connect(this.sfxGain);
    
    // Massive noise crash
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 1.0);
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
    
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    
    lowOsc.start(now);
    noise.start(now);
    
    lowOsc.stop(now + 1.3);
    noise.stop(now + 1.3);
  }

  // --- Beat Sequencer & Music Engine (MP3 buffer playback) ---

  loadAudioFile(url) {
    if (this.loadedBuffers[url]) return Promise.resolve(this.loadedBuffers[url]);
    
    return new Promise((resolve, reject) => {
      this.init();
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      
      xhr.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = (e.loaded / e.total) * 100;
          if (this.onLoadProgress) {
            this.onLoadProgress(url, percent);
          }
        }
      };
      
      xhr.onload = () => {
        if (xhr.status === 200) {
          this.ctx.decodeAudioData(xhr.response, (buffer) => {
            this.loadedBuffers[url] = buffer;
            resolve(buffer);
          }, (err) => {
            reject(new Error("Audio decode failed: " + err));
          });
        } else {
          reject(new Error("XHR failed with status: " + xhr.status));
        }
      };
      
      xhr.onerror = () => reject(new Error("Network error loading audio"));
      xhr.send();
    });
  }

  registerBeatCallback(cb) {
    this.beatCallbacks.push(cb);
  }

  triggerBeatEvent(time) {
    this.beatCallbacks.forEach(cb => cb(0, time));
  }

  playTrack(url, bpm) {
    this.init();
    
    // If context is suspended (blocked by browser autoplay), store as pending and return.
    if (this.ctx && this.ctx.state === 'suspended') {
      this.pendingTrack = { url, bpm };
      return;
    }
    
    this.stopMusic();
    
    const buffer = this.loadedBuffers[url];
    if (!buffer) {
      console.warn("Audio buffer not loaded in advance: " + url);
      return;
    }
    
    this.bpm = bpm;
    this.isPlayingMusic = true;
    
    this.musicSource = this.ctx.createBufferSource();
    this.musicSource.buffer = buffer;
    this.musicSource.loop = true;
    this.musicSource.connect(this.musicGain);
    this.musicSource.start(0);
    
    // Start beat callbacks simulation based on BPM
    let beat = 0;
    const intervalMs = (60.0 / bpm) * 1000;
    
    const tick = () => {
      if (!this.isPlayingMusic) return;
      const now = this.ctx.currentTime;
      this.triggerBeatEvent(now);
      beat = (beat + 1) % 16;
    };
    
    tick(); // first tick
    this.beatIntervalId = setInterval(tick, intervalMs);
  }

  crossfadeTrack(url, bpm, fadeDuration = 2.0) {
    this.init();
    
    if (this.ctx && this.ctx.state === 'suspended') {
      this.pendingTrack = { url, bpm };
      return;
    }
    
    const buffer = this.loadedBuffers[url];
    if (!buffer) {
      console.warn("Audio buffer not loaded in advance: " + url);
      return;
    }
    
    // Fade out current track
    const oldSource = this.musicSource;
    const oldGain = this.musicGain;
    
    // Create new music gain and source
    const newGain = this.ctx.createGain();
    newGain.gain.setValueAtTime(0, this.ctx.currentTime);
    newGain.gain.linearRampToValueAtTime(this.musicVolume, this.ctx.currentTime + fadeDuration);
    newGain.connect(this.masterGain);
    
    if (oldSource && oldGain) {
      oldGain.gain.cancelScheduledValues(this.ctx.currentTime);
      oldGain.gain.setValueAtTime(oldGain.gain.value, this.ctx.currentTime);
      oldGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fadeDuration);
      
      setTimeout(() => {
        try { oldSource.stop(); } catch(e) {}
        oldGain.disconnect();
      }, fadeDuration * 1000 + 100);
    }
    
    this.musicGain = newGain; // replace current musicGain reference
    
    this.bpm = bpm;
    this.isPlayingMusic = true;
    
    this.musicSource = this.ctx.createBufferSource();
    this.musicSource.buffer = buffer;
    this.musicSource.loop = true;
    this.musicSource.connect(this.musicGain);
    this.musicSource.start(0);
    
    // restart beat tracking
    if (this.beatIntervalId) {
      clearInterval(this.beatIntervalId);
    }
    let beat = 0;
    const intervalMs = (60.0 / bpm) * 1000;
    const tick = () => {
      if (!this.isPlayingMusic) return;
      const now = this.ctx.currentTime;
      this.triggerBeatEvent(now);
      beat = (beat + 1) % 16;
    };
    tick();
    this.beatIntervalId = setInterval(tick, intervalMs);
  }

  stopMusic() {
    this.isPlayingMusic = false;
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch (e) {
        // Might be already stopped or not started
      }
      this.musicSource = null;
    }
    if (this.beatIntervalId) {
      clearInterval(this.beatIntervalId);
      this.beatIntervalId = null;
    }
  }

  playWarningBeep() {
    this.init();
    this.resume();
    const now = this.ctx.currentTime;
    
    // Play 3 rapid retro warning alarm beeps
    for (let i = 0; i < 3; i++) {
      const time = now + i * 0.18;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, time);
      
      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
      
      osc.connect(gain);
      gain.connect(this.sfxGain);
      
      osc.start(time);
      osc.stop(time + 0.09);
    }
  }

  playLaserStart() {
    this.init();
    this.resume();
    if (this.laserOsc) return; // Already playing
    
    const now = this.ctx.currentTime;
    this.laserOsc = this.ctx.createOscillator();
    this.laserOsc.type = 'sawtooth';
    this.laserOsc.frequency.setValueAtTime(110, now);
    
    // High-speed frequency modulation (rumble wobble)
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(45, now);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(35, now);
    
    lfo.connect(lfoGain);
    lfoGain.connect(this.laserOsc.frequency);
    
    // Bandpass filter to make it sound sharp and sweeping
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.Q.setValueAtTime(3.0, now);
    
    this.laserGain = this.ctx.createGain();
    this.laserGain.gain.setValueAtTime(0.01, now);
    this.laserGain.gain.linearRampToValueAtTime(0.25, now + 0.15); // Fade in
    
    this.laserOsc.connect(filter);
    filter.connect(this.laserGain);
    this.laserGain.connect(this.sfxGain);
    
    lfo.start(now);
    this.laserOsc.start(now);
    
    this.laserLfo = lfo;
  }

  playLaserStop() {
    if (!this.laserOsc) return;
    const now = this.ctx.currentTime;
    
    const oscNode = this.laserOsc;
    const lfoNode = this.laserLfo;
    const gainNode = this.laserGain;
    
    if (gainNode) {
      try {
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      } catch (e) {}
    }
    
    setTimeout(() => {
      try {
        if (oscNode) oscNode.stop();
        if (lfoNode) lfoNode.stop();
      } catch (e) {}
    }, 100);
    
    this.laserOsc = null;
    this.laserLfo = null;
    this.laserGain = null;
  }

  playNoteHitSFX() {
    this.init();
    this.resume();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(700 + Math.random() * 200, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  playClickSFX() {
    this.init();
    this.resume();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playUpgradeSelectedSFX() {
    this.init();
    this.resume();
    const now = this.ctx.currentTime;
    [440, 554, 659].forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.08);
      gain.gain.setValueAtTime(0.2, now + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + index * 0.08);
      osc.stop(now + index * 0.08 + 0.26);
    });
  }

  playPowerUpSFX() {
    this.init();
    this.resume();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(960, now + 0.7);
    
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + 0.7);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start(now);
    osc.stop(now + 0.71);
  }

  playWaveSpawn() {
    this.init();
    this.resume();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.28);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.29);
  }
}

export const audio = new AudioEngine();
