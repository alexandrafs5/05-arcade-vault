import type { CreateEngine, EngineSnapshot, EngineState } from "../types";
import {
  BLOCK,
  COLS,
  H,
  LINE_SCORES,
  PALETTES,
  PIECES,
  PIECE_TYPES,
  PLAYFIELD_W,
  PREVIEW_X,
  REPEAT_DELAY,
  REPEAT_INTERVAL,
  ROWS,
  W,
  createBoard,
  rotateCW,
  type Palette,
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

// Neon block: dark tinted fill + glowing outline, at pixel position (px, py).
function paintNeonBlock(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  color: string,
  px: number,
  py: number,
  alpha: number,
) {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha * 0.18;
  ctx.fillRect(px + 2, py + 2, BLOCK - 4, BLOCK - 4);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = pal.glow;
  ctx.strokeRect(px + 3, py + 3, BLOCK - 6, BLOCK - 6);
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

// Transparent margin around a baked neon block so the glow is not clipped.
function spriteMargin(pal: Palette): number {
  return Math.ceil(pal.glow * 1.5) + 2;
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  x: number,
  y: number,
  colorIndex: number,
  alpha = 1,
  ghost = false,
  sprite: ImageBitmap | null = null,
) {
  if (!colorIndex) return;
  const color = pal.colors[colorIndex] ?? "#fff";
  const px = x * BLOCK;
  const py = y * BLOCK;
  if (pal.blockStyle === "neon") {
    if (sprite) {
      // Baked block (fill + glowing outline); alpha scales both like live.
      const m = spriteMargin(pal);
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, px - m, py - m);
    } else {
      paintNeonBlock(ctx, pal, color, px, py, alpha);
    }
  } else if (pal.blockStyle === "retro") {
    // Flat and chunky: square with a gap and a hollow core; outline-only ghost.
    ctx.globalAlpha = 1;
    if (ghost) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 3, py + 3, BLOCK - 6, BLOCK - 6);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(px + 2, py + 2, BLOCK - 4, BLOCK - 4);
      ctx.fillStyle = pal.bg;
      ctx.fillRect(px + 8, py + 8, BLOCK - 16, BLOCK - 16);
      ctx.fillStyle = color;
      ctx.fillRect(px + 11, py + 11, BLOCK - 22, BLOCK - 22);
    }
  } else {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, BLOCK - 2, BLOCK - 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)"; // highlight
    ctx.fillRect(px + 1, py + 1, BLOCK - 2, 4);
  }
  ctx.globalAlpha = 1;
}

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
  let idleDrawn = false; // the frozen frame (paused / game over) is on screen
  let lastSnap: EngineSnapshot | null = null;

  // Baked neon blocks, one per piece color (index = color index). Built lazily
  // on the first neon frame; live drawing is used until a sprite is ready.
  let sprites: (ImageBitmap | null)[] = [];
  let building = false;
  let spriteGen = 0;

  function closeSprites() {
    spriteGen++; // invalidates in-flight createImageBitmap calls
    building = false;
    for (const s of sprites) s?.close();
    sprites = [];
  }

  function buildSprites() {
    building = true;
    const gen = spriteGen;
    const p = pal;
    const m = spriteMargin(p);
    const size = BLOCK + 2 * m;
    for (let i = 1; i < p.colors.length; i++) {
      const color = p.colors[i];
      if (!color) continue;
      const off = document.createElement("canvas"); // never attached to the DOM
      off.width = size;
      off.height = size;
      paintNeonBlock(off.getContext("2d")!, p, color, m, m, 1);
      createImageBitmap(off)
        .then((bm) => {
          if (gen !== spriteGen) bm.close();
          else sprites[i] = bm;
        })
        .catch(() => {});
    }
  }

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
    ctx.strokeStyle = pal.grid;
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
      for (let c = 0; c < COLS; c++)
        drawBlock(
          ctx,
          pal,
          c,
          r,
          board[r][c],
          1,
          false,
          sprites[board[r][c]] ?? null,
        );

    const gy = game.ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(
            ctx,
            pal,
            current.x + c,
            gy + r,
            current.shape[r][c],
            pal.ghostAlpha,
            true,
            sprites[current.shape[r][c]] ?? null,
          );

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(
          ctx,
          pal,
          current.x + c,
          current.y + r,
          current.shape[r][c],
          1,
          false,
          sprites[current.shape[r][c]] ?? null,
        );
  }

  // Next piece in the side strip, centered in a 4x4 cell box.
  function drawPreview() {
    ctx.strokeStyle = pal.divider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PREVIEW_X + 0.5, 0);
    ctx.lineTo(PREVIEW_X + 0.5, H);
    ctx.stroke();

    ctx.fillStyle = pal.label;
    ctx.font = pal.font;
    ctx.textAlign = "center";
    ctx.fillText("SIGUIENTE", PREVIEW_X + (W - PREVIEW_X) / 2, 28);

    const shape = game.next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    ctx.save();
    ctx.translate(PREVIEW_X + (W - PREVIEW_X - 4 * BLOCK) / 2, 44);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(
          ctx,
          pal,
          offX + c,
          offY + r,
          shape[r][c],
          1,
          false,
          sprites[shape[r][c]] ?? null,
        );
    ctx.restore();
  }

  function draw() {
    if (pal.blockStyle === "neon" && !building) buildSprites();
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    drawPlayfield();
    drawPreview();
  }

  // Held-key repeat: code -> seconds until the next repeat.
  const held = new Map<string, number>();
  const REPEATING = ["ArrowLeft", "ArrowRight", "ArrowDown"];

  function act(code: string) {
    switch (code) {
      case "ArrowLeft":
        game.moveX(-1);
        break;
      case "ArrowRight":
        game.moveX(1);
        break;
      case "ArrowDown":
        game.softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        game.rotate();
        break;
      case "Space":
        game.hardDrop();
        break;
    }
  }

  function isTyping(e: KeyboardEvent) {
    const t = e.target;
    return (
      t instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(t.tagName)
    );
  }

  function onKeyDown(e: KeyboardEvent) {
    if (isTyping(e)) return;
    if (
      ["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
        e.code,
      )
    )
      e.preventDefault();
    if (paused || game.over || e.repeat) return;
    if (REPEATING.includes(e.code)) {
      if (held.has(e.code)) return;
      held.set(e.code, REPEAT_DELAY);
    }
    act(e.code);
    emitIfChanged();
  }

  function clearInput() {
    held.clear();
  }

  function onKeyUp(e: KeyboardEvent) {
    held.delete(e.code);
  }

  function applyRepeats(dt: number) {
    for (const [code, t] of held) {
      let left = t - dt;
      while (left <= 0 && !game.over) {
        act(code);
        left += REPEAT_INTERVAL;
      }
      held.set(code, left);
    }
  }

  function frame(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = paused ? null : ts;
    if (!paused) {
      game.tick(dt);
      applyRepeats(dt);
    }
    emitIfChanged();
    // Nothing moves while paused or after game over: repaint once, then skip.
    if (!paused && !game.over) {
      draw();
      idleDrawn = false;
    } else if (!idleDrawn) {
      draw();
      idleDrawn = true;
    }
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
      emitIfChanged();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearInput);
      clearInput();
      closeSprites();
    },
    setPaused(p) {
      paused = p;
      idleDrawn = false; // repaint once on the next frame
      lastTime = null;
      clearInput();
    },
    setSkin(skin) {
      pal = PALETTES[skin];
      closeSprites(); // rebuilt lazily on the next neon frame
      idleDrawn = false;
      if (paused) {
        draw();
        idleDrawn = true;
      }
    },
    restart() {
      game.reset();
      paused = false;
      lastTime = null;
      clearInput();
      overReported = false;
      lastSnap = null;
      emitIfChanged();
    },
  };
};
