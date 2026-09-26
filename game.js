// --- Synthétiseur audio Web Audio (fonctionne sans aucun fichier audio externe) ---
const AudioEngine = {
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
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    // Arpège ascendant joyeux
    osc.frequency.setValueAtTime(523.25, now);       // Do5
    osc.frequency.setValueAtTime(659.25, now + 0.08); // Mi5
    osc.frequency.setValueAtTime(783.99, now + 0.16); // Sol5
    osc.frequency.setValueAtTime(1046.5, now + 0.24); // Do6

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.start(now);
    osc.stop(now + 0.45);
  },
  playFail() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    // Son grave descendant d'erreur
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.35);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.start(now);
    osc.stop(now + 0.35);
  },
  playBonus() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.25);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.start(now);
    osc.stop(now + 0.25);
  }
};

// ==========================================
// SCÈNE 1 : Menu de sélection du Niveau
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

    this.add.text(width / 2, 70, 'MATH RUSH', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#f1c40f'
    }).setOrigin(0.5);

    this.add.text(width / 2, 115, 'Choisis ton niveau :', {
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
      btn.fillRoundedRect(width / 2 - 130, startY, 260, 55, 12);

      const label = this.add.text(width / 2, startY + 28, `${cfg.name.toUpperCase()}`, {
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff'
      }).setOrigin(0.5);

      const zone = this.add.zone(width / 2, startY + 28, 260, 55).setInteractive();
      zone.on('pointerdown', () => {
        AudioEngine.init();
        this.scene.start('GameScene', { levelKey: lvl.key });
      });

      startY += 75;
    });

    // Conseil de l'assistant dans le menu
    const tipBg = this.add.graphics();
    tipBg.fillStyle(0x1a1a2e, 0.9);
    tipBg.fillRoundedRect(20, height - 100, width - 40, 80, 10);
    this.add.text(width / 2, height - 60, "🤖 Assistant :\nAttrape la bonne réponse !\nÉvite les pièges, attrape les 🎁 et 🛡️ !", {
      fontSize: '13px',
      color: '#a0aec0',
      align: 'center'
    }).setOrigin(0.5);
  }
}

// ==========================================
// SCÈNE 2 : Jeu Principal
// ==========================================
class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.levelKey = data.levelKey || 'normal';
    this.score = 0;
    this.streak = 0;
    this.hasShield = false;
    this.shieldTimer = null;
    this.currentEquation = null;
    this.targetX = 180;
    this.isGameOver = false;
  }

  create() {
    const rawData = this.cache.json.get('gameData');
    this.levelConfig = rawData.levels[this.levelKey];
    this.bonusConfig = rawData.bonuses;
    this.currentSpeed = this.levelConfig.baseSpeed;

    const { width, height } = this.scale;

    // --- Graphismes générés à chaud ---
    // Joueur (Vaisseau / Carré bleu stylé)
    const pGfx = this.add.graphics();
    pGfx.fillStyle(0x3498db, 1);
    pGfx.fillRoundedRect(0, 0, 50, 50, 10);
    pGfx.generateTexture('playerTex', 50, 50);
    pGfx.destroy();

    // Bouclier (aura)
    const sGfx = this.add.graphics();
    sGfx.lineStyle(4, 0x00ffff, 1);
    sGfx.strokeCircle(30, 30, 28);
    sGfx.generateTexture('shieldAura', 60, 60);
    sGfx.destroy();

    // Sprite Joueur
    this.player = this.physics.add.sprite(width / 2, height - 120, 'playerTex');
    this.player.setCollideWorldBounds(true);

    this.shieldSprite = this.add.sprite(this.player.x, this.player.y, 'shieldAura');
    this.shieldSprite.setVisible(false);

    // Groupes d'objets
    this.answerItems = this.physics.add.group();
    this.bonusItems = this.physics.add.group();

    // --- Interface Utilisateur (HUD) ---
    this.scoreText = this.add.text(20, 20, 'Score: 0', {
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff'
    });

    this.levelText = this.add.text(width - 20, 20, `${this.levelConfig.name}`, {
      fontSize: '16px',
      color: '#f1c40f'
    }).setOrigin(1, 0);

    // Panneau de l'équation
    const eqBg = this.add.graphics();
    eqBg.fillStyle(0x2c3e50, 0.9);
    eqBg.fillRoundedRect(width / 2 - 120, 55, 240, 50, 10);

    this.equationText = this.add.text(width / 2, 80, '', {
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#f39c12'
    }).setOrigin(0.5);

    // Assistant textuel en bas
    const botBg = this.add.graphics();
    botBg.fillStyle(0x161b22, 0.95);
    botBg.fillRoundedRect(15, height - 70, width - 30, 55, 8);

    this.assistantText = this.add.text(25, height - 55, '🤖 : Déplace ton doigt pour jouer !', {
      fontSize: '13px',
      color: '#58a6ff',
      wordWrap: { width: width - 50 }
    });

    // Contrôles tactiles (suivi du doigt)
    this.input.on('pointermove', (p) => { this.targetX = p.x; });
    this.input.on('pointerdown', (p) => { this.targetX = p.x; });

    // Collisions
    this.physics.add.overlap(this.player, this.answerItems, this.hitAnswer, null, this);
    this.physics.add.overlap(this.player, this.bonusItems, this.hitBonus, null, this);

    // Lancement de la première équation
    this.generateNewRound();

    // Apparition périodique des bonus (cadeau ou bouclier)
    this.time.addEvent({
      delay: this.bonusConfig.dropInterval,
      callback: this.spawnRandomBonus,
      callbackScope: this,
      loop: true
    });
  }

  update(time, delta) {
    if (this.isGameOver) return;

    // Déplacement fluide vers le doigt
    if (Math.abs(this.player.x - this.targetX) > 4) {
      this.player.x = Phaser.Math.Linear(this.player.x, this.targetX, 0.25);
    }

    // Le bouclier suit le joueur
    this.shieldSprite.setPosition(this.player.x, this.player.y);

    // Si les bulles sortent du bas de l'écran sans être touchées
    let allFallen = true;
    this.answerItems.getChildren().forEach(item => {
      if (item.y < this.scale.height - 70) {
        allFallen = false;
      }
    });

    if (this.answerItems.getChildren().length > 0 && allFallen) {
      this.setAssistantMessage('⚠️ Tu as manqué le calcul ! Réessaye.');
      AudioEngine.playFail();
      this.generateNewRound();
    }
  }

  setAssistantMessage(msg) {
    if (this.assistantText) {
      this.assistantText.setText(`🤖 : ${msg}`);
    }
  }

  // --- Génération d'équations adaptées au niveau ---
  generateEquation() {
    const cfg = this.levelConfig;
    const op = Phaser.Utils.Array.GetRandom(cfg.operations);
    let n1 = Phaser.Math.Between(1, cfg.maxNum);
    let n2 = Phaser.Math.Between(1, cfg.maxNum);
    let result = 0;

    if (op === '+') {
      result = n1 + n2;
    } else if (op === '-') {
      if (n1 < n2) [n1, n2] = [n2, n1]; // Pas de négatif pour rester fun
      result = n1 - n2;
    } else if (op === '*') {
      n1 = Phaser.Math.Between(1, Math.min(12, cfg.maxNum));
      n2 = Phaser.Math.Between(1, 10);
      result = n1 * n2;
    }

    return { text: `${n1} ${op} ${n2} = ?`, correct: result };
  }

  generateNewRound() {
    this.answerItems.clear(true, true);
    this.currentEquation = this.generateEquation();
    this.equationText.setText(this.currentEquation.text);

    const correctVal = this.currentEquation.correct;
    // Faux résultats proches
    const f1 = correctVal + Phaser.Utils.Array.GetRandom([-3, -2, -1, 1, 2, 3]);
    let f2 = correctVal + Phaser.Utils.Array.GetRandom([-5, -4, 4, 5]);
    if (f2 === f1) f2 = correctVal + 6;

    const answers = Phaser.Utils.Array.Shuffle([
      { value: correctVal, isCorrect: true },
      { value: f1, isCorrect: false },
      { value: f2, isCorrect: false }
    ]);

    // 3 colonnes réparties sur la largeur
    const positionsX = [70, 180, 290];

    answers.forEach((ans, i) => {
      const x = positionsX[i];
      const y = 120;

      const container = this.add.container(x, y);
      const circle = this.add.circle(0, 0, 26, 0x8e44ad);
      const txt = this.add.text(0, 0, `${ans.value}`, {
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff'
      }).setOrigin(0.5);

      container.add([circle, txt]);
      container.setSize(52, 52);
      this.physics.world.enable(container);
      container.body.setVelocityY(this.currentSpeed);
      container.isCorrect = ans.isCorrect;

      this.answerItems.add(container);
    });
  }

  hitAnswer(player, item) {
    if (item.isCorrect) {
      // Victoire sur ce calcul
      AudioEngine.playSuccess();
      this.score += 20;
      this.streak++;
      this.currentSpeed += this.levelConfig.speedIncrement; // Vitesse qui augmente !
      this.scoreText.setText(`Score: ${this.score}`);

      // Assistant encourage
      const praises = ['Bien joué ! 👍', 'Super calcul ! 🔥', 'La vitesse augmente ! ⚡', 'Inarrêtable ! 🚀'];
      this.setAssistantMessage(Phaser.Utils.Array.GetRandom(praises));

      this.generateNewRound();
    } else {
      // Erreur
      if (this.hasShield) {
        // Le bouclier sauve le joueur !
        AudioEngine.playBonus();
        this.consumeShield();
        this.setAssistantMessage('🛡️ Le bouclier a absorbé ton erreur !');
        this.generateNewRound();
      } else {
        // Perdu
        AudioEngine.playFail();
        this.gameOver();
      }
    }
  }

  // --- Gestion des Bonus (Cadeau & Bouclier) ---
  spawnRandomBonus() {
    if (this.isGameOver) return;
    const type = Phaser.Math.Between(0, 1) === 0 ? 'gift' : 'shield';
    const x = Phaser.Math.Between(40, this.scale.width - 40);

    const container = this.add.container(x, 110);
    const circle = this.add.circle(0, 0, 20, type === 'gift' ? 0xe67e22 : 0x00bcd4);
    const icon = this.add.text(0, 0, type === 'gift' ? '🎁' : '🛡️', { fontSize: '18px' }).setOrigin(0.5);

    container.add([circle, icon]);
    container.setSize(40, 40);
    this.physics.world.enable(container);
    container.body.setVelocityY(this.currentSpeed * 0.9);
    container.bonusType = type;

    this.bonusItems.add(container);
  }

  hitBonus(player, bonus) {
    AudioEngine.playBonus();
    if (bonus.bonusType === 'gift') {
      this.score += this.bonusConfig.giftPoints;
      this.scoreText.setText(`Score: ${this.score}`);
      this.setAssistantMessage(`🎁 Cadeau attrapé ! +${this.bonusConfig.giftPoints} pts !`);
    } else if (bonus.bonusType === 'shield') {
      this.activateShield();
      this.setAssistantMessage(`🛡️ Bouclier activé pour ${this.levelConfig.shieldDuration / 1000}s !`);
    }
    bonus.destroy();
  }

  activateShield() {
    this.hasShield = true;
    this.shieldSprite.setVisible(true);

    if (this.shieldTimer) this.shieldTimer.remove();
    this.shieldTimer = this.time.delayedCall(this.levelConfig.shieldDuration, () => {
      this.consumeShield();
      this.setAssistantMessage('⚠️ Le bouclier est épuisé.');
    });
  }

  consumeShield() {
    this.hasShield = false;
    this.shieldSprite.setVisible(false);
    if (this.shieldTimer) {
      this.shieldTimer.remove();
      this.shieldTimer = null;
    }
  }

  gameOver() {
    this.isGameOver = true;
    this.physics.pause();
    this.setAssistantMessage('💥 Aïe ! Mauvaise réponse. Game Over !');

    const { width, height } = this.scale;
    const endBg = this.add.graphics();
    endBg.fillStyle(0x000000, 0.85);
    endBg.fillRect(0, 0, width, height);

    this.add.text(width / 2, height / 2 - 80, 'GAME OVER', {
      fontSize: '34px',
      fontStyle: 'bold',
      color: '#e74c3c'
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 20, `Score Final : ${this.score}`, {
      fontSize: '22px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Bouton Rejouer
    const restartBtn = this.add.graphics();
    restartBtn.fillStyle(0x27ae60, 1);
    restartBtn.fillRoundedRect(width / 2 - 100, height / 2 + 30, 200, 50, 10);

    this.add.text(width / 2, height / 2 + 55, 'REJOUER', {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    const restartZone = this.add.zone(width / 2, height / 2 + 55, 200, 50).setInteractive();
    restartZone.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });
  }
}

// Configuration Globale Phaser
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
