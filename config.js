

window.GAME_CONFIG = {
  canvas: { width: 1280, height: 720 },

  backgroundImage: "assets/background.jpg",
  // Игрок: 3 состояния (если файлов нет — будет fallback)
  playerImages: {
    idle: "assets/player.png",
    happy: "assets/player_happy.png",
    angry: "assets/player_angry.png"
  },
  playerMoodMs: 260, // сколько держится эмоция после события


  goodItems: [
    { id: "good-1", image: "assets/good1.png" },
    { id: "good-2", image: "assets/good2.png" },
    { id: "good-3", image: "assets/good3.png" },
    { id: "good-4", image: "assets/good4.png" },
    { id: "good-5", image: "assets/good5.png" },
  ],

  badItems: [
    { id: "bad-1", image: "assets/bad1.png" },
    { id: "bad-2", image: "assets/bad2.png" },
    { id: "bad-3", image: "assets/bad3.png" },
    { id: "bad-4", image: "assets/bad4.png" },
    { id: "bad-5", image: "assets/bad5.png" },
  ],

  rules: {
    lives: 3,
    goodScore: +1,
    badScore: -1,
    badTakesLife: true,

    comboEvery: 5,
    comboMax: 5,
  },

  physics: {
    gravityBase: 240,
    gravityRamp: 14,
    spawnBase: 0.85,
    spawnMin: 0.35,
    spawnRamp: 0.03,
  },

  player: {
    width: 300,
    height: 320,
    speed: 800,
    floorPadding: -40,
    hitboxScale: 0.65,
},


  items: {
    sizeMin: 50,
    sizeMax: 80,
    spin: true,
  }
};
