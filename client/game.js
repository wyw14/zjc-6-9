﻿const API_BASE_URL = 'http://localhost:6038/api';

const CARD_EMOJIS = {
  1: '🎃',
  2: '🎄',
  3: '🎁',
  4: '🎈',
  5: '🎉',
  6: '🎊',
  7: '🎗️',
  8: '🎟️'
};

const GAME_MODE = {
  PRACTICE: 'practice',
  RACE: 'race'
};

const gameBoard = document.getElementById('gameBoard');
const timerEl = document.getElementById('timer');
const movesEl = document.getElementById('moves');
const matchedEl = document.getElementById('matched');
const restartBtn = document.getElementById('restartBtn');
const leaderboardBtn = document.getElementById('leaderboardBtn');
const winModal = document.getElementById('winModal');
const leaderboardModal = document.getElementById('leaderboardModal');
const finalTimeEl = document.getElementById('finalTime');
const finalMovesEl = document.getElementById('finalMoves');
const playerNameInput = document.getElementById('playerName');
const submitScoreBtn = document.getElementById('submitScoreBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
const leaderboardList = document.getElementById('leaderboardList');

const modeSelect = document.getElementById('modeSelect');
const gameArea = document.getElementById('gameArea');
const modeBadge = document.getElementById('modeBadge');
const modeIcon = document.getElementById('modeIcon');
const modeText = document.getElementById('modeText');
const showAnswerBtn = document.getElementById('showAnswerBtn');
const hideAnswerBtn = document.getElementById('hideAnswerBtn');
const changeModeBtn = document.getElementById('changeModeBtn');
const submitScoreSection = document.getElementById('submitScoreSection');
const winModeBadge = document.getElementById('winModeBadge');
const backToModeSelectBtn = document.getElementById('backToModeSelectBtn');
const modeCards = document.querySelectorAll('.mode-card');

let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let moves = 0;
let timer = null;
let startTime = null;
let elapsedTime = 0;
let gameStarted = false;
let isProcessing = false;
let currentMode = null;
let answerVisible = false;
let raceSessionId = null;
let serverVerifiedTime = null;

function setGameMode(mode) {
  currentMode = mode;
  modeBadge.className = 'mode-badge ' + mode;

  if (mode === GAME_MODE.PRACTICE) {
    modeIcon.textContent = '📚';
    modeText.textContent = '练习模式';
    showAnswerBtn.classList.remove('hidden');
  } else {
    modeIcon.textContent = '⚡';
    modeText.textContent = '竞速模式';
    showAnswerBtn.classList.add('hidden');
    hideAnswerBtn.classList.add('hidden');
  }

  modeSelect.classList.add('hidden');
  gameArea.classList.remove('hidden');
}

function backToModeSelection() {
  winModal.classList.add('hidden');
  gameArea.classList.add('hidden');
  modeSelect.classList.remove('hidden');
  resetGameState();
}

modeCards.forEach(card => {
  card.addEventListener('click', () => {
    const mode = card.dataset.mode;
    setGameMode(mode);
    initGame();
  });
});

changeModeBtn.addEventListener('click', backToModeSelection);
backToModeSelectBtn.addEventListener('click', backToModeSelection);

async function initGame() {
  resetGameState();

  if (currentMode === GAME_MODE.RACE) {
    try {
      const response = await fetch(`${API_BASE_URL}/race/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        raceSessionId = data.sessionId;
      } else {
        throw new Error(data.error || '启动竞速会话失败');
      }
    } catch (error) {
      console.error('启动竞速会话失败:', error);
      alert('启动竞速模式失败，请重试');
      backToModeSelection();
      return;
    }
  }

  const shuffledCards = await fetchShuffledCards();
  renderCards(shuffledCards);

  if (currentMode === GAME_MODE.RACE) {
    startTimer();
    gameStarted = true;
  }
}

function resetGameState() {
  cards = [];
  flippedCards = [];
  matchedPairs = 0;
  moves = 0;
  elapsedTime = 0;
  gameStarted = false;
  isProcessing = false;
  answerVisible = false;
  raceSessionId = null;
  serverVerifiedTime = null;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  updateTimerDisplay();
  if (movesEl) movesEl.textContent = '0';
  if (matchedEl) matchedEl.textContent = '0/8';
  if (gameBoard) gameBoard.innerHTML = '';

  showAnswerBtn.classList.remove('hidden');
  hideAnswerBtn.classList.add('hidden');
  if (currentMode === GAME_MODE.RACE) {
    showAnswerBtn.classList.add('hidden');
  }
}

async function fetchShuffledCards() {
  try {
    const response = await fetch(`${API_BASE_URL}/shuffle?mode=${currentMode}`);
    const data = await response.json();
    return data.cards;
  } catch (error) {
    console.error('获取洗牌数据失败:', error);
    const fallbackCards = [];
    for (let i = 1; i <= 8; i++) {
      fallbackCards.push(i, i);
    }
    for (let i = fallbackCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fallbackCards[i], fallbackCards[j]] = [fallbackCards[j], fallbackCards[i]];
    }
    return fallbackCards;
  }
}

function renderCards(cardIds) {
  cardIds.forEach((cardId, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = cardId;
    card.dataset.index = index;

    const cardBack = document.createElement('div');
    cardBack.className = 'card-face card-back';

    const cardFront = document.createElement('div');
    cardFront.className = 'card-face card-front';
    cardFront.textContent = CARD_EMOJIS[cardId] || '❓';

    card.appendChild(cardBack);
    card.appendChild(cardFront);

    card.addEventListener('click', () => handleCardClick(card));

    gameBoard.appendChild(card);
    cards.push(card);
  });
}

function handleCardClick(card) {
  if (isProcessing) return;
  if (card.classList.contains('flipped')) return;
  if (card.classList.contains('matched')) return;
  if (flippedCards.length >= 2) return;
  if (answerVisible) return;

  if (!gameStarted && currentMode === GAME_MODE.PRACTICE) {
    startTimer();
    gameStarted = true;
  }

  flipCard(card);
  flippedCards.push(card);

  if (flippedCards.length === 2) {
    moves++;
    movesEl.textContent = moves;
    checkMatch();
  }
}

function flipCard(card) {
  card.classList.add('flipped');
}

function unflipCard(card) {
  card.classList.remove('flipped');
}

function showAllAnswers() {
  cards.forEach(card => {
    if (!card.classList.contains('matched')) {
      card.classList.add('flipped', 'peek');
    }
  });
  answerVisible = true;
  showAnswerBtn.classList.add('hidden');
  hideAnswerBtn.classList.remove('hidden');
}

function hideAllAnswers() {
  cards.forEach(card => {
    if (!card.classList.contains('matched')) {
      card.classList.remove('flipped', 'peek');
    }
  });
  answerVisible = false;
  showAnswerBtn.classList.remove('hidden');
  hideAnswerBtn.classList.add('hidden');
}

showAnswerBtn.addEventListener('click', () => {
  if (currentMode === GAME_MODE.PRACTICE) {
    showAllAnswers();
  }
});

hideAnswerBtn.addEventListener('click', () => {
  if (currentMode === GAME_MODE.PRACTICE) {
    hideAllAnswers();
  }
});

function checkMatch() {
  isProcessing = true;

  const [card1, card2] = flippedCards;
  const id1 = parseInt(card1.dataset.id);
  const id2 = parseInt(card2.dataset.id);

  if (id1 === id2) {
    setTimeout(() => {
      card1.classList.add('matched');
      card2.classList.add('matched');
      card1.classList.remove('peek');
      card2.classList.remove('peek');
      matchedPairs++;
      matchedEl.textContent = `${matchedPairs}/8`;
      flippedCards = [];
      isProcessing = false;

      if (matchedPairs === 8) {
        endGame();
      }
    }, 500);
  } else {
    setTimeout(() => {
      unflipCard(card1);
      unflipCard(card2);
      card1.classList.remove('peek');
      card2.classList.remove('peek');
      flippedCards = [];
      isProcessing = false;
    }, 1000);
  }
}

function startTimer() {
  startTime = Date.now() - elapsedTime;
  timer = setInterval(() => {
    elapsedTime = Date.now() - startTime;
    updateTimerDisplay();
  }, 100);
}

function updateTimerDisplay() {
  const totalSeconds = Math.floor(elapsedTime / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

async function endGame() {
  clearInterval(timer);
  timer = null;

  finalMovesEl.textContent = moves;

  winModeBadge.className = 'win-mode-badge ' + currentMode;

  if (currentMode === GAME_MODE.PRACTICE) {
    finalTimeEl.textContent = timerEl.textContent;
    winModeBadge.textContent = '📚 练习模式（不计入排行榜）';
    submitScoreSection.classList.add('hidden');
    submitScoreBtn.classList.add('hidden');
  } else {
    try {
      const response = await fetch(`${API_BASE_URL}/race/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: raceSessionId })
      });
      const data = await response.json();

      if (data.success) {
        serverVerifiedTime = data.time;
        const minutes = Math.floor(serverVerifiedTime / 60);
        const seconds = serverVerifiedTime % 60;
        finalTimeEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      } else {
        throw new Error(data.error || '成绩验证失败');
      }
    } catch (error) {
      console.error('验证成绩失败:', error);
      alert('成绩验证失败：' + (error.message || '请重试'));
      finalTimeEl.textContent = timerEl.textContent + ' (未验证)';
      submitScoreSection.classList.add('hidden');
      submitScoreBtn.classList.add('hidden');
      winModeBadge.textContent = '⚡ 竞速模式 (成绩验证失败)';
      setTimeout(() => {
        winModal.classList.remove('hidden');
      }, 500);
      return;
    }

    winModeBadge.textContent = '⚡ 竞速模式';
    submitScoreSection.classList.remove('hidden');
    submitScoreBtn.classList.remove('hidden');
  }

  setTimeout(() => {
    winModal.classList.remove('hidden');
  }, 500);
}

async function submitScore() {
  if (currentMode !== GAME_MODE.RACE) {
    alert('练习模式成绩不计入排行榜');
    return;
  }

  if (!raceSessionId) {
    alert('无效的游戏会话，请重新开始游戏');
    return;
  }

  if (serverVerifiedTime === null) {
    alert('成绩尚未验证，请稍候或重新游戏');
    return;
  }

  const playerName = playerNameInput.value.trim() || '匿名玩家';

  try {
    const response = await fetch(`${API_BASE_URL}/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: raceSessionId,
        playerName: playerName,
        mode: currentMode
      })
    });

    const data = await response.json();

    if (data.success) {
      const minutes = Math.floor(data.time / 60);
      const seconds = data.time % 60;
      const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      alert(`恭喜！用时 ${timeStr}，你排名第 ${data.rank} 名！`);
      winModal.classList.add('hidden');
      showLeaderboard();
    } else {
      alert(data.error || '提交失败');
    }
  } catch (error) {
    console.error('提交成绩失败:', error);
    alert('提交成绩失败，请稍后重试');
  }
}

async function showLeaderboard() {
  try {
    const response = await fetch(`${API_BASE_URL}/leaderboard`);
    const data = await response.json();
    renderLeaderboard(data.leaderboard);
  } catch (error) {
    console.error('获取排行榜失败:', error);
    leaderboardList.innerHTML = '<li>加载排行榜失败</li>';
  }

  leaderboardModal.classList.remove('hidden');
}

function renderLeaderboard(leaderboard) {
  if (!leaderboard || leaderboard.length === 0) {
    leaderboardList.innerHTML = '<li class="empty-message">暂无记录，快来挑战吧！</li>';
    return;
  }

  leaderboardList.innerHTML = '';

  leaderboard.forEach((entry, index) => {
    const li = document.createElement('li');
    li.className = 'rank-item';

    const minutes = Math.floor(entry.time / 60);
    const seconds = entry.time % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    li.innerHTML = `
      <span class="rank-name">
        <span class="rank">#${index + 1}</span>
        <span class="name">${entry.playerName}</span>
      </span>
      <span class="time">${timeStr}</span>
    `;

    leaderboardList.appendChild(li);
  });
}

restartBtn.addEventListener('click', initGame);
playAgainBtn.addEventListener('click', () => {
  winModal.classList.add('hidden');
  initGame();
});
leaderboardBtn.addEventListener('click', showLeaderboard);
closeLeaderboardBtn.addEventListener('click', () => {
  leaderboardModal.classList.add('hidden');
});
submitScoreBtn.addEventListener('click', submitScore);
