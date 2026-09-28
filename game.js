// --- Moteur Audio ---
const SoundEngine = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  },
  playSuccess() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(1040, t + 0.15);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.15);
  },
  playFail() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(90, t + 0.35);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.35);
  },
  playPowerup() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.25);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.start(t);
    osc.stop(t + 0.25);
  }
};

// ==========================================
// SCÈNE MENU
// ==========================================
class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  preload() {
    this.load.json('gameData', 'data.json');
  }

  create() {
    const data = this.cache.json.get('gameData');
    const { width, height } = this.scale;

    this.add.text(width / 2, 70, 'COIN CATCHER', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#f1c40f'
    }).setOrigin(0.5);

    this.add.text(width / 2, 115, 'Choisis ta difficulté :', {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const levels = [
      { key: 'amateur', color: 0x2ecc71 },
      { key: 'normal',  color: 0x3498db },
      { key: 'pro',     color: 0xe67e22 },
      { key: 'legende', color: 0xe74c3c }
    ];

    let startY = 175;
    levels.forEach(lvl => {
      const cfg = data.levels[lvl.key];
      const btn = this.add.graphics();
      btn.fillStyle(lvl.color, 1);
      btn.fillRoundedRect(width / 2 - 120, startY, 240, 50, 10);

      this.add.text(width / 2, startY + 25, cfg.name.toUpperCase(), {
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff'
      }).setOrigin(0.5);

      const zone = this.add.zone(width / 2, startY + 25, 240, 50).setInteractive();
      zone.on('pointerdown', () => {
        SoundEngine.init();
        this.scene.start('GameScene', { levelKey: lvl.key });
      });

      startY += 70;
    });

    const tipBg = this.add.graphics();
    tipBg.fillStyle(0x161b22, 0.9);
    tipBg.fillRoundedRect(20, height - 100, width - 40, 75, 10);
    this.add.text(width / 2, height - 62, "🤖 Guide :\nAttrape les pièces 🟡, cadeaux 🎁 et boucliers 🛡️.\nAttention : évite les bombes 💣 !", {
      fontSize: '13px',
      color: '#58a6ff',
      align: 'center'
    }).setOrigin(0.5);
  }
}

// ==========================================
// SCÈNE DE JEU
// ==========================================
class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.levelKey = data.levelKey || 'normal';
    this.score = 0;
    this.targetX = 180;
    this.hasShield = false;
    this.shieldTimer = null;
    this.isGameOver = false;
  }

  create() {
    const rawData = this.cache.json.get('gameData');
    this.levelConfig = rawData.levels[this.levelKey];
    this.rewards = rawData.rewards;
    this.currentSpeed = this.levelConfig.startSpeed;

    const { width, height } = this.scale;

    // --- Génération propre des Textures (Sans Conteneur) ---
    // 1. Joueur
    const pGfx = this.make.graphics();
    pGfx.fillStyle(0x3498db, 1);
    pGfx.fillRoundedRect(0, 0, 50, 50, 10);
    pGfx.generateTexture('playerTex', 50, 50);

    // 2. Bouclier (aura)
    const sGfx = this.make.graphics();
    sGfx.lineStyle(4, 0x00ffff, 1);
    sGfx.strokeCircle(32, 32, 28);
    sGfx.generateTexture('shieldAuraTex', 64, 64);

    // 3. Pièce dorée
    const cGfx = this.make.graphics();
    cGfx.fillStyle(0xf1c40f, 1);
    cGfx.fillCircle(18, 18, 16);
    cGfx.lineStyle(3, 0xd4ac0d, 1);
    cGfx.strokeCircle(18, 18, 16);
    cGfx.generateTexture('coinTex', 36, 36);

    // 4. Bombe
    const bGfx = this.make.graphics();
    bGfx.fillStyle(0xe74c3c, 1);
    bGfx.fillCircle(18, 18, 16);
    bGfx.lineStyle(3, 0xc0392b, 1);
    bGfx.strokeCircle(18, 18, 16);
    bGfx.generateTexture('bombTex', 36, 36);

    // 5. Cadeau
    const gGfx = this.make.graphics();
    gGfx.fillStyle(0xe67e22, 1);
    gGfx.fillRoundedRect(0, 0, 36, 36, 6);
    gGfx.lineStyle(3, 0xffffff, 1);
    gGfx.strokeRect(15, 0, 6, 36);
    gGfx.generateTexture('giftTex', 36, 36);

    // 6. Bonus Bouclier
    const shGfx = this.make.graphics();
    shGfx.fillStyle(0x00bcd4, 1);
    shGfx.fillCircle(18, 18, 16);
    shGfx.lineStyle(3, 0xffffff, 1);
    shGfx.strokeCircle(18, 18, 16);
    shGfx.generateTexture('shieldItemTex', 36, 36);

    // Sprite Joueur
    this.player = this.physics.add.sprite(width / 2, height - 120, 'playerTex');
    this.player.setCollideWorldBounds(true);

    this.shieldAura = this.add.sprite(this.player.x, this.player.y, 'shieldAuraTex');
    this.shieldAura.setVisible(false);

    // Groupe d'objets avec physique activée
    this.itemsGroup = this.physics.add.group();

    // Textes
    this.scoreText = this.add.text(20, 20, 'Score: 0', {
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff'
    });

    this.levelText = this.add.text(width - 20, 20, `${this.levelConfig.name}`, {
      fontSize: '16px',
      color: '#f1c40f'
    }).setOrigin(1, 0);

    // Assistant en bas
    const botBg = this.add.graphics();
    botBg.fillStyle(0x161b22, 0.95);
    botBg.fillRoundedRect(15, height - 65, width - 30, 50, 8);

    this.assistantText = this.add.text(25, height - 52, '🤖 : Fais glisser ton doigt pour ramasser !', {
      fontSize: '13px',
      color: '#58a6ff'
    });

    // Contrôles tactiles
    this.input.on('pointermove', (p) => { this.targetX = p.x; });
    this.input.on('pointerdown', (p) => { this.targetX = p.x; });

    // Collisions joueur / objets
    this.physics.add.overlap(this.player, this.itemsGroup, this.onHitItem, null, this);

    // Générateur régulier d'objets
    this.time.addEvent({
      delay: 900,
      callback: this.spawnItem,
      callbackScope: this,
      loop: true
    });
  }

  update() {
    if (this.isGameOver) return;

    // Suivi fluide du doigt
    if (Math.abs(this.player.x - this.targetX) > 4) {
      this.player.x = Phaser.Math.Linear(this.player.x, this.targetX, 0.25);
    }

    this.shieldAura.setPosition(this.player.x, this.player.y);

    // Supprimer les objets qui dépassent l'écran
    this.itemsGroup.getChildren().forEach(item => {
      if (item.y > this.scale.height - 60) {
        item.destroy();
      }
    });
  }

  setAssistant(text) {
    if (this.assistantText) this.assistantText.setText(`🤖 : ${text}`);
  }

  spawnItem() {
    if (this.isGameOver) return;

    const x = Phaser.Math.Between(30, this.scale.width - 30);
    const rand = Math.random();
    let texture = 'coinTex';
    let type = 'coin';

    if (rand < this.levelConfig.bombRatio) {
      texture = 'bombTex';
      type = 'bomb';
    } else if (rand > 0.88) {
      texture = 'giftTex';
      type = 'gift';
    } else if (rand > 0.80) {
      texture = 'shieldItemTex';
      type = 'shield';
    }

    const item = this.itemsGroup.create(x, -20, texture);
    item.itemType = type;
    item.setVelocityY(this.currentSpeed);
  }

  onHitItem(player, item) {
    const type = item.itemType;
    item.destroy();

    if (type === 'coin') {
      SoundEngine.playSuccess();
      this.score += this.rewards.coinPoints;
      this.currentSpeed += this.levelConfig.speedIncrement; // Accélération
      this.scoreText.setText(`Score: ${this.score}`);
      this.setAssistant('Pièce attrapée ! 🟡 Vitesse + !');
    } 
    else if (type === 'gift') {
      SoundEngine.playPowerup();
      this.score += this.rewards.giftPoints;
      this.scoreText.setText(`Score: ${this.score}`);
      this.setAssistant('Super cadeau ! 🎁 +50 points !');
    } 
    else if (type === 'shield') {
      SoundEngine.playPowerup();
      this.activateShield();
      this.setAssistant(`🛡️ Bouclier activé pour ${this.levelConfig.shieldDuration / 1000}s !`);
    } 
    else if (type === 'bomb') {
      if (this.hasShield) {
        SoundEngine.playPowerup();
        this.consumeShield();
        this.setAssistant('🛡️ Le bouclier a détruit la bombe !');
      } else {
        SoundEngine.playFail();
        this.triggerGameOver();
      }
    }
  }

  activateShield() {
    this.hasShield = true;
    this.shieldAura.setVisible(true);

    if (this.shieldTimer) this.shieldTimer.remove();
    this.shieldTimer = this.time.delayedCall(this.levelConfig.shieldDuration, () => {
      this.consumeShield();
      this.setAssistant('⚠️ Le bouclier est terminé !');
    });
  }

  consumeShield() {
    this.hasShield = false;
    this.shieldAura.setVisible(false);
    if (this.shieldTimer) {
      this.shieldTimer.remove();
      this.shieldTimer = null;
    }
  }

  triggerGameOver() {
    this.isGameOver = true;
    this.physics.pause();
    this.setAssistant('💥 BOOM ! Fin de la partie.');

    const { width, height } = this.scale;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRect(0, 0, width, height);

    this.add.text(width / 2, height / 2 - 70, 'GAME OVER', {
      fontSize: '34px',
      fontStyle: 'bold',
      color: '#e74c3c'
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 15, `Score Final : ${this.score}`, {
      fontSize: '22px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const btn = this.add.graphics();
    btn.fillStyle(0x27ae60, 1);
    btn.fillRoundedRect(width / 2 - 90, height / 2 + 35, 180, 50, 10);

    this.add.text(width / 2, height / 2 + 60, 'REJOUER', {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    const zone = this.add.zone(width / 2, height / 2 + 60, 180, 50).setInteractive();
    zone.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });
  }
}

// Configuration Phaser
const config = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 360,
    height: 640
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scene: [MenuScene, GameScene]
};

const game = new Phaser.Game(config);
