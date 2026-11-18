/* ПР 3. Криві Велера, правило Пальмгрена–Майнера, Rainflow (ASTM E1049) */
function rainflow(seq) {
  const st = [], out = [];
  for (const p of seq) {
    st.push(p);
    while (st.length >= 3) {
      const X = Math.abs(st[st.length - 1] - st[st.length - 2]), Yr = Math.abs(st[st.length - 2] - st[st.length - 3]);
      if (X < Yr) break;
      if (st.length === 3) { out.push([Yr, 0.5]); st.shift(); }
      else { out.push([Yr, 1]); const last = st.pop(); st.pop(); st.pop(); st.push(last); }
    }
  }
  for (let i = 0; i < st.length - 1; i++) out.push([Math.abs(st[i + 1] - st[i]), 0.5]);
  return out;
}
function rfTable(out) { const m = {}; out.forEach(([r, c]) => m[r] = (m[r] || 0) + c); return Object.keys(m).map(Number).sort((a, b) => b - a).map(r => [r, m[r]]); }
registerPR({
  id: 3, module: 1,
  title: 'Оцінювання довговічності деталей машин за кривими Велера, правилом Пальмгрена–Майнера та Rainflow-аналізом',
  short: 'Втома: S–N, Майнер, Rainflow',
  gen(r) {
    const sl = r.pick([220, 250, 280, 300]), m = r.pick([6, 8, 9]), NG = 2e6;
    const Nf = sa => sa > sl ? NG * (sl / sa) ** m : Infinity;
    const sa = [r.uni(1.25, 1.35), r.uni(1.12, 1.2), r.uni(1.04, 1.09), r.uni(0.86, 0.93)].map(k => Math.round(sl * k / 5) * 5);
    const Dt = r.uni(0.3, 0.85); const w = [r.uni(0.2, 0.5), r.uni(0.2, 0.5), r.uni(0.2, 0.5)]; const ws = w[0] + w[1] + w[2];
    const N = sa.map(Nf);
    const n = [0, 1, 2].map(i => sig(Dt * w[i] / ws * N[i], 2)); n.push(sig(r.uni(2, 8) * 1e6, 2));
    const Di = [0, 1, 2, 3].map(i => isFinite(N[i]) ? n[i] / N[i] : 0);
    const D = Di.reduce((a, b) => a + b, 0);
    // історія навантаження для Rainflow
    let seq, rf, guard = 0;
    do {
      seq = []; let cur = r.step(-150, 150, 50); seq.push(cur); let up = r.u() < 0.5;
      for (let i = 1; i < 10; i++) {
        const opts = []; for (let x = -350; x <= 400; x += 50) if (up ? x > cur : x < cur) opts.push(x);
        if (!opts.length) { up = !up; i--; continue; }
        cur = r.pick(opts); seq.push(cur); up = !up;
      }
      rf = rfTable(rainflow(seq));
      guard++;
    } while (guard < 200 && !(rf.length >= 3 && rf.length <= 6 && rf.some(([rg, c]) => rg / 2 > sl * 1.05) && rf.some(([, c]) => c >= 1)));
    const Dh = rf.reduce((s, [rg, c]) => s + (rg / 2 > sl ? c / Nf(rg / 2) : 0), 0);
    const decoy = (() => { for (const x of [50, 100, 150, 200, 250, 300, 350, 400, 450, 500]) if (!rf.some(([rg]) => rg === x) && x < rf[0][0]) return x; return 25; })();
    return { sl, m, NG, sa, n, N, Di, D, seq, rf, Dh, decoy };
  },
  build(v, r) {
    const b = [];
    const C8 = ['ФК.08', 'ЗК.01'];
    b.push(H('Вихідні дані варіанта'));
    b.push(INFO(`<p>Крива втоми матеріалу деталі (з урахуванням концентрації, масштабу і стану поверхні) апроксимована степеневою залежністю Велера:</p>
      <p class="formula">σ<sub>a</sub><sup>m</sup> · N = σ<sub>−1</sub><sup>m</sup> · N<sub>G</sub>, &nbsp; σ<sub>a</sub> &gt; σ<sub>−1</sub></p>
      <p>Навчальні дані: σ<sub>−1</sub> = <b>${v.sl} МПа</b>, m = <b>${v.m}</b>, N<sub>G</sub> = <b>2·10<sup>6</sup></b> циклів. Використовуйте класичне правило Пальмгрена–Майнера: амплітуди σ<sub>a</sub> ≤ σ<sub>−1</sub> пошкодження не вносять; критерій руйнування D = 1.</p>`));
    const sn = logspace(1e4, 1e8, 60).map(N => [N, N < v.NG ? v.sl * (v.NG / N) ** (1 / v.m) : v.sl]);
    b.push(CHART(plot({ id: 31, title: 'Крива втоми матеріалу варіанта', xlab: 'N, циклів', ylab: 'σa, МПа', xlog: true, ylog: false, series: [{ pts: sn, color: COL.s1, label: 'S–N' }],
      xmin: 1e4, xmax: 1e8, ymin: Math.floor(v.sl * 0.8 / 10) * 10, ymax: Math.ceil(sn[0][1] * 1.05 / 10) * 10, hlines: [{ y: v.sl, label: 'σ₋₁ = ' + v.sl + ' МПа', color: COL.ink2 }], vlines: [{ x: v.NG, label: 'N_G', color: COL.ink2 }] })));
    b.push(H('Завдання 1. Блоковий спектр навантаження'));
    b.push(TABLE(['Рівень i', 'σ<sub>a,i</sub>, МПа', 'n<sub>i</sub>, циклів у блоці'], v.sa.map((s, i) => [i + 1, s, fmt(v.n[i], 3)])));
    for (let i = 0; i < 3; i++) b.push(NUM('p3_N' + i, 'N<sub>' + (i + 1) + '</sub> — довговічність на рівні ' + (i + 1), v.N[i], { unit: 'циклів', tol: 0.02, comp: C8,
      errors: [{ value: v.NG * (v.sa[i] / v.sl) ** v.m, msg: 'Відношення напружень обернено: N = N<sub>G</sub>(σ<sub>−1</sub>/σ<sub>a</sub>)<sup>m</sup>' }] }));
    for (let i = 0; i < 4; i++) {
      const bad = i === 3 ? [{ value: v.n[3] / (v.NG * (v.sl / v.sa[3]) ** v.m), msg: 'Рівень нижче σ<sub>−1</sub>: за класичним правилом Майнера пошкодження не накопичується (D₄ = 0)' }] : [{ value: v.N[i] / v.n[i], msg: 'Обернено відношення: D<sub>i</sub> = n<sub>i</sub>/N<sub>i</sub>' }];
      b.push(NUM('p3_D' + i, 'D<sub>' + (i + 1) + '</sub> = n<sub>' + (i + 1) + '</sub>/N<sub>' + (i + 1) + '</sub>', v.Di[i], { tol: 0.02, abs: i === 3 ? 1e-4 : 0, comp: C8, errors: bad }));
    }
    const D4wrong = v.Di[0] + v.Di[1] + v.Di[2] + v.n[3] / (v.NG * (v.sl / v.sa[3]) ** v.m);
    b.push(NUM('p3_D', 'Сумарне пошкодження одного блока D', v.D, { tol: 0.02, comp: C8, errors: [{ value: D4wrong, msg: 'До суми включено пошкодження від рівня нижче σ<sub>−1</sub>' }] }));
    b.push(NUM('p3_L', 'Довговічність, блоків до руйнування L = 1/D', 1 / v.D, { unit: 'блоків', tol: 0.02, comp: C8, errors: [{ value: 1 / D4wrong, msg: 'До суми включено пошкодження від рівня нижче σ<sub>−1</sub>' }] }));
    const share = v.Di[0] / v.D;
    b.push(NUM('p3_share', 'Частка пошкодження від найвищого рівня 1 у сумарному D', share * 100, { unit: '%', tol: 0.02, abs: 0.3, comp: ['ЗК.01', 'ФК.02'],
      errors: [{ value: v.n[0] / (v.n[0] + v.n[1] + v.n[2] + v.n[3]) * 100, msg: 'Обчислено частку циклів, а не частку пошкодження' }] }));
    b.push(H('Завдання 2. Rainflow-аналіз історії навантаження'));
    b.push(INFO(`<p>Тензометрія зафіксувала послідовність екстремумів напруження (МПа): <b class="mono">${v.seq.join(' → ')}</b>. Виконайте підрахунок циклів методом «дощового потоку» за ASTM E1049 (трьохточковий алгоритм; залишок рахується півциклами). Розмах циклу Δσ = |σ<sub>max</sub> − σ<sub>min</sub>|, амплітуда σ<sub>a</sub> = Δσ/2; вплив середнього напруження не враховуйте.</p>`));
    b.push(CHART(plot({ id: 32, title: 'Історія навантаження (екстремуми)', xlab: 'номер екстремуму', ylab: 'σ, МПа', series: [{ pts: v.seq.map((y, i) => [i + 1, y]), color: COL.s1, marker: true, label: 'σ(t)' }],
      xmin: 0.5, xmax: v.seq.length + 0.5, xticks: v.seq.map((_, i) => i + 1), ymin: -400, ymax: 450, hlines: [{ y: 0, color: COL.ink2 }] })));
    const bins = v.rf.map(x => x[0]).concat([v.decoy]).sort((a, b) => b - a);
    for (const rg of bins) {
      const c = (v.rf.find(x => x[0] === rg) || [0, 0])[1];
      b.push(NUM('p3_rf' + rg, 'Кількість циклів з розмахом Δσ = ' + rg + ' МПа (півцикл = 0,5)', c, { tol: 0, abs: 0.01, comp: ['ФК.09', 'ФК.08'], w: 0.7 }));
    }
    b.push(NUM('p3_Dh', 'Пошкодження від одного повторення історії D<sub>h</sub>', v.Dh, { tol: 0.03, comp: C8,
      errors: [{ value: v.rf.reduce((s, [rg, c]) => s + (rg > v.sl ? c / (v.NG * (v.sl / rg) ** v.m) : 0), 0), msg: 'У S–N підставлено розмах Δσ замість амплітуди σ<sub>a</sub> = Δσ/2' }] }));
    b.push(NUM('p3_Rh', 'Кількість повторень історії до руйнування 1/D<sub>h</sub>', 1 / v.Dh, { tol: 0.03, comp: C8 }));
    b.push(H('Завдання 3. Аналіз та обмеження методу'));
    b.push(MULTI(r, 'p3_lim', 'Оберіть ВСІ коректні твердження про обмеження правила Пальмгрена–Майнера:', [
      { t: 'Не враховує послідовність навантаження (ефекти «високе→низьке» і «низьке→високе»)', ok: true },
      { t: 'Ігнорує пошкоджувальну дію амплітуд нижче σ<sub>−1</sub>, хоча після перевантажень вони можуть пошкоджувати (модифікації Хайбаха, Кортена–Долана)', ok: true },
      { t: 'Не враховує вплив середнього напруження циклу без додаткової поправки (Гудман, Гербер, SWT)', ok: true },
      { t: 'Вимагає обов\'язкового врахування порядку циклів через нелінійне підсумовування', ok: false },
      { t: 'Дає точний результат D = 1 для будь-якого спектра', ok: false },
    ], { comp: ['ФК.02', 'ЗК.01'], w: 1.5 }));
    const top = v.Di[0] >= Math.max(v.Di[1], v.Di[2]);
    b.push(CHOICE(r, 'p3_dec', 'Який захід найефективніше підвищить ресурс при вашому спектрі?', [
      { t: 'Обмежити (або виключити) режим з найвищою амплітудою: він дає найбільшу частку пошкодження', ok: top, why: 'Подивіться, який рівень дає найбільшу частку D' },
      { t: 'Зменшити кількість циклів на рівні 4 (нижче σ<sub>−1</sub>)', ok: false, why: 'Рівень нижче σ<sub>−1</sub> за класичним Майнером не пошкоджує' },
      { t: 'Обмежити рівень, що дає найбільшу частку D, яка у вашому варіанті належить не найвищому рівню навантаження', ok: !top, why: 'Порівняйте D<sub>i</sub> усіх рівнів' },
    ], { comp: ['ЗК.03', 'ФК.07'], w: 1.2 }));
    b.push(H('Контрольні запитання'));
    b.push(...theory(r, 'p3', [
      { q: 'Призначення Rainflow-аналізу:', ok: 'Виділення замкнених петель гістерезису (циклів) з довільної історії навантаження', bad: ['Фільтрація шуму сигналу', 'Визначення частоти власних коливань', 'Побудова кривої Велера'] },
      { q: 'При двоступеневому навантаженні «високе → низьке» фактична сума Σn/N зазвичай:', ok: 'Менша за 1', bad: ['Більша за 1', 'Точно дорівнює 1', 'Дорівнює 0,5'] },
      { q: 'Гігациклова втома (VHCF) показує, що:', ok: 'Для багатьох сталей горизонтальної ділянки S–N за N > 10⁷ немає, руйнування ініціюється від внутрішніх включень', bad: ['Після 10⁷ циклів руйнування неможливе', 'VHCF стосується лише полімерів', 'Межа витривалості зростає з N'] },
      { q: 'Рівняння Баскіна описує:', ok: 'Степеневу залежність амплітуди напруження від кількості півциклів до руйнування σ<sub>a</sub> = σ\'<sub>f</sub>(2N<sub>f</sub>)<sup>b</sup>', bad: ['Ріст тріщини da/dN', 'Пластичну деформацію циклу', 'Розподіл Вейбулла'] },
      { q: 'Вплив розтягувального середнього напруження циклу на довговічність:', ok: 'Зменшує довговічність (враховується діаграмами Гудмана, Гербера, параметром SWT)', bad: ['Збільшує довговічність', 'Не впливає', 'Впливає лише при стиску'] },
    ], 3));
    return b;
  },
  review(v) {
    const lab = ['1', '2', '3', '4'];
    const c1 = plot({ id: 33, title: 'Внесок рівнів спектра в пошкодження D', ylab: 'D_i', xticks: [], series: [{ pts: v.Di.map((d, i) => [i + 1, d]), bar: 0.6, color: COL.s2, label: 'D_i' }], xmin: 0.4, xmax: 4.6, ymin: 0,
      notes: v.Di.map((d, i) => ({ x: i + 1, y: d, text: 'рівень ' + lab[i] + ': ' + fmtT(d, 3), anchor: 'middle', dx: 0, dy: -8 })) });
    const c2 = plot({ id: 34, title: 'Гістограма Rainflow (кількість циклів за розмахом)', xlab: 'Δσ, МПа', ylab: 'циклів', series: [{ pts: v.rf, bar: 30, color: COL.s1, label: 'Rainflow' }], ymin: 0, xmin: 0, xmax: v.rf[0][0] + 60, ymax: Math.max(...v.rf.map(x => x[1])) + 0.5 });
    return [c1, c2];
  },
});
