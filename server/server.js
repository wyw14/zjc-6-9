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
const RACE_SESSION_TTL = 10 * 60 * 1000;
let leaderboard = [];
let raceSessions = new Map();

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of raceSessions) {
    if (now - session.startTime > RACE_SESSION_TTL) {
      raceSessions.delete(sessionId);
    }
  }
}

setInterval(cleanExpiredSessions, 60 * 1000);

function generateSessionId() {
  return 'race_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
}

app.post('/api/race/start', (req, res) => {
  const sessionId = generateSessionId();
  const startTime = Date.now();

  raceSessions.set(sessionId, {
    startTime: startTime,
    endTime: null,
    completed: false,
    submitted: false
  });

  res.json({
    success: true,
    sessionId: sessionId,
    startTime: startTime
  });
});

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

app.post('/api/race/complete', (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId || !raceSessions.has(sessionId)) {
    return res.status(400).json({
      success: false,
      error: '无效的游戏会话，请重新开始'
    });
  }

  const session = raceSessions.get(sessionId);

  if (session.submitted) {
    return res.status(400).json({
      success: false,
      error: '该会话成绩已提交，请勿重复提交'
    });
  }

  if (Date.now() - session.startTime > RACE_SESSION_TTL) {
    raceSessions.delete(sessionId);
    return res.status(400).json({
      success: false,
      error: '会话已过期，请重新开始'
    });
  }

  const endTime = Date.now();
  session.endTime = endTime;
  session.completed = true;
  const serverCalculatedTime = Math.floor((endTime - session.startTime) / 1000);

  raceSessions.set(sessionId, session);

  res.json({
    success: true,
    sessionId: sessionId,
    startTime: session.startTime,
    endTime: endTime,
    time: serverCalculatedTime
  });
});

app.post('/api/score', (req, res) => {
  const { sessionId, playerName, mode } = req.body;

  if (!mode || mode !== GAME_MODE.RACE) {
    return res.status(400).json({
      success: false,
      error: '仅竞速模式成绩可计入排行榜'
    });
  }

  if (!sessionId || !raceSessions.has(sessionId)) {
    return res.status(400).json({
      success: false,
      error: '无效的游戏会话，请重新开始游戏'
    });
  }

  const session = raceSessions.get(sessionId);

  if (!session.completed) {
    return res.status(400).json({
      success: false,
      error: '游戏尚未完成，请先通关'
    });
  }

  if (session.submitted) {
    return res.status(400).json({
      success: false,
      error: '该会话成绩已提交，请勿重复提交'
    });
  }

  const serverCalculatedTime = Math.floor((session.endTime - session.startTime) / 1000);

  if (serverCalculatedTime <= 0) {
    return res.status(400).json({
      success: false,
      error: '成绩数据无效'
    });
  }

  const entry = {
    id: Date.now(),
    time: serverCalculatedTime,
    playerName: playerName || '匿名玩家',
    mode: GAME_MODE.RACE,
    sessionId: sessionId,
    startTime: session.startTime,
    endTime: session.endTime,
    date: new Date().toLocaleString('zh-CN')
  };

  session.submitted = true;
  raceSessions.set(sessionId, session);

  leaderboard.push(entry);
  leaderboard.sort((a, b) => a.time - b.time);
  leaderboard = leaderboard.slice(0, 10);

  const rank = leaderboard.findIndex(e => e.id === entry.id) + 1;

  res.json({
    success: true,
    rank: rank,
    mode: GAME_MODE.RACE,
    time: serverCalculatedTime,
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
