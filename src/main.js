/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Main Game Orchestrator & Loop
 * ==========================================================================
 */

import { Player } from './player.js';
import { MechanicalEye } from './boss/eye.js';
import { CrystalTitan } from './boss/titan.js';
import { ClockworkConductor } from './boss/conductor.js';
import { ShadowWeaver } from './boss/weaver.js';
import { VoidSingularity } from './boss/singularity.js';
import { Sigma } from './boss/sigma.js';
import { audio } from './audio.js';
import { particles, screenShake, hitStop } from './particle.js';
import { debug } from './debug.js';

class TreasureChest {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 35;
    this.color = '#ff9d00';
    this.isBroken = false;
    this.pulse = 0;
  }
  
  update(dt) {
    this.pulse += 3 * dt;
  }
  
  draw(ctx) {
    if (this.isBroken) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    
    const pulseScale = 1.0 + Math.sin(this.pulse) * 0.08;
    ctx.scale(pulseScale, pulseScale);
    
    // Draw outer golden ring glow
    ctx.strokeStyle = 'rgba(255, 157, 0, 0.15)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 15, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw Chest body
    ctx.strokeStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 15;
    ctx.lineWidth = 3.5;
    
    // Chest base box
    ctx.strokeRect(-24, -10, 48, 24);
    
    // Chest lid (half circle)
    ctx.beginPath();
    ctx.arc(0, -10, 24, Math.PI, 0);
    ctx.stroke();
    
    // Keyhole / lock plate
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.fillRect(-5, -2, 10, 8);
    
    // Keyhole dot
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, 2, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

const UPGRADES_LIST = [
  { id: 'orbitSpeed', name: 'Hyper Drive', desc: 'Accelerates orbit and punch force', diff: '+25% Orbit Speed & +2 Dash Damage', icon: '⚡' },
  { id: 'chargeSpeed', name: 'Quantum Capacitor', desc: 'Overclocks battery charge and engine', diff: '+30% Charge Rate & +20% Dash Speed', icon: '🔋' },
  { id: 'dashSpeed', name: 'Chrono Thrusters', desc: 'Improves dash timing and shields', diff: '+40% Dash Speed & +1 Max HP', icon: '🚀' },
  { id: 'maxHp', name: 'Reinforced Hull', desc: 'Extra hearts with capacitors', diff: '+1 Max HP & +25% Charge Rate', icon: '💖' },
  { id: 'bonusDamage', name: 'Vortex Matrix', desc: 'Amplifies dash power and i-frames', diff: '+5 Dash Damage & +0.4s Invincibility', icon: '💥' },
  { id: 'bonusInvincibility', name: 'Nano Shielding', desc: 'Extends protection and thrusters', diff: '+0.6s Invincibility & +15% Orbit Speed', icon: '🛡️' }
];

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
    this.bossWeaver = null;
    this.bossSingularity = null;
    this.bossSigma = null;
    this.chest = null;
    
    // Timers
    this.lastTime = 0;
    this.stateTimer = 0;
    
    // States: 'MENU', 'PLAYING', 'GAMEOVER', 'VICTORY', 'CHEST_LOOT', 'LOADING'
    this.state = 'MENU';
    
    // Input parameters
    this.inputPressed = false;
    this.pressStartTime = 0;
    this.hasInteracted = false;
    
    // Upgrades campaign inventory
    this.upgrades = {};
    this.selectedUpgrade = null;
    this.superDebugActive = false;
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
    this.bossWeaver = new ShadowWeaver(this.cx, this.cy);
    this.bossSingularity = new VoidSingularity(this.cx, this.cy);
    this.bossSigma = new Sigma(this.cx, this.cy);
    
    // Load saved campaign level and upgrades
    this.loadJourney();
    this.setLevelBoss(this.currentLevel);
    this.player.applyUpgrades(this.upgrades);
    this.updateInventoryUI();
    
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

  saveJourney() {
    localStorage.setItem('orbital_bound_campaign_level', this.currentLevel.toString());
    localStorage.setItem('orbital_bound_upgrades', JSON.stringify(this.upgrades || {}));
  }

  loadJourney() {
    this.currentLevel = parseInt(localStorage.getItem('orbital_bound_campaign_level') || '1', 10);
    if (isNaN(this.currentLevel) || this.currentLevel < 1 || this.currentLevel > 6) {
      this.currentLevel = 1;
    }
    try {
      this.upgrades = JSON.parse(localStorage.getItem('orbital_bound_upgrades') || '{}');
    } catch (e) {
      this.upgrades = {};
    }
  }

  setLevelBoss(level) {
    this.currentLevel = level;
    localStorage.setItem('orbital_bound_campaign_level', level.toString());
    
    if (level === 1) this.boss = this.bossEye;
    else if (level === 2) this.boss = this.bossTitan;
    else if (level === 3) this.boss = this.bossConductor;
    else if (level === 4) this.boss = this.bossWeaver;
    else if (level === 5) this.boss = this.bossSingularity;
    else if (level === 6) this.boss = this.bossSigma;

    const sectorSelect = document.getElementById('debug-sector-select');
    if (sectorSelect) {
      sectorSelect.value = level.toString();
    }
    
    const menuSectorSelect = document.getElementById('menu-sector-select');
    if (menuSectorSelect) {
      menuSectorSelect.value = level.toString();
    }
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

      // Loot overlay proceed shortcut
      if (this.state === 'CHEST_LOOT' && this.chest && this.chest.isBroken) {
        if (this.selectedUpgrade) {
          this.proceedToNextSector();
        }
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
      
      if ((this.state !== 'PLAYING' && !(this.state === 'CHEST_LOOT' && this.chest && !this.chest.isBroken)) || this.player.state === 'DEAD') return;
      
      this.inputPressed = true;
      this.pressStartTime = performance.now();
      this.player.press();
    };

    const handleRelease = (e) => {
      if (!this.inputPressed) return;
      if ((this.state !== 'PLAYING' && !(this.state === 'CHEST_LOOT' && this.chest && !this.chest.isBroken)) || this.player.state === 'DEAD') return;
      
      this.inputPressed = false;
      const duration = performance.now() - this.pressStartTime;
      this.player.release(duration);
    };

    // Keyboard bindings
    let debugSequence = '';
    let killSequence = '';
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      
      // Trace cheat sequence: lkj (insta charge)
      if (['l', 'k', 'j'].includes(key)) {
        debugSequence += key;
        if (debugSequence.endsWith('lkjlkjlkj')) {
          this.toggleSuperDebugCheat();
          debugSequence = '';
        }
      } else {
        debugSequence = '';
      }

      // Trace cheat sequence: mnb (instant kill boss)
      if (['m', 'n', 'b'].includes(key)) {
        killSequence += key;
        if (killSequence.endsWith('mnbmnbmnbmnbmnb')) {
          if (this.state === 'PLAYING' && this.boss && this.boss.state !== 'DEAD') {
            this.boss.takeDamage(9999);
            audio.playBossExplode();
            particles.spawnExplosion(this.boss.cx, this.boss.cy, '#ff0033', 50, 15);
          }
          killSequence = '';
        }
      } else {
        killSequence = '';
      }

      if (e.code === 'Space') {
        e.preventDefault();
        
        if (this.state === 'CHEST_LOOT' && this.chest && this.chest.isBroken) {
          if (!e.repeat) {
            // Start hold confirmation on current selection (do not cycle on keydown!)
            this.isHoldingSpace = true;
            this.spaceHoldTime = 0;
          }
        } else if (this.state === 'ENDING_STORY') {
          if (this.endingStage === 'GEOMETRY_CARDS' && !e.repeat) {
            this.advanceGeometryCard();
          } else if (this.endingStage === 'DIALOGUE' && this.activeDialogueChoices && this.activeDialogueChoices.length > 0) {
            if (!e.repeat) {
              this.isHoldingSpaceEnding = true;
              this.spaceHoldTimeEnding = 0;
            }
          }
        } else {
          handlePress(e);
        }
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        this.togglePause();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        
        if (this.state === 'CHEST_LOOT' && this.chest && this.chest.isBroken) {
          // If they release before confirming, cycle selection to the next card!
          if (this.isHoldingSpace) {
            this.isHoldingSpace = false;
            this.spaceHoldTime = 0;
            const progressInner = document.getElementById('loot-hold-bar-inner');
            if (progressInner) progressInner.style.width = '0%';
            
            // Cycle card selection index
            this.lootSelectedIndex = (this.lootSelectedIndex + 1) % 3;
            this.selectedUpgrade = this.lootChoices[this.lootSelectedIndex].id;
            
            // Update visual cards selection styling
            const cards = document.querySelectorAll('.loot-card');
            cards.forEach((c, idx) => {
              if (idx === this.lootSelectedIndex) c.classList.add('selected');
              else c.classList.remove('selected');
            });
          }
        } else if (this.state === 'ENDING_STORY') {
          if (this.endingStage === 'DIALOGUE' && this.isHoldingSpaceEnding) {
            this.isHoldingSpaceEnding = false;
            if (this.spaceHoldTimeEnding < 1.0) {
              this.spaceHoldTimeEnding = 0;
              const barInner = document.getElementById('dialogue-hold-bar-inner');
              if (barInner) barInner.style.width = '0%';
              
              this.dialogueSelectedChoiceIndex = (this.dialogueSelectedChoiceIndex + 1) % this.activeDialogueChoices.length;
              this.updateDialogueChoiceSelectionVisuals();
              audio.playNoteHitSFX();
            }
          }
        } else {
          handleRelease(e);
        }
      }
    });

    // Mouse click and touch bounds
    const playArea = document.getElementById('game-container');
    playArea.addEventListener('mousedown', (e) => {
      // Ignore clicks on menus, debug buttons, sliders, or action panels
      if (e.button !== 0 || 
          e.target.closest('#debug-panel') || 
          e.target.closest('.settings-panel') || 
          e.target.closest('.pause-hud-btn') || 
          e.target.closest('.pause-actions')) return;
      handlePress(e);
    });

    // Start game directly from welcome overlay background/text clicks
    const menuOverlayEl = document.getElementById('menu-overlay');
    if (menuOverlayEl) {
      menuOverlayEl.addEventListener('mousedown', (e) => {
        if (this.state === 'MENU') {
          if (!e.target.closest('.settings-panel') && !e.target.closest('.control-help') && !e.target.closest('.menu-sector-picker-container')) {
            e.stopPropagation();
            this.enableAudioContext();
            this.startGame();
          }
        }
      });
    }

    window.addEventListener('mouseup', (e) => {
      handleRelease(e);
    });

    // Touch support for mobile devices
    playArea.addEventListener('touchstart', (e) => {
      if (e.target.closest('#debug-panel') || 
          e.target.closest('.settings-panel') || 
          e.target.closest('.pause-hud-btn') || 
          e.target.closest('.pause-actions')) return;
      e.preventDefault();
      handlePress(e);
    }, { passive: false });

    playArea.addEventListener('touchend', (e) => {
      handleRelease(e);
    });

    // Debug sector selector dropdown
    const sectorSelect = document.getElementById('debug-sector-select');
    if (sectorSelect) {
      sectorSelect.addEventListener('change', (e) => {
        const selectedLvl = parseInt(e.target.value);
        this.setLevelBoss(selectedLvl);
        if (this.state === 'PLAYING' || this.state === 'CHEST_LOOT' || this.state === 'GAMEOVER') {
          this.state = 'PLAYING';
          this.startGame();
        }
      });
      sectorSelect.value = this.currentLevel.toString();
    }

    // Welcome start menu sector selector dropdown
    const menuSectorSelect = document.getElementById('menu-sector-select');
    if (menuSectorSelect) {
      menuSectorSelect.addEventListener('change', (e) => {
        const selectedLvl = parseInt(e.target.value);
        this.setLevelBoss(selectedLvl);
      });
      menuSectorSelect.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      menuSectorSelect.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      menuSectorSelect.value = this.currentLevel.toString();
    }
    const menuPickerContainer = document.querySelector('.menu-sector-picker-container');
    if (menuPickerContainer) {
      menuPickerContainer.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      menuPickerContainer.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Volume Control Sliders
    const musicVolSlider = document.getElementById('music-volume');
    const sfxVolSlider = document.getElementById('sfx-volume');
    const musicVolPauseSlider = document.getElementById('music-volume-pause');
    const sfxVolPauseSlider = document.getElementById('sfx-volume-pause');

    const updateMusicVol = (val) => {
      audio.setMusicVolume(val);
      if (musicVolSlider) musicVolSlider.value = val;
      if (musicVolPauseSlider) musicVolPauseSlider.value = val;
      const text = `${Math.round(val * 100)}%`;
      const valEl = document.getElementById('music-volume-val');
      const valPauseEl = document.getElementById('music-volume-pause-val');
      if (valEl) valEl.textContent = text;
      if (valPauseEl) valPauseEl.textContent = text;
    };

    const updateSfxVol = (val) => {
      audio.setSfxVolume(val);
      if (sfxVolSlider) sfxVolSlider.value = val;
      if (sfxVolPauseSlider) sfxVolPauseSlider.value = val;
      const text = `${Math.round(val * 100)}%`;
      const valEl = document.getElementById('sfx-volume-val');
      const valPauseEl = document.getElementById('sfx-volume-pause-val');
      if (valEl) valEl.textContent = text;
      if (valPauseEl) valPauseEl.textContent = text;
    };

    // Initialize slider values
    updateMusicVol(audio.musicVolume);
    updateSfxVol(audio.sfxVolume);

    if (musicVolSlider) {
      musicVolSlider.addEventListener('input', (e) => updateMusicVol(parseFloat(e.target.value)));
    }
    if (sfxVolSlider) {
      sfxVolSlider.addEventListener('input', (e) => updateSfxVol(parseFloat(e.target.value)));
    }
    if (musicVolPauseSlider) {
      musicVolPauseSlider.addEventListener('input', (e) => updateMusicVol(parseFloat(e.target.value)));
    }
    if (sfxVolPauseSlider) {
      sfxVolPauseSlider.addEventListener('input', (e) => updateSfxVol(parseFloat(e.target.value)));
    }

    // Pause button in HUD
    const btnPauseToggle = document.getElementById('btn-pause-toggle');
    if (btnPauseToggle) {
      btnPauseToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePause();
      });
    }

    // Resume button in Pause menu
    const btnResumeGame = document.getElementById('btn-resume-game');
    if (btnResumeGame) {
      btnResumeGame.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePause();
      });
    }

    // Restart button in Pause menu
    const btnRestartGame = document.getElementById('btn-restart-game');
    if (btnRestartGame) {
      btnRestartGame.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('pause-overlay').classList.remove('active');
        this.state = 'PLAYING';
        this.startGame();
      });
    }

    // Proceed button in Loot Selection menu
    const btnProceed = document.getElementById('btn-proceed');
    if (btnProceed) {
      btnProceed.addEventListener('click', (e) => {
        e.stopPropagation();
        this.proceedToNextSector();
      });
    }

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
    audio.resume();
    
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

  togglePause() {
    if (this.state !== 'PLAYING' && this.state !== 'PAUSED') return;
    
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.updateInventoryUI();
      document.getElementById('pause-overlay').classList.add('active');
    } else {
      this.state = 'PLAYING';
      document.getElementById('pause-overlay').classList.remove('active');
      audio.resume();
    }
  }

  startGame() {
    if (this.state === 'LOADING') return;
    this.state = 'LOADING';

    this.enableAudioContext();
    audio.stopMusic();
    
    this.loadBossAudio(this.currentLevel, () => {
      this.state = 'PLAYING';
      
      this.player.reset();
      
      // Load saved campaign and upgrades
      this.loadJourney();
      this.player.applyUpgrades(this.upgrades);
      
      this.boss.reset();
      this.chest = null;
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

  spawnTreasureChest() {
    this.state = 'CHEST_LOOT';
    this.chest = new TreasureChest(this.cx, this.cy);
    
    audio.stopMusic();
    setTimeout(() => {
      if (this.state === 'CHEST_LOOT') {
        // play menu music low during selection
        audio.playTrack('soundtracks/menu.mp3', 100);
      }
    }, 1000);
  }

  breakChest() {
    if (!this.chest || this.chest.isBroken) return;
    this.chest.isBroken = true;
    
    // Play reward chime
    audio.playHealSFX();
    
    // Spawn flashy wood and gold particles
    particles.spawnExplosion(this.cx, this.cy, '#ff9d00', 35, 8); // Gold sparks
    particles.spawnShards(this.cx, this.cy, '#8b5a2b', 18, 6); // Wood chunks
    
    setTimeout(() => {
      this.showLootOverlay();
    }, 800);
  }

  showLootOverlay() {
    this.state = 'CHEST_LOOT'; // Transition state
    
    const shuffled = [...UPGRADES_LIST].sort(() => 0.5 - Math.random());
    const choices = shuffled.slice(0, 3);
    
    this.lootChoices = choices;
    this.lootSelectedIndex = 0;
    this.selectedUpgrade = choices[0].id;
    
    const container = document.getElementById('loot-choices');
    if (!container) return;
    container.innerHTML = '';
    
    choices.forEach((upg, idx) => {
      const card = document.createElement('div');
      card.className = 'loot-card';
      if (idx === 0) card.classList.add('selected'); // First card selected by default!
      
      card.innerHTML = `
        <div class="loot-card-icon">${upg.icon}</div>
        <h3>${upg.name}</h3>
        <p class="description">${upg.desc}</p>
        <div class="stat-diff">${upg.diff}</div>
      `;
      
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        this.lootSelectedIndex = idx;
        this.selectedUpgrade = upg.id;
        document.querySelectorAll('.loot-card').forEach((c, cIdx) => {
          if (cIdx === idx) c.classList.add('selected');
          else c.classList.remove('selected');
        });
      });
      container.appendChild(card);
    });
    
    // Reset space hold state
    this.isHoldingSpace = false;
    this.spaceHoldTime = 0;
    const progressInner = document.getElementById('loot-hold-bar-inner');
    if (progressInner) progressInner.style.width = '0%';
    
    document.getElementById('loot-overlay').classList.add('active');
  }

  proceedToNextSector() {
    if (!this.selectedUpgrade) return;
    
    // Apply stats upgrade
    if (!this.upgrades) this.upgrades = {};
    if (this.selectedUpgrade === 'maxHp') {
      this.upgrades.maxHp = (this.upgrades.maxHp || 0) + 1;
      this.player.hp = Math.min(this.player.maxHp + 1, this.player.hp + 1);
    } else if (this.selectedUpgrade === 'bonusDamage') {
      this.upgrades.bonusDamage = (this.upgrades.bonusDamage || 0) + 5;
    } else if (this.selectedUpgrade === 'bonusInvincibility') {
      this.upgrades.bonusInvincibility = (this.upgrades.bonusInvincibility || 0) + 0.5;
    } else {
      this.upgrades[this.selectedUpgrade] = (this.upgrades[this.selectedUpgrade] || 0) + 0.25;
    }
    
    this.selectedUpgrade = null;
    document.getElementById('loot-overlay').classList.remove('active');
    
    if (this.currentLevel < 6) {
      this.setLevelBoss(this.currentLevel + 1);
      this.saveJourney();
      this.startGame();
    } else {
      // Finished all 6 levels
      this.setLevelBoss(1);
      this.upgrades = {}; // reset upgrades for new campaign run
      this.saveJourney();
      this.triggerEndingStory();
    }
  }

  triggerEndingStory() {
    this.state = 'ENDING_STORY';
    this.endingStage = 'DIALOGUE';
    
    this.setLevelBoss(1);
    this.upgrades = {};
    this.saveJourney();
    
    this.isHoldingSpaceEnding = false;
    this.spaceHoldTimeEnding = 0;
    this.activeDialogueChoices = [];
    this.dialogueSelectedChoiceIndex = 0;
    
    audio.stopMusic();
    audio.playTrack('soundtracks/menu.mp3', 100);
    
    // Show overlay
    const storyOverlay = document.getElementById('story-overlay');
    if (storyOverlay) storyOverlay.classList.add('active');
    
    // Show dialogue screen, hide geometry screen
    document.getElementById('story-dialogue-screen').classList.add('active');
    document.getElementById('story-geometry-screen').classList.remove('active');
    
    const dialogueLog = document.getElementById('dialogue-log');
    const dialogueChoices = document.getElementById('dialogue-choices');
    if (dialogueLog) dialogueLog.innerHTML = '';
    if (dialogueChoices) dialogueChoices.innerHTML = '';
    
    // Start dialogue tree
    setTimeout(() => {
      this.renderDialogueLine('entity-a', "DID YOU HAVE FUN", () => {
        this.showDialogueChoices([
          {
            text: "I THINK I DID",
            action: () => {
              this.renderDialogueLine('entity-b', "I THINK I DID", () => {
                audio.playClickSFX();
                setTimeout(() => {
                  this.renderDialogueLine('entity-a', "YEAH LESS PEOPLE MAKE IT UP HERE", () => {
                    setTimeout(() => {
                      this.renderDialogueLine('entity-a', "HOPE YOU LIKED MY GAME :)", () => {
                        audio.playHealSFX();
                        screenShake.trigger(10, 0.3);
                        setTimeout(() => {
                          this.renderDialogueLine('entity-a', "do you know what is the story...", () => {
                            setTimeout(() => {
                              this.showDialogueChoices([
                                {
                                  text: "SHOW ME THE STORY",
                                  action: () => {
                                    audio.playUpgradeSelectedSFX();
                                    this.startGeometryCards();
                                  }
                                }
                              ]);
                            }, 800);
                          });
                        }, 2200);
                      });
                    }, 1800);
                  });
                }, 1000);
              });
            }
          },
          {
            text: "I DIDN'T",
            action: () => {
              this.renderDialogueLine('entity-b', "I DIDN'T", () => {
                audio.playClickSFX();
                setTimeout(() => {
                  this.renderDialogueLine('entity-a', "YOU SEE LESS PEOPLE MAKE IT HERE", () => {
                    setTimeout(() => {
                      this.showDialogueChoices([
                        {
                          text: "WANT TO KNOW WHY",
                          action: () => {
                            this.renderDialogueLine('entity-b', "WANT TO KNOW WHY", () => {
                              audio.playClickSFX();
                              setTimeout(() => {
                                this.renderDialogueLine('entity-a', "because you had FUN", () => {
                                  setTimeout(() => {
                                    this.renderDialogueLine('entity-a', "HOPE YOU LIKED MY GAME :)", () => {
                                      audio.playHealSFX();
                                      screenShake.trigger(10, 0.3);
                                      setTimeout(() => {
                                        this.renderDialogueLine('entity-a', "do you know what is the story...", () => {
                                          setTimeout(() => {
                                            this.showDialogueChoices([
                                              {
                                                text: "SHOW ME THE STORY",
                                                action: () => {
                                                  audio.playUpgradeSelectedSFX();
                                                  this.startGeometryCards();
                                                }
                                              }
                                            ]);
                                          }, 800);
                                        });
                                      }, 2200);
                                    });
                                  }, 1800);
                                });
                              }, 1000);
                            });
                          }
                        }
                      ]);
                    }, 1000);
                  });
                }, 1000);
              });
            }
          }
        ]);
      });
    }, 1200);
  }

  renderDialogueLine(sender, text, callback) {
    const dialogueLog = document.getElementById('dialogue-log');
    if (!dialogueLog) return;
    
    const bubble = document.createElement('div');
    bubble.className = `dialogue-bubble ${sender}`;
    dialogueLog.appendChild(bubble);
    
    let charIndex = 0;
    audio.playNoteHitSFX();
    
    const typeNextChar = () => {
      bubble.textContent += text[charIndex];
      charIndex++;
      if (charIndex < text.length) {
        if (text[charIndex] === ' ') {
          audio.playNoteHitSFX();
        }
        setTimeout(typeNextChar, 55);
      } else {
        dialogueLog.scrollTop = dialogueLog.scrollHeight;
        if (callback) callback();
      }
    };
    typeNextChar();
  }

  showDialogueChoices(choices) {
    this.activeDialogueChoices = choices;
    this.dialogueSelectedChoiceIndex = 0;
    
    const dialogueChoices = document.getElementById('dialogue-choices');
    const holdContainer = document.getElementById('dialogue-hold-container');
    if (!dialogueChoices) return;
    dialogueChoices.innerHTML = '';
    
    if (holdContainer) holdContainer.style.display = choices.length > 0 ? 'flex' : 'none';
    
    choices.forEach((c, idx) => {
      const btn = document.createElement('button');
      btn.className = 'dialogue-choice-btn';
      btn.textContent = c.text;
      
      btn.addEventListener('click', () => {
        this.activeDialogueChoices = [];
        dialogueChoices.innerHTML = '';
        if (holdContainer) holdContainer.style.display = 'none';
        c.action();
      });
      
      dialogueChoices.appendChild(btn);
    });
    
    this.updateDialogueChoiceSelectionVisuals();
  }

  updateDialogueChoiceSelectionVisuals() {
    const buttons = document.querySelectorAll('.dialogue-choice-btn');
    buttons.forEach((btn, idx) => {
      if (idx === this.dialogueSelectedChoiceIndex) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }

  startGeometryCards() {
    this.endingStage = 'GEOMETRY_CARDS';
    
    const storyContainer = document.querySelector('.story-container');
    if (storyContainer) {
      storyContainer.classList.add('flash-white');
      setTimeout(() => storyContainer.classList.remove('flash-white'), 400);
    }
    
    document.getElementById('story-dialogue-screen').classList.remove('active');
    document.getElementById('story-geometry-screen').classList.add('active');
    
    this.currentStoryCard = 0;
    this.storyAnimationTime = 0;
    
    this.storyCards = [
      {
        title: "THE ANOMALY",
        body: "Deep in the unmapped sectors of UMBRA, a high-gravity reactor was built to power interstellar grids. But the core reached critical density, turning into a perpetual temporal anomaly. Space and time began to tear.",
        draw: (ctx, t) => {
          ctx.strokeStyle = '#ff9d00';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#ff9d00';
          
          const size = 65 + Math.sin(t * 3) * 15;
          ctx.save();
          ctx.translate(200, 200);
          ctx.rotate(t * 0.8);
          
          ctx.beginPath();
          ctx.rect(-size/2, -size/2, size, size);
          ctx.stroke();
          
          ctx.strokeStyle = '#00f3ff';
          ctx.shadowColor = '#00f3ff';
          ctx.beginPath();
          ctx.rect(-size/3, -size/3, size, size);
          ctx.stroke();
          
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.beginPath();
          ctx.moveTo(-size/2, -size/2); ctx.lineTo(-size/3, -size/3);
          ctx.moveTo(size/2, -size/2); ctx.lineTo(size/1.5, -size/3);
          ctx.moveTo(-size/2, size/2); ctx.lineTo(-size/3, size/1.5);
          ctx.moveTo(size/2, size/2); ctx.lineTo(size/1.5, size/1.5);
          ctx.stroke();
          
          ctx.restore();
        }
      },
      {
        title: "THE ORBIT",
        body: "You are the Vanguard Pilot, sent on a terminal mission: enter the core's gravity well, bypass the automated sentinel shields, and harvest the alchemical matter before the reactor collapses.",
        draw: (ctx, t) => {
          ctx.fillStyle = '#000';
          ctx.strokeStyle = '#ff00ff';
          ctx.lineWidth = 3;
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#ff00ff';
          
          ctx.beginPath();
          ctx.arc(200, 200, 40 + Math.sin(t * 5) * 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(200, 200, 100, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.save();
          ctx.translate(200, 200);
          ctx.rotate(t * 1.5);
          ctx.fillStyle = '#00f3ff';
          ctx.shadowColor = '#00f3ff';
          ctx.shadowBlur = 10;
          
          ctx.beginPath();
          ctx.moveTo(100, -8);
          ctx.lineTo(112, 0);
          ctx.lineTo(100, 8);
          ctx.closePath();
          ctx.fill();
          
          ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
          ctx.beginPath();
          ctx.arc(0, 0, 100, -0.3, 0);
          ctx.stroke();
          
          ctx.restore();
        }
      },
      {
        title: "THE GUARDIANS",
        body: "The core's defenses were not programmed to be defeated. Sector by sector, they evolved, learning from your movement, firing hyper-dense plasma, web lattices, and gravitational sweeps to crush your resolve.",
        draw: (ctx, t) => {
          ctx.save();
          ctx.translate(200, 200);
          ctx.rotate(-t * 0.5);
          
          ctx.strokeStyle = '#ff0033';
          ctx.shadowColor = '#ff0033';
          ctx.shadowBlur = 15;
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const angle = (Math.PI / 4) * i;
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * 130, Math.sin(angle) * 130);
          }
          ctx.stroke();
          
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, 70 + Math.sin(t*4)*10, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.restore();
        }
      },
      {
        title: "THE LOOP",
        body: "As you shattered the final cauldron core, the gravity well collapsed. But there was no escape—the anomaly bent time backward. You are locked in the perfect, endless orbit. An eternal playtest.",
        draw: (ctx, t) => {
          ctx.save();
          ctx.translate(200, 200);
          ctx.strokeStyle = '#9d00ff';
          ctx.shadowColor = '#9d00ff';
          ctx.shadowBlur = 18;
          ctx.lineWidth = 2.5;
          
          ctx.beginPath();
          for (let i = 0; i < 200; i++) {
            const angle = i * 0.12 + t * 2.0;
            const r = i * 0.75;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.restore();
        }
      },
      {
        title: "THE ASCENSION",
        body: "Yet, you survived. By conquering the recursion, you ascended beyond the simulator. The code is yours. The orbit is yours. Thank you for playing UMBRA.",
        draw: (ctx, t) => {
          ctx.strokeStyle = '#00f3ff';
          ctx.shadowColor = '#00f3ff';
          ctx.shadowBlur = 12;
          ctx.lineWidth = 1.5;
          
          ctx.save();
          ctx.translate(200, 220);
          
          ctx.beginPath();
          ctx.moveTo(-180, 0);
          ctx.lineTo(180, 0);
          ctx.stroke();
          
          ctx.beginPath();
          for (let i = -6; i <= 6; i++) {
            ctx.moveTo(i * 12, 0);
            ctx.lineTo(i * 45, 120);
          }
          ctx.stroke();
          
          ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
          const lineYOffset = (t * 50) % 30;
          for (let y = lineYOffset; y < 120; y += 30) {
            ctx.beginPath();
            const leftX = -180 * (y / 120);
            const rightX = 180 * (y / 120);
            ctx.moveTo(leftX, y);
            ctx.lineTo(rightX, y);
            ctx.stroke();
          }
          
          ctx.restore();
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#ff00ff';
          ctx.shadowColor = '#ff00ff';
          ctx.shadowBlur = 20;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(200, 120, 25, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    ];

    this.showGeometryCard(0);

    const geometryScreen = document.getElementById('story-geometry-screen');
    geometryScreen.onclick = () => this.advanceGeometryCard();

    this.geometryLoopActive = true;
    const canvas = document.getElementById('geometry-canvas');
    const ctx = canvas.getContext('2d');
    
    const renderLoop = () => {
      if (!this.geometryLoopActive) return;
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      this.storyAnimationTime += 0.016;
      const activeCard = this.storyCards[this.currentStoryCard];
      if (activeCard) {
        activeCard.draw(ctx, this.storyAnimationTime);
      }
      requestAnimationFrame(renderLoop);
    };
    renderLoop();
  }

  showGeometryCard(index) {
    const card = this.storyCards[index];
    if (!card) return;
    
    audio.playWaveSpawn();
    
    const titleEl = document.getElementById('geometry-card-title');
    const bodyEl = document.getElementById('geometry-card-body');
    
    if (titleEl) {
      titleEl.textContent = card.title;
      const colors = ['#ff9d00', '#ff00ff', '#ff0033', '#9d00ff', '#00f3ff'];
      titleEl.style.color = colors[index % colors.length];
      titleEl.style.textShadow = `0 0 10px ${colors[index % colors.length]}`;
    }
    
    if (bodyEl) {
      bodyEl.textContent = '';
      let charIndex = 0;
      const typeText = () => {
        if (this.currentStoryCard !== index) return;
        bodyEl.textContent += card.body[charIndex];
        charIndex++;
        if (charIndex < card.body.length) {
          setTimeout(typeText, 25);
        }
      };
      typeText();
    }
  }

  advanceGeometryCard() {
    this.currentStoryCard++;
    if (this.currentStoryCard < this.storyCards.length) {
      const storyContainer = document.querySelector('.story-container');
      if (storyContainer) {
        storyContainer.classList.add('flash-white');
        setTimeout(() => storyContainer.classList.remove('flash-white'), 400);
      }
      this.showGeometryCard(this.currentStoryCard);
    } else {
      this.geometryLoopActive = false;
      
      const storyContainer = document.querySelector('.story-container');
      if (storyContainer) {
        storyContainer.classList.add('flash-white');
        setTimeout(() => storyContainer.classList.remove('flash-white'), 400);
      }
      
      document.getElementById('story-geometry-screen').classList.remove('active');
      document.getElementById('story-dialogue-screen').classList.add('active');
      
      this.endingStage = 'DIALOGUE';
      this.activeDialogueChoices = [];
      this.dialogueSelectedChoiceIndex = 0;
      
      const dialogueLog = document.getElementById('dialogue-log');
      if (dialogueLog) dialogueLog.innerHTML = '';
      
      setTimeout(() => {
        this.renderDialogueLine('entity-a', "now you know the story do you have any quesions", () => {
          this.showDialogueChoices([
            {
              text: "YES I DO",
              action: () => {
                this.renderDialogueLine('entity-b', "YES I DO", () => {
                  audio.playClickSFX();
                  setTimeout(() => {
                    this.renderDialogueLine('entity-a', "okay, goodbye", () => {
                      setTimeout(() => {
                        const storyOverlay = document.getElementById('story-overlay');
                        if (storyOverlay) storyOverlay.classList.remove('active');
                        document.getElementById('menu-overlay').classList.add('active');
                        this.state = 'MENU';
                        this.updateInventoryUI();
                        audio.stopMusic();
                        audio.playTrack('soundtracks/menu.mp3', 100);
                      }, 1800);
                    });
                  }, 800);
                });
              }
            },
            {
              text: "NO I DON'T",
              action: () => {
                this.renderDialogueLine('entity-b', "NO I DON'T", () => {
                  audio.playClickSFX();
                  setTimeout(() => {
                    this.renderDialogueLine('entity-a', "Guess you are not carious about the story?", () => {
                      setTimeout(() => {
                        this.showDialogueChoices([
                          {
                            text: "Yes",
                            action: () => this.triggerFinalGoodbye("Yes")
                          },
                          {
                            text: "YES",
                            action: () => this.triggerFinalGoodbye("YES")
                          },
                          {
                            text: "yes",
                            action: () => this.triggerFinalGoodbye("yes")
                          },
                          {
                            text: "YEEES",
                            action: () => this.triggerFinalGoodbye("YEEES")
                          }
                        ]);
                      }, 1000);
                    });
                  }, 1000);
                });
              }
            }
          ]);
        });
      }, 1000);
    }
  }

  triggerFinalGoodbye(optionText) {
    this.renderDialogueLine('entity-b', optionText, () => {
      audio.playClickSFX();
      setTimeout(() => {
        this.renderDialogueLine('entity-a', "THEN, GOODBYE!", () => {
          setTimeout(() => {
            const storyOverlay = document.getElementById('story-overlay');
            if (storyOverlay) storyOverlay.classList.remove('active');
            
            document.getElementById('menu-overlay').classList.add('active');
            this.state = 'MENU';
            this.updateInventoryUI();
            audio.stopMusic();
            audio.playTrack('soundtracks/menu.mp3', 100);
          }, 2000);
        });
      }, 1000);
    });
  }

  toggleSuperDebugCheat() {
    this.superDebugActive = !this.superDebugActive;
    
    audio.playHealSFX();
    particles.spawnExplosion(this.player.x, this.player.y, '#39ff14', 20, 5);
    
    particles.spawnText(
      this.player.x, 
      this.player.y - 30, 
      this.superDebugActive ? "CHEAT ON: INSTA-CHARGE" : "CHEAT OFF", 
      this.superDebugActive ? "#39ff14" : "#ff3b30", 
      18
    );
  }

  updateInventoryUI() {
    const welcomePanel = document.getElementById('inventory-panel');
    const welcomeList = document.getElementById('inventory-list');
    const pausePanel = document.getElementById('pause-inventory-panel');
    const pauseList = document.getElementById('pause-inventory-list');
    
    const keys = Object.keys(this.upgrades || {});
    const hasUpgrades = keys.some(k => this.upgrades[k] > 0);
    
    if (welcomePanel) welcomePanel.style.display = hasUpgrades ? 'block' : 'none';
    if (pausePanel) pausePanel.style.display = hasUpgrades ? 'block' : 'none';
    
    if (!hasUpgrades) return;
    
    const upgradeTypes = {
      orbitSpeed: { name: 'Hyper Drive', icon: '⚡', desc: 'Increases orbit movement speed.' },
      chargeSpeed: { name: 'Quantum Capacitor', icon: '🔋', desc: 'Accelerates attack charge rate.' },
      dashSpeed: { name: 'Chrono Thrusters', icon: '🚀', desc: 'Increases dash travel speed.' },
      maxHp: { name: 'Reinforced Hull', icon: '💖', desc: 'Adds extra maximum heart capacity.' },
      bonusDamage: { name: 'Vortex Matrix', icon: '💥', desc: 'Increases dash collision damage.' },
      bonusInvincibility: { name: 'Nano Shielding', icon: '🛡️', desc: 'Extends post-hit invincibility time.' }
    };
    
    const renderGrid = (listEl) => {
      if (!listEl) return;
      listEl.innerHTML = '';
      for (const key of keys) {
        const val = this.upgrades[key];
        if (val > 0) {
          const info = upgradeTypes[key];
          
          let textVal = '';
          if (key === 'maxHp' || key === 'bonusDamage') textVal = `+${val}`;
          else if (key === 'bonusInvincibility') textVal = `+${val}s`;
          else textVal = `+${Math.round(val * 100)}%`;
          
          const slot = document.createElement('div');
          slot.className = 'inventory-slot';
          slot.innerHTML = `
            <span class="inventory-slot-icon">${info.icon}</span>
            <span class="inventory-slot-badge">${val}</span>
            <div class="inventory-slot-tooltip">
              <strong style="color: var(--neon-cyan);">${info.name}</strong><br/>
              ${info.desc}<br/>
              <span style="color: var(--neon-magenta); font-weight: bold;">Stat Boost: ${textVal}</span>
            </div>
          `;
          listEl.appendChild(slot);
        }
      }
    };
    
    renderGrid(welcomeList);
    renderGrid(pauseList);
  }

  triggerVictory() {
    this.state = 'VICTORY';
    this.stateTimer = 3.0;
    audio.stopMusic();
    
    const titleEl = document.querySelector('#victory-overlay h1');
    const subtitleEl = document.getElementById('victory-subtitle');
    const promptEl = document.getElementById('victory-prompt');
    
    if (this.currentLevel === 6) {
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
    if (this.state === 'PAUSED') return;

    if (this.state === 'ENDING_STORY') {
      if (this.endingStage === 'DIALOGUE' && this.isHoldingSpaceEnding) {
        this.spaceHoldTimeEnding += dt;
        const progressPercent = Math.min(100, (this.spaceHoldTimeEnding / 1.0) * 100);
        const barInner = document.getElementById('dialogue-hold-bar-inner');
        if (barInner) barInner.style.width = `${progressPercent}%`;
        
        if (this.spaceHoldTimeEnding >= 1.0) {
          this.isHoldingSpaceEnding = false;
          this.spaceHoldTimeEnding = 0;
          if (barInner) barInner.style.width = '0%';
          
          const selectedChoice = this.activeDialogueChoices[this.dialogueSelectedChoiceIndex];
          if (selectedChoice) {
            this.activeDialogueChoices = [];
            const dialogueChoices = document.getElementById('dialogue-choices');
            const holdContainer = document.getElementById('dialogue-hold-container');
            if (dialogueChoices) dialogueChoices.innerHTML = '';
            if (holdContainer) holdContainer.style.display = 'none';
            selectedChoice.action();
          }
        }
      }
      return;
    }

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
          if (this.currentLevel === 6) {
            this.triggerEndingStory();
          } else {
            this.spawnTreasureChest();
          }
        }
      }
    } else if (this.state === 'CHEST_LOOT') {
      debug.update(dt, this.player, null);
      if (!isFrozen) {
        this.player.update(dt, null);
        if (this.chest) this.chest.update(dt);
      }
      
      // Update spacebar hold confirm progress
      if (this.chest && this.chest.isBroken && this.isHoldingSpace) {
        this.spaceHoldTime += dt;
        const progressPercent = Math.min(100, (this.spaceHoldTime / 1.5) * 100);
        const progressInner = document.getElementById('loot-hold-bar-inner');
        if (progressInner) progressInner.style.width = `${progressPercent}%`;
        
        if (this.spaceHoldTime >= 1.5) {
          this.isHoldingSpace = false;
          this.spaceHoldTime = 0;
          if (progressInner) progressInner.style.width = '0%';
          this.proceedToNextSector();
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
    if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAMEOVER' || this.state === 'VICTORY' || this.state === 'CHEST_LOOT') {
      if (this.state === 'CHEST_LOOT' && this.chest) {
        this.chest.draw(this.ctx);
      } else {
        this.boss.draw(this.ctx);
      }
      this.player.draw(this.ctx);
    }
    
    // Render particles
    particles.draw(this.ctx);
    
    // Draw debug hitboxes (if option enabled)
    if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'CHEST_LOOT') {
      debug.drawHitbox(this.ctx, this.player.x, this.player.y, this.player.radius, '#39ff14');
      if (this.state === 'CHEST_LOOT' && this.chest) {
        debug.drawHitbox(this.ctx, this.chest.x, this.chest.y, this.chest.radius, '#ff9d00');
      } else {
        debug.drawHitbox(this.ctx, this.boss.cx, this.boss.cy, this.boss.radius * this.boss.visualScale, '#ff0055');
      }
      
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
