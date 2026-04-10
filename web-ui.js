const API = '/api/preset';
const RUN_API = '/api/run';
const TIMEOUT_MS = 30000; // 30秒超时

function $(id) { return document.getElementById(id); }

function setLoading(on, msg = '执行中，请稍候...') {
  const output = $('output');
  if (on) {
    output.className = 'output loading';
    output.innerHTML = `<div class="loading-box"><div class="spinner"></div><span>${msg}</span></div>`;
  }
}

function showOutput(text, isError = false) {
  const output = $('output');
  output.className = 'output' + (isError ? ' error' : ' success');
  output.textContent = text || '(无输出)';
  output.scrollTop = output.scrollHeight;
}

function clearOutput() {
  $('output').textContent = '';
  $('output').className = 'output';
  $('output').innerHTML = '<div class="placeholder">点击上方按钮，结果将显示在这里</div>';
}

function showTip(msg, type = 'info') {
  const tip = $('tip');
  if (!tip) return;
  tip.textContent = msg;
  tip.className = `tip tip-${type}`;
  tip.style.display = 'block';
  setTimeout(() => { tip.style.display = 'none'; }, 4000);
}

async function callAPI(command, extraArgs = []) {
  setLoading(true);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, args: extraArgs }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    if (data.error) {
      showOutput('❌ 错误: ' + data.error, true);
    } else if (!data.stdout && !data.code === 0) {
      showOutput('⚠️ 命令执行异常，退出码: ' + data.code, true);
    } else {
      showOutput(data.stdout || '✅ 执行完成（无文字输出）');
    }
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      showOutput(`⏱️ 执行超时（>${TIMEOUT_MS/1000}秒）\n\n可能原因：\n• API 响应太慢\n• 网络连接问题\n• 命令需要长时间运行\n\n建议：尝试更简单的命令，或检查 API 配置`, true);
    } else {
      showOutput('🌐 网络错误: ' + e.message, true);
    }
  }
}

async function runCustom() {
  const cmd = $('custom-cmd').value.trim();
  if (!cmd) { showTip('请输入命令', 'warn'); return; }
  setLoading(true);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const args = cmd.split(/\s+/);
    const res = await fetch(RUN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    showOutput(data.stdout || data.stderr || data.error || '(无输出)', !!data.error);
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      showOutput(`⏱️ 执行超时（>${TIMEOUT_MS/1000}秒）`, true);
    } else {
      showOutput('错误: ' + e.message, true);
    }
  }
}

function runPreset(cmd, label) {
  showTip(`正在执行: ${label}`, 'info');
  callAPI(cmd);
}

function runSearch() {
  const q = $('search-input').value.trim();
  if (!q) { showTip('请输入搜索关键词', 'warn'); return; }
  showTip(`正在搜索: ${q}`, 'info');
  callAPI('search', q.split(/\s+/));
}

function runCompetitor() {
  const q = $('competitor-input').value.trim();
  if (!q) { showTip('请输入竞品名称', 'warn'); return; }
  showTip(`正在调研: ${q}`, 'info');
  callAPI('competitor', q.split(/\s+/));
}

function runMarket() {
  const q = $('market-input').value.trim();
  if (!q) { showTip('请输入调研主题', 'warn'); return; }
  showTip(`正在调研市场: ${q}`, 'info');
  callAPI('market', q.split(/\s+/));
}

// 回车触发
[['search-input', 'runSearch'], ['competitor-input', 'runCompetitor'], ['market-input', 'runMarket'], ['custom-cmd', 'runCustom']].forEach(([id, fn]) => {
  const el = $(id);
  if (el) el.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); window[fn](); }
  });
});
