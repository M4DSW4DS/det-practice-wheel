const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Users/Administrator/Documents/GitHub/det-practice-wheel';
const PORT = 5620;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const rows = [
  { player_id: 1, name: 'MARMARUS', avatar: '🦉', token: 'a1', score: 1200, progress: { read_select: 3 }, inventory: [], updated_at: new Date().toISOString() },
  { player_id: 2, name: 'VOVA', avatar: '🦊', token: 'a2', score: 3400, progress: { read_select: 4 }, inventory: [], updated_at: new Date().toISOString() },
  { player_id: 3, name: 'ANYA', avatar: '🐼', token: 'a3', score: 900, progress: {}, inventory: [], updated_at: new Date().toISOString() },
  { player_id: 4, name: 'FRIEND', avatar: '🐯', token: 'a4', score: 2600, progress: {}, inventory: [], updated_at: new Date().toISOString() }
];

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    localStorage.setItem('detGame_myPlayer', '1');
    localStorage.setItem('detGame_host', '0');
    localStorage.setItem('detGame_migrated', '1');
    localStorage.setItem('detGame_v23', JSON.stringify({ p: 1, score: {}, prog: {}, inv: {} }));
  });
  await ctx.route('**/rest/v1/**', route => {
    const u = route.request().url();
    let body = rows;
    if (u.includes('/links')) body = [{ friend_id: 2 }, { friend_id: 3 }, { friend_id: 4 }];
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Network.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 400 * 1024, uploadThroughput: 400 * 1024 });

  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(2500);

  const metrics = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.metrics.map(x => [x.name, x.value]));

  const info = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const res = performance.getEntriesByType('resource');
    const bytes = res.reduce((s, r) => s + (r.transferSize || 0), 0);
    return {
      nodes: document.getElementsByTagName('*').length,
      drumCards: document.querySelectorAll('.drum-card').length,
      cards: document.querySelectorAll('.player-card').length,
      fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0),
      dcl: Math.round(nav.domContentLoadedEventEnd || 0),
      load: Math.round(nav.loadEventEnd || 0),
      transferKB: Math.round(bytes / 1024),
      resources: res.length,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null
    };
  });

  // spin under 6x CPU
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.evaluate(() => window.executeSpin && executeSpin());
  const frames = await page.evaluate(() => new Promise(resolve => {
    const gaps = []; let last = performance.now(); const start = last; let n = 0;
    const tick = now => {
      gaps.push(now - last); last = now; n++;
      if (now - start < 7000) requestAnimationFrame(tick);
      else resolve({ frames: n, max: Math.round(Math.max(...gaps)), avg: +(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1), over50: gaps.filter(g => g > 50).length });
    };
    requestAnimationFrame(tick);
  }));

  // idle canvas load: count rAF during 2s on wheel
  const idle = await page.evaluate(() => new Promise(resolve => {
    let n = 0; const start = performance.now();
    const tick = () => { n++; if (performance.now() - start < 2000) requestAnimationFrame(tick); else resolve(n); };
    requestAnimationFrame(tick);
  }));

  // updateUI cost
  const upd = await page.evaluate(() => {
    const t = performance.now();
    for (let i = 0; i < 100; i++) updateUI();
    return +((performance.now() - t) / 100).toFixed(2);
  });

  // memory after 100 updateUI
  const after = await page.evaluate(() => performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null);

  console.log(JSON.stringify({ loadMs, ...info, spinFrames: frames, idleFramesPer2s: idle, updateUIms: upd, heapAfterMB: after,
    jsHeapUsedMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), jsHeapTotalMB: +(m.JSHeapTotalSize / 1048576).toFixed(1),
    layoutCount: m.LayoutCount, recalcStyleCount: m.RecalcStyleCount, taskDurationS: +(m.TaskDuration || 0).toFixed(2) }, null, 2));

  await browser.close(); server.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
