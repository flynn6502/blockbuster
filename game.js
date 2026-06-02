(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const newScoreModalEl = document.getElementById("newScoreModal");
  const winnerScoreValueEl = document.getElementById("winnerScoreValue");
  const newScoreFormEl = document.getElementById("newScoreForm");
  const initialsInputs = [
    document.getElementById("scoreInitial1"),
    document.getElementById("scoreInitial2"),
    document.getElementById("scoreInitial3"),
  ];
  const bootstrapModal = window.bootstrap ? new window.bootstrap.Modal(newScoreModalEl) : null;

  const COLS = 8;
  const ROWS = 8;
  const CELL_SIZE = 50;
  const DESKTOP_BREAKPOINT = 1024;
  const SCORE_API_URL = "./api/scoreboard.php";
  const BONUS_MAP = {
    2: 0.1,
    3: 0.2,
    4: 0.3,
    5: 0.5,
  };

  const SHAPES = [
    // 1 block
    [[1]],
    // 2 in line
    [[1, 1]],
    // 2 in vertical line
    [[1], [1]],
    // 3 in line
    [[1, 1, 1]],
    // 3 in vertical line
    [[1], [1], [1]],
    // 4 in line
    [[1, 1, 1, 1]],
    // 3 blocks in 90 degrees
    [
      [1, 0],
      [1, 1],
    ],
    // 3 blocks in 180 degrees
    [
      [0, 1],
      [1, 1],
    ],
    // 4 blocks in 90 degrees
    [
      [1, 0],
      [1, 0],
      [1, 1],
    ],
    // 4 blocks in 180 degrees
    [
      [1, 1, 1],
      [1, 0, 0],
    ],
    // 4 blocks in 0 degrees
    [
      [1, 1, 1],
      [0, 0, 1],
    ],
    // 9 blocks in 3x3
    [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ],
    // 4 blocks in 2x2
    [
      [1, 1],
      [1, 1],
    ],
    // 4-block S shape (horizontal)
    [
      [0, 1, 1],
      [1, 1, 0],
    ],
    // 4-block S shape (vertical)
    [
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    // 4-block Z shape (horizontal)
    [
      [1, 1, 0],
      [0, 1, 1],
    ],
    // 4-block Z shape (vertical)
    [
      [0, 1],
      [1, 1],
      [1, 0],
    ],
  ];
  const SHAPE_COLORS = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#84cc16",
    "#f43f5e",
    "#a855f7",
  ];

  function normalizeLeaderboard(entries) {
    if (!Array.isArray(entries)) return [];
    return entries
      .filter((entry) => entry && typeof entry.name === "string" && typeof entry.score === "number")
      .map((entry) => ({
        name: entry.name.slice(0, 3).toUpperCase(),
        score: Math.max(0, Math.floor(entry.score)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }

  async function fetchScoreboardData() {
    const response = await fetch(SCORE_API_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Scoreboard fetch failed: ${response.status}`);
    const data = await response.json();
    const leaderboard = normalizeLeaderboard(data.leaderboard);
    const bestScore = Math.max(0, Number(data.bestScore) || (leaderboard[0] ? leaderboard[0].score : 0));
    return { leaderboard, bestScore };
  }

  async function saveScoreToServer(name, score) {
    const response = await fetch(SCORE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name: normalizeInitials(name),
        score: Math.max(0, Math.floor(score)),
      }),
    });
    if (!response.ok) throw new Error(`Score save failed: ${response.status}`);
    const data = await response.json();
    const leaderboard = normalizeLeaderboard(data.leaderboard);
    const bestScore = Math.max(0, Number(data.bestScore) || (leaderboard[0] ? leaderboard[0].score : 0));
    return { leaderboard, bestScore };
  }

  function normalizeInitials(input) {
    const lettersOnly = (input || "").toUpperCase().replace(/[^A-Z]/g, "");
    if (!lettersOnly) return "AAA";
    return (lettersOnly + "AAA").slice(0, 3);
  }

  function setModalInitials(value) {
    initialsInputs.forEach((input, i) => {
      input.value = value && value[i] ? value[i].toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1) : "";
    });
  }

  function getModalInitials() {
    const value = initialsInputs.map((input) => input.value || "").join("");
    return normalizeInitials(value);
  }

  function animateModalScore(targetScore) {
    if (!winnerScoreValueEl) return;
    const duration = 800;
    const start = performance.now();
    const target = Math.max(0, Math.floor(targetScore));

    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);
      winnerScoreValueEl.textContent = String(current);
      if (progress < 1) requestAnimationFrame(frame);
    }

    winnerScoreValueEl.textContent = "0";
    requestAnimationFrame(frame);
  }

  const state = {
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
    score: 0,
    gameOver: false,
    currentScreen: "game",
    leaderboard: [],
    bestScore: 0,
    runStartBestScore: 0,
    scoreSubmitted: false,
    tray: [],
    burnFlashes: [],
    burnEmbers: [],
    layout: {
      width: 0,
      height: 0,
      navbarH: 0,
      mainX: 0,
      mainY: 0,
      mainW: 0,
      mainH: 0,
      sideX: 0,
      sideY: 0,
      sideW: 0,
      sideH: 0,
      cell: 0,
      boardX: 0,
      boardY: 0,
      boardW: 0,
      boardH: 0,
      restartBtn: { x: 0, y: 0, w: 0, h: 0 },
      scoreboardBtn: { x: 0, y: 0, w: 0, h: 0 },
      backBtn: { x: 0, y: 0, w: 0, h: 0 },
    },
    drag: null,
    pointer: { x: 0, y: 0 },
  };
  state.runStartBestScore = state.bestScore;

  function cloneMatrix(matrix) {
    return matrix.map((row) => row.slice());
  }

  function shuffled(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function createShape(shapeIndex, color) {
    const matrix = cloneMatrix(SHAPES[shapeIndex]);
    return { matrix, color };
  }

  function refillTrayIfNeeded() {
    if (state.tray.length === 0) {
      const roundColors = shuffled(SHAPE_COLORS).slice(0, 3);
      const shapeIndices = shuffled([...Array(SHAPES.length).keys()]).slice(0, 3);
      state.tray = shapeIndices.map((shapeIndex, i) => createShape(shapeIndex, roundColors[i]));
      computeTraySlots();
      checkGameOver();
    }
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = window.innerWidth;
    const h = window.innerHeight;
    const navbarH = Math.max(56, h * 0.1);
    const contentY = navbarH;
    const contentH = h - navbarH;
    const boardW = CELL_SIZE * COLS;
    const boardH = CELL_SIZE * ROWS;
    const boardSidePadding = 24;
    const minMainW = boardW + boardSidePadding * 2;
    const minSideW = CELL_SIZE * 2 + 24;
    const preferredSideW = Math.round(Math.min(Math.max(w * 0.24, CELL_SIZE * 4 + 24), CELL_SIZE * 5 + 24));
    const availableForSide = Math.max(0, w - minMainW);
    const sideW = Math.max(minSideW, Math.min(preferredSideW, availableForSide));
    const sideX = 0;
    const sideY = contentY;
    const sideH = contentH;
    const mainX = sideW;
    const mainY = contentY;
    const mainW = w - sideW;
    const mainH = contentH;
    const cell = CELL_SIZE;
    const boardX = Math.floor((w - boardW) / 2);
    const boardY = Math.floor(mainY + Math.max(8, (mainH - boardH) / 2));
    document.body.style.minWidth = w >= DESKTOP_BREAKPOINT ? `${boardW + 80}px` : "0px";
    const buttonH = Math.max(34, Math.min(44, navbarH * 0.72));
    const restartBtnW = Math.max(84, Math.min(130, navbarH * 1.8));
    const scoreboardBtnW = Math.max(108, Math.min(168, navbarH * 2.3));
    const buttonGap = 10;
    const rightPadding = 14;
    const restartBtn = {
      w: restartBtnW,
      h: buttonH,
      x: w - restartBtnW - rightPadding,
      y: Math.floor((navbarH - buttonH) / 2),
    };
    const scoreboardBtn = {
      w: scoreboardBtnW,
      h: buttonH,
      x: restartBtn.x - scoreboardBtnW - buttonGap,
      y: Math.floor((navbarH - buttonH) / 2),
    };
    const backBtnW = Math.max(84, Math.min(132, navbarH * 1.8));
    const backBtn = {
      w: backBtnW,
      h: buttonH,
      x: w - backBtnW - rightPadding,
      y: Math.floor((navbarH - buttonH) / 2),
    };

    state.layout = {
      width: w,
      height: h,
      navbarH,
      mainX,
      mainY,
      mainW,
      mainH,
      sideX,
      sideY,
      sideW,
      sideH,
      cell,
      boardX,
      boardY,
      boardW,
      boardH,
      restartBtn,
      scoreboardBtn,
      backBtn,
    };

    computeTraySlots();
  }

  function computeTraySlots() {
    const { sideX, sideY, sideW, sideH } = state.layout;
    if (!sideW || !sideH) return;
    const slotGap = Math.max(8, Math.min(16, sideW * 0.08));
    const slotW = Math.max(1, sideW - slotGap * 2);
    const trayTop = sideY + slotGap;
    const trayHeight = Math.max(1, sideH - slotGap * 2);
    const slotH = Math.max(1, (trayHeight - slotGap * 2) / 3);
    const startY = trayTop;

    state.tray.forEach((shape, i) => {
      shape.slot = {
        x: sideX + slotGap,
        y: startY + i * (slotH + slotGap),
        w: slotW,
        h: slotH,
      };
    });
  }

  function drawRoundedRect(x, y, w, h, r, fill, stroke) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function drawBlock(x, y, size, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    drawRoundedRect(x + 1, y + 1, size - 2, size - 2, Math.max(2, size * 0.12), color, "#0b1022");
    ctx.globalAlpha = 1;
  }

  function addBurnEffect(cells) {
    const now = performance.now();
    cells.forEach(({ r, c }) => {
      state.burnFlashes.push({
        r,
        c,
        start: now,
        duration: 280,
      });
      const emberCount = 4;
      for (let i = 0; i < emberCount; i++) {
        const angle = (Math.PI * 2 * i) / emberCount + Math.random() * 0.8;
        const speed = 0.08 + Math.random() * 0.08;
        state.burnEmbers.push({
          r,
          c,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.03,
          life: 260 + Math.random() * 160,
          born: now,
          size: 3 + Math.random() * 3,
          color: Math.random() > 0.5 ? "#fb923c" : "#facc15",
        });
      }
    });
  }

  function drawBurnEffects(now) {
    const { boardX, boardY, cell } = state.layout;

    state.burnFlashes = state.burnFlashes.filter((flash) => now - flash.start < flash.duration);
    state.burnFlashes.forEach((flash) => {
      const t = (now - flash.start) / flash.duration;
      const alpha = Math.max(0, 0.6 * (1 - t));
      const x = boardX + flash.c * cell;
      const y = boardY + flash.r * cell;
      drawBlock(x, y, cell, "#fb923c", alpha);
      drawBlock(x + 2, y + 2, cell - 4, "#fde68a", alpha * 0.55);
    });

    state.burnEmbers = state.burnEmbers.filter((ember) => now - ember.born < ember.life);
    state.burnEmbers.forEach((ember) => {
      const age = now - ember.born;
      const lifeT = age / ember.life;
      const alpha = Math.max(0, 0.8 * (1 - lifeT));
      const baseX = boardX + ember.c * cell + cell / 2;
      const baseY = boardY + ember.r * cell + cell / 2;
      const px = baseX + ember.vx * age;
      const py = baseY + ember.vy * age + 0.00022 * age * age;
      const radius = Math.max(1, ember.size * (1 - lifeT));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ember.color;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function drawGrid() {
    const { boardX, boardY, boardW, boardH, cell } = state.layout;
    drawRoundedRect(boardX - 4, boardY - 4, boardW + 8, boardH + 8, 10, "#1e293b", "#334155");
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = boardX + c * cell;
        const y = boardY + r * cell;
        drawBlock(x, y, cell, "#0f1a34", 0.9);
        if (state.board[r][c]) drawBlock(x, y, cell, state.board[r][c], 1);
      }
    }
  }

  function drawNavbar() {
    const { width, navbarH, restartBtn, scoreboardBtn, backBtn } = state.layout;
    drawRoundedRect(0, 0, width, navbarH, 0, "#0b1228", "#1f2a44");
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.floor(navbarH * 0.38)}px Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const leftLabel = state.currentScreen === "scoreboard" ? "Scoreboard" : `Score: ${state.score}`;
    ctx.fillText(leftLabel, 14, navbarH / 2);

    if (state.currentScreen === "scoreboard") {
      drawRoundedRect(backBtn.x, backBtn.y, backBtn.w, backBtn.h, 10, "#1d4ed8", "#60a5fa");
      ctx.fillStyle = "#eff6ff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${Math.floor(backBtn.h * 0.42)}px Arial`;
      ctx.fillText("Back", backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h / 2 + 1);
      return;
    }

    if (state.gameOver) {
      drawRoundedRect(restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h, 10, "#1d4ed8", "#60a5fa");
      drawRoundedRect(scoreboardBtn.x, scoreboardBtn.y, scoreboardBtn.w, scoreboardBtn.h, 10, "#0f766e", "#2dd4bf");
      ctx.fillStyle = "#eff6ff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${Math.floor(restartBtn.h * 0.42)}px Arial`;
      ctx.fillText("Restart", restartBtn.x + restartBtn.w / 2, restartBtn.y + restartBtn.h / 2 + 1);
      ctx.font = `bold ${Math.floor(scoreboardBtn.h * 0.4)}px Arial`;
      ctx.fillText("Scoreboard", scoreboardBtn.x + scoreboardBtn.w / 2, scoreboardBtn.y + scoreboardBtn.h / 2 + 1);
    }
  }

  function drawShapeMatrix(shape, x, y, cell, alpha = 1) {
    for (let r = 0; r < shape.matrix.length; r++) {
      for (let c = 0; c < shape.matrix[r].length; c++) {
        if (shape.matrix[r][c]) drawBlock(x + c * cell, y + r * cell, cell, shape.color, alpha);
      }
    }
  }

  function drawTrayShape(shape, alpha = 1) {
    const slot = shape.slot;
    drawRoundedRect(slot.x, slot.y, slot.w, slot.h, 12, "#0f172a", "#0f172a");
    const rows = shape.matrix.length;
    const cols = shape.matrix[0].length;
    const innerPadding = 10;
    const size = Math.min(CELL_SIZE, (slot.w - innerPadding * 2) / cols, (slot.h - innerPadding * 2) / rows);
    const x = slot.x + (slot.w - cols * size) / 2;
    const y = slot.y + (slot.h - rows * size) / 2;
    drawShapeMatrix(shape, x, y, size, alpha);
    shape.preview = { x, y, size };
  }

  function drawScoreboardScreen() {
    const { width, height, navbarH } = state.layout;
    const contentH = height - navbarH;
    const panelW = Math.min(width - 20, 520);
    const panelH = Math.min(contentH - 20, 460);
    const panelX = Math.floor((width - panelW) / 2);
    const panelY = Math.floor(navbarH + (contentH - panelH) / 2);
    drawRoundedRect(panelX, panelY, panelW, panelH, 14, "#111d3b", "#26395f");

    const left = panelX + 18;
    const right = panelX + panelW - 18;
    let y = panelY + 28;

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#bfdbfe";
    ctx.font = "bold 20px Arial";
    ctx.fillText("SCOREBOARD", left, y);

    ctx.textAlign = "right";
    ctx.fillStyle = "#fde68a";
    ctx.font = "bold 18px Arial";

    y += 30;
    ctx.strokeStyle = "#233253";
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();

    const rows = state.leaderboard.slice(0, 8);
    const rowGap = 36;
    y += 24;
    ctx.font = "bold 20px Arial";
    rows.forEach((entry, i) => {
      const rank = `${i + 1}.`;
      ctx.textAlign = "left";
      ctx.fillStyle = i === 0 ? "#fcd34d" : "#dbeafe";
      ctx.fillText(rank, left, y + i * rowGap);
      ctx.fillStyle = i === 0 ? "#facc15" : "#e2e8f0";
      ctx.fillText(entry.name, left + 40, y + i * rowGap);
      ctx.textAlign = "right";
      ctx.fillStyle = i === 0 ? "#facc15" : "#93c5fd";
      ctx.fillText(String(entry.score), right, y + i * rowGap);
    });

    if (!rows.length) {
      ctx.textAlign = "left";
      ctx.fillStyle = "#94a3b8";
      ctx.font = "16px Arial";
      ctx.fillText("No scores yet - clear lines to set one.", left, y + 4);
    }
  }

  function drawSidebar() {
    const { sideX, sideY, sideW, sideH } = state.layout;
    drawRoundedRect(sideX, sideY, sideW, sideH, 0, "#0b1228", "#1f2a44");
    state.tray.forEach((shape) => {
      if (!state.drag || state.drag.shape !== shape) drawTrayShape(shape, 1);
    });
  }

  function boardPosFromPointer(shape, px, py) {
    const { boardX, boardY, cell } = state.layout;
    const rows = shape.matrix.length;
    const cols = shape.matrix[0].length;
    const left = px - (cols * cell) / 2;
    const top = py - (rows * cell) / 2;
    const col = Math.round((left - boardX) / cell);
    const row = Math.round((top - boardY) / cell);
    return { row, col };
  }

  function canPlace(shape, row, col) {
    for (let r = 0; r < shape.matrix.length; r++) {
      for (let c = 0; c < shape.matrix[r].length; c++) {
        if (!shape.matrix[r][c]) continue;
        const rr = row + r;
        const cc = col + c;
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) return false;
        if (state.board[rr][cc]) return false;
      }
    }
    return true;
  }

  function place(shape, row, col) {
    for (let r = 0; r < shape.matrix.length; r++) {
      for (let c = 0; c < shape.matrix[r].length; c++) {
        if (shape.matrix[r][c]) state.board[row + r][col + c] = shape.color;
      }
    }
    clearLinesAndScore();
  }

  function clearLinesAndScore() {
    const fullRows = [];
    const fullCols = [];
    for (let r = 0; r < ROWS; r++) {
      if (state.board[r].every((v) => v)) fullRows.push(r);
    }
    for (let c = 0; c < COLS; c++) {
      let full = true;
      for (let r = 0; r < ROWS; r++) {
        if (!state.board[r][c]) {
          full = false;
          break;
        }
      }
      if (full) fullCols.push(c);
    }

    const cellsToClear = new Set();
    fullRows.forEach((r) => {
      for (let c = 0; c < COLS; c++) cellsToClear.add(`${r},${c}`);
    });
    fullCols.forEach((c) => {
      for (let r = 0; r < ROWS; r++) cellsToClear.add(`${r},${c}`);
    });

    const cleared = cellsToClear.size;
    if (!cleared) return;

    const clearedCells = [];
    cellsToClear.forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      clearedCells.push({ r, c });
      state.board[r][c] = 0;
    });
    addBurnEffect(clearedCells);

    const lineCount = fullRows.length + fullCols.length;
    const base = cleared;
    const bonusRate = BONUS_MAP[lineCount] || 0;
    const bonus = Math.round(base * bonusRate);
    state.score += base + bonus;
    if (state.score > state.bestScore) state.bestScore = state.score;
  }

  async function addToLeaderboard(name, score) {
    try {
      const data = await saveScoreToServer(name, score);
      state.leaderboard = data.leaderboard;
      state.bestScore = data.bestScore;
    } catch (error) {
      console.error("Failed to save score to server:", error);
    }
  }

  function submitScoreIfNeeded() {
    const isNewHighest = state.score > state.runStartBestScore;
    if (state.scoreSubmitted || state.score <= 0 || !isNewHighest) return;
    animateModalScore(state.score);
    setModalInitials("");
    if (bootstrapModal) {
      bootstrapModal.show();
      initialsInputs[0].focus();
      initialsInputs[0].select();
    } else {
      addToLeaderboard("AAA", state.score)
        .finally(() => {
          state.scoreSubmitted = true;
        });
    }
  }

  function checkGameOver() {
    if (!state.tray.length) return;
    for (const shape of state.tray) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (canPlace(shape, r, c)) {
            state.gameOver = false;
            return;
          }
        }
      }
    }
    if (!state.gameOver) {
      state.gameOver = true;
      submitScoreIfNeeded();
    }
  }

  function pointerFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    if (e.changedTouches && e.changedTouches.length) {
      return {
        x: e.changedTouches[0].clientX - rect.left,
        y: e.changedTouches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function pickShapeAt(x, y) {
    for (const shape of state.tray) {
      const s = shape.slot;
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return shape;
    }
    return null;
  }

  function pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function resetGame() {
    state.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    state.score = 0;
    state.gameOver = false;
    state.runStartBestScore = state.bestScore;
    state.scoreSubmitted = false;
    state.tray = [];
    state.drag = null;
    state.burnFlashes = [];
    state.burnEmbers = [];
    refillTrayIfNeeded();
  }

  function onPointerDown(e) {
    const p = pointerFromEvent(e);
    state.pointer = p;
    if (state.currentScreen === "scoreboard") {
      if (pointInRect(p.x, p.y, state.layout.backBtn)) {
        state.currentScreen = "game";
      }
      return;
    }
    if (state.gameOver) {
      if (pointInRect(p.x, p.y, state.layout.restartBtn)) {
        resetGame();
        return;
      }
      if (pointInRect(p.x, p.y, state.layout.scoreboardBtn)) {
        state.currentScreen = "scoreboard";
        return;
      }
      return;
    }
    const shape = pickShapeAt(p.x, p.y);
    if (!shape) return;
    state.drag = { shape, x: p.x, y: p.y };
  }

  function onPointerMove(e) {
    if (!state.drag) return;
    const p = pointerFromEvent(e);
    state.pointer = p;
    state.drag.x = p.x;
    state.drag.y = p.y;
  }

  function onPointerUp(e) {
    if (!state.drag) return;
    const p = pointerFromEvent(e);
    const { shape } = state.drag;
    const pos = boardPosFromPointer(shape, p.x, p.y);
    if (canPlace(shape, pos.row, pos.col)) {
      place(shape, pos.row, pos.col);
      state.tray = state.tray.filter((s) => s !== shape);
      refillTrayIfNeeded();
      if (!state.tray.length) refillTrayIfNeeded();
      checkGameOver();
    }
    state.drag = null;
  }

  function drawDragOverlay() {
    if (!state.drag) return;
    const { shape, x, y } = state.drag;
    const { cell, boardX, boardY } = state.layout;
    const pos = boardPosFromPointer(shape, x, y);
    const valid = canPlace(shape, pos.row, pos.col);

    for (let r = 0; r < shape.matrix.length; r++) {
      for (let c = 0; c < shape.matrix[r].length; c++) {
        if (!shape.matrix[r][c]) continue;
        const bx = boardX + (pos.col + c) * cell;
        const by = boardY + (pos.row + r) * cell;
        const inside = pos.row + r >= 0 && pos.row + r < ROWS && pos.col + c >= 0 && pos.col + c < COLS;
        if (inside) drawBlock(bx, by, cell, valid ? shape.color : "#ef4444", 0.55);
      }
    }

    const rows = shape.matrix.length;
    const cols = shape.matrix[0].length;
    const dragCell = cell;
    const dx = x - (cols * dragCell) / 2;
    const dy = y - (rows * dragCell) / 2;
    drawShapeMatrix(shape, dx, dy, dragCell, 0.9);
  }

  function draw() {
    const now = performance.now();
    ctx.clearRect(0, 0, state.layout.width, state.layout.height);
    drawNavbar();
    if (state.currentScreen === "scoreboard") {
      drawScoreboardScreen();
      return;
    }
    drawGrid();
    drawBurnEffects(now);
    drawSidebar();
    drawDragOverlay();

    if (state.gameOver) {
      const { width, height, navbarH } = state.layout;
      ctx.fillStyle = "rgba(2, 6, 23, 0.6)";
      ctx.fillRect(0, navbarH, width, height - navbarH);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 34px Arial";
      ctx.fillText("No moves left", width / 2, height / 2 - 20);
    }
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  function init() {
    resize();
    refillTrayIfNeeded();

    window.addEventListener("resize", resize);
    canvas.addEventListener("mousedown", onPointerDown);
    canvas.addEventListener("mousemove", onPointerMove);
    canvas.addEventListener("mouseup", onPointerUp);
    canvas.addEventListener("mouseleave", onPointerUp);

    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      onPointerDown(e);
    });
    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      onPointerMove(e);
    });
    canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      onPointerUp(e);
    });
    canvas.addEventListener("touchcancel", (e) => {
      e.preventDefault();
      onPointerUp(e);
    });

    initialsInputs.forEach((input, index) => {
      input.addEventListener("input", () => {
        input.value = (input.value || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1);
        input.classList.toggle("focus-caret", !input.value && document.activeElement === input);
        if (input.value && index < initialsInputs.length - 1) {
          initialsInputs[index + 1].focus();
          initialsInputs[index + 1].select();
        }
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !input.value && index > 0) {
          initialsInputs[index - 1].focus();
          initialsInputs[index - 1].select();
        }
      });
      input.addEventListener("focus", () => {
        input.classList.toggle("focus-caret", !input.value);
      });
      input.addEventListener("blur", () => {
        input.classList.remove("focus-caret");
      });
    });

    if (newScoreFormEl) {
      newScoreFormEl.addEventListener("submit", (e) => {
        e.preventDefault();
        const initials = getModalInitials();
        addToLeaderboard(initials, state.score)
          .finally(() => {
            state.scoreSubmitted = true;
            if (bootstrapModal) bootstrapModal.hide();
          });
      });
    }

    fetchScoreboardData()
      .then((data) => {
        state.leaderboard = data.leaderboard;
        state.bestScore = data.bestScore;
        state.runStartBestScore = state.bestScore;
      })
      .catch((error) => {
        console.error("Failed to load scoreboard from server:", error);
      })
      .finally(() => {
        loop();
      });
  }

  init();
})();
