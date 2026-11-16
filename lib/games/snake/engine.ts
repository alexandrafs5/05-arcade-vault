import type { CreateEngine, EngineSnapshot, EngineState } from "../types";
import {
  COLS,
  DIRS,
  FIRST_APPLE,
  H,
  MAX_QUEUED_TURNS,
  OPPOSITE,
  ROWS,
  START_HEAD,
  START_LENGTH,
  STEP_MS,
  W,
  type Cell,
  type Dir,
} from "./constants";

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

export const createEngine: CreateEngine = (canvas, cb) => {
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

  game.reset();

  return {
    start() {
      emitIfChanged();
    },
    stop() {},
    setPaused() {},
    restart() {
      game.reset();
      overReported = false;
      lastSnap = null;
      emitIfChanged();
    },
  };
};
