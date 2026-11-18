import type { CreateEngine, EngineSnapshot, EngineState } from "../types";
import {
  APPLE_SPRITE,
  CELL,
  COLS,
  DIRS,
  FIRST_APPLE,
  H,
  KEY_TO_DIR,
  MAX_QUEUED_TURNS,
  OPPOSITE,
  PALETTES,
  ROWS,
  START_HEAD,
  START_LENGTH,
  SPRITE_URL,
  STEP_MS,
  W,
  type Cell,
  type Dir,
} from "./constants";

const EYE_SIDES = [-1, 1];

// Game rules, no canvas and no timers. Everything lives in this closure.
function createGame() {
  let snake: Cell[] = []; // head first
  let dir: Dir = "right"; // direction of the last executed step
  let queue: Dir[] = []; // pending turns, at most MAX_QUEUED_TURNS
  let apple: Cell | null = null;
  let started = false; // the snake waits for the first valid key
  let score = 0;
  let over = false;
  let acc = 0; // seconds since the last step

  const same = (a: Cell, b: Cell) => a.col === b.col && a.row === b.row;

  // Uniform pick among cells the snake does not occupy.
  function spawnApple() {
    const free: Cell[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const c = { col, row };
        if (!snake.some((s) => same(s, c))) free.push(c);
      }
    }
    apple = free[Math.floor(Math.random() * free.length)] ?? null;
  }

  // Moves the snake one cell: eat, grow, collide, win.
  function step() {
    if (queue.length > 0) dir = queue.shift()!;
    const d = DIRS[dir];
    const head = snake[0];
    const next = { col: head.col + d.col, row: head.row + d.row };

    if (next.col < 0 || next.col >= COLS || next.row < 0 || next.row >= ROWS) {
      over = true;
      return;
    }

    const eating = apple !== null && same(next, apple);
    // The tail leaves its cell this step unless the snake grows.
    const body = eating ? snake : snake.slice(0, -1);
    if (body.some((s) => same(s, next))) {
      over = true;
      return;
    }

    snake.unshift(next);
    if (!eating) {
      snake.pop();
      return;
    }

    score += 1;
    if (snake.length >= COLS * ROWS) {
      apple = null;
      over = true; // board full: win ends the game
    } else {
      spawnApple();
    }
  }

  return {
    reset() {
      snake = [];
      for (let i = 0; i < START_LENGTH; i++) {
        snake.push({ col: START_HEAD.col - i, row: START_HEAD.row });
      }
      dir = "right";
      queue = [];
      apple = { ...FIRST_APPLE };
      started = false;
      score = 0;
      over = false;
      acc = 0;
    },
    // Validated against the last queued direction (or the current one).
    turn(d: Dir) {
      if (over) return;
      const last = queue.length > 0 ? queue[queue.length - 1] : dir;
      if (d === OPPOSITE[last]) return; // 180 degree reversal
      if (d === last) {
        started = true; // same direction as the current one only starts the game
        return;
      }
      if (queue.length >= MAX_QUEUED_TURNS) return;
      queue.push(d);
      started = true;
    },
    clearTurns() {
      queue = [];
    },
    // `dt` in seconds. At most one step per call, so a long frame never skips cells.
    update(dt: number) {
      if (over || !started) return;
      acc += dt;
      if (acc >= STEP_MS / 1000) {
        acc -= STEP_MS / 1000;
        step();
      }
    },
    get snake() {
      return snake;
    },
    get dir() {
      return dir;
    },
    get apple() {
      return apple;
    },
    get score() {
      return score;
    },
    get length() {
      return snake.length;
    },
    get over() {
      return over;
    },
  };
}

export const createEngine: CreateEngine = (canvas, cb, opts) => {
  let pal = PALETTES[opts?.skin ?? "classic"];
  canvas.width = W;
  canvas.height = H;

  const game = createGame();
  let overReported = false;
  let lastSnap: EngineSnapshot | null = null;

  // onChange only when score, state or a hud value changes; onGameOver once per game.
  function emitIfChanged() {
    const state: EngineState = game.over ? "gameover" : "playing";
    if (
      lastSnap &&
      lastSnap.score === game.score &&
      lastSnap.state === state &&
      lastSnap.hud.length === game.length
    )
      return;
    lastSnap = {
      score: game.score,
      state,
      hud: { length: game.length },
    };
    cb.onChange(lastSnap);
    if (state === "gameover" && !overReported) {
      overReported = true;
      cb.onGameOver(game.score);
    }
  }

  const ctx = canvas.getContext("2d")!;
  let paused = false;
  let running = false;
  let rafId = 0;
  let lastTime: number | null = null; // null = next frame uses dt = 0
  // True once the current frozen state (paused or game over) has been painted.
  let idlePainted = false;

  // Apple sprite: loaded inside start(), never at module level.
  let sheet: HTMLImageElement | null = null;
  let sheetStatus: "idle" | "loading" | "ready" | "error" = "idle";

  function loadSheet() {
    if (sheetStatus !== "idle") return;
    sheetStatus = "loading";
    const img = new Image();
    sheet = img;
    img.onload = () => {
      if (!running || sheet !== img) return; // stopped while loading
      sheetStatus = "ready";
      idlePainted = false;
    };
    img.onerror = () => {
      if (!running || sheet !== img) return;
      console.error(`Snake: failed to load ${SPRITE_URL}`);
      sheetStatus = "error"; // flat-circle fallback keeps the game playable
      idlePainted = false;
    };
    img.src = SPRITE_URL;
  }

  function drawBoard() {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        ctx.fillStyle = (col + row) % 2 === 0 ? pal.boardA : pal.boardB;
        ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
      }
    }
    if (pal.grid) {
      ctx.strokeStyle = pal.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 0; c <= COLS; c++) {
        ctx.moveTo(c * CELL + 0.5, 0);
        ctx.lineTo(c * CELL + 0.5, H);
      }
      for (let r = 0; r <= ROWS; r++) {
        ctx.moveTo(0, r * CELL + 0.5);
        ctx.lineTo(W, r * CELL + 0.5);
      }
      ctx.stroke();
    }
  }

  function drawApple() {
    const a = game.apple;
    if (!a) return;
    const cx = a.col * CELL + CELL / 2;
    const cy = a.row * CELL + CELL / 2;
    if (pal.appleStyle === "orb") {
      ctx.shadowColor = pal.apple;
      ctx.shadowBlur = pal.glow;
      ctx.fillStyle = pal.apple;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      ctx.fillStyle = pal.appleHighlight;
      ctx.fillRect(cx - 2, cy - CELL * 0.46, 4, CELL * 0.16); // stem
    } else if (pal.appleStyle === "pixel") {
      const u = CELL / 9;
      const ox = cx - 3.5 * u;
      const oy = cy - 3.5 * u;
      ctx.fillStyle = pal.apple;
      ctx.fillRect(ox + u, oy + u, 5 * u, 6 * u);
      ctx.fillRect(ox, oy + 2 * u, 7 * u, 4 * u);
      ctx.fillStyle = pal.appleHighlight;
      ctx.fillRect(ox + 1.5 * u, oy + 2 * u, u, u);
      ctx.fillRect(ox + 3 * u, oy - u, u, 1.5 * u); // stem
    } else if (sheetStatus === "ready" && sheet) {
      // Keep the sprite aspect ratio (110x160), centered in the cell.
      const h = CELL * 0.9;
      const w = (h * APPLE_SPRITE.w) / APPLE_SPRITE.h;
      ctx.drawImage(
        sheet,
        APPLE_SPRITE.x,
        APPLE_SPRITE.y,
        APPLE_SPRITE.w,
        APPLE_SPRITE.h,
        cx - w / 2,
        cy - h / 2,
        w,
        h,
      );
    } else {
      ctx.fillStyle = pal.apple;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSnake() {
    const cells = game.snake;
    const hx = cells[0].col * CELL + CELL / 2;
    const hy = cells[0].row * CELL + CELL / 2;

    // Body: one rounded line through the cell centers.
    ctx.shadowColor = pal.snake;
    ctx.shadowBlur = pal.glow;
    ctx.fillStyle = pal.snake;
    ctx.strokeStyle = pal.snake;
    if (pal.bodyStyle === "blocks") {
      // Chunky flat squares, one per cell.
      for (const c of cells) {
        ctx.fillRect(c.col * CELL + 3, c.row * CELL + 3, CELL - 6, CELL - 6);
      }
    } else {
      ctx.lineWidth = CELL * 0.72;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < cells.length; i++) {
        const x = cells[i].col * CELL + CELL / 2;
        const y = cells[i].row * CELL + CELL / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // Head: slightly bigger.
      ctx.beginPath();
      ctx.arc(hx, hy, CELL * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    // Two eyes looking in the move direction.
    const d = DIRS[game.dir];
    const fx = d.col; // forward
    const fy = d.row;
    const sx = -d.row; // sideways
    const sy = d.col;
    for (const side of EYE_SIDES) {
      const ex = hx + fx * CELL * 0.12 + sx * side * CELL * 0.17;
      const ey = hy + fy * CELL * 0.12 + sy * side * CELL * 0.17;
      ctx.fillStyle = pal.eyeWhite;
      if (pal.eyeShape === "square") {
        const r = CELL * 0.08;
        ctx.fillRect(ex - r, ey - r, r * 2, r * 2);
        continue;
      }
      ctx.beginPath();
      ctx.arc(ex, ey, CELL * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.eyePupil;
      ctx.beginPath();
      ctx.arc(
        ex + fx * CELL * 0.04,
        ey + fy * CELL * 0.04,
        CELL * 0.055,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  function draw() {
    drawBoard();
    if (sheetStatus === "ready" || sheetStatus === "error") drawApple();
    drawSnake();
  }

  function frame(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = paused ? null : ts;
    const ready = sheetStatus === "ready" || sheetStatus === "error";
    if (!paused && ready) game.update(dt);
    emitIfChanged();
    // Nothing moves while paused or after game over: paint once, then skip.
    const idle = paused || game.over;
    if (!idle || !idlePainted) {
      draw();
      idlePainted = idle;
    }
    rafId = requestAnimationFrame(frame);
  }

  function isTyping(e: KeyboardEvent) {
    const t = e.target;
    return (
      t instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(t.tagName)
    );
  }

  function onKeyDown(e: KeyboardEvent) {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const d = KEY_TO_DIR[e.key.toLowerCase()];
    if (!d) return;
    if (e.key.startsWith("Arrow")) e.preventDefault(); // no page scroll
    if (paused) return;
    game.turn(d);
  }

  function clearInput() {
    game.clearTurns();
  }

  game.reset();

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = null;
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("blur", clearInput);
      loadSheet();
      emitIfChanged();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", clearInput);
      clearInput();
      if (sheetStatus === "loading") {
        if (sheet) {
          sheet.onload = null;
          sheet.onerror = null;
        }
        sheet = null;
        sheetStatus = "idle"; // reload on the next start()
      }
    },
    setSkin(skin) {
      pal = PALETTES[skin];
      idlePainted = false;
      if (paused && (sheetStatus === "ready" || sheetStatus === "error"))
        draw();
    },
    setPaused(p) {
      paused = p;
      idlePainted = false;
      lastTime = null;
      clearInput();
    },
    restart() {
      game.reset();
      idlePainted = false;
      overReported = false;
      lastSnap = null;
      lastTime = null;
      emitIfChanged();
    },
  };
};
