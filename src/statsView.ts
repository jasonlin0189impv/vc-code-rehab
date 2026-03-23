import * as vscode from 'vscode';
import { DailyRecord } from './types';

export function showStatsView(records: DailyRecord[], limit: number): void {
  const panel = vscode.window.createWebviewPanel(
    'vcCodeRehabStats',
    'Coding Token Stats',
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );

  panel.webview.html = buildHtml(records, limit);
}

function calcStreak(records: DailyRecord[], limit: number): number {
  let streak = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (r.manualTokens === 0 && r.aiTokens === 0) {
      break;
    }
    if (r.manualTokens < limit) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function calcBestStreak(records: DailyRecord[], limit: number): number {
  let best = 0;
  let current = 0;
  for (const r of records) {
    if (r.manualTokens === 0 && r.aiTokens === 0) {
      current = 0;
      continue;
    }
    if (r.manualTokens < limit) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function calc7DayAiRatio(records: DailyRecord[]): number | null {
  const last7 = records.slice(-7).filter(r => r.manualTokens > 0 || r.aiTokens > 0);
  if (last7.length === 0) {
    return null;
  }
  const totalManual = last7.reduce((s, r) => s + r.manualTokens, 0);
  const totalAi = last7.reduce((s, r) => s + r.aiTokens, 0);
  const total = totalManual + totalAi;
  return total > 0 ? Math.round((totalAi / total) * 100) : 0;
}

function calcDaysOverLimit(records: DailyRecord[], limit: number): number {
  return records.filter(r => r.manualTokens >= limit).length;
}

function buildHtml(records: DailyRecord[], limit: number): string {
  const last14 = records.slice(-14);
  const streak = calcStreak(records, limit);
  const bestStreak = calcBestStreak(records, limit);
  const aiRatio7d = calc7DayAiRatio(records);
  const daysOverLimit = calcDaysOverLimit(records, limit);

  const maxTokens = Math.max(limit, ...last14.map(r => r.manualTokens + r.aiTokens));
  const barWidth = 28;
  const barGap = 10;
  const chartHeight = 160;
  const svgWidth = last14.length * (barWidth + barGap);

  const bars = last14.map((record, i) => {
    const x = i * (barWidth + barGap);
    const manualH = maxTokens > 0 ? Math.round((record.manualTokens / maxTokens) * chartHeight) : 0;
    const aiH = maxTokens > 0 ? Math.round((record.aiTokens / maxTokens) * chartHeight) : 0;
    const overLimit = record.manualTokens >= limit;
    const manualFill = overLimit ? '#f14c4c' : record.manualTokens >= limit * 0.8 ? '#cca700' : '#4ec9b0';
    const label = record.date.slice(5);
    const total = record.manualTokens + record.aiTokens;

    return `
      <g>
        <rect x="${x}" y="${chartHeight - aiH}" width="${barWidth}" height="${aiH}" fill="#569cd6" rx="2"/>
        <rect x="${x}" y="${chartHeight - aiH - manualH}" width="${barWidth}" height="${manualH}" fill="${manualFill}" rx="2"/>
        <text x="${x + barWidth / 2}" y="${chartHeight + 14}" text-anchor="middle" font-size="9" fill="#ccc">${label}</text>
        ${total > 0 ? `<text x="${x + barWidth / 2}" y="${chartHeight - aiH - manualH - 4}" text-anchor="middle" font-size="9" fill="#ccc">${total}</text>` : ''}
      </g>`;
  }).join('');

  const limitY = maxTokens > 0 ? Math.round((1 - limit / maxTokens) * chartHeight) : 0;
  const limitLine = `
    <line x1="0" y1="${limitY}" x2="${svgWidth}" y2="${limitY}" stroke="#f14c4c" stroke-width="1" stroke-dasharray="4,3"/>
    <text x="${svgWidth + 4}" y="${limitY + 4}" font-size="9" fill="#f14c4c">limit</text>`;

  const today = records[records.length - 1] ?? { manualTokens: 0, aiTokens: 0 };
  const todayManual = today.manualTokens;
  const todayAi = today.aiTokens;
  const pct = Math.min(100, Math.round((todayManual / limit) * 100));
  const total = todayManual + todayAi;
  const aiRatio = total > 0 ? Math.round((todayAi / total) * 100) : 0;

  const streakEmoji = streak >= 7 ? '🔥' : streak >= 3 ? '⚡' : '🗓️';
  const streakLabel = streak === 0
    ? 'No streak yet — stay under the limit today!'
    : streak === 1
    ? '1 day under limit'
    : `${streak} days under limit`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Coding Token Stats</title>
  <style>
    body { font-family: var(--vscode-font-family); background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); padding: 24px; }
    h2 { margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 0.85em; margin-bottom: 24px; }
    .row { display: flex; gap: 32px; flex-wrap: wrap; margin-bottom: 8px; }
    .stat { text-align: center; }
    .stat .val { font-size: 1.6em; font-weight: bold; }
    .stat .lbl { font-size: 0.8em; color: #888; }
    .red { color: #f14c4c; }
    .blue { color: #569cd6; }
    .green { color: #4ec9b0; }
    .streak-box { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; }
    .streak-num { font-size: 2.2em; font-weight: bold; }
    .streak-info { display: flex; flex-direction: column; }
    .streak-info .lbl { font-size: 0.8em; color: #888; }
    .kpi-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
    .kpi { flex: 1; min-width: 100px; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px 16px; }
    .kpi-val { font-size: 1.4em; font-weight: bold; margin-bottom: 4px; }
    .kpi-lbl { font-size: 0.78em; color: #888; }
    .section { margin-bottom: 28px; }
    .progress-track { background: #333; border-radius: 4px; height: 14px; width: 100%; max-width: 400px; margin: 12px 0 4px; }
    .progress-fill { height: 100%; border-radius: 4px; background: ${pct >= 100 ? '#f14c4c' : pct >= 80 ? '#cca700' : '#4ec9b0'}; width: ${pct}%; }
    .progress-label { font-size: 0.82em; color: #aaa; }
    .legend { display: flex; gap: 16px; font-size: 0.82em; margin: 12px 0 4px; }
    .legend span { display: flex; align-items: center; gap: 5px; }
    .dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
    svg { overflow: visible; margin-top: 8px; }
    .note { font-size: 0.75em; color: #666; margin-top: 16px; }
  </style>
</head>
<body>
  <h2>Coding Token Stats</h2>
  <p class="subtitle">Daily manual limit: ${limit} tokens &nbsp;|&nbsp; Counting method: chars ÷ 4</p>

  <div class="streak-box">
    <div class="streak-num">${streakEmoji} ${streak}</div>
    <div class="streak-info">
      <strong>${streakLabel}</strong>
      <span class="lbl">Consecutive days with manual tokens under the limit</span>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi">
      <div class="kpi-val">🏆 ${bestStreak}</div>
      <div class="kpi-lbl">Best streak (days)</div>
    </div>
    <div class="kpi">
      <div class="kpi-val ${aiRatio7d !== null && aiRatio7d >= 70 ? 'green' : ''}">${aiRatio7d !== null ? aiRatio7d + '%' : '—'}</div>
      <div class="kpi-lbl">7-day avg AI ratio</div>
    </div>
    <div class="kpi">
      <div class="kpi-val ${daysOverLimit > 0 ? 'red' : 'green'}">${daysOverLimit} / 30</div>
      <div class="kpi-lbl">Days over limit (30d)</div>
    </div>
  </div>

  <div class="section">
    <h3>Today</h3>
    <div class="row">
      <div class="stat">
        <div class="val red">${todayManual}</div>
        <div class="lbl">Manual tokens</div>
      </div>
      <div class="stat">
        <div class="val blue">${todayAi}</div>
        <div class="lbl">AI tokens (est.)</div>
      </div>
      <div class="stat">
        <div class="val ${aiRatio >= 70 ? 'green' : ''}">${aiRatio}%</div>
        <div class="lbl">AI ratio</div>
      </div>
    </div>
    <div class="progress-track"><div class="progress-fill"></div></div>
    <div class="progress-label">Manual: ${todayManual} / ${limit} tokens (${pct}%)</div>
  </div>

  <div class="section">
    <h3>Last 14 Days</h3>
    <div class="legend">
      <span><span class="dot" style="background:#f14c4c"></span> Manual (over limit)</span>
      <span><span class="dot" style="background:#4ec9b0"></span> Manual (under limit)</span>
      <span><span class="dot" style="background:#569cd6"></span> AI (estimated)</span>
    </div>
    <svg width="${svgWidth + 60}" height="${chartHeight + 30}">
      ${bars}
      ${limitLine}
    </svg>
  </div>

  <p class="note">* AI tokens are estimated from large insertions (&gt; 5 chars). Includes Copilot, Cursor AI, Claude Code, and pastes.</p>
</body>
</html>`;
}
