#!/usr/bin/env node
// Requer o preview de produção na porta 4399; QA_URL pode apontar para outro host/base.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const browser = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
  await page.goto(process.env.QA_URL ?? 'http://127.0.0.1:4399/labs/hard-context-and-baggage/');
  const lab = page.getByTestId('context-lab');
  await lab.scrollIntoViewIfNeeded();
  await lab.getByRole('radio', { name: 'Iso', exact: true }).click();
  await page.waitForFunction(() => ['webgl2', 'webgpu'].includes(document.querySelector('.iso-stage')?.getAttribute('data-backend')));
  await page.waitForTimeout(2500);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await lab.getByRole('button', { name: /Fan-out, and the baggage/ }).click();
  await page.evaluate(() => {
    window.__isoQA = { samples: [], last: performance.now(), raf: 0 };
    const tick = (t) => {
      window.__isoQA.samples.push(t - window.__isoQA.last);
      window.__isoQA.last = t;
      window.__isoQA.raf = requestAnimationFrame(tick);
    };
    window.__isoQA.raf = requestAnimationFrame(tick);
  });
  await page.waitForTimeout(3500);
  const result = await page.evaluate(() => {
    cancelAnimationFrame(window.__isoQA.raf);
    const a = window.__isoQA.samples.slice(2).sort((a, b) => a - b);
    const stage = document.querySelector('.iso-stage');
    return {
      rafFps: a.length ? Math.round(a.length / a.reduce((s, x) => s + x, 0) * 10000) / 10 : 0,
      p95: a.length ? Math.round(a[Math.floor(a.length * .95)]) : 0,
      backend: stage.getAttribute('data-backend'),
      quality: stage.getAttribute('data-qualidade'),
      drawCalls: Number(stage.getAttribute('data-chamadas')),
    };
  });
  const output = fileURLToPath(new URL('../qa-report/', import.meta.url));
  mkdirSync(output, { recursive: true });
  writeFileSync(output + 'iso.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
