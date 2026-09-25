// Configuration Phaser adaptée pour smartphone (portrait)
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
  scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let player, coin, scoreText;
let score = 0;
let gameData = {};
let targetX = 180;

function preload() {
  // Chargement du fichier JSON
  this.load.json('gameConfig', 'data.json');
}

function create() {
  // Récupération des données JSON
  gameData = this.cache.json.get('gameConfig');

  // Création du joueur (carré bleu) sans image externe requise
  const playerGfx = this.add.graphics();
  playerGfx.fillStyle(0x3498db);
  playerGfx.fillRoundedRect(0, 0, 50, 50, 10);
  playerGfx.generateTexture('playerTexture', 50, 50);
  playerGfx.destroy();

  player = this.physics.add.sprite(180, 560, 'playerTexture');
  player.setCollideWorldBounds(true);

  // Création d'une pièce (cercle jaune)
  const coinGfx = this.add.graphics();
  coinGfx.fillStyle(0xf1c40f);
  coinGfx.fillCircle(15, 15, 15);
  coinGfx.generateTexture('coinTexture', 30, 30);
  coinGfx.destroy();

  coin = this.physics.add.sprite(Phaser.Math.Between(30, 330), -20, 'coinTexture');

  // Texte du score
  scoreText = this.add.text(20, 25, `${gameData.ui.scoreLabel}0`, {
    fontSize: '24px',
    color: '#ffffff',
    fontStyle: 'bold'
  });

  // Contrôles tactiles (le joueur suit le doigt)
  this.input.on('pointermove', (pointer) => {
    targetX = pointer.x;
  });
  this.input.on('pointerdown', (pointer) => {
    targetX = pointer.x;
  });

  // Gestion des collisions
  this.physics.add.overlap(player, coin, collectCoin, null, this);
}

function update() {
  // Déplacement fluide vers le doigt
  if (Math.abs(player.x - targetX) > 5) {
    player.x = Phaser.Math.Linear(player.x, targetX, 0.2);
  }

  // Faire tomber la pièce
  coin.y += 4;
  if (coin.y > 660) {
    resetCoin();
  }
}

function collectCoin(p, c) {
  score += gameData.coin.points;
  scoreText.setText(`${gameData.ui.scoreLabel}${score}`);
  resetCoin();
}

function resetCoin() {
  coin.setPosition(Phaser.Math.Between(30, 330), -20);
}