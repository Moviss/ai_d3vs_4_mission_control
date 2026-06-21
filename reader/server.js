import { createServer } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = 3000;

const SUMMARIES_DIR = join(__dirname, '..', 'lessons', 'summaries');

const SOURCES = {
  summaries: SUMMARIES_DIR,
};

async function listSummaries() {
  const files = await readdir(SUMMARIES_DIR);
  const result = [];
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const match = f.match(/^s(\d+)e(\d+)/);
    if (!match) continue;
    const text = await readFile(join(SUMMARIES_DIR, f), 'utf-8');
    const h1 = text.split('\n')[0]
      .replace(/^#\s*/, '')
      .replace(/\s*—\s*Podsumowanie$/, '')
      .replace(/^S\d+E\d+\s*—\s*/, '');
    result.push({ source: 'summaries', file: f, season: +match[1], episode: +match[2], title: h1 });
  }
  return result.sort((a, b) => a.season - b.season || a.episode - b.episode);
}

async function listDocs() {
  return listSummaries();
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (url.pathname === '/favicon.ico') {
      res.writeHead(204);
      return res.end();
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = await readFile(join(__dirname, 'index.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    if (url.pathname === '/api/list') {
      const list = await listDocs();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(list));
    }

    if (url.pathname.startsWith('/api/md/')) {
      const rest = decodeURIComponent(url.pathname.slice('/api/md/'.length));
      const slash = rest.indexOf('/');
      if (slash === -1) {
        res.writeHead(400);
        return res.end('Bad request');
      }
      const source = rest.slice(0, slash);
      const name = rest.slice(slash + 1);
      const dir = SOURCES[source];
      if (!dir) {
        res.writeHead(404);
        return res.end('Unknown source');
      }
      if (!name || name.includes('..') || name.includes('/')) {
        res.writeHead(400);
        return res.end('Bad request');
      }
      const content = await readFile(join(dir, name), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(content);
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (e) {
    const code = e.code === 'ENOENT' ? 404 : 500;
    res.writeHead(code);
    res.end(code === 404 ? 'Not found' : 'Server error');
  }
}).listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  📖  Reader: ${url}\n`);
  exec(`open ${url}`);
});
