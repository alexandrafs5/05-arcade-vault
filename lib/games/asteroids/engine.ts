import {
  H,
  POWERUP_DROP_CHANCE,
  POWERUP_DURATION,
  W,
  dist,
  rand,
} from "./constants";
import {
  Asteroid,
  Bullet,
  Particle,
  PowerUp,
  Ship,
  type Keys,
} from "./entities";

import type { CreateEngine, EngineSnapshot, EngineState } from "../types";

export const createEngine: CreateEngine = (canvas, cb) => {
  const ctx = canvas.getContext("2d")!;
  canvas.width = W;
  canvas.height = H;

  // ── Input ───────────────────────────────────────────────────────────────────
  const keys: Keys = {};
  const justPressed: Keys = {};

  const SCROLL_KEYS = [
    "Space",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ];

  const onKeyDown = (e: KeyboardEvent) => {
    // Stop the page from scrolling, but keep typing in form fields (game-over name input).
    const t = e.target as HTMLElement | null;
    const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
    if (!typing && SCROLL_KEYS.includes(e.code)) e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };

  function clearInput() {
    for (const k of Object.keys(keys)) delete keys[k];
    for (const k of Object.keys(justPressed)) delete justPressed[k];
  }

  function pressed(code: string) {
    const val = !!justPressed[code];
    justPressed[code] = false;
    return val;
  }

  // ── Game state (per instance) ───────────────────────────────────────────────
  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUps: PowerUp[] = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let state: EngineState = "playing";
  let deadTimer = 0;
  let powerUpSpawned = false;
  let killsSinceSpawn = 0;

  let rafId: number | null = null;
  let lastTime: number | null = null;
  let paused = false;
  let lastSnap: EngineSnapshot | null = null;

  function emitIfChanged() {
    if (
      lastSnap &&
      lastSnap.score === score &&
      lastSnap.hud.lives === lives &&
      lastSnap.hud.level === level &&
      lastSnap.state === state
    )
      return;
    lastSnap = { score, state, hud: { lives, level } };
    cb.onChange(lastSnap);
  }

  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    spawnAsteroids(4);
    clearInput();
    lastTime = null;
    emitIfChanged();
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      state = "gameover";
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state === "gameover") {
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt, keys);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bullet vs asteroid
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += a.points;
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Ship vs asteroid
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    // Level cleared
    if (asteroids.length === 0) nextLevel();
  }

  // ── Draw (world only; HUD and game-over overlay live in the React shell) ────
  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw(ctx));
    asteroids.forEach((a) => a.draw(ctx));
    powerUps.forEach((p) => p.draw(ctx));
    bullets.forEach((b) => b.draw(ctx));
    ship.draw(ctx);

    if (ship.tripleShot > 0) {
      ctx.fillStyle = "#0ff";
      ctx.font = "15px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`3x  ${ship.tripleShot.toFixed(1)}s`, 14, 26);
    }
  }

  // ── Loop ────────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    rafId = requestAnimationFrame(loop);

    if (paused) {
      lastTime = null; // first frame after resume uses dt = 0
      draw();
      return;
    }

    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    const wasOver = state === "gameover";
    update(dt);
    draw();
    emitIfChanged();
    if (!wasOver && state === "gameover") cb.onGameOver(score);
  }

  const onBlur = () => clearInput();

  return {
    start() {
      if (rafId !== null) return;
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      initGame();
      lastTime = null;
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      clearInput();
    },
    setPaused(p: boolean) {
      paused = p;
      clearInput();
      lastTime = null;
    },
    restart() {
      initGame(); // score 0, lives 3, level 1
    },
  };
};
