/* ПР 4. Імовірнісна модель ресурсу (статистика, Вейбулл, умовна надійність) */
function linreg(x, y) {
  const n = x.length, mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  const k = sxy / sxx; return { k, b: my - k * mx, r2: sxy * sxy / (sxx * syy) };
}
function weibullFit(data, rank) {
  const s = data.slice().sort((a, b) => a - b), n = s.length;
  const F = s.map((_, i) => rank === 'mean' ? (i + 1) / (n + 1) : (i + 1 - 0.3) / (n + 0.4));
  const x = s.map(Math.log), y = F.map(f => Math.log(-Math.log(1 - f)));
  const L = linreg(x, y); const beta = L.k, eta = Math.exp(-L.b / beta);
  const Li = linreg(y, x); const betaInv = 1 / Li.k;
  return { beta, eta, r2: L.r2, x, y, s, betaInv, etaInv: Math.exp(Li.b) };
}
registerPR({
  id: 4, module: 1,
  title: 'Побудова ймовірнісної моделі прогнозування ресурсу деталей машин',
  short: 'Імовірнісна модель ресурсу',
  gen(r) {
    const beta0 = r.uni(2.5, 6), eta0 = r.step(500, 1200, 10);
    let data, guard = 0;
    do { data = Array.from({ length: 10 }, () => Math.round(eta0 * (-Math.log(1 - r.uni(0.04, 0.96))) ** (1 / beta0))); guard++; } while (new Set(data).size < 10 && guard < 50);
    const n = 10, s = data.slice().sort((a, b) => a - b);
    const mean = data.reduce((a, b) => a + b) / n, median = (s[4] + s[5]) / 2;
    const sd = Math.sqrt(data.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1));
    const cv = sd / mean * 100;
    const W = weibullFit(data), Wm = weibullFit(data, 'mean');
    const Nst = Math.round(W.eta * r.uni(0.45, 0.75) / 10) * 10;
    const Rst = Math.exp(-((Nst / W.eta) ** W.beta));
    const B10 = W.eta * (-Math.log(0.9)) ** (1 / W.beta);
    const N0 = Math.round(W.eta * r.uni(0.35, 0.55) / 10) * 10, dN = Math.round(W.eta * r.uni(0.15, 0.3) / 10) * 10;
    const Rf = N => Math.exp(-((N / W.eta) ** W.beta));
    const Rcond = Rf(N0 + dN) / Rf(N0);
    return { data, mean, median, sd, cv, W, Wm, Nst, Rst, B10, N0, dN, Rcond, unsortedMedian: (data[4] + data[5]) / 2 };
  },
  build(v, r) {
    const b = [], C8 = ['ФК.08', 'ФК.09'];
    b.push(H('Вихідні дані варіанта'));
    b.push(INFO('<p>Стендові випробування партії з 10 однотипних деталей до втомного руйнування дали такі значення ресурсу (тис. циклів, у порядку випробувань):</p>'));
    b.push(TABLE(['№'].concat(v.data.map((_, i) => i + 1)), [['N, тис. циклів'].concat(v.data)]));
    b.push(INFO(`<p class="note">Параметри двопараметричного розподілу Вейбулла R(N) = exp[−(N/η)<sup>β</sup>] оцініть методом лінійної регресії на ймовірнісному папері: впорядкуйте вибірку, використайте медіанні ранги Бернарда F<sub>i</sub> = (i − 0,3)/(n + 0,4), координати x = ln N<sub>i</sub>, y = ln[−ln(1 − F<sub>i</sub>)]; регресія y на x: β = нахил, η = exp(−b/β). Рекомендоване ПЗ: Excel (ЛИНЕЙН / НАКЛОН), Python (NumPy/SciPy), MATLAB.</p>`));
    b.push(H('1. Описова статистика'));
    b.push(NUM('p4_mean', 'Середнє N̄', v.mean, { unit: 'тис. циклів', tol: 0.002, comp: C8 }));
    b.push(NUM('p4_med', 'Медіана', v.median, { unit: 'тис. циклів', tol: 0.002, comp: C8, errors: [{ value: v.unsortedMedian === v.median ? NaN : v.unsortedMedian, msg: 'Медіану взято з невпорядкованої вибірки — спочатку відсортуйте дані' }] }));
    b.push(NUM('p4_sd', 'Вибіркове СКВ s (з n − 1)', v.sd, { unit: 'тис. циклів', tol: 0.01, comp: C8, errors: [{ value: v.sd * Math.sqrt(9 / 10), msg: 'Обчислено генеральне СКВ (ділення на n) — для вибірки потрібно n − 1' }, { value: v.sd ** 2, msg: 'Подано дисперсію s², а не СКВ s' }] }));
    b.push(NUM('p4_cv', 'Коефіцієнт варіації V', v.cv, { unit: '%', tol: 0.015, comp: C8 }));
    b.push(H('2. Модель Вейбулла'));
    b.push(NUM('p4_beta', 'Параметр форми β', v.W.beta, { tol: 0.03, comp: C8,
      errors: [{ value: v.Wm.beta, msg: 'Використано середні ранги i/(n+1) замість медіанних рангів Бернарда' }, { value: v.W.betaInv, msg: 'Виконано регресію x на y замість y на x' }] }));
    b.push(NUM('p4_eta', 'Характеристичний ресурс η', v.W.eta, { unit: 'тис. циклів', tol: 0.015, comp: C8, errors: [{ value: v.Wm.eta, msg: 'Використано середні ранги i/(n+1) замість медіанних рангів Бернарда' }] }));
    b.push(NUM('p4_r2', 'Коефіцієнт детермінації R² лінійної апроксимації', v.W.r2, { tol: 0, abs: 0.01, comp: ['ФК.09', 'ФК.02'] }));
    b.push(H('3. Надійність і залишковий ресурс'));
    b.push(NUM('p4_R', 'Імовірність безвідмовної роботи R(N) для N = ' + v.Nst + ' тис. циклів', v.Rst, { tol: 0, abs: 0.01, comp: C8, errors: [{ value: 1 - v.Rst, msg: 'Обчислено ймовірність відмови F = 1 − R' }] }));
    b.push(NUM('p4_B10', 'Ресурс B<sub>10</sub> (R = 0,9)', v.B10, { unit: 'тис. циклів', tol: 0.03, comp: C8, errors: [{ value: v.W.eta * (-Math.log(0.1)) ** (1 / v.W.beta), msg: 'Підставлено R = 0,1 замість 0,9' }] }));
    b.push(NUM('p4_Rc', 'Деталь уже відпрацювала N<sub>0</sub> = ' + v.N0 + ' тис. циклів. Імовірність, що вона відпрацює ще ' + v.dN + ' тис. циклів без відмови', v.Rcond, { tol: 0, abs: 0.01, comp: ['ФК.08', 'ЗК.03'],
      errors: [{ value: Math.exp(-((v.dN / v.W.eta) ** v.W.beta)), msg: 'Не враховано вже відпрацьований ресурс: потрібна умовна надійність R(N₀+ΔN)/R(N₀)' }, { value: Math.exp(-(((v.N0 + v.dN) / v.W.eta) ** v.W.beta)), msg: 'Обчислено безумовну R(N₀+ΔN) — потрібно поділити на R(N₀)' }] }));
    b.push(H('4. Інтерпретація'));
    b.push(CHOICE(r, 'p4_beta_int', 'Як інтерпретувати отримане значення β?', [
      { t: 'β > 1: інтенсивність відмов зростає — домінує накопичення пошкоджень (втома, зношування); профілактична заміна доцільна', ok: true },
      { t: 'β < 1: відмови припрацювання, інтенсивність спадає', ok: false, why: 'Ваше β більше за 1' },
      { t: 'β ≈ 1: випадкові раптові відмови, профілактична заміна не дає ефекту', ok: false, why: 'Ваше β помітно більше за 1' },
    ], { comp: ['ЗК.01', 'ФК.09'] }));
    b.push(CHOICE(r, 'p4_n', 'Чи достатньо 10 зразків для надійного прогнозу B<sub>10</sub>?', [
      { t: 'Ні: B<sub>10</sub> — екстраполяція в хвіст розподілу; потрібні довірчі межі (напр., 90 %) і за можливості більша вибірка (ISO 12107)', ok: true },
      { t: 'Так: регресія з R² > 0,9 гарантує точність B<sub>10</sub>', ok: false, why: 'Високий R² не усуває статистичну невизначеність хвоста розподілу' },
      { t: 'Так, якщо коефіцієнт варіації менший за 50 %', ok: false, why: 'CV не визначає довірчий інтервал квантиля' },
    ], { comp: ['ФК.02', 'ЗК.03', 'ФК.09'], w: 1.2 }));
    b.push(TEXT('p4_just', 'Інженерний висновок: рекомендований інтервал профілактичної заміни і обґрунтування вибору закону розподілу (3–5 речень).', { comp: ['ЗК.03'] }));
    b.push(H('Контрольні запитання'));
    b.push(...theory(r, 'p4', [
      { q: 'Для опису яких величин доцільний логнормальний розподіл?', ok: 'Ресурс деталей, швидкість росту тріщин, зношування — величини, що утворюються добутком багатьох випадкових чинників', bad: ['Тільки механічні властивості матеріалу', 'Лише раптові відмови з постійною інтенсивністю', 'Похибки вимірювання геометрії'] },
      { q: 'Умовна функція надійності R(N|N₀) =', ok: 'R(N)/R(N₀)', bad: ['R(N) − R(N₀)', 'R(N)·R(N₀)', '1 − R(N − N₀)'] },
      { q: 'Характеристичний ресурс η у розподілі Вейбулла — це ресурс, за якого:', ok: 'Відмовило ≈ 63,2 % виробів', bad: ['Відмовило 50 % виробів', 'Відмовило 10 % виробів', 'Інтенсивність відмов максимальна'] },
      { q: 'Чим B₁₀ корисніший за середній ресурс для відповідальних деталей?', ok: 'Він характеризує ресурс з гарантованою ймовірністю безвідмовної роботи 0,9', bad: ['Він завжди більший за середній', 'Не залежить від розсіювання', 'Не потребує статистичних даних'] },
    ], 3));
    return b;
  },
  review(v) {
    const W = v.W;
    const xs = linspace(Math.min(...W.x) - 0.1, Math.max(...W.x) + 0.1, 20);
    const c1 = plot({ id: 41, title: 'Ймовірнісний папір Вейбулла (медіанні ранги)', xlab: 'ln N', ylab: 'ln[−ln(1−F)]',
      series: [{ pts: W.x.map((x, i) => [x, W.y[i]]), line: false, marker: true, color: COL.s1, label: 'дані' }, { pts: xs.map(x => [x, W.beta * x - W.beta * Math.log(W.eta)]), color: COL.s2, label: 'β = ' + fmtT(W.beta, 3) + ', η = ' + fmtT(W.eta, 4) }] });
    const Ns = linspace(0, W.eta * 1.6, 100);
    const c2 = plot({ id: 42, title: 'Функція надійності R(N)', xlab: 'N, тис. циклів', ylab: 'R', ymin: 0, ymax: 1.02, xmin: 0,
      series: [{ pts: Ns.map(N => [N, Math.exp(-((N / W.eta) ** W.beta))]), color: COL.s1, label: 'R(N)' }],
      hlines: [{ y: 0.9, label: 'R = 0,9', color: COL.ink2 }], vlines: [{ x: v.B10, label: 'B10 = ' + fmtT(v.B10, 3) }] });
    return [c1, c2];
  },
});
