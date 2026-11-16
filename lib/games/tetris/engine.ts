import type { CreateEngine, EngineSnapshot, EngineState } from "../types";
import {
  BLOCK,
  COLORS,
  COLS,
  GRID_LINE,
  H,
  LINE_SCORES,
  PIECES,
  PIECE_TYPES,
  PLAYFIELD_W,
  PREVIEW_X,
  ROWS,
  W,
  createBoard,
  rotateCW,
  type Shape,
} from "./constants";

type Piece = { type: number; shape: Shape; x: number; y: number };

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * PIECE_TYPES) + 1;
  const shape = PIECES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

// Game rules, no canvas and no timers. Everything lives in this closure.
function createGame() {
  let board = createBoard();
  let current = randomPiece();
  let next = randomPiece();
  let score = 0;
  let lines = 0;
  let level = 1;
  let over = false;
  let dropInterval = 1000; // ms, as in the original
  let dropAccum = 0; // ms

  function collide(shape: Shape, ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) over = true;
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  return {
    reset() {
      board = createBoard();
      score = 0;
      lines = 0;
      level = 1;
      over = false;
      dropInterval = 1000;
      dropAccum = 0;
      next = randomPiece();
      spawn();
    },
    moveX(dir: -1 | 1) {
      if (over) return;
      if (!collide(current.shape, current.x + dir, current.y)) current.x += dir;
    },
    rotate() {
      if (over) return;
      const rotated = rotateCW(current.shape);
      for (const kick of [0, -1, 1, -2, 2]) {
        if (!collide(rotated, current.x + kick, current.y)) {
          current.shape = rotated;
          current.x += kick;
          return;
        }
      }
    },
    softDrop() {
      if (over) return;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
        score += 1;
      } else {
        lockPiece();
      }
    },
    hardDrop() {
      if (over) return;
      const gy = ghostY();
      score += (gy - current.y) * 2;
      current.y = gy;
      lockPiece();
    },
    // Gravity. `dt` in seconds; the accumulator resets on each drop (original).
    tick(dt: number) {
      if (over) return;
      dropAccum += dt * 1000;
      if (dropAccum >= dropInterval) {
        dropAccum = 0;
        if (!collide(current.shape, current.x, current.y + 1)) current.y++;
        else lockPiece();
      }
    },
    ghostY,
    get board() {
      return board;
    },
    get current() {
      return current;
    },
    get next() {
      return next;
    },
    get score() {
      return score;
    },
    get lines() {
      return lines;
    },
    get level() {
      return level;
    },
    get over() {
      return over;
    },
  };
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorIndex: number,
  alpha = 1,
) {
  if (!colorIndex) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS[colorIndex] ?? "#fff";
  ctx.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; // highlight
  ctx.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, 4);
  ctx.globalAlpha = 1;
}

export const createEngine: CreateEngine = (canvas, cb) => {
  const ctx = canvas.getContext("2d")!;
  canvas.width = W;
  canvas.height = H;

  const game = createGame();
  let paused = false;
  let running = false;
  let rafId = 0;
  let lastTime: number | null = null; // null = next frame uses dt = 0
  let overReported = false;
  let lastSnap: EngineSnapshot | null = null;

  function emitIfChanged() {
    const state: EngineState = game.over ? "gameover" : "playing";
    if (
      lastSnap &&
      lastSnap.score === game.score &&
      lastSnap.state === state &&
      lastSnap.hud.lines === game.lines &&
      lastSnap.hud.level === game.level
    )
      return;
    lastSnap = {
      score: game.score,
      state,
      hud: { lines: game.lines, level: game.level },
    };
    cb.onChange(lastSnap);
    if (state === "gameover" && !overReported) {
      overReported = true;
      cb.onGameOver(game.score);
    }
  }

  function drawPlayfield() {
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, H);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(PLAYFIELD_W, r * BLOCK);
      ctx.stroke();
    }

    const { board, current } = game;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c]);

    const gy = game.ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], 0.2);

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c]);
  }

  // Next piece in the side strip, centered in a 4x4 cell box.
  function drawPreview() {
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PREVIEW_X + 0.5, 0);
    ctx.lineTo(PREVIEW_X + 0.5, H);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("SIGUIENTE", PREVIEW_X + (W - PREVIEW_X) / 2, 28);

    const shape = game.next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    ctx.save();
    ctx.translate(PREVIEW_X + (W - PREVIEW_X - 4 * BLOCK) / 2, 44);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(ctx, offX + c, offY + r, shape[r][c]);
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawPlayfield();
    drawPreview();
  }

  function frame(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = paused ? null : ts;
    if (!paused) game.tick(dt);
    emitIfChanged();
    draw();
    rafId = requestAnimationFrame(frame);
  }

  game.reset();

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = null;
      emitIfChanged();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    setPaused(p) {
      paused = p;
      lastTime = null;
    },
    restart() {
      game.reset();
      paused = false;
      lastTime = null;
      overReported = false;
      lastSnap = null;
      emitIfChanged();
    },
  };
};
