/* ===================== ТРЕНАЖЕР: ІНТЕРФЕЙС ЗДОБУВАЧА ===================== */
const STORE_KEY = 'mddekm_trainer_v2';
let MEM = null, CUR = null;          // CUR: {pr, built} | 'home' | 'proto'
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
function load() { if (MEM) return MEM; try { MEM = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { MEM = {}; } MEM.prs = MEM.prs || {}; return MEM; }
let savedAt = null;
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(MEM)); savedAt = new Date(); } catch (e) { savedAt = null; } updateDock(); }
function prState(id) { const S = load(); S.prs[id] = S.prs[id] || { answers: {} }; return S.prs[id]; }
function itemsOf(built) { return built.blocks.filter(b => b.item).map(b => b.item); }
function isAnswered(it, a) {
  if (it.type === 'order') return true;
  if (a === undefined || a === null || a === '') return false;
  if (Array.isArray(a)) return a.length > 0;
  if (it.type === 'match') return it.rows.every(r => a[r.id]);
  if (it.type === 'text') return String(a).trim().length >= Math.min(20, it.min || 20);
  return String(a).trim() !== '';
}
function shortName(n) { const p = n.split(' '); return p[0] + (p[1] ? ' ' + p[1][0] + '.' : '') + (p[2] ? ' ' + p[2][0] + '.' : ''); }
function protoCode(student, prs) {
  const core = { n: normText(student.name), g: normText(student.group), v: Number(student.variant), p: {} };
  for (const pr of PRS) { const st = prs[pr.id]; if (st && st.submitted) core.p[pr.id] = { a: st.answers, s: st.score ?? st.result.score, t: st.submitted }; }
  return cyrb53(JSON.stringify(core) + SALT).toString(36).toUpperCase().padStart(11, '0').match(/.{1,4}/g).join('-');
}
function ring(frac, label, cls) {
  const r = 15, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac || 0));
  return `<svg class="ring ${cls || ''}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="${r}" class="rt"/>${f > 0 ? `<circle cx="20" cy="20" r="${r}" class="rf" stroke-dasharray="${c * f} ${c}" transform="rotate(-90 20 20)"/>` : ''}<text x="20" y="24" text-anchor="middle">${label}</text></svg>`;
}
function prStatus(pr) {
  const st = load().prs[pr.id];
  if (st && st.submitted) return { kind: 'done', score: st.result.score, frac: st.result.score / 25 };
  if (st && st.started) {
    const built = buildPR(pr, load().student.variant); const its = itemsOf(built);
    const n = its.filter(it => isAnswered(it, st.answers[it.id])).length;
    return { kind: 'wip', n, total: its.length, frac: n / its.length };
  }
  return { kind: 'new', frac: 0 };
}

/* ---------- каркас ---------- */
function renderTop() {
  const S = load();
  $('#who').innerHTML = S.student ? `<span class="chip"><b>Варіант ${S.student.variant}</b><span>${esc(shortName(S.student.name))}, ${esc(S.student.group)}</span></span>` : '';
}
function renderRail() {
  const S = load(), rail = $('#rail');
  if (!S.student) { rail.innerHTML = ''; document.body.classList.add('no-rail'); return; }
  document.body.classList.remove('no-rail');
  let h = `<a href="#/" class="rl ${CUR === 'home' ? 'act' : ''}"><span class="ri">⌂</span><span>Огляд робіт</span></a>`;
  for (const m of [1, 2]) {
    h += `<div class="rg">Модуль ${m}</div>`;
    for (const pr of PRS.filter(p => p.module === m)) {
      const s = prStatus(pr);
      const lab = s.kind === 'done' ? Math.round(s.score) : pr.id;
      h += `<a href="#/pr/${pr.id}" class="rl ${CUR && CUR.pr && CUR.pr.id === pr.id ? 'act' : ''}" title="${esc(pr.title)}">${ring(s.frac, lab, s.kind)}<span><small>ПР ${pr.id}</small>${pr.short}</span></a>`;
    }
  }
  h += `<a href="#/protocol" class="rl ${CUR === 'proto' ? 'act' : ''}"><span class="ri">≣</span><span>Протокол і компетентності</span></a>`;
  rail.innerHTML = h;
}
function setDock(on) { $('#dock').hidden = !on; document.body.classList.toggle('has-dock', on); }
function updateDock() {
  if (!CUR || !CUR.pr) return;
  const st = prState(CUR.pr.id); if (st.submitted) return;
  const its = itemsOf(CUR.built); const n = its.filter(it => isAnswered(it, st.answers[it.id])).length;
  $('#dk-bar').style.width = (n / its.length * 100) + '%';
  $('#dk-txt').innerHTML = `Відповідей <b>${n}</b> з ${its.length}` + (savedAt ? ` <span class="saved">збережено о ${savedAt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</span>` : '');
  $$('.mp-sec').forEach(a => { const ids = a.dataset.ids.split(','); const k = ids.filter(id => { const it = its.find(i => i.id === id); return it && isAnswered(it, st.answers[id]); }).length; a.querySelector('.mp-n').textContent = k + '/' + ids.length; a.classList.toggle('full', k === ids.length); });
}

/* ---------- маршрутизація ---------- */
function route() {
  if (typeof TEACHER_APP !== 'undefined') return;
  const S = load();
  if (!S.student) return renderLogin();
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('pr/')) { const id = +h.split('/')[1]; if (PRS.find(p => p.id === id)) return openPR(id); }
  if (h === 'protocol') return openProtocol();
  return openHome();
}
window.addEventListener('hashchange', route);

/* ---------- вхід ---------- */
function renderLogin() {
  CUR = null; renderTop(); renderRail(); setDock(false); $('#map').innerHTML = '';
  const opts = Array.from({ length: CONFIG.variants }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  view().innerHTML = `<section class="login">
    <div class="stamp big">
      <div class="st-t">${esc(CONFIG.course)}</div>
      <div class="st-r"><span>Практичні роботи</span><b>1–8</b></div><div class="st-r"><span>Режим</span><b>контроль</b></div><div class="st-r"><span>Рівень</span><b>доктор філософії, G9</b></div>
    </div>
    <h1>Тренажер практичних робіт</h1>
    <p class="lead">Вісім робіт за РПНД: від критеріїв міцності до PHM-систем і ШІ-агентів. Ви виконуєте розрахунок крок за кроком, а тренажер перевіряє кожен результат і пояснює типові помилки.</p>
    <form id="lg" class="form" novalidate>
      <label>Прізвище, ім'я, по батькові<input id="lg_n" autocomplete="name" required placeholder="Іваненко Іван Іванович"></label>
      <div class="two"><label>Група<input id="lg_g" required placeholder="1АПМ-24"></label>
      <label>Номер варіанта<select id="lg_v" required><option value="">—</option>${opts}</select></label></div>
      <p class="hint">Номер варіанта видає викладач. Він однаковий для всіх восьми робіт.</p>
      <button class="btn pri" type="submit">Розпочати роботу</button><p id="lg_e" class="err" role="alert"></p>
    </form>
    <details class="rules"><summary>Як працює тренажер</summary><ul>
      <li>Відповіді зберігаються в цьому браузері автоматично; можна закрити сторінку і повернутися.</li>
      <li>Кожну роботу здаєте один раз. Після здачі відповіді блокуються, і ви бачите результат із поясненнями.</li>
      <li>Дозволені калькулятор, Excel, Python, MATLAB, методичні вказівки. Числа вводьте з 3–4 значущими цифрами: 0,0123 або 1,2e6 або 1,2·10^6.</li>
      <li>Оцінка — до 25 балів за кожну роботу за шкалою РПНД. Текстові обґрунтування оцінює викладач.</li>
      <li>Наприкінці завантажте протокол і надішліть його викладачу.</li></ul></details>
  </section>`;
  $('#lg').onsubmit = e => {
    e.preventDefault();
    const n = $('#lg_n').value.trim().replace(/\s+/g, ' '), g = $('#lg_g').value.trim(), v = +$('#lg_v').value;
    if (n.split(' ').length < 2) return $('#lg_e').textContent = 'Введіть прізвище та ім\'я.';
    if (g.length < 2) return $('#lg_e').textContent = 'Введіть назву групи.';
    if (!v) return $('#lg_e').textContent = 'Оберіть номер варіанта.';
    MEM = { student: { name: n, group: g, variant: v }, prs: {}, theme: load().theme }; save();
    location.hash = '#/'; route();
  };
}
const view = () => $('#view');

/* ---------- огляд ---------- */
function openHome() {
  CUR = 'home'; renderTop(); renderRail(); setDock(false); $('#map').innerHTML = '';
  const S = load();
  const done = PRS.filter(p => S.prs[p.id] && S.prs[p.id].submitted);
  const mod = m => PRS.filter(p => p.module === m).reduce((a, p) => a + (S.prs[p.id] && S.prs[p.id].submitted ? S.prs[p.id].result.score : 0), 0) / 4;
  let h = `<section class="home"><h1>Добрий день, ${esc(S.student.name.split(' ')[1] || S.student.name)}</h1>
    <p class="lead">Здано ${done.length} з 8 робіт. Модуль 1 — ${fmtT(mod(1), 3)} з 25, модуль 2 — ${fmtT(mod(2), 3)} з 25.</p>`;
  for (const m of [1, 2]) {
    h += `<h2 class="mh">Модуль ${m}. ${m === 1 ? 'Класичні та сучасні методи оцінювання міцності, руйнування і довговічності' : 'Цифрові технології та інтелектуальні системи прогнозування ресурсу'}</h2><div class="tiles">`;
    for (const pr of PRS.filter(p => p.module === m)) {
      const s = prStatus(pr);
      const stat = s.kind === 'done' ? `<span class="tag ok">здано · ${fmtT(s.score, 3)} б.</span>` : s.kind === 'wip' ? `<span class="tag wip">${s.n} з ${s.total} відповідей</span>` : '<span class="tag">не розпочато</span>';
      h += `<a class="tile ${s.kind}" href="#/pr/${pr.id}"><div class="tn">ПР ${pr.id}</div><div class="tt">${pr.title}</div><div class="tb">${stat}<span class="go">${s.kind === 'done' ? 'Результат' : s.kind === 'wip' ? 'Продовжити' : 'Почати'}</span></div><div class="tp" style="width:${s.frac * 100}%"></div></a>`;
    }
    h += '</div>';
  }
  h += `<p class="foot"><a href="#/protocol">Сформувати протокол для викладача</a> · <button class="link" id="out">Змінити здобувача або варіант</button></p></section>`;
  view().innerHTML = h; window.scrollTo(0, 0);
  $('#out').onclick = () => askModal('Змінити здобувача?', 'Усі відповіді в цьому браузері буде видалено. Спершу завантажте протокол, якщо ви вже здали роботи.', 'Видалити і вийти', () => { MEM = { prs: {}, theme: load().theme }; save(); location.hash = ''; route(); }, true);
}

/* ---------- рендер завдань ---------- */
function itemHTML(it, num, ans, locked, g, key) {
  const dis = locked ? 'disabled' : '';
  const cls = g ? (g.ok === true ? 'good' : g.ok === false ? (g.score > 0 ? 'part' : 'badi') : 'tchr') : '';
  let h = `<div class="item ${cls}" id="it-${it.id}" data-item="${it.id}"><div class="q"><span class="qn">${num}</span><div>${it.q}</div></div><div class="ctl">`;
  if (it.type === 'num') h += `<div class="numw"><input class="num" data-k="${it.id}" value="${esc(ans ?? '')}" ${dis} inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="відповідь"><span class="unit">${it.unit || ''}</span><span class="parsed" data-p="${it.id}"></span></div>`;
  if (it.type === 'text') h += `<textarea data-k="${it.id}" rows="4" ${dis} placeholder="Ваша відповідь">${esc(ans ?? '')}</textarea>`;
  if (it.type === 'choice') h += it.options.map(o => `<label class="opt"><input type="radio" name="${it.id}" value="${o.id}" ${ans === o.id ? 'checked' : ''} ${dis}><span>${o.t}</span></label>`).join('');
  if (it.type === 'multi') h += '<p class="hint">Можна обрати кілька варіантів.</p>' + it.options.map(o => `<label class="opt"><input type="checkbox" name="${it.id}" value="${o.id}" ${(ans || []).includes(o.id) ? 'checked' : ''} ${dis}><span>${o.t}</span></label>`).join('');
  if (it.type === 'order') {
    const ord = ans && ans.length ? ans : it.initial;
    h += `<ol class="ord">` + ord.map((id, i) => `<li><span>${it.steps.find(s => s.id === id).t}</span>${locked ? '' : `<span class="mvw"><button class="mv" data-o="${it.id}" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="вгору">▲</button><button class="mv" data-o="${it.id}" data-i="${i}" data-d="1" ${i === ord.length - 1 ? 'disabled' : ''} aria-label="вниз">▼</button></span>`}</li>`).join('') + '</ol>';
  }
  if (it.type === 'match') {
    const a = ans || {};
    h += '<div class="mt">' + it.rows.map(r => `<div class="mr"><div class="ml">${r.t}</div><select data-m="${it.id}" data-r="${r.id}" ${dis}><option value="">оберіть…</option>${it.opts.map(o => `<option value="${o.id}" ${a[r.id] === o.id ? 'selected' : ''}>${o.t}</option>`).join('')}</select></div>`).join('') + '</div>';
  }
  h += '</div>';
  if (g) {
    const mark = g.ok === true ? 'Правильно' : g.ok === false ? (g.score > 0 ? 'Частково, ' + Math.round(g.score * 100) + ' %' : 'Неправильно') : 'Оцінює викладач';
    h += `<div class="fb"><b>${mark}.</b>${g.diag && g.ok !== true && g.diag !== 'Оцінює викладач' ? ' ' + g.diag : ''}</div>`;
  }
  if (key) h += `<div class="key"><b>Еталон:</b> ${refText(it)}</div>`;
  return h + '</div>';
}
function blocksHTML(blocks, answers, locked, grades, key) {
  let sec = 0, hid = 0, k = 0, fresh = true, out = '';
  for (const bl of blocks) {
    if (bl.h) { hid++; k = 0; fresh = true; out += `<h3 id="sec-${hid}">${bl.h}</h3>`; continue; }
    if (bl.info) { out += `<div class="info">${bl.info}</div>`; continue; }
    if (bl.chart) { out += `<figure>${bl.chart}${bl.cap ? '<figcaption>' + bl.cap + '</figcaption>' : ''}</figure>`; continue; }
    if (bl.item) { if (fresh) { sec++; fresh = false; } k++; out += itemHTML(bl.item, sec + '.' + k, answers[bl.item.id], locked, grades ? grades[bl.item.id] : null, key); }
  }
  return out;
}
function sectionsOf(blocks) {
  const secs = []; let cur = null;
  for (const bl of blocks) { if (bl.h) { cur = { t: bl.h, ids: [] }; secs.push(cur); } else if (bl.item) { if (!cur) { cur = { t: 'Завдання', ids: [] }; secs.push(cur); } cur.ids.push(bl.item.id); } }
  return secs.filter(s => s.ids.length);
}
function stampHTML(pr, S, st) {
  const sc = st && st.submitted ? fmtT(st.result.score, 4) : '—';
  const state = st && st.submitted ? 'здано ' + new Date(st.submitted).toLocaleDateString('uk-UA') : st && st.started ? 'виконується' : 'не розпочато';
  return `<div class="stamp">
    <div class="st-t">${pr.title}</div>
    <div class="st-r"><span>Робота</span><b>ПР ${pr.id} / М${pr.module}</b></div>
    <div class="st-r"><span>Варіант</span><b>${S.student.variant}</b></div>
    <div class="st-r"><span>Здобувач</span><b>${esc(shortName(S.student.name))}</b></div>
    <div class="st-r"><span>Група</span><b>${esc(S.student.group)}</b></div>
    <div class="st-r"><span>Стан</span><b>${state}</b></div>
    <div class="st-r sc"><span>Оцінка</span><b>${sc}<small> / 25</small></b></div>
  </div>`;
}

/* ---------- ПР ---------- */
function openPR(id) {
  const S = load(); const pr = PRS.find(p => p.id === id);
  CUR = { pr, built: buildPR(pr, S.student.variant) };
  const st = prState(id); if (!st.started) { st.started = new Date().toISOString(); save(); }
  renderTop(); renderRail(); renderPR(true);
}
function renderPR(top) {
  const S = load(), { pr, built } = CUR; const st = prState(pr.id); const locked = !!st.submitted;
  let h = stampHTML(pr, S, st);
  if (locked) {
    const r = st.result, its = itemsOf(built);
    const ok = its.filter(it => st.result.items[it.id] && st.result.items[it.id].ok === true).length;
    h += `<div class="result ${r.score >= 15 ? 'pass' : 'fail'}"><div class="rs">${fmtT(r.score, 3)}<small>/25</small></div><div><b>${r.level.name}, ECTS ${r.level.ects}</b><br>Правильно ${ok} з ${its.filter(it => it.type !== 'text').length} автоматично оцінюваних завдань. Нижче — розбір кожного завдання.</div></div>`;
  }
  if (CONFIG.showReference && REFS[pr.id]) h += `<details class="refp"><summary>Довідка з методичних вказівок</summary><div>${REFS[pr.id]}</div></details>`;
  h += blocksHTML(built.blocks, st.answers, locked, locked ? st.result.items : null, false);
  if (locked && pr.review) { const ch = pr.review(built.v); if (ch.length) h += '<h3>Візуалізація результату</h3>' + ch.map(c => `<figure>${c}</figure>`).join(''); }
  view().innerHTML = h;
  const secs = sectionsOf(built.blocks);
  let sn = 0; const heads = $$('#view h3');
  $('#map').innerHTML = '<div class="mp"><div class="mp-h">Розділи роботи</div>' + secs.map(s => { const hEl = heads.find(x => x.textContent === s.t.replace(/<[^>]+>/g, '')); return `<a class="mp-sec" href="javascript:void 0" data-ids="${s.ids.join(',')}" data-to="${hEl ? hEl.id : ''}"><span>${s.t}</span><span class="mp-n"></span></a>`; }).join('') + '</div>';
  $$('.mp-sec').forEach(a => a.onclick = () => { const el = document.getElementById(a.dataset.to); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  if (locked) {
    setDock(false);
    $$('.mp-sec').forEach(a => { const ids = a.dataset.ids.split(','); const k = ids.filter(id => st.result.items[id] && st.result.items[id].ok === true).length; a.querySelector('.mp-n').textContent = k + '/' + ids.length + ' ✓'; });
  } else { setDock(true); bindInputs(); updateDock(); }
  if (top) window.scrollTo(0, 0);
}
function bindInputs() {
  const { pr, built } = CUR; const st = prState(pr.id); const items = Object.fromEntries(itemsOf(built).map(i => [i.id, i]));
  const showParsed = el => { const p = $(`[data-p="${el.dataset.k}"]`); if (!p) return; const v = el.value.trim(); if (!v) { p.textContent = ''; p.className = 'parsed'; return; } const x = parseNum(v); p.innerHTML = isFinite(x) ? '= ' + fmt(x, 6) : 'не число'; p.className = 'parsed ' + (isFinite(x) ? 'okp' : 'badp'); };
  $$('[data-k]', view()).forEach(el => { if (el.classList.contains('num')) showParsed(el); el.oninput = () => { st.answers[el.dataset.k] = el.value; if (el.classList.contains('num')) showParsed(el); save(); }; });
  $$('input[type=radio]', view()).forEach(el => el.onchange = () => { st.answers[el.name] = el.value; save(); });
  $$('input[type=checkbox]', view()).forEach(el => el.onchange = () => { st.answers[el.name] = $$(`input[name="${el.name}"]:checked`, view()).map(x => x.value); save(); });
  $$('select[data-m]', view()).forEach(el => el.onchange = () => { const a = st.answers[el.dataset.m] = st.answers[el.dataset.m] || {}; a[el.dataset.r] = el.value; save(); });
  $$('button.mv', view()).forEach(el => el.onclick = () => {
    const it = items[el.dataset.o]; const ord = (st.answers[it.id] && st.answers[it.id].length ? st.answers[it.id] : it.initial).slice();
    const i = +el.dataset.i, j = i + +el.dataset.d; [ord[i], ord[j]] = [ord[j], ord[i]]; st.answers[it.id] = ord; save();
    const y = window.scrollY; renderPR(false); window.scrollTo(0, y);
    const b = $(`button.mv[data-o="${it.id}"][data-i="${j}"][data-d="${el.dataset.d}"]`) || $(`button.mv[data-o="${it.id}"][data-i="${j}"]`); if (b) b.focus();
  });
}
function submitFlow() {
  const { pr, built } = CUR; const st = prState(pr.id); const its = itemsOf(built);
  const miss = its.filter(it => !isAnswered(it, st.answers[it.id]));
  const body = miss.length ? `<p>Без відповіді залишилось <b>${miss.length}</b> ${miss.length === 1 ? 'завдання' : 'завдань'}. Незаповнені завдання оцінюються в 0 балів.</p><ul class="misslist">${miss.slice(0, 12).map(it => `<li><a href="#" data-go="${it.id}">${it.q}</a></li>`).join('')}</ul>` : '<p>Усі завдання мають відповіді. Після здачі змінити їх буде неможливо.</p>';
  askModal('Здати ПР ' + pr.id + '?', body, 'Здати роботу', () => {
    for (const it of its) if (it.type === 'order' && !(st.answers[it.id] && st.answers[it.id].length)) st.answers[it.id] = it.initial;
    st.result = gradePR(pr, built, st.answers); st.submitted = new Date().toISOString(); save();
    renderRail(); renderPR(true); toast('Роботу здано: ' + fmtT(st.result.score, 3) + ' з 25 балів');
  });
  $$('[data-go]', $('#modal')).forEach(a => a.onclick = e => { e.preventDefault(); closeModal(); const el = document.getElementById('it-' + a.dataset.go); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); const f = el.querySelector('input,select,textarea,button'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 400); });
}

/* ---------- модальне вікно, сповіщення ---------- */
function askModal(title, body, okText, onOk, danger) {
  const m = $('#modal');
  m.innerHTML = `<form method="dialog" class="md"><h2>${title}</h2><div class="mb">${body}</div><div class="ma"><button value="cancel" class="btn">Повернутися</button><button value="ok" class="btn ${danger ? 'danger' : 'pri'}" id="md-ok">${okText}</button></div></form>`;
  m.onclose = () => { if (m.returnValue === 'ok') onOk(); };
  m.returnValue = ''; m.showModal(); $('#md-ok').focus();
}
function closeModal() { const m = $('#modal'); m.returnValue = 'cancel'; m.close(); }
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 3200); }

/* ---------- протокол ---------- */
function compOf(prs) {
  const comp = {};
  for (const p of PRS) { const st = prs[p.id]; if (!st || !st.submitted) continue; for (const [c, x] of Object.entries(st.result.comp)) { comp[c] = comp[c] || { w: 0, s: 0 }; comp[c].w += x.w; comp[c].s += x.s; } }
  return comp;
}
function protocolHTML(student, prs, key) {
  const mod = m => PRS.filter(p => p.module === m).reduce((a, p) => a + (prs[p.id] && prs[p.id].submitted ? prs[p.id].result.score : 0), 0) / 4;
  const m1 = mod(1), m2 = mod(2), comp = compOf(prs);
  let h = `<div class="stamp"><div class="st-t">Протокол виконання практичних робіт · ${esc(CONFIG.course)}</div>
    <div class="st-r"><span>Здобувач</span><b>${esc(student.name)}</b></div><div class="st-r"><span>Група</span><b>${esc(student.group)}</b></div><div class="st-r"><span>Варіант</span><b>${student.variant}</b></div>
    <div class="st-r"><span>Модуль 1 / 2</span><b>${fmtT(m1, 4)} / ${fmtT(m2, 4)}</b></div><div class="st-r"><span>Код автентичності</span><b class="mono">${protoCode(student, prs)}</b></div><div class="st-r sc"><span>Разом (ПР)</span><b>${fmtT(m1 + m2, 4)}<small> / 50</small></b></div></div>`;
  h += '<table class="dt"><thead><tr><th>ПР</th><th>Тема</th><th>Бали</th><th>ECTS</th><th>Здано</th></tr></thead><tbody>';
  for (const p of PRS) { const st = prs[p.id]; h += `<tr><td>${p.id}</td><td class="l">${p.short}</td><td>${st && st.submitted ? fmtT(st.result.score, 4) : '—'}</td><td>${st && st.submitted ? st.result.level.ects : 'не здано'}</td><td>${st && st.submitted ? new Date(st.submitted).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' }) : ''}</td></tr>`; }
  h += `</tbody></table><p class="hint">Бали — автоматична частина оцінки за практичні завдання (РПНД, п. 13). Текстові обґрунтування оцінює викладач; колоквіуми оцінюються окремо.</p>`;
  h += '<h3>Карта сформованості компетентностей</h3><div class="cmap">';
  for (const [c, d] of Object.entries(COMPETENCIES)) {
    const x = comp[c]; const pct = x ? x.s / x.w * 100 : null;
    h += `<div class="crow"><b>${c}</b><span>${d}</span><div class="cbar"><div style="width:${pct ?? 0}%" class="${pct === null ? '' : pct >= 75 ? 'hi' : pct >= 60 ? 'mid' : 'lo'}"></div></div><span class="cp">${pct === null ? 'немає даних' : Math.round(pct) + ' %'}</span></div>`;
  }
  h += '</div><p class="hint">≥ 75 % — сформована, 60–74 % — частково, менше 60 % — потребує доопрацювання. ЗК.04 (креативність) оцінює викладач за текстовими відповідями.</p>';
  for (const p of PRS) {
    const st = prs[p.id]; if (!st || !st.submitted) continue; const built = buildPR(p, student.variant);
    h += `<details class="pd"><summary>ПР ${p.id}. ${p.title} — ${fmtT(st.result.score, 4)} б.</summary><table class="dt sm"><thead><tr><th>Завдання</th><th>Відповідь</th><th>Результат</th>${key ? '<th>Еталон</th>' : ''}</tr></thead><tbody>`;
    for (const it of itemsOf(built)) {
      const g = st.result.items[it.id] || {};
      h += `<tr class="${it.type === 'text' ? 'txt' : ''}"><td class="l">${it.q}</td><td class="l">${esc(answerText(it, st.answers[it.id])).slice(0, 900)}</td><td class="l">${g.ok === true ? '✓' : g.ok === false ? (g.score > 0 ? '◐ ' + Math.round(g.score * 100) + ' %' : '✗') : '✎'}${g.diag && g.ok !== true ? '<br><small>' + g.diag + '</small>' : ''}</td>${key ? '<td class="l"><small>' + refText(it) + '</small></td>' : ''}</tr>`;
    }
    h += '</tbody></table></details>';
  }
  return h;
}
function protocolJSON() {
  const S = load();
  const out = { format: 'MDDEKM-trainer-protocol/2', student: S.student, code: protoCode(S.student, S.prs), created: new Date().toISOString(), prs: {} };
  for (const p of PRS) { const st = S.prs[p.id]; if (st && st.submitted) out.prs[p.id] = { answers: st.answers, score: st.result.score, started: st.started, submitted: st.submitted }; }
  return out;
}
function openProtocol() {
  CUR = 'proto'; renderTop(); renderRail(); setDock(false); $('#map').innerHTML = '';
  const S = load(); const n = PRS.filter(p => S.prs[p.id] && S.prs[p.id].submitted).length;
  view().innerHTML = `<h1>Протокол для викладача</h1><p class="lead">${n ? `Здано робіт: ${n} з 8. Завантажте файл протоколу і надішліть його викладачу (e-mail, Moodle, Teams). Код автентичності засвідчує, що файл не змінено.` : 'Ще жодної роботи не здано. Протокол з\'явиться після першої здачі.'}</p>
    <div class="actions noprint"><button class="btn pri" id="pdl" ${n ? '' : 'disabled'}>Завантажити протокол (.json)</button><button class="btn" id="ppr" ${n ? '' : 'disabled'}>Друк або PDF</button></div>` + protocolHTML(S.student, S.prs, false);
  $('#ppr').onclick = () => { $$('details.pd').forEach(d => d.open = true); window.print(); };
  $('#pdl').onclick = () => {
    const blob = new Blob([JSON.stringify(protocolJSON(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `МДДЕКМ_протокол_${S.student.name.split(' ')[0]}_${S.student.group}_в${S.student.variant}.json`; document.body.appendChild(a); a.click(); a.remove();
    toast('Протокол завантажено');
  };
  window.scrollTo(0, 0);
}

/* ---------- тема і старт ---------- */
function applyTheme() { const t = load().theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); document.documentElement.dataset.theme = t; $('#theme').setAttribute('aria-label', t === 'dark' ? 'Світла тема' : 'Темна тема'); $('#theme').textContent = t === 'dark' ? '☀' : '☾'; }
function boot() {
  applyTheme();
  $('#theme').onclick = () => { const S = load(); S.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme(); };
  $('#dk-sub').onclick = submitFlow;
  route();
}
if (typeof TEACHER_APP === 'undefined') document.addEventListener('DOMContentLoaded', boot);
