'use strict';
/* ===================== ЯДРО ТРЕНАЖЕРА МДДЕКМ ===================== */
const SALT = (typeof CONFIG !== 'undefined' && CONFIG.salt) || 'MDDEKM-VNTU-2026';
const PRS = [];                         // реєстр практичних робіт
function registerPR(pr) { PRS.push(pr); }

/* ---------- хеш і генератор псевдовипадкових чисел ---------- */
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function makeRng(seed) {
  const r = mulberry32(seed >>> 0);
  const R = {
    u: () => r(),
    uni: (a, b) => a + (b - a) * r(),
    int: (a, b) => a + Math.floor(r() * (b - a + 1)),
    step: (a, b, s) => +(a + s * Math.floor(r() * (Math.round((b - a) / s) + 1))).toFixed(10),
    pick: arr => arr[Math.floor(r() * arr.length)],
    shuffle: arr => { const x = arr.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; },
  };
  R.sample = (arr, k) => R.shuffle(arr).slice(0, k);
  return R;
}
function normText(s) { return String(s || '').toLowerCase().replace(/[ʼ’`']/g, "'").replace(/\s+/g, ' ').trim(); }
function seedFor(variant, prId) { return cyrb53('V' + Number(variant) + '|' + SALT + '|PR' + prId) % 4294967296; }

/* ---------- числа ---------- */
function round(x, d = 0) { const p = 10 ** d; return Math.round(x * p) / p; }
function sig(x, n = 3) { return x === 0 ? 0 : Number(x.toPrecision(n)); }
function fmt(x, n = 4) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  if (!isFinite(x)) return '∞';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e5 || a < 1e-3) {
    const e = Math.floor(Math.log10(a)); let m = x / 10 ** e;
    m = Number(m.toPrecision(n));
    if (Math.abs(m) >= 10) { m = m / 10; return fmtMant(m) + '·10<sup>' + (e + 1) + '</sup>'; }
    return fmtMant(m) + '·10<sup>' + e + '</sup>';
  }
  return String(Number(x.toPrecision(n))).replace('.', ',');
}
function fmtMant(m) { return String(Number(m.toPrecision(4))).replace('.', ','); }
function fmtT(x, n = 4) { return fmt(x, n).replace(/<sup>/g, '^').replace(/<\/sup>/g, ''); }   // текстовий формат
function parseNum(s) {
  if (s === null || s === undefined) return NaN;
  let t = String(s).trim().replace(/\s+/g, '').replace(/−/g, '-').replace(/,/g, '.');
  if (t === '') return NaN;
  t = t.replace(/[·×xX*]10\^?\(?([+-]?\d+)\)?$/, 'e$1').replace(/^10\^\(?([+-]?\d+)\)?$/, '1e$1');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return NaN;
  return Number(t);
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- компетентності за РПНД ---------- */
const COMPETENCIES = {
  'ЗК.01': 'Абстрактне мислення, аналіз та синтез',
  'ЗК.02': 'Виявляти, ставити та вирішувати проблеми',
  'ЗК.03': 'Приймати обґрунтовані рішення',
  'ЗК.04': 'Генерувати нові ідеї (креативність)',
  'ФК.01': 'Сучасні знання в галузі досліджень і проєктування машин',
  'ФК.02': 'Критичний аналіз, оцінка і синтез нових ідей',
  'ФК.04': 'Інформаційні технології в науковій діяльності',
  'ФК.07': 'Постановка задачі, рішення за неповної інформації',
  'ФК.08': 'Математичні методи, ІТ і прикладне ПЗ для інженерних задач',
  'ФК.09': 'Експеримент, обробка та інтерпретація результатів',
};
function levelFor(score) {          // шкала РПНД для практичного завдання (25 б.)
  if (score >= 22.5) return { ects: 'A', name: 'IV — високий (творчий)' };
  if (score >= 20.5) return { ects: 'B', name: 'III — достатній (конструктивний)' };
  if (score >= 18.75) return { ects: 'C', name: 'III — достатній (конструктивний)' };
  if (score >= 16) return { ects: 'D', name: 'II — середній (репродуктивний)' };
  if (score >= 15) return { ects: 'E', name: 'II — середній (репродуктивний)' };
  return { ects: 'FX/F', name: 'I — низький' };
}
function ectsTotal(p) {
  if (p >= 90) return 'A'; if (p >= 82) return 'B'; if (p >= 75) return 'C';
  if (p >= 64) return 'D'; if (p >= 60) return 'E'; if (p >= 35) return 'FX'; return 'F';
}

/* ---------- оцінювання завдань ---------- */
function lcs(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]);
  return d[m][n];
}
function near(x, a, tol, abs) { return Math.abs(x - a) <= Math.max(Math.abs(a) * tol, abs || 0); }
function gradeItem(it, ans) {
  if (it.type === 'text') {
    const len = String(ans || '').trim().length;
    return { score: null, ok: null, diag: len >= (it.min || 40) ? 'Оцінює викладач' : 'Обґрунтування відсутнє або закоротке (оцінює викладач)' };
  }
  if (it.type === 'num') {
    const x = parseNum(ans);
    if (!isFinite(x)) return { score: 0, ok: false, diag: 'Відповідь відсутня або не є числом' };
    const tol = it.tol ?? 0.015;
    if (near(x, it.answer, tol, it.abs)) return { score: 1, ok: true, diag: null };
    for (const e of (it.errors || [])) if (isFinite(e.value) && near(x, e.value, tol, it.abs)) return { score: 0, ok: false, diag: e.msg };
    if (it.answer !== 0) {
      const r = x / it.answer;
      for (const [f, m] of [[1000, 'у 1000 разів'], [1e-3, 'у 1000 разів'], [1e6, 'у 10⁶ разів'], [1e-6, 'у 10⁶ разів'], [Math.sqrt(1000), 'у √1000 ≈ 31,6 раза'], [1 / Math.sqrt(1000), 'у √1000 ≈ 31,6 раза'], [100, 'у 100 разів'], [0.01, 'у 100 разів']])
        if (Math.abs(r / f - 1) < Math.max(tol, 0.01)) return { score: 0, ok: false, diag: 'Помилка порядку величини (' + m + '): перевірте одиниці вимірювання (мм ↔ м, МПа ↔ Па, % ↔ частки)' };
      if (Math.abs(r - 1) < 0.08) return { score: 0.25, ok: false, diag: 'Близько, але поза допуском: перевірте округлення проміжних величин (утримуйте ≥ 4 значущі цифри)' };
      if (Math.abs(r + 1) < tol) return { score: 0, ok: false, diag: 'Невірний знак' };
    }
    return { score: 0, ok: false, diag: 'Невірне значення: перевірте розрахункову модель' };
  }
  if (it.type === 'choice') {
    const o = it.options.find(o => o.id === ans);
    if (!o) return { score: 0, ok: false, diag: 'Варіант не обрано' };
    return o.ok ? { score: 1, ok: true, diag: null } : { score: 0, ok: false, diag: o.why || 'Хибний вибір' };
  }
  if (it.type === 'multi') {
    const sel = new Set(ans || []); const nOk = it.options.filter(o => o.ok).length;
    let tp = 0, fp = 0; const miss = [], extra = [];
    for (const o of it.options) { if (sel.has(o.id) && o.ok) tp++; else if (sel.has(o.id)) { fp++; extra.push(o.t); } else if (o.ok) miss.push(o.t); }
    const s = Math.max(0, (tp - fp) / nOk);
    return { score: s, ok: s === 1, diag: s === 1 ? null : [miss.length ? 'Пропущено: ' + miss.length : '', extra.length ? 'Зайвих (хибних) виборів: ' + extra.length : ''].filter(Boolean).join('; ') };
  }
  if (it.type === 'order') {
    const a = ans && ans.length ? ans : it.initial; const n = it.correct.length;
    const s = lcs(a, it.correct) / n;
    return { score: s === 1 ? 1 : Math.max(0, (s * n - 1) / (n - 1)), ok: s === 1, diag: s === 1 ? null : 'Порушено логіку послідовності: у правильному відносному порядку ' + Math.round(s * n) + ' з ' + n + ' етапів' };
  }
  if (it.type === 'match') {
    const a = ans || {}; let good = 0; const bad = [];
    it.rows.forEach(r => { if (a[r.id] === r.correct) good++; else bad.push(r.t); });
    const s = good / it.rows.length;
    return { score: s, ok: s === 1, diag: s === 1 ? null : 'Невірно зіставлено: ' + bad.map(b => '«' + b.replace(/<[^>]+>/g, '') + '»').join(', ') };
  }
  return { score: 0, ok: false, diag: 'Невідомий тип' };
}
function gradePR(pr, built, answers) {
  const items = built.blocks.filter(b => b.item).map(b => b.item);
  let W = 0, S = 0; const res = {}; const comp = {};
  for (const it of items) {
    const g = gradeItem(it, answers[it.id]); res[it.id] = g;
    if (g.score === null) continue;
    const w = it.w ?? 1; W += w; S += w * g.score;
    for (const c of it.comp || []) { comp[c] = comp[c] || { w: 0, s: 0 }; comp[c].w += w; comp[c].s += w * g.score; }
  }
  const score = round(25 * S / W, 2);
  return { score, level: levelFor(score), items: res, comp };
}
function answerText(it, ans) {
  if (ans === undefined || ans === null || ans === '' || (Array.isArray(ans) && !ans.length)) return '—';
  if (it.type === 'num' || it.type === 'text') return String(ans);
  if (it.type === 'choice') { const o = it.options.find(o => o.id === ans); return o ? o.t : '—'; }
  if (it.type === 'multi') return it.options.filter(o => ans.includes(o.id)).map(o => o.t).join('; ');
  if (it.type === 'order') return ans.map(id => it.steps.find(s => s.id === id).t).join(' → ');
  if (it.type === 'match') return it.rows.map(r => { const o = it.opts.find(o => o.id === ans[r.id]); return r.t + ' → ' + (o ? o.t : '—'); }).join('; ');
  return String(ans);
}
function refText(it) {
  if (it.type === 'num') return fmt(it.answer, 4) + (it.unit ? ' ' + it.unit : '') + ' (допуск ±' + round((it.tol ?? 0.015) * 100, 1) + ' %' + (it.abs ? ', абс. ' + fmt(it.abs) : '') + ')';
  if (it.type === 'choice') return it.options.find(o => o.ok).t;
  if (it.type === 'multi') return it.options.filter(o => o.ok).map(o => o.t).join('; ');
  if (it.type === 'order') return it.correct.map(id => it.steps.find(s => s.id === id).t).join(' → ');
  if (it.type === 'match') return it.rows.map(r => r.t + ' → ' + it.opts.find(o => o.id === r.correct).t).join('; ');
  if (it.type === 'text') return it.hint || 'Оцінює викладач';
  return '';
}

/* ---------- конструктори завдань ---------- */
function NUM(id, q, answer, o = {}) { return { item: Object.assign({ id, type: 'num', q, answer }, o) }; }
function CHOICE(rng, id, q, opts, o = {}) {      // opts: [{t, ok, why}]
  const options = rng.shuffle(opts.map((x, i) => Object.assign({ id: id + '_' + i }, x)));
  return { item: Object.assign({ id, type: 'choice', q, options }, o) };
}
function MULTI(rng, id, q, opts, o = {}) {
  const options = rng.shuffle(opts.map((x, i) => Object.assign({ id: id + '_' + i }, x)));
  return { item: Object.assign({ id, type: 'multi', q, options }, o) };
}
function ORDER(rng, id, q, steps, o = {}) {      // steps у правильному порядку
  const st = steps.map((t, i) => ({ id: id + '_' + i, t }));
  const correct = st.map(s => s.id);
  let initial = rng.shuffle(correct); let guard = 0;
  while (lcs(initial, correct) > steps.length / 2 && guard++ < 20) initial = rng.shuffle(correct);
  return { item: Object.assign({ id, type: 'order', q, steps: st, correct, initial }, o) };
}
function MATCH(rng, id, q, pairs, o = {}) {      // pairs: [[row, option]] (+ extra decoys у o.decoys)
  const optsT = [...new Set(pairs.map(p => p[1]).concat(o.decoys || []))];
  const opts = rng.shuffle(optsT.map((t, i) => ({ id: id + '_o' + i, t })));
  const rows = rng.shuffle(pairs.map((p, i) => ({ id: id + '_r' + i, t: p[0], correct: opts.find(x => x.t === p[1]).id })));
  return { item: Object.assign({ id, type: 'match', q, rows, opts }, o) };
}
function TEXT(id, q, o = {}) { return { item: Object.assign({ id, type: 'text', q, w: 0, min: 60 }, o) }; }
function INFO(html) { return { info: html }; }
function H(t) { return { h: t }; }
function CHART(svg, cap) { return { chart: svg, cap }; }
function TABLE(head, rows, cls) {
  return { info: '<table class="dt ' + (cls || '') + '"><thead><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table>' };
}
/* теоретичні тести: пул [{q, ok, bad:[...]}] → k випадкових */
function theory(rng, prefix, pool, k, comp) {
  return rng.sample(pool, k).map((p, i) => CHOICE(rng, prefix + '_t' + i, p.q,
    [{ t: p.ok, ok: true }].concat(p.bad.map(b => ({ t: b, ok: false }))), { comp: comp || ['ФК.01', 'ЗК.01'], w: 0.6 }));
}

/* ---------- SVG-графіки ---------- */
const COL = { s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', crit: '#e34948', ink: '#0b0b0b', ink2: '#52514e', grid: '#e4e2dc', surf: '#fcfcfb' };
function niceTicks(min, max, count = 5) {
  const span = max - min || 1; const step0 = span / count; const mag = 10 ** Math.floor(Math.log10(step0)); const e = step0 / mag;
  const step = e >= 7.5 ? 10 * mag : e >= 3.5 ? 5 * mag : e >= 1.5 ? 2 * mag : mag;
  const t = []; for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9 * step; v += step) t.push(+v.toFixed(10));
  return t;
}
function tickLab(v) { return String(+v.toPrecision(6)).replace('.', ','); }
function plot(o) {
  const W = o.w || 640, Hh = o.h || 340, m = { l: 66, r: 18, t: o.title ? 34 : 14, b: 50 };
  const pw = W - m.l - m.r, ph = Hh - m.t - m.b;
  const all = []; (o.series || []).forEach(s => s.pts.forEach(p => all.push(p)));
  let xmin = o.xmin ?? Math.min(...all.map(p => p[0])), xmax = o.xmax ?? Math.max(...all.map(p => p[0]));
  let ymin = o.ymin ?? Math.min(...all.map(p => p[1])), ymax = o.ymax ?? Math.max(...all.map(p => p[1]));
  const tx = o.xlog ? v => Math.log10(v) : v => v, ty = o.ylog ? v => Math.log10(v) : v => v;
  const X = v => m.l + (tx(v) - tx(xmin)) / (tx(xmax) - tx(xmin)) * pw;
  const Y = v => m.t + ph - (ty(v) - ty(ymin)) / (ty(ymax) - ty(ymin)) * ph;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${Hh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.title || 'графік')}">`;
  s += `<rect x="0" y="0" width="${W}" height="${Hh}" fill="${COL.surf}"/>`;
  if (o.title) s += `<text x="${m.l}" y="20" font-size="14" font-weight="600" fill="${COL.ink}">${o.title}</text>`;
  const xt = o.xticks || (o.xlog ? logTicks(xmin, xmax) : niceTicks(xmin, xmax, o.nx || 6));
  const yt = o.yticks || (o.ylog ? logTicks(ymin, ymax) : niceTicks(ymin, ymax, o.ny || 5));
  for (const v of yt) { const y = Y(v); s += `<line x1="${m.l}" x2="${m.l + pw}" y1="${y}" y2="${y}" stroke="${COL.grid}" stroke-width="1"/><text x="${m.l - 6}" y="${y + 4}" font-size="11" text-anchor="end" fill="${COL.ink2}">${o.ylog ? logLab(v) : tickLab(v)}</text>`; }
  for (const v of xt) { const x = X(v); s += `<line x1="${x}" x2="${x}" y1="${m.t}" y2="${m.t + ph}" stroke="${COL.grid}" stroke-width="1"/><text x="${x}" y="${m.t + ph + 16}" font-size="11" text-anchor="middle" fill="${COL.ink2}">${o.xlog ? logLab(v) : tickLab(v)}</text>`; }
  s += `<line x1="${m.l}" x2="${m.l + pw}" y1="${m.t + ph}" y2="${m.t + ph}" stroke="${COL.ink2}"/><line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${m.t + ph}" stroke="${COL.ink2}"/>`;
  if (o.xlab) s += `<text x="${m.l + pw / 2}" y="${Hh - 10}" font-size="12" text-anchor="middle" fill="${COL.ink}">${o.xlab}</text>`;
  if (o.ylab) s += `<text transform="translate(16 ${m.t + ph / 2}) rotate(-90)" font-size="12" text-anchor="middle" fill="${COL.ink}">${o.ylab}</text>`;
  s += `<clipPath id="cp${o.id || 0}"><rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}"/></clipPath><g clip-path="url(#cp${o.id || 0})">`;
  for (const hl of o.hlines || []) { const y = Y(hl.y); s += `<line x1="${m.l}" x2="${m.l + pw}" y1="${y}" y2="${y}" stroke="${hl.color || COL.crit}" stroke-width="1.5" stroke-dasharray="6 4"/>`; }
  for (const vl of o.vlines || []) { const x = X(vl.x); s += `<line x1="${x}" x2="${x}" y1="${m.t}" y2="${m.t + ph}" stroke="${vl.color || COL.crit}" stroke-width="1.5" stroke-dasharray="6 4"/>`; }
  for (const se of o.series || []) {
    const c = se.color || COL.s1;
    if (se.bar) {
      const bw = Math.max(4, Math.abs(X(xmin + se.bar) - X(xmin)) - 2);
      for (const p of se.pts) { const x = X(p[0]) - bw / 2, y = Y(p[1]), y0 = Y(o.ylog ? ymin : Math.max(0, ymin)); s += `<path d="M${x},${y0} V${y + 4} q0,-4 4,-4 H${x + bw - 4} q4,0 4,4 V${y0} Z" fill="${c}"><title>${se.label ? se.label + ': ' : ''}${tickLab(p[0])} → ${tickLab(p[1])}</title></path>`; }
      continue;
    }
    if (se.line !== false) s += `<polyline fill="none" stroke="${c}" stroke-width="${se.width || 2}" ${se.dash ? 'stroke-dasharray="' + se.dash + '"' : ''} stroke-linejoin="round" points="${se.pts.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`;
    if (se.marker) for (const p of se.pts) s += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4.5" fill="${c}" stroke="${COL.surf}" stroke-width="2"><title>${se.label ? se.label + ': ' : ''}(${tickLab(+p[0].toPrecision(4))}; ${tickLab(+p[1].toPrecision(4))})</title></circle>`;
  }
  s += '</g>';
  for (const hl of o.hlines || []) if (hl.label) s += `<text x="${m.l + pw - 4}" y="${Y(hl.y) - 5}" font-size="11" text-anchor="end" fill="${COL.ink}">${hl.label}</text>`;
  for (const vl of o.vlines || []) if (vl.label) s += `<text x="${X(vl.x) + 4}" y="${m.t + 12}" font-size="11" fill="${COL.ink}">${vl.label}</text>`;
  for (const n of o.notes || []) s += `<text x="${X(n.x) + (n.dx || 6)}" y="${Y(n.y) + (n.dy || -6)}" font-size="11" fill="${COL.ink}" ${n.anchor ? 'text-anchor="' + n.anchor + '"' : ''}>${n.text}</text>`;
  const leg = (o.series || []).filter(s => s.label);
  if (leg.length > 1 || o.legend) {
    let ly = m.t + 8; const lx = o.legendLeft ? m.l + 10 : m.l + pw - 190;
    s += `<rect x="${lx - 6}" y="${ly - 6}" width="190" height="${leg.length * 18 + 6}" fill="${COL.surf}" opacity="0.92" stroke="${COL.grid}"/>`;
    for (const l of leg) { s += `<line x1="${lx}" x2="${lx + 20}" y1="${ly + 5}" y2="${ly + 5}" stroke="${l.color || COL.s1}" stroke-width="${l.bar ? 8 : 2.5}" ${l.dash ? 'stroke-dasharray="' + l.dash + '"' : ''}/><text x="${lx + 26}" y="${ly + 9}" font-size="11" fill="${COL.ink}">${l.label}</text>`; ly += 18; }
  }
  return s + '</svg>';
}
function logTicks(min, max) { const t = []; for (let k = Math.floor(Math.log10(min)); k <= Math.ceil(Math.log10(max)); k++) { const v = 10 ** k; if (v >= min * 0.999 && v <= max * 1.001) t.push(v); } return t; }
function logLab(v) { const k = Math.round(Math.log10(v)); return k >= 0 && k <= 3 ? String(10 ** k) : '10^' + k; }
function linspace(a, b, n) { return Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1)); }
function logspace(a, b, n) { return linspace(Math.log10(a), Math.log10(b), n).map(v => 10 ** v); }

/* ---------- побудова ПР для студента ---------- */
function buildPR(pr, variant) {
  const rng = makeRng(seedFor(variant, pr.id));
  const v = pr.gen(rng);
  const blocks = pr.build(v, rng);
  return { v, blocks };
}
