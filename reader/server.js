import { createServer } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SUMMARIES_DIR = join(__dirname, '..', 'lessons', 'summaries');
const PORT = 3000;

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
    result.push({ file: f, season: +match[1], episode: +match[2], title: h1 });
  }
  return result.sort((a, b) => a.season - b.season || a.episode - b.episode);
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
      const list = await listSummaries();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(list));
    }

    if (url.pathname.startsWith('/api/md/')) {
      const name = decodeURIComponent(url.pathname.slice(8));
      if (name.includes('..') || name.includes('/')) {
        res.writeHead(400);
        return res.end('Bad request');
      }
      const content = await readFile(join(SUMMARIES_DIR, name), 'utf-8');
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
