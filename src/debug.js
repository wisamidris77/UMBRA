/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Debug Console Panel Helper
 * ==========================================================================
 */

class DebugConsole {
  constructor() {
    this.fps = 0;
    this.frameTime = 0;
    this.frameCount = 0;
    this.showHitboxes = false;
    
    // UI elements cache
    this.elDir = null;
    this.elCharge = null;
    this.elBossHp = null;
    this.elBossPhase = null;
    this.elAttack = null;
    this.elFps = null;
    this.elCheckbox = null;
  }

  init() {
    this.elDir = document.getElementById('debug-dir');
    this.elCharge = document.getElementById('debug-charge');
    this.elBossHp = document.getElementById('debug-boss-hp');
    this.elBossPhase = document.getElementById('debug-boss-phase');
    this.elAttack = document.getElementById('debug-attack');
    this.elFps = document.getElementById('debug-fps');
    this.elCheckbox = document.getElementById('debug-hitboxes');
    
    if (this.elCheckbox) {
      this.elCheckbox.addEventListener('change', (e) => {
        this.showHitboxes = e.target.checked;
      });
      // Set initial state
      this.showHitboxes = this.elCheckbox.checked;
    }
  }

  update(dt, player, boss) {
    // 1. Calculate FPS
    this.frameCount++;
    this.frameTime += dt;
    if (this.frameTime >= 1.0) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.frameTime = 0;
    }
    
    // 2. Update HUD overlays
    if (this.elFps) this.elFps.textContent = this.fps;
    
    if (player) {
      if (this.elDir) this.elDir.textContent = player.orbitDir > 0 ? 'CW' : 'CCW';
      if (this.elCharge) this.elCharge.textContent = `${Math.round(player.chargePercent * 100)}%`;
    }
    
    if (boss) {
      if (this.elBossHp) this.elBossHp.textContent = `${Math.round(boss.hp)}/${boss.maxHp}`;
      if (this.elBossPhase) this.elBossPhase.textContent = `Phase ${boss.phase}`;
      if (this.elAttack) {
        let atkStr = boss.targetAttack || 'Idle';
        // Clean up format
        atkStr = atkStr.replace(/_/g, ' ').toLowerCase();
        // Capitalize words
        atkStr = atkStr.replace(/\b\w/g, c => c.toUpperCase());
        this.elAttack.textContent = `${boss.state} - ${atkStr}`;
      }
    }
  }

  drawHitbox(ctx, x, y, radius, color = '#39ff14') {
    if (!this.showHitboxes) return;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw crosshair center
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + 4, y);
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y + 4);
    ctx.stroke();
    
    ctx.restore();
  }
  
  drawLaserHitbox(ctx, x1, y1, x2, y2, thickness, color = '#39ff14') {
    if (!this.showHitboxes) return;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }
}

export const debug = new DebugConsole();
