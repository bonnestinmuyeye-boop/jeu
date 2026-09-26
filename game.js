// Sons dynamiques via le Web Audio API
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
// SCÈNE DU MENU : Choix du niveau
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

    // Assistant du menu
    const tipBg = this.add.graphics();
    tipBg.fillStyle(0x161b22, 0.9);
    tipBg.fillRoundedRect(20, height - 100, width - 40, 75, 10);
    this.add.text(width / 2, height - 62, "🤖 Guide :\nAttrape les pièces 🟡, cadeaux 🎁 et boucliers 🛡️.\nAttention : esquive les bombes 💣 !", {
      fontSize: '13px',
      color: '#58a6ff',
      align: 'center'
    }).setOrigin(0.5);
  }
}

// ==========================================
// SCÈNE DE JEU : Le 1er jeu avec bonus & pièges
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

    // --- Création visuelle du joueur ---
    const pGfx = this.add.graphics();
    pGfx.fillStyle(0x3498db, 1);
    pGfx.fillRoundedRect(0, 0, 50, 50, 10);
    pGfx.generateTexture('playerTex', 50, 50);
    pGfx.destroy();

    // Bouclier visuel
    const sGfx = this.add.graphics();
    sGfx.lineStyle(4, 0x00ffff, 1);
    sGfx.strokeCircle(32, 32, 30);
    sGfx.generateTexture('shieldTex', 64, 64);
    sGfx.destroy();

    this.player = this.physics.add.sprite(width / 2, height - 120, 'playerTex');
    this.player.setCollideWorldBounds(true);

    this.shieldAura = this.add.sprite(this.player.x, this.player.y, 'shieldTex');
    this.shieldAura.setVisible(false);

    // Groupe d'objets qui tombent
    this.fallingGroup = this.physics.add.group();

    // UI
    this.scoreText = this.add.text(20, 20, `Score: 0`, {
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff'
    });

    this.levelText = this.add.text(width - 20, 20, `${this.levelConfig.name}`, {
      fontSize: '16px',
      color: '#f1c40f'
    }).setOrigin(1, 0);

    // Assistant en bas de l'écran
    const botBg = this.add.graphics();
    botBg.fillStyle(0x161b22, 0.95);
    botBg.fillRoundedRect(15, height - 65, width - 30, 50, 8);

    this.assistantText = this.add.text(25, height - 52, '🤖 : Déplace-toi avec le doigt ! Attrape les pièces 🟡', {
      fontSize: '13px',
      color: '#58a6ff'
    });

    // Contrôles tactiles
    this.input.on('pointermove', (p) => { this.targetX = p.x; });
    this.input.on('pointerdown', (p) => { this.targetX = p.x; });

    // Collisions
    this.physics.add.overlap(this.player, this.fallingGroup, this.collectItem, null, this);

    // Apparition régulière d'objets
    this.spawnTimer = this.time.addEvent({
      delay: 1100,
      callback: this.spawnItem,
      callbackScope: this,
      loop: true
    });
  }

  update() {
    if (this.isGameOver) return;

    // Déplacement fluide vers le doigt
    if (Math.abs(this.player.x - this.targetX) > 4) {
      this.player.x = Phaser.Math.Linear(this.player.x, this.targetX, 0.25);
    }

    this.shieldAura.setPosition(this.player.x, this.player.y);

    // Nettoyage des objets tombés tout en bas
    this.fallingGroup.getChildren().forEach(item => {
      if (item.y > this.scale.height - 70) {
        item.destroy();
      }
    });
  }

  setAssistant(text) {
    if (this.assistantText) this.assistantText.setText(`🤖 : ${text}`);
  }

  spawnItem() {
    if (this.isGameOver) return;

    const x = Phaser.Math.Between(40, this.scale.width - 40);
    const rand = Math.random();
    let type = 'coin';

    // Logique d'apparition : bombe, cadeau, bouclier ou pièce
    if (rand < this.levelConfig.bombRatio) {
      type = 'bomb';
    } else if (rand > 0.88) {
      type = 'gift';
    } else if (rand > 0.80) {
      type = 'shield';
    }

    const container = this.add.container(x, -25);
    let color = 0xf1c40f;
    let label = '🟡';

    if (type === 'bomb') {
      color = 0xe74c3c;
      label = '💣';
    } else if (type === 'gift') {
      color = 0xe67e22;
      label = '🎁';
    } else if (type === 'shield') {
      color = 0x00bcd4;
      label = '🛡️';
    }

    const circle = this.add.circle(0, 0, 18, color);
    const txt = this.add.text(0, 0, label, { fontSize: '18px' }).setOrigin(0.5);

    container.add([circle, txt]);
    container.setSize(36, 36);
    this.physics.world.enable(container);
    container.body.setVelocityY(this.currentSpeed);
    container.itemType = type;

    this.fallingGroup.add(container);
  }

  collectItem(player, item) {
    const type = item.itemType;
    item.destroy();

    if (type === 'coin') {
      SoundEngine.playSuccess();
      this.score += this.rewards.coinPoints;
      this.currentSpeed += this.levelConfig.speedIncrement; // Accélération continue
      this.scoreText.setText(`Score: ${this.score}`);
      this.setAssistant('Bien joué ! +10 pts ⚡ Ça accélère !');
    } 
    else if (type === 'gift') {
      SoundEngine.playPowerup();
      this.score += this.rewards.giftPoints;
      this.scoreText.setText(`Score: ${this.score}`);
      this.setAssistant('Super cadeau ! 🎁 +50 points d\'un coup !');
    } 
    else if (type === 'shield') {
      SoundEngine.playPowerup();
      this.activateShield();
      this.setAssistant(`🛡️ Bouclier activé ! Protégé pendant ${this.levelConfig.shieldDuration / 1000}s !`);
    } 
    else if (type === 'bomb') {
      if (this.hasShield) {
        SoundEngine.playPowerup();
        this.consumeShield();
        this.setAssistant('🛡️ Le bouclier a fait exploser la bombe sans dégâts !');
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
      this.setAssistant('⚠️ Ton bouclier s\'est désactivé ! Fais attention !');
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
    this.setAssistant('💥 BOOM ! Touché par une bombe. Game Over !');

    const { width, height } = this.scale;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRect(0, 0, width, height);

    this.add.text(width / 2, height / 2 - 80, 'GAME OVER', {
      fontSize: '34px',
      fontStyle: 'bold',
      color: '#e74c3c'
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 20, `Score : ${this.score}`, {
      fontSize: '22px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const restartBtn = this.add.graphics();
    restartBtn.fillStyle(0x27ae60, 1);
    restartBtn.fillRoundedRect(width / 2 - 100, height / 2 + 30, 200, 50, 10);

    this.add.text(width / 2, height / 2 + 55, 'REJOUER', {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    const zone = this.add.zone(width / 2, height / 2 + 55, 200, 50).setInteractive();
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
