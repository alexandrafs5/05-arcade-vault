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
  H,
  PADDLE_BOUNCE_TOLERANCE,
  PADDLE_H,
  PADDLE_SPEED,
  PADDLE_W,
  PADDLE_Y,
  START_LIVES,
  W,
  type BlockColor,
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
export function createGame() {
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
