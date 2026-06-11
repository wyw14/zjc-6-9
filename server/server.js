const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 6038;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

const CARD_PAIRS = 8;
const GAME_MODE = {
  PRACTICE: 'practice',
  RACE: 'race'
};
let leaderboard = [];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

app.get('/api/shuffle', (req, res) => {
  const { mode } = req.query;

  if (mode && mode !== GAME_MODE.PRACTICE && mode !== GAME_MODE.RACE) {
    return res.status(400).json({ error: '无效的游戏模式' });
  }

  const cardIds = [];
  for (let i = 1; i <= CARD_PAIRS; i++) {
    cardIds.push(i, i);
  }
  const shuffled = shuffle(cardIds);

  res.json({
    cards: shuffled,
    mode: mode || GAME_MODE.PRACTICE
  });
});

app.post('/api/score', (req, res) => {
  const { time, playerName, mode } = req.body;

  if (typeof time !== 'number' || time <= 0) {
    return res.status(400).json({
      success: false,
      error: '无效的成绩数据'
    });
  }

  if (!mode || mode !== GAME_MODE.RACE) {
    return res.status(400).json({
      success: false,
      error: '仅竞速模式成绩可计入排行榜'
    });
  }

  const entry = {
    id: Date.now(),
    time: time,
    playerName: playerName || '匿名玩家',
    mode: GAME_MODE.RACE,
    date: new Date().toLocaleString('zh-CN')
  };

  leaderboard.push(entry);
  leaderboard.sort((a, b) => a.time - b.time);
  leaderboard = leaderboard.slice(0, 10);

  const rank = leaderboard.findIndex(e => e.id === entry.id) + 1;

  res.json({
    success: true,
    rank: rank,
    mode: GAME_MODE.RACE,
    leaderboard: leaderboard
  });
});

app.get('/api/leaderboard', (req, res) => {
  const raceLeaderboard = leaderboard.filter(entry => entry.mode === GAME_MODE.RACE);
  res.json({
    mode: GAME_MODE.RACE,
    leaderboard: raceLeaderboard
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
