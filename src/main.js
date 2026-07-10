/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Main Game Orchestrator & Loop
 * ==========================================================================
 */

import { Player } from './player.js';
import { MechanicalEye } from './boss/eye.js';
import { CrystalTitan } from './boss/titan.js';
import { ClockworkConductor } from './boss/conductor.js';
import { SolarPhoenix } from './boss/phoenix.js';
import { ShadowWeaver } from './boss/weaver.js';
import { VoidSingularity } from './boss/singularity.js';
import { AlchemicalCauldron } from './boss/cauldron.js';
import { audio } from './audio.js';
import { particles, screenShake, hitStop } from './particle.js';
import { debug } from './debug.js';

class GameApp {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.cx = 0; // center coordinates
    this.cy = 0;
    
    // Entities
    this.player = null;
    this.boss = null;
    this.bossEye = null;
    this.bossTitan = null;
    this.bossConductor = null;
    this.bossPhoenix = null;
    this.bossWeaver = null;
    this.bossSingularity = null;
    this.bossCauldron = null;
    
    // Timers
    this.lastTime = 0;
    this.stateTimer = 0;
    
    // States: 'MENU', 'PLAYING', 'GAMEOVER', 'VICTORY'
    this.state = 'MENU';
    
    // Input parameters
    this.inputPressed = false;
    this.pressStartTime = 0;
    this.hasInteracted = false;
  }

  init() {
    window.gameAppInstance = this; // Register globally for collision query bounds
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Setup virtual resolution
    this.canvas.width = 960;
    this.canvas.height = 540;
    this.cx = this.canvas.width / 2;
    this.cy = this.canvas.height / 2;
    
    // Instantiate entities
    this.player = new Player(this.cx, this.cy);
    this.bossEye = new MechanicalEye(this.cx, this.cy);
    this.bossTitan = new CrystalTitan(this.cx, this.cy);
    this.bossConductor = new ClockworkConductor(this.cx, this.cy);
    this.bossPhoenix = new SolarPhoenix(this.cx, this.cy);
    this.bossWeaver = new ShadowWeaver(this.cx, this.cy);
    this.bossSingularity = new VoidSingularity(this.cx, this.cy);
    this.bossCauldron = new AlchemicalCauldron(this.cx, this.cy);
    
    // Load saved campaign level
    this.currentLevel = parseInt(localStorage.getItem('orbital_bound_campaign_level') || '1', 10);
    if (isNaN(this.currentLevel) || this.currentLevel < 1 || this.currentLevel > 7) {
      this.currentLevel = 1;
    }
    this.setLevelBoss(this.currentLevel);
    
    // Setup components
    debug.init();
    this.setupEventListeners();
    
    // Hook audio beats to boss visual scales
    audio.registerBeatCallback((beat, time) => {
      if (this.boss) {
        this.boss.visualScale = 1.15;
      }
    });
    
    // Load menu audio first before showing the menu
    this.loadMenuAudio();
    
    // Start game loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  setLevelBoss(level) {
    this.currentLevel = level;
    localStorage.setItem('orbital_bound_campaign_level', level.toString());
    
    if (level === 1) this.boss = this.bossEye;
    else if (level === 2) this.boss = this.bossTitan;
    else if (level === 3) this.boss = this.bossConductor;
    else if (level === 4) this.boss = this.bossPhoenix;
    else if (level === 5) this.boss = this.bossWeaver;
    else if (level === 6) this.boss = this.bossSingularity;
    else if (level === 7) this.boss = this.bossCauldron;
  }

  loadMenuAudio() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingTitle = document.getElementById('loading-title');
    const loadingSubtitle = document.getElementById('loading-subtitle');
    const loadingBarInner = document.getElementById('loading-bar-inner');
    const menuOverlay = document.getElementById('menu-overlay');

    if (loadingOverlay) loadingOverlay.classList.add('active');
    if (menuOverlay) menuOverlay.classList.remove('active');
    if (loadingTitle) loadingTitle.textContent = "DOWNLOADING SYSTEM AUDIO";
    if (loadingSubtitle) loadingSubtitle.textContent = "INITIALIZING SOUNDTRACK TELEMETRY...";
    if (loadingBarInner) loadingBarInner.style.width = "0%";

    audio.onLoadProgress = (url, percent) => {
      if (loadingBarInner) loadingBarInner.style.width = `${percent}%`;
    };

    audio.loadAudioFile('soundtracks/menu.mp3')
      .then(() => {
        setTimeout(() => {
          if (loadingOverlay) loadingOverlay.classList.remove('active');
          if (menuOverlay) menuOverlay.classList.add('active');
          this.state = 'MENU';
          audio.playTrack('soundtracks/menu.mp3', 100);
        }, 300);
      })
      .catch((err) => {
        console.error("Failed to load menu audio", err);
        if (loadingOverlay) loadingOverlay.classList.remove('active');
        if (menuOverlay) menuOverlay.classList.add('active');
        this.state = 'MENU';
      });
  }

  loadBossAudio(level, onComplete) {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingTitle = document.getElementById('loading-title');
    const loadingSubtitle = document.getElementById('loading-subtitle');
    const loadingBarInner = document.getElementById('loading-bar-inner');
    const menuOverlay = document.getElementById('menu-overlay');
    const gameoverOverlay = document.getElementById('gameover-overlay');
    const victoryOverlay = document.getElementById('victory-overlay');

    if (loadingOverlay) loadingOverlay.classList.add('active');
    if (menuOverlay) menuOverlay.classList.remove('active');
    if (gameoverOverlay) gameoverOverlay.classList.remove('active');
    if (victoryOverlay) victoryOverlay.classList.remove('active');
    
    if (loadingTitle) loadingTitle.textContent = `LOADING SECTOR ${level}`;
    if (loadingSubtitle) loadingSubtitle.textContent = "RETRIEVING ENCRYPTED AUDIO DATA...";
    if (loadingBarInner) loadingBarInner.style.width = "0%";

    audio.onLoadProgress = (url, percent) => {
      if (loadingBarInner) loadingBarInner.style.width = `${percent}%`;
    };

    const trackUrl = `soundtracks/level${level}.mp3`;
    audio.loadAudioFile(trackUrl)
      .then(() => {
        setTimeout(() => {
          if (loadingOverlay) loadingOverlay.classList.remove('active');
          onComplete();
        }, 300);
      })
      .catch((err) => {
        console.error("Failed to load boss audio: " + trackUrl, err);
        if (loadingOverlay) loadingOverlay.classList.remove('active');
        onComplete();
      });
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.resizeCanvas());
    this.resizeCanvas();
    
    // --- Input Hooks (Mouse & Keypresses) ---
    
    const handlePress = (e) => {
      if (e.repeat) return;
      
      this.enableAudioContext();
      
      // Menu overlay transition
      if (this.state === 'MENU') {
        this.startGame();
        return;
      }
      
      // Fast bypass overlay countdowns
      if (this.state === 'GAMEOVER') {
        this.stateTimer = 0;
        return;
      }
      
      if (this.state === 'VICTORY') {
        this.stateTimer = 0;
        return;
      }
      
      if (this.state !== 'PLAYING' || this.player.state === 'DEAD') return;
      
      this.inputPressed = true;
      this.pressStartTime = performance.now();
      this.player.press();
    };

    const handleRelease = (e) => {
      if (!this.inputPressed) return;
      if (this.state !== 'PLAYING' || this.player.state === 'DEAD') return;
      
      this.inputPressed = false;
      const duration = performance.now() - this.pressStartTime;
      this.player.release(duration);
    };

    // Keyboard bindings
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handlePress(e);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleRelease(e);
      }
    });

    // Mouse click and touch bounds
    const playArea = document.getElementById('game-container');
    playArea.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('#debug-panel')) return;
      handlePress(e);
    });

    window.addEventListener('mouseup', (e) => {
      handleRelease(e);
    });

    // Touch support for mobile devices
    playArea.addEventListener('touchstart', (e) => {
      if (e.target.closest('#debug-panel')) return;
      e.preventDefault();
      handlePress(e);
    }, { passive: false });

    playArea.addEventListener('touchend', (e) => {
      handleRelease(e);
    });

    // Debug panel toggle
    document.getElementById('debug-btn-toggle-boss').addEventListener('click', (e) => {
      e.stopPropagation(); // Avoid triggering screen interactions
      this.toggleBossDebug();
    });

    // Enable audio context triggers
    window.addEventListener('click', () => this.enableAudioContext(), { once: true });
    window.addEventListener('keydown', () => this.enableAudioContext(), { once: true });
  }

  resizeCanvas() {
    // Canvas resizing helper
  }

  enableAudioContext() {
    if (this.hasInteracted) return;
    this.hasInteracted = true;
    
    audio.init();
    
    const prompt = document.getElementById('audio-prompt');
    if (prompt) {
      prompt.classList.add('fade-out');
      setTimeout(() => prompt.remove(), 500);
    }
  }

  toggleBossDebug() {
    let nextLvl = this.currentLevel + 1;
    if (nextLvl > 7) nextLvl = 1;
    this.setLevelBoss(nextLvl);
    
    if (this.state === 'PLAYING') {
      this.startGame();
    }
  }

  startGame() {
    this.enableAudioContext();
    audio.stopMusic();
    
    this.loadBossAudio(this.currentLevel, () => {
      this.state = 'PLAYING';
      
      this.player.reset();
      this.boss.reset();
      particles.clear();
      
      let startBPM = 100;
      if (this.boss === this.bossTitan) startBPM = 80;
      else if (this.boss === this.bossConductor) startBPM = 110;
      else if (this.boss === this.bossPhoenix) startBPM = 125;
      else if (this.boss === this.bossWeaver) startBPM = 115;
      else if (this.boss === this.bossSingularity) startBPM = 130;
      else if (this.boss === this.bossCauldron) startBPM = 105;
      
      audio.playTrack(`soundtracks/level${this.currentLevel}.mp3`, startBPM);
    });
  }

  triggerGameOver() {
    this.state = 'GAMEOVER';
    this.stateTimer = 3.0; // 3 seconds timer
    audio.stopMusic();
    document.getElementById('gameover-overlay').classList.add('active');
  }

  triggerVictory() {
    this.state = 'VICTORY';
    this.stateTimer = 3.0;
    audio.stopMusic();
    
    const titleEl = document.querySelector('#victory-overlay h1');
    const subtitleEl = document.getElementById('victory-subtitle');
    const promptEl = document.getElementById('victory-prompt');
    
    if (this.currentLevel === 7) {
      if (titleEl) titleEl.textContent = "CAMPAIGN COMPLETE";
      if (subtitleEl) subtitleEl.textContent = "YOU CONQUERED ALL THREATS!";
      if (promptEl) promptEl.innerHTML = "REBOOTING CAMPAIGN IN <span id='victory-countdown'>3</span>...";
    } else {
      if (titleEl) titleEl.textContent = "TARGET ELIMINATED";
      if (subtitleEl) subtitleEl.textContent = `SECTOR ${this.currentLevel} CLEARED`;
      if (promptEl) promptEl.innerHTML = `PROCEEDING TO SECTOR ${this.currentLevel + 1} IN <span id='victory-countdown'>3</span>...`;
    }
    
    document.getElementById('victory-overlay').classList.add('active');
  }

  loop(timestamp) {
    // Delta time calculations
    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    
    // Clamp dt to prevent frame lag issues breaking collisions
    dt = Math.min(dt, 0.1);
    
    this.update(dt);
    this.draw();
    
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    // 1. Process screen shake and hit stop timers
    screenShake.update(dt);
    
    const isFrozen = hitStop.update(dt);
    
    // Update particle calculations (even during freeze)
    particles.update(dt);
    
    if (this.state === 'PLAYING') {
      // 2. Query debug updates
      debug.update(dt, this.player, this.boss);
      
      if (!isFrozen) {
        // Run game logic only when not frozen
        this.player.update(dt, this.boss);
        this.boss.update(dt, this.player);
        
        // Sync music with active boss actions dynamically
        if (this.boss.state === 'DEAD' || this.boss.state === 'TRANSITION') {
          audio.setIntensityState('RECOVERY');
        } else if (this.boss.state === 'TELEGRAPH') {
          audio.setIntensityState('TELEGRAPH');
        } else if (this.boss.state === 'ATTACK') {
          if (this.boss.targetAttack && this.boss.targetAttack.startsWith('WOW_')) {
            audio.setIntensityState('WOW');
          } else {
            audio.setIntensityState('ATTACK');
          }
        } else if (this.boss.state === 'RECOVERY') {
          audio.setIntensityState('RECOVERY');
        } else {
          audio.setIntensityState('IDLE');
        }
        
        // Check game-over conditions
        if (this.player.state === 'DEAD') {
          this.triggerGameOver();
        }
        
        // Check victory conditions
        if (this.boss.state === 'DEAD' && this.boss.stateTimer <= 0) {
          this.triggerVictory();
        }
      }
    } else if (this.state === 'GAMEOVER') {
      this.stateTimer -= dt;
      const countEl = document.getElementById('gameover-countdown');
      if (countEl) countEl.textContent = Math.max(0, Math.ceil(this.stateTimer));
      
      if (this.stateTimer <= 0) {
        document.getElementById('gameover-overlay').classList.remove('active');
        this.startGame();
      }
    } else if (this.state === 'VICTORY') {
      this.stateTimer -= dt;
      const countEl = document.getElementById('victory-countdown');
      if (countEl) countEl.textContent = Math.max(0, Math.ceil(this.stateTimer));
      
      if (this.stateTimer <= 0) {
        document.getElementById('victory-overlay').classList.remove('active');
        if (this.currentLevel < 7) {
          this.setLevelBoss(this.currentLevel + 1);
          this.startGame();
        } else {
          this.setLevelBoss(1);
          document.getElementById('menu-overlay').classList.add('active');
          this.state = 'MENU';
        }
      }
    }
  }

  draw() {
    this.ctx.save();
    
    // Clear canvas with base background
    this.ctx.fillStyle = '#07080b';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Apply viewport screen shakes
    screenShake.applyTransform(this.ctx);
    
    // Draw background neon ring references (visual depth)
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(this.cx, this.cy, 220, 0, Math.PI * 2); // player orbit path indicator
    this.ctx.stroke();
    this.ctx.restore();
    
    // Render entities
    if (this.state === 'PLAYING' || this.state === 'GAMEOVER' || this.state === 'VICTORY') {
      this.boss.draw(this.ctx);
      this.player.draw(this.ctx);
    }
    
    // Render particles
    particles.draw(this.ctx);
    
    // Draw debug hitboxes (if option enabled)
    if (this.state === 'PLAYING') {
      debug.drawHitbox(this.ctx, this.player.x, this.player.y, this.player.radius, '#39ff14');
      debug.drawHitbox(this.ctx, this.boss.cx, this.boss.cy, this.boss.radius * this.boss.visualScale, '#ff0055');
      
      // Draw boss specific warning indicators
      if (this.boss === this.bossEye && this.boss.laserActive) {
        if (this.boss.targetAttack === 'WOW_GAZE_OF_DOOM') {
          // Half circle wedge
        } else {
          // Sweeping Laser line hitbox
          const lx = this.cx + Math.cos(this.boss.currentLaserAngle) * 500;
          const ly = this.cy + Math.sin(this.boss.currentLaserAngle) * 500;
          debug.drawLaserHitbox(this.ctx, this.cx, this.cy, lx, ly, 12, '#39ff14');
        }
      }
    }
    
    this.ctx.restore();
  }
}

// Instantiate and start app on window load
window.addEventListener('DOMContentLoaded', () => {
  const app = new GameApp();
  app.init();
});
