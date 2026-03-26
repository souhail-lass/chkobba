import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import serveHandler from 'serve-handler';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, '..', 'dist');

const routes = [
  { route: '/', waitFor: '#landing-title', outFile: path.join(distDir, 'index.html') },
  { route: '/how-to-play', waitFor: '#how-to-play-title', outFile: path.join(distDir, 'how-to-play', 'index.html') },
];

function rewriteSeoHead(html, route) {
  if (route === '/') return html;
  if (route === '/how-to-play') {
    const url = 'https://chkobba.app/how-to-play';
    return html
      .replaceAll('href="https://chkobba.app/"', `href="${url}"`)
      .replaceAll('content="https://chkobba.app/"', `content="${url}"`)
      .replace(
        /<title>.*?<\/title>/,
        '<title>Comment jouer à la Chkobba — règles (Chkobba)</title>',
      )
      .replace(
        /<meta name="description" content="[^"]*">/,
        '<meta name="description" content="Apprenez les règles de la Chkobba (chkobba) : captures, comptage des points, Bermila, Dinari, 7 Haya. Guide simple pour bien commencer avant de jouer en ligne.">',
      );
  }
  return html;
}

function startStaticServer() {
  const server = http.createServer((req, res) =>
    serveHandler(req, res, {
      public: distDir,
      cleanUrls: false,
      rewrites: [
        { source: '/how-to-play', destination: '/index.html' },
        { source: '/how-to-play/', destination: '/index.html' },
        { source: '**', destination: '/index.html' },
      ],
    }),
  );

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Failed to bind static server'));
      resolve({ server, port: address.port });
    });
  });
}

async function prerender() {
  const { server, port } = await startStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    page.on('pageerror', (err) => {
      // eslint-disable-next-line no-console
      console.error('[prerender] pageerror', err);
    });
    page.on('console', (msg) => {
      // eslint-disable-next-line no-console
      console.log('[prerender] console', msg.type(), msg.text());
    });

    // Reduce noise / flaky waits from third-party resources.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      const type = req.resourceType();
      if (type === 'media') return req.abort();
      if (type === 'websocket') return req.abort();
      if (url.startsWith('https://www.googletagmanager.com/')) return req.abort();
      return req.continue();
    });

    const rendered = [];

    for (const { route, outFile, waitFor } of routes) {
      const url = `${baseUrl}${route}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#root', { timeout: 30_000 });
      try {
        await page.waitForSelector(waitFor, { timeout: 60_000 });
      } catch (e) {
        const rootText = await page.evaluate(() => document.getElementById('root')?.innerText?.slice(0, 500) || '');
        // eslint-disable-next-line no-console
        console.error(`[prerender] missing selector ${waitFor} on ${route}. rootText=`, JSON.stringify(rootText));
        throw e;
      }

      const html = await page.content();
      rendered.push({ route, outFile, html: rewriteSeoHead(html, route) });
    }

    for (const { route, outFile, html } of rendered) {
      await mkdir(path.dirname(outFile), { recursive: true });
      await writeFile(outFile, html, 'utf8');
      // eslint-disable-next-line no-console
      console.log(`[prerender] wrote ${path.relative(distDir, outFile)} from ${route}`);
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
}

prerender().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[prerender] failed', err);
  process.exitCode = 1;
});

