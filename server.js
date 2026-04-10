/**
 * B2Btrade-agent Web UI Server
 * 启动: node server.js
 * 访问: http://localhost:8878
 */
import http from 'http';
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

const __dirname = '.';
const PORT = 8878;
const B2B_PATH = join(process.env.APPDATA || '', 'npm', 'node_modules', 'b2btrade-agent', 'src', 'index.js');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.json': 'application/json',
};

function cleanANSI(s) {
  return (s || '').toString().replace(/\x1b\[[0-9;]*m/g, '').trim();
}

function runB2B(args, timeoutMs = 30000) {
  return new Promise((resolve) => {
    if (!existsSync(B2B_PATH)) {
      resolve({ stdout: '', stderr: `找不到 b2btrade-agent，请先安装：npm install -g b2btrade-agent`, code: 1 });
      return;
    }

    const child = spawn('node', [B2B_PATH, ...args], {
      timeout: timeoutMs,
      shell: true,
      windowsHide: true,
    });

    let stdout = '', stderr = '';
    let done = false;

    const finish = (code = 0) => {
      if (done) return;
      done = true;
      child.kill();
      resolve({ stdout: cleanANSI(stdout), stderr: cleanANSI(stderr), code });
    };

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', finish);
    child.on('error', e => { stderr += e.message; finish(1); });

    // 超时兜底
    setTimeout(() => finish(124), timeoutMs);
  });
}

function serveFile(res, filePath, contentType) {
  if (!existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    res.end(content);
  } catch (e) {
    res.writeHead(500); res.end(e.message);
  }
}

const HTML = readFileSync(join(__dirname, 'web-ui.html'), 'utf8');
const CSS  = readFileSync(join(__dirname, 'web-ui.css'),  'utf8');
const JS   = readFileSync(join(__dirname, 'web-ui.js'),   'utf8');

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // API 路由
  if (path === '/api/preset' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const { command, args: extraArgs = [] } = JSON.parse(body);
        const presets = {
          status:     { args: ['status'] },
          search:     { args: ['search', ...extraArgs] },
          findemail:  { args: ['run', 'find-email'] },
          competitor: { args: ['run', 'competitor', ...extraArgs] },
          crm:        { args: ['crm'] },
          chat:       { args: ['chat', ...extraArgs] },
          config:     { args: ['config'] },
          sequence:    { args: ['sequence'] },
          market:     { args: ['run', 'market-research', ...extraArgs] },
        };
        const p = presets[command];
        if (!p) throw new Error(`未知命令: ${command}`);
        const result = await runB2B(p.args);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message, stdout: '', stderr: '' }));
      }
    });
    return;
  }

  if (path === '/api/run' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const { args } = JSON.parse(body);
        if (!Array.isArray(args)) throw new Error('args must be array');
        const result = await runB2B(args);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 静态文件
  if (path === '/' || path === '/index.html') {
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    res.end(HTML); return;
  }
  const mime = MIME[extname(path)];
  if (mime) { serveFile(res, join(__dirname, path.slice(1)), mime); return; }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  🌐 B2Btrade Web UI: http://localhost:${PORT}\n`);
});
