import type { SkinId } from "../skins";
import type { CreateEngine, EngineSnapshot, EngineState } from "../types";
import {
  BALL_SIZE,
  BASE_BALL_VX,
  BASE_BALL_VY,
  BLOCK_H,
  BLOCK_SCORE,
  BLOCK_W,
  BLOCKS_ORIGIN_X,
  BLOCKS_ORIGIN_Y,
  EXPLOSION_DURATION,
  EXPLOSION_FRAME_COUNT,
  EXPLOSION_FRAMES,
  H,
  PALETTES,
  PADDLE_BOUNCE_TOLERANCE,
  PADDLE_H,
  PADDLE_SPEED,
  PADDLE_W,
  PADDLE_Y,
  SPRITES,
  SPRITESHEET_URL,
  START_LIVES,
  W,
  type BlockColor,
  type Rect,
} from "./constants";
import { LEVELS } from "./levels";

export type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
};

export type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number; // ms
};

// Game rules, no canvas and no timers. Everything lives in this closure.
function createGame() {
  const paddle = { x: 0, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
  const ball = {
    x: 0,
    y: 0,
    w: BALL_SIZE,
    h: BALL_SIZE,
    vx: BASE_BALL_VX,
    vy: BASE_BALL_VY,
  };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let over = false;

  // Ball on top of the paddle, launched instantly with the current level speed.
  function placeBall() {
    const speed = LEVELS[level - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    level = n;
    blocks = LEVELS[n - 1].blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    placeBall();
  }

  function hitsBlock(b: Block): boolean {
    return (
      ball.x < b.x + b.w &&
      ball.x + ball.w > b.x &&
      ball.y < b.y + b.h &&
      ball.y + ball.h > b.y
    );
  }

  return {
    reset() {
      score = 0;
      lives = START_LIVES;
      over = false;
      paddle.x = (W - paddle.w) / 2;
      loadLevel(1);
    },
    // Mouse: center the paddle on `centerX` (logic pixels).
    setPaddleCenter(centerX: number) {
      if (over) return;
      paddle.x = Math.max(0, Math.min(W - paddle.w, centerX - paddle.w / 2));
    },
    // `dir`: -1 left, 1 right, 0 none. `dt` in seconds.
    update(dt: number, dir: -1 | 0 | 1) {
      if (over) return;

      paddle.x = Math.max(
        0,
        Math.min(W - paddle.w, paddle.x + dir * PADDLE_SPEED * dt),
      );

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Walls: left, right, top. The bottom is open.
      if (ball.x <= 0) {
        ball.x = 0;
        ball.vx = Math.abs(ball.vx);
      }
      if (ball.x + ball.w >= W) {
        ball.x = W - ball.w;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y <= 0) {
        ball.y = 0;
        ball.vy = Math.abs(ball.vy);
      }

      // Paddle: only when falling; vx is unchanged (no angle control).
      if (
        ball.vy > 0 &&
        ball.x + ball.w > paddle.x &&
        ball.x < paddle.x + paddle.w &&
        ball.y + ball.h >= paddle.y &&
        ball.y + ball.h <= paddle.y + paddle.h + PADDLE_BOUNCE_TOLERANCE
      ) {
        ball.y = paddle.y - ball.h;
        ball.vy = -Math.abs(ball.vy);
      }

      // Blocks: at most one per frame; always flips vy (as in the original).
      for (const b of blocks) {
        if (!b.alive || !hitsBlock(b)) continue;
        b.alive = false;
        explosions.push({
          x: b.x,
          y: b.y,
          w: b.w,
          h: b.h,
          color: b.color,
          elapsed: 0,
        });
        score += BLOCK_SCORE;
        ball.vy = -ball.vy;
        if (blocks.every((k) => !k.alive)) {
          if (level < LEVELS.length) loadLevel(level + 1);
          else over = true; // cleared the last level: win ends the game
        }
        break;
      }

      for (const e of explosions) e.elapsed += dt * 1000;
      explosions = explosions.filter((e) => e.elapsed < EXPLOSION_DURATION);

      // Ball lost.
      if (!over && ball.y > H) {
        lives--;
        if (lives <= 0) {
          lives = 0;
          over = true;
        } else {
          placeBall();
        }
      }
    },
    get paddle() {
      return paddle;
    },
    get ball() {
      return ball;
    },
    get blocks() {
      return blocks;
    },
    get explosions() {
      return explosions;
    },
    get score() {
      return score;
    },
    get lives() {
      return lives;
    },
    get level() {
      return level;
    },
    get over() {
      return over;
    },
  };
}

type SpriteStatus = "idle" | "loading" | "ready" | "error";

export const createEngine: CreateEngine = (canvas, cb, opts) => {
  let pal = PALETTES[opts?.skin ?? "classic"];
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

  // Keyboard: both keys held cancel out.
  const keys = { left: false, right: false };
  const inputDir = (): -1 | 0 | 1 =>
    keys.left === keys.right ? 0 : keys.left ? -1 : 1;

  function clearInput() {
    keys.left = false;
    keys.right = false;
  }

  function isTyping(e: KeyboardEvent) {
    const t = e.target;
    return (
      t instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(t.tagName)
    );
  }

  function onKeyDown(e: KeyboardEvent) {
    if (isTyping(e)) return;
    if (e.code !== "ArrowLeft" && e.code !== "ArrowRight") return;
    e.preventDefault();
    if (paused) return;
    if (e.code === "ArrowLeft") keys.left = true;
    else keys.right = true;
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code === "ArrowLeft") keys.left = false;
    else if (e.code === "ArrowRight") keys.right = false;
  }

  // Mouse: the canvas is scaled by CSS, so convert to logic pixels.
  function onMouseMove(e: MouseEvent) {
    if (paused || game.over) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    game.setPaddleCenter(((e.clientX - rect.left) * W) / rect.width);
  }

  // Spritesheet: loaded inside start(), never at module level.
  let sheet: HTMLImageElement | null = null;
  let sheetStatus: SpriteStatus = "idle";

  function loadSheet() {
    if (sheetStatus !== "idle") return;
    sheetStatus = "loading";
    const img = new Image();
    sheet = img;
    img.onload = () => {
      if (!running || sheet !== img) return; // stopped while loading
      sheetStatus = "ready";
    };
    img.onerror = () => {
      if (!running || sheet !== img) return;
      console.error(`Arkanoid: failed to load ${SPRITESHEET_URL}`);
      sheetStatus = "error"; // flat-rect fallback keeps the game playable
    };
    img.src = SPRITESHEET_URL;
  }

  function emitIfChanged() {
    const state: EngineState = game.over ? "gameover" : "playing";
    if (
      lastSnap &&
      lastSnap.score === game.score &&
      lastSnap.state === state &&
      lastSnap.hud.lives === game.lives &&
      lastSnap.hud.level === game.level
    )
      return;
    lastSnap = {
      score: game.score,
      state,
      hud: { lives: game.lives, level: game.level },
    };
    cb.onChange(lastSnap);
    if (state === "gameover" && !overReported) {
      overReported = true;
      cb.onGameOver(game.score);
    }
  }

  function drawSprite(
    r: Rect,
    x: number,
    y: number,
    w: number,
    h: number,
    fallback: string,
  ) {
    if (sheetStatus === "ready" && sheet) {
      ctx.drawImage(sheet, r.sx, r.sy, r.sw, r.sh, x, y, w, h);
    } else {
      ctx.fillStyle = fallback;
      ctx.fillRect(x, y, w, h);
    }
  }

  // Vector redraw for neon/retro. Glow is reset after every draw.
  function drawBlock(x: number, y: number, w: number, h: number, c: string) {
    if (pal.style === "neon") {
      ctx.shadowColor = c;
      ctx.shadowBlur = pal.glow;
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * 0.2;
      ctx.fillStyle = c;
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.globalAlpha = prev;
    } else {
      ctx.fillStyle = c;
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    }
  }

  function drawSolid(x: number, y: number, w: number, h: number, c: string) {
    ctx.fillStyle = c;
    if (pal.style === "neon") {
      ctx.shadowColor = c;
      ctx.shadowBlur = pal.glow;
    }
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }

  function draw() {
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    if (sheetStatus !== "ready" && sheetStatus !== "error") return;
    const sprite = pal.style === "sprite";

    for (const b of game.blocks) {
      if (!b.alive) continue;
      if (sprite)
        drawSprite(
          SPRITES.blocks[b.color],
          b.x,
          b.y,
          b.w,
          b.h,
          pal.blocks[b.color],
        );
      else drawBlock(b.x, b.y, b.w, b.h, pal.blocks[b.color]);
    }

    for (const e of game.explosions) {
      const t = e.elapsed / EXPLOSION_DURATION;
      if (sprite) {
        const i = Math.min(
          Math.floor(t * EXPLOSION_FRAME_COUNT),
          EXPLOSION_FRAME_COUNT - 1,
        );
        drawSprite(
          EXPLOSION_FRAMES[e.color][i],
          e.x,
          e.y,
          e.w,
          e.h,
          pal.explosion,
        );
      } else if (pal.style === "neon") {
        const g = t * 8;
        ctx.globalAlpha = Math.max(0, 1 - t);
        drawBlock(e.x - g, e.y - g, e.w + g * 2, e.h + g * 2, pal.explosion);
        ctx.globalAlpha = 1;
      } else if (Math.floor(t * 4) % 2 === 0) {
        drawBlock(e.x, e.y, e.w, e.h, pal.explosion); // flat blink
      }
    }

    const { paddle, ball } = game;
    if (sprite) {
      drawSprite(
        SPRITES.paddle,
        paddle.x,
        paddle.y,
        paddle.w,
        paddle.h,
        pal.paddle,
      );
      drawSprite(SPRITES.ball, ball.x, ball.y, ball.w, ball.h, pal.ball);
    } else {
      drawSolid(paddle.x, paddle.y, paddle.w, paddle.h, pal.paddle);
      drawSolid(ball.x, ball.y, ball.w, ball.h, pal.ball);
    }
  }

  function frame(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = paused ? null : ts;
    const ready = sheetStatus === "ready" || sheetStatus === "error";
    if (!paused && ready) game.update(dt, inputDir());
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
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", clearInput);
      canvas.addEventListener("mousemove", onMouseMove);
      loadSheet();
      emitIfChanged();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearInput);
      canvas.removeEventListener("mousemove", onMouseMove);
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
    setPaused(p) {
      paused = p;
      lastTime = null;
      clearInput();
    },
    setSkin(skin: SkinId) {
      pal = PALETTES[skin];
      if (paused) draw(); // repaint one frame; no state change
    },
    restart() {
      game.reset();
      overReported = false;
      lastSnap = null;
      lastTime = null;
      emitIfChanged();
    },
  };
};
