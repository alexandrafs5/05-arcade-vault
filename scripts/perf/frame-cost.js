// Frame-cost measurement for Arcade Vault games (SPEC 14).
//
// Run: paste this file's contents as `code` into the playwright MCP tool
// `browser_run_code_unsafe`, with `npm run dev` serving http://localhost:3000.
// It is a single async function expression taking a Playwright `page`.
//
// Metric: CPU time of one requestAnimationFrame callback (update + draw) plus a
// forced canvas flush (`getImageData`), in ms. Headless Chromium throttles the
// native rAF to 1 fps, so rAF is replaced by a 16 ms setTimeout shim. This does
// NOT measure display FPS or GPU time. Compare before/after on the same machine.
//
// Output: one line per game/skin/rate:
//   4x frogger/neon: n=<frames> avg=<ms> p95=<ms> max=<ms>

async (page) => {
  // ---- Constants: edit these to measure other games ----
  const BASE = "http://localhost:3000";
  const GAMES = ["frogger"];
  const SKINS = ["classic", "neon", "retro"];
  const RATES = [1, 4]; // CPU throttle rates
  const WARMUP_MS = 1200; // discarded after load
  const RUN_MS = 3000; // measured window
  const KEY_EVERY_MS = 80;
  const KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"];

  // rAF shim, installed before any page script runs.
  await page.context().addInitScript(() => {
    window.__d = [];
    let id = 0;
    const timers = new Map();
    window.requestAnimationFrame = (cb) => {
      const h = ++id;
      timers.set(
        h,
        setTimeout(() => {
          timers.delete(h);
          const t0 = performance.now();
          cb(t0);
          const c = document.querySelector("canvas");
          const ctx = c && c.getContext("2d");
          if (ctx) ctx.getImageData(0, 0, 1, 1); // force canvas flush
          window.__d.push(performance.now() - t0);
        }, 16),
      );
      return h;
    };
    window.cancelAnimationFrame = (h) => {
      clearTimeout(timers.get(h));
      timers.delete(h);
    };
  });

  const cdp = await page.context().newCDPSession(page);
  const lines = [];

  for (const rate of RATES) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    for (const game of GAMES) {
      for (const skin of SKINS) {
        await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
        await page.evaluate(
          ([g, s]) => localStorage.setItem("av_skin_" + g, s),
          [game, skin],
        );
        await page.goto(`${BASE}/juegos/${game}/jugar`, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForTimeout(WARMUP_MS);
        await page.evaluate(() => {
          window.__d = [];
        });
        const end = Date.now() + RUN_MS;
        while (Date.now() < end) {
          const key = KEYS[Math.floor(Math.random() * KEYS.length)];
          await page.keyboard.press(key);
          await page.waitForTimeout(KEY_EVERY_MS);
        }
        const d = await page.evaluate(() => window.__d.slice());
        const s = [...d].sort((a, b) => a - b);
        const n = s.length;
        const avg = n ? d.reduce((a, b) => a + b, 0) / n : 0;
        const p95 = n ? s[Math.min(n - 1, Math.floor(n * 0.95))] : 0;
        const max = n ? s[n - 1] : 0;
        lines.push(
          `${rate}x ${game}/${skin}: n=${n} avg=${avg.toFixed(1)} p95=${p95.toFixed(1)} max=${max.toFixed(1)}`,
        );
      }
    }
  }

  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  return lines.join("\n");
};
