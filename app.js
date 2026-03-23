// ============================================================
// CONSTANTS & CONFIG
// ============================================================

const MERCURY_RETROGRADES = [
  ['2015-01-21','2015-02-11'],['2015-05-19','2015-06-11'],['2015-09-17','2015-10-09'],
  ['2016-01-05','2016-01-25'],['2016-04-28','2016-05-22'],['2016-08-30','2016-09-22'],
  ['2016-12-19','2017-01-08'],['2017-04-09','2017-05-03'],['2017-08-12','2017-09-05'],
  ['2017-12-03','2017-12-23'],['2018-03-22','2018-04-15'],['2018-07-26','2018-08-18'],
  ['2018-11-16','2018-12-06'],['2019-03-05','2019-03-28'],['2019-07-07','2019-07-31'],
  ['2019-10-31','2019-11-20'],['2020-02-17','2020-03-10'],['2020-06-18','2020-07-12'],
  ['2020-10-14','2020-11-03'],['2021-01-30','2021-02-21'],['2021-05-29','2021-06-22'],
  ['2021-09-27','2021-10-23'],['2022-01-14','2022-02-04'],['2022-05-10','2022-06-03'],
  ['2022-09-10','2022-10-02'],['2022-12-29','2023-01-18'],['2023-04-21','2023-05-15'],
  ['2023-08-23','2023-09-15'],['2023-12-13','2024-01-02'],['2024-04-01','2024-04-25'],
  ['2024-08-05','2024-08-28'],['2024-11-26','2024-12-15'],
];

// Simulated Arsenal results 2015-2024 (W/D/L with date)
// A representative sample based on real-ish form patterns
const ARSENAL_SIMULATED = generateArsenalResults();

function generateArsenalResults() {
  const results = [];
  // Form profiles by season (roughly accurate vibes)
  const seasons = [
    { year: 2015, form: 0.58 }, // Wenger mid era
    { year: 2016, form: 0.60 },
    { year: 2017, form: 0.58 },
    { year: 2018, form: 0.55 }, // Emery arrives
    { year: 2019, form: 0.52 }, // Emery out, Arteta in
    { year: 2020, form: 0.54 },
    { year: 2021, form: 0.56 }, // Arteta building
    { year: 2022, form: 0.68 }, // Strong Arteta era
    { year: 2023, form: 0.71 }, // Title contenders
    { year: 2024, form: 0.69 },
  ];
  // Generate ~38 matches per season on weekend dates
  for (const s of seasons) {
    for (let gw = 0; gw < 38; gw++) {
      const month = gw < 19 ? Math.floor(8 + gw/4) : Math.floor(1 + (gw-19)/4);
      const day = (gw % 4) * 7 + 4;
      const dateStr = `${month <= 9 ? s.year : s.year}-${String(month).padStart(2,'0')}-${String(Math.min(day,28)).padStart(2,'0')}`;
      const r = Math.random();
      let outcome;
      if (r < s.form) outcome = 'W';
      else if (r < s.form + 0.15) outcome = 'D';
      else outcome = 'L';
      results.push({ date: dateStr, outcome, team: 'Arsenal' });
    }
  }
  return results;
}

// ============================================================
// DATA FETCHING
// ============================================================

const priceCache = {};

async function fetchPrices(ticker, fromDate, toDate) {
  const key = `${ticker}_${fromDate}_${toDate}`;
  if (priceCache[key]) return priceCache[key];

  const url = `data/prices/${ticker.toUpperCase()}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${ticker} — no data file found`);
  const allPrices = await res.json();

  const prices = allPrices.filter(p => p.date >= fromDate && p.date <= toDate);
  if (prices.length === 0) {
    throw new Error(`No data for ${ticker} in range ${fromDate} to ${toDate}`);
  }

  priceCache[key] = prices;
  return prices;
}

// ============================================================
// TECHNICAL INDICATORS
// ============================================================

function sma(prices, window) {
  return prices.map((_, i) => {
    if (i < window - 1) return null;
    const slice = prices.slice(i - window + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / window;
  });
}

function ema(prices, window) {
  const k = 2 / (window + 1);
  const result = [null];
  let prev = prices[0];
  for (let i = 1; i < prices.length; i++) {
    if (i < window - 1) { result.push(null); continue; }
    if (i === window - 1) {
      const init = prices.slice(0, window).reduce((a, b) => a + b, 0) / window;
      result.push(init);
      prev = init;
    } else {
      prev = prices[i] * k + prev * (1 - k);
      result.push(prev);
    }
  }
  return result;
}

function rsi(prices, period = 14) {
  const result = Array(period).fill(null);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return result;
}

function bollingerBands(prices, window, numStd) {
  const mid = sma(prices, window);
  return prices.map((_, i) => {
    if (i < window - 1) return { upper: null, mid: null, lower: null, bw: null };
    const slice = prices.slice(i - window + 1, i + 1);
    const mean = mid[i];
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / window);
    return { upper: mean + numStd * std, mid: mean, lower: mean - numStd * std, bw: (numStd * 2 * std) / mean };
  });
}

// ============================================================
// MOON PHASES (simplified Meeus algorithm)
// ============================================================

function moonPhase(date) {
  const d = new Date(date);
  // Days since known new moon (Jan 6, 2000)
  const knownNew = new Date('2000-01-06');
  const diff = (d - knownNew) / (1000 * 60 * 60 * 24);
  const cycle = 29.53058867;
  const phase = ((diff % cycle) + cycle) % cycle;
  return phase; // 0 = new, ~14.77 = full
}

function isNearNewMoon(date, windowDays) {
  const phase = moonPhase(date);
  return phase <= windowDays || phase >= (29.53 - windowDays);
}

function isNearFullMoon(date, windowDays) {
  const phase = moonPhase(date);
  return Math.abs(phase - 14.77) <= windowDays;
}

function isWaxing(date) {
  return moonPhase(date) < 14.77;
}

// ============================================================
// MERCURY RETROGRADE
// ============================================================

function isMercuryRetrograde(dateStr, bufferDays = 0) {
  const d = new Date(dateStr).getTime();
  for (const [start, end] of MERCURY_RETROGRADES) {
    const s = new Date(start).getTime() - bufferDays * 86400000;
    const e = new Date(end).getTime() + bufferDays * 86400000;
    if (d >= s && d <= e) return true;
  }
  return false;
}

// ============================================================
// STRATEGIES
// ============================================================

function strategyMACrossover(prices, params) {
  const closes = prices.map(p => p.close);
  const maFn = params.ma_type === 'ema' ? ema : sma;
  const fastMA = maFn(closes, params.fast_window);
  const slowMA = maFn(closes, params.slow_window);

  return prices.map((p, i) => {
    if (fastMA[i] === null || slowMA[i] === null) return { date: p.date, signal: 0 };
    const signal = fastMA[i] > slowMA[i] ? 1 : 0;
    const reason = signal ? `${params.ma_type.toUpperCase()}(${params.fast_window}) > ${params.ma_type.toUpperCase()}(${params.slow_window})` : `${params.ma_type.toUpperCase()}(${params.fast_window}) < ${params.ma_type.toUpperCase()}(${params.slow_window})`;
    return { date: p.date, signal, reason };
  });
}

function strategyRSI(prices, params) {
  const closes = prices.map(p => p.close);
  const rsiVals = rsi(closes, params.rsi_period);
  let position = 0;

  return prices.map((p, i) => {
    const r = rsiVals[i];
    if (r === null) return { date: p.date, signal: 0 };
    if (r < params.oversold) position = 1;
    if (r > params.overbought) position = 0;
    return { date: p.date, signal: position, reason: `RSI=${r.toFixed(1)}` };
  });
}

function strategyBollinger(prices, params) {
  const closes = prices.map(p => p.close);
  const std = params.bb_std / 10;
  const bands = bollingerBands(closes, params.bb_window, std);
  let position = 0;

  return prices.map((p, i) => {
    const b = bands[i];
    if (!b.bw) return { date: p.date, signal: 0 };
    const recentBW = bands.slice(Math.max(0, i - params.squeeze_lb), i + 1).map(x => x.bw).filter(Boolean);
    const minBW = Math.min(...recentBW);
    const isSqueeze = b.bw <= minBW * 1.1;
    if (p.close > b.upper && isSqueeze) position = 1;
    if (p.close < b.mid) position = 0;
    return { date: p.date, signal: position, reason: isSqueeze ? 'squeeze+breakout' : 'no squeeze' };
  });
}

function strategyDualMomentum(prices, safePrices, params) {
  const rebalanceDays = params.dm_rebal;
  const lookback = params.dm_lookback;
  let position = 0;
  let daysSinceRebal = 0;

  return prices.map((p, i) => {
    daysSinceRebal++;
    if (i < lookback || daysSinceRebal < rebalanceDays) return { date: p.date, signal: position };
    daysSinceRebal = 0;
    const returnPrimary = (prices[i].close - prices[i - lookback].close) / prices[i - lookback].close;
    const riskFree = 0.02 * (lookback / 252);
    position = returnPrimary > riskFree ? 1 : 0;
    return { date: p.date, signal: position, reason: `${(returnPrimary * 100).toFixed(1)}% > ${(riskFree * 100).toFixed(1)}%` };
  });
}

function strategyCongressional(prices, congressPrices, params) {
  if (!congressPrices || congressPrices.length < 10) {
    return prices.map(p => ({ date: p.date, signal: 1, reason: 'NANC data unavailable — defaulting to invested' }));
  }
  const closes = congressPrices.map(p => p.close);
  const maVals = sma(closes, Math.min(params.congress_ma, closes.length - 1));
  const congressMap = {};
  congressPrices.forEach((p, i) => { congressMap[p.date] = maVals[i]; });

  let lastSignal = 0;
  return prices.map(p => {
    const ma = congressMap[p.date];
    const cp = congressPrices.find(c => c.date === p.date);
    if (ma && cp) lastSignal = cp.close > ma ? 1 : 0;
    return { date: p.date, signal: lastSignal, reason: `Congress proxy trend` };
  });
}

function strategyMercury(prices, params) {
  const buffer = parseInt(params.mercury_window);
  return prices.map(p => {
    const retro = isMercuryRetrograde(p.date, buffer);
    return { date: p.date, signal: retro ? 0 : 1, reason: retro ? '☿ retrograde' : 'direct' };
  });
}

function strategyMoon(prices, params) {
  const w = parseInt(params.moon_window);
  return prices.map(p => {
    let signal;
    if (params.moon_mode === 'waxing_hold') {
      signal = isWaxing(p.date) ? 1 : 0;
    } else {
      const nearNew = isNearNewMoon(p.date, w);
      const nearFull = isNearFullMoon(p.date, w);
      if (nearNew) signal = 1;
      else if (nearFull) signal = 0;
      else signal = -1; // hold
    }
    return { date: p.date, signal: signal === -1 ? undefined : signal, reason: `phase=${moonPhase(p.date).toFixed(1)}d` };
  });
}

function strategyFriday13(prices, params) {
  const extended = params.f13_window === '3';
  return prices.map(p => {
    const d = new Date(p.date);
    let avoid = false;
    if (!extended) {
      avoid = d.getDay() === 5 && d.getDate() === 13;
    } else {
      for (let offset = -1; offset <= 2; offset++) {
        const test = new Date(d);
        test.setDate(test.getDate() - offset);
        if (test.getDate() === 13) { avoid = true; break; }
      }
    }
    return { date: p.date, signal: avoid ? 0 : 1, reason: avoid ? '🔪 Friday 13th' : 'clear' };
  });
}

function strategySports(prices, matchResults, params) {
  const mode = params.sports_mode;
  const matchMap = {};
  for (const m of matchResults) matchMap[m.date] = m.outcome;

  const offseason = (dateStr) => {
    const m = new Date(dateStr).getMonth() + 1;
    return m === 6 || m === 7;
  };

  let position = 1;
  let winStreak = 0;

  return prices.map(p => {
    if (offseason(p.date)) return { date: p.date, signal: 0, reason: '🌴 offseason' };
    const result = matchMap[p.date];
    if (result) {
      if (mode === 'per_result') {
        if (result === 'W') position = 1;
        else if (result === 'L') position = 0;
        // draw = hold
      } else {
        if (result === 'W') { winStreak++; if (winStreak === 1) position = 1; }
        else { if (winStreak > 0) position = 0; winStreak = 0; }
      }
    }
    return { date: p.date, signal: position, reason: result ? `Result: ${result}` : 'no fixture' };
  });
}

// ============================================================
// BACKTEST ENGINE
// ============================================================

function runBacktest(prices, signals) {
  let cash = 10000;
  let shares = 0;
  let position = 0;
  const equity = [];
  const trades = [];
  let peakEquity = 10000;
  let maxDrawdown = 0;
  let winningTrades = 0;
  let totalTrades = 0;
  let daysInMarket = 0;
  let entryValue = null;

  // Resolve "hold" signals (-1/undefined means keep previous)
  let resolvedSignal = 0;

  for (let i = 0; i < prices.length; i++) {
    const p = prices[i];
    const sig = signals[i];
    const newSignal = sig.signal !== undefined ? sig.signal : resolvedSignal;
    resolvedSignal = newSignal;

    // Execute trade
    if (newSignal !== position) {
      if (newSignal === 1 && position === 0) {
        // Buy
        shares = cash / p.close;
        entryValue = cash;
        cash = 0;
        position = 1;
        trades.push({ date: p.date, action: 'BUY', reason: sig.reason || '—', price: p.close, portfolio: shares * p.close });
        totalTrades++;
      } else if (newSignal === 0 && position === 1) {
        // Sell
        const value = shares * p.close;
        if (entryValue && value > entryValue) winningTrades++;
        cash = value;
        shares = 0;
        position = 0;
        trades.push({ date: p.date, action: 'SELL', reason: sig.reason || '—', price: p.close, portfolio: cash });
        entryValue = null;
      }
    }

    const portfolioValue = position === 1 ? shares * p.close : cash;
    equity.push({ date: p.date, value: portfolioValue });
    if (position === 1) daysInMarket++;
    if (portfolioValue > peakEquity) peakEquity = portfolioValue;
    const dd = (peakEquity - portfolioValue) / peakEquity;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const finalValue = equity[equity.length - 1]?.value || 10000;
  const years = prices.length / 252;
  const totalReturn = (finalValue - 10000) / 10000;
  const cagr = Math.pow(finalValue / 10000, 1 / years) - 1;

  // Sharpe (annualised, using daily returns)
  const dailyReturns = equity.slice(1).map((e, i) => (e.value - equity[i].value) / equity[i].value);
  const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const stdReturn = Math.sqrt(dailyReturns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) / dailyReturns.length);
  const sharpe = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(252) : 0;

  return {
    equity,
    trades,
    totalReturn,
    cagr,
    sharpe,
    maxDrawdown,
    winRate: totalTrades > 0 ? winningTrades / totalTrades : null,
    totalTrades,
    timeInMarket: daysInMarket / prices.length,
  };
}

function runBuyAndHold(prices) {
  const initial = 10000;
  const shares = initial / prices[0].close;
  const equity = prices.map(p => ({ date: p.date, value: shares * p.close }));
  const finalValue = equity[equity.length - 1].value;
  const years = prices.length / 252;
  let peak = initial, maxDD = 0;
  for (const e of equity) {
    if (e.value > peak) peak = e.value;
    const dd = (peak - e.value) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return {
    equity,
    totalReturn: (finalValue - initial) / initial,
    cagr: Math.pow(finalValue / initial, 1 / years) - 1,
    maxDrawdown: maxDD,
  };
}

function runBacktestHedged(primaryPrices, hedgePrices, signals, normalPct, defensivePct) {
  const initial = 10000;
  let portfolioValue = initial;
  const equity = [];
  const trades = [];
  let peakEquity = initial;
  let maxDrawdown = 0;
  let winningTrades = 0;
  let totalTrades = 0;
  let daysInMarket = 0;
  let entryValue = null;
  let resolvedSignal = 0;
  let prevAlloc = null;

  const hedgeMap = {};
  for (const p of hedgePrices) hedgeMap[p.date] = p.close;

  for (let i = 0; i < primaryPrices.length; i++) {
    const p = primaryPrices[i];
    const sig = signals[i];
    const newSignal = sig.signal !== undefined ? sig.signal : resolvedSignal;
    resolvedSignal = newSignal;

    const primaryPct = newSignal === 1 ? normalPct / 100 : defensivePct / 100;
    const allocKey = `${primaryPct}`;

    if (allocKey !== prevAlloc && prevAlloc !== null) {
      const action = newSignal === 1 ? 'REBAL→NORMAL' : 'REBAL→DEFENSIVE';
      trades.push({ date: p.date, action, reason: sig.reason || '—', price: p.close, portfolio: portfolioValue });
      if (newSignal === 0 && entryValue !== null) {
        if (portfolioValue > entryValue) winningTrades++;
        entryValue = null;
        totalTrades++;
      }
      if (newSignal === 1 && entryValue === null) {
        entryValue = portfolioValue;
      }
    } else if (prevAlloc === null && newSignal === 1) {
      entryValue = portfolioValue;
    }
    prevAlloc = allocKey;

    if (i > 0) {
      const prevPrimary = primaryPrices[i - 1].close;
      const prevHedge = hedgeMap[primaryPrices[i - 1].date];
      const curHedge = hedgeMap[p.date];

      const prevSignal = signals[i - 1].signal !== undefined ? signals[i - 1].signal : 0;
      const prevPrimaryPct = prevSignal === 1 ? normalPct / 100 : defensivePct / 100;
      const prevHedgePct = 1 - prevPrimaryPct;

      const primaryReturn = (p.close - prevPrimary) / prevPrimary;
      const hedgeReturn = (prevHedge && curHedge) ? (curHedge - prevHedge) / prevHedge : 0;
      const dailyReturn = prevPrimaryPct * primaryReturn + prevHedgePct * hedgeReturn;
      portfolioValue *= (1 + dailyReturn);
    }

    equity.push({ date: p.date, value: portfolioValue });
    if (newSignal === 1) daysInMarket++;
    if (portfolioValue > peakEquity) peakEquity = portfolioValue;
    const dd = (peakEquity - portfolioValue) / peakEquity;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const finalValue = equity[equity.length - 1]?.value || initial;
  const years = primaryPrices.length / 252;
  const totalReturn = (finalValue - initial) / initial;
  const cagr = Math.pow(finalValue / initial, 1 / years) - 1;

  const dailyReturns = equity.slice(1).map((e, i) => (e.value - equity[i].value) / equity[i].value);
  const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const stdReturn = Math.sqrt(dailyReturns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) / dailyReturns.length);
  const sharpe = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(252) : 0;

  return {
    equity,
    trades,
    totalReturn,
    cagr,
    sharpe,
    maxDrawdown,
    winRate: totalTrades > 0 ? winningTrades / totalTrades : null,
    totalTrades,
    timeInMarket: daysInMarket / primaryPrices.length,
  };
}

// ============================================================
// CHART MANAGEMENT
// ============================================================

let equityChart = null, deltaChart = null;

function initCharts() {
  const equityCtx = document.getElementById('equityChart').getContext('2d');
  const deltaCtx = document.getElementById('deltaChart').getContext('2d');

  Chart.defaults.color = '#6b7a8f';
  Chart.defaults.borderColor = '#1f2530';

  equityChart = new Chart(equityCtx, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: '#111318', borderColor: '#2a3040', borderWidth: 1,
        callbacks: {
          label: ctx => ` ${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)}`
        }
      }},
      scales: {
        x: { grid: { color: '#1a1f28' }, ticks: { maxTicksLimit: 8, font: { family: 'IBM Plex Mono', size: 10 } } },
        y: { grid: { color: '#1a1f28' }, ticks: { font: { family: 'IBM Plex Mono', size: 10 }, callback: v => `$${v.toFixed(0)}` } }
      }
    }
  });

  deltaChart = new Chart(deltaCtx, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: '#111318', borderColor: '#2a3040', borderWidth: 1,
        callbacks: {
          label: ctx => ` delta: ${ctx.parsed.y >= 0 ? '+' : ''}${ctx.parsed.y.toFixed(2)}%`
        }
      }},
      scales: {
        x: { grid: { color: '#1a1f28' }, ticks: { maxTicksLimit: 8, font: { family: 'IBM Plex Mono', size: 10 } } },
        y: { grid: { color: '#1a1f28' }, ticks: { font: { family: 'IBM Plex Mono', size: 10 }, callback: v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` } }
      }
    }
  });
}

function updateCharts(result, bhResult) {
  const labels = result.equity.map(e => e.date).filter((_, i) => i % 5 === 0 || i === result.equity.length - 1);
  const step = Math.max(1, Math.floor(result.equity.length / 300));

  const sampledDates = result.equity.filter((_, i) => i % step === 0).map(e => e.date);
  const strategyVals = result.equity.filter((_, i) => i % step === 0).map(e => e.value);
  const bhVals = bhResult.equity.filter((_, i) => i % step === 0).map(e => e.value);
  const deltaVals = strategyVals.map((v, i) => ((v - bhVals[i]) / bhVals[i]) * 100);

  equityChart.data.labels = sampledDates;
  equityChart.data.datasets = [
    {
      label: 'Strategy',
      data: strategyVals,
      borderColor: '#00d4aa',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.1,
      fill: false,
    },
    {
      label: 'Buy & Hold',
      data: bhVals,
      borderColor: '#3d4a5c',
      borderWidth: 1,
      pointRadius: 0,
      tension: 0.1,
      fill: false,
    }
  ];
  equityChart.update();

  deltaChart.data.labels = sampledDates;
  deltaChart.data.datasets = [
    {
      label: 'Delta',
      data: deltaVals,
      borderColor: '#00d4aa',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.1,
      fill: {
        target: 'origin',
        above: 'rgba(0,212,170,0.08)',
        below: 'rgba(255,69,96,0.08)',
      },
      segment: {
        borderColor: ctx => ctx.p0.parsed.y >= 0 ? '#00d4aa' : '#ff4560',
      }
    }
  ];
  deltaChart.update();
}

// ============================================================
// METRICS DISPLAY
// ============================================================

function formatPct(val, showSign = true) {
  const s = (val * 100).toFixed(1) + '%';
  return showSign && val >= 0 ? '+' + s : s;
}

function updateMetrics(result, bhResult) {
  const setMetric = (id, val, cls) => {
    const el = document.getElementById(id);
    el.textContent = val;
    el.className = 'metric-value ' + (cls || 'neu');
  };

  const stratClass = result.totalReturn >= bhResult.totalReturn ? 'pos' : 'neg';
  setMetric('m_total_return', formatPct(result.totalReturn), stratClass);
  document.getElementById('m_bh_return').textContent = `vs ${formatPct(bhResult.totalReturn)} B&H`;

  setMetric('m_cagr', formatPct(result.cagr), result.cagr >= 0 ? 'pos' : 'neg');
  document.getElementById('m_bh_cagr').textContent = `vs ${formatPct(bhResult.cagr)} B&H`;

  setMetric('m_sharpe', result.sharpe.toFixed(2), result.sharpe >= 1 ? 'pos' : result.sharpe >= 0 ? 'neu' : 'neg');

  setMetric('m_drawdown', formatPct(-result.maxDrawdown, false), result.maxDrawdown < bhResult.maxDrawdown ? 'pos' : 'neg');
  document.getElementById('m_bh_dd').textContent = `vs ${formatPct(-bhResult.maxDrawdown, false)} B&H`;

  if (result.winRate !== null) {
    setMetric('m_winrate', formatPct(result.winRate, false), result.winRate >= 0.5 ? 'pos' : 'neg');
  } else {
    setMetric('m_winrate', '—', 'neu');
  }
  document.getElementById('m_trade_count').textContent = `${result.totalTrades} trades`;

  setMetric('m_time_in', formatPct(result.timeInMarket, false), 'neu');
}

// ============================================================
// TRADE LOG
// ============================================================

function updateTradeLog(trades) {
  const tbody = document.getElementById('tradeLog');
  document.getElementById('tradeCount').textContent = `${trades.length} total trades`;

  if (trades.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text3);text-align:center;padding:20px">No trades generated</td></tr>';
    return;
  }

  const recent = trades.slice(-30).reverse();
  tbody.innerHTML = recent.map(t => `
    <tr>
      <td>${t.date}</td>
      <td class="trade-${t.action.toLowerCase()}">${t.action}</td>
      <td style="color:var(--text2)">${t.reason || '—'}</td>
      <td>$${t.price.toFixed(2)}</td>
      <td>$${t.portfolio.toFixed(2)}</td>
    </tr>
  `).join('');
}

// ============================================================
// PARAMS COLLECTION
// ============================================================

function getParams() {
  const strategy = document.querySelector('.strategy-btn.active')?.dataset.strategy;
  return {
    strategy,
    primary_etf: document.getElementById('primaryEtf').value,
    date_from: document.getElementById('dateFrom').value,
    date_to: document.getElementById('dateTo').value,
    fast_window: parseInt(document.getElementById('fast_window').value),
    slow_window: parseInt(document.getElementById('slow_window').value),
    ma_type: document.getElementById('ma_type').value,
    rsi_period: parseInt(document.getElementById('rsi_period').value),
    oversold: parseInt(document.getElementById('oversold').value),
    overbought: parseInt(document.getElementById('overbought').value),
    bb_window: parseInt(document.getElementById('bb_window').value),
    bb_std: parseInt(document.getElementById('bb_std').value),
    squeeze_lb: parseInt(document.getElementById('squeeze_lb').value),
    dm_lookback: parseInt(document.getElementById('dm_lookback').value),
    dm_rebal: parseInt(document.getElementById('dm_rebal').value),
    congress_etf: document.getElementById('congress_etf').value,
    congress_ma: parseInt(document.getElementById('congress_ma').value),
    mercury_window: document.getElementById('mercury_window').value,
    moon_mode: document.getElementById('moon_mode').value,
    moon_window: parseInt(document.getElementById('moon_window').value),
    f13_window: document.getElementById('f13_window').value,
    sports_team: document.getElementById('sports_team').value,
    sports_mode: document.getElementById('sports_mode').value,
    football_api_key: document.getElementById('football_api_key').value,
    hedge_enabled: document.getElementById('hedgeEnabled').checked,
    hedge_etf: document.getElementById('hedgeEtf').value,
    hedge_normal: parseInt(document.getElementById('hedge_normal').value),
    hedge_defensive: parseInt(document.getElementById('hedge_defensive').value),
  };
}

// ============================================================
// MAIN BACKTEST RUNNER
// ============================================================

async function runBacktestFull() {
  const params = getParams();
  const startTime = Date.now();

  setStatus('loading', 'fetching data...');
  showError(null);
  document.getElementById('chartLoader').classList.add('show');

  try {
    // Fetch primary prices
    const prices = await fetchPrices(params.primary_etf, params.date_from, params.date_to);
    if (!prices || prices.length < 50) throw new Error('Not enough price data returned');

    document.getElementById('dataRange').textContent = `${prices[0].date} → ${prices[prices.length - 1].date} (${prices.length}d)`;

    // Generate signals based on strategy
    let signals;
    let extraPrices = null;

    switch (params.strategy) {
      case 'ma_crossover':
        signals = strategyMACrossover(prices, params);
        break;
      case 'rsi':
        signals = strategyRSI(prices, params);
        break;
      case 'bollinger':
        signals = strategyBollinger(prices, params);
        break;
      case 'dual_momentum':
        signals = strategyDualMomentum(prices, null, params);
        break;
      case 'congressional': {
        try {
          extraPrices = await fetchPrices(params.congress_etf, '2023-02-01', params.date_to);
        } catch { extraPrices = null; }
        signals = strategyCongressional(prices, extraPrices, params);
        break;
      }
      case 'mercury':
        signals = strategyMercury(prices, params);
        break;
      case 'moon':
        signals = strategyMoon(prices, params);
        break;
      case 'friday13':
        signals = strategyFriday13(prices, params);
        break;
      case 'sports': {
        let matchResults = ARSENAL_SIMULATED;
        if (params.football_api_key) {
          try {
            matchResults = await fetchFootballResults(params.sports_team, params.football_api_key, params.date_from, params.date_to);
          } catch { /* fall back to simulated */ }
        }
        signals = strategySports(prices, matchResults, params);
        break;
      }
      default:
        signals = prices.map(p => ({ date: p.date, signal: 1 }));
    }

    let result;
    if (params.hedge_enabled && params.strategy !== 'rotation') {
      const hedgePrices = await fetchPrices(params.hedge_etf, params.date_from, params.date_to);
      result = runBacktestHedged(prices, hedgePrices, signals, params.hedge_normal, params.hedge_defensive);
    } else {
      result = runBacktest(prices, signals);
    }
    const bhResult = runBuyAndHold(prices);

    updateCharts(result, bhResult);
    updateMetrics(result, bhResult);
    updateTradeLog(result.trades);

    const elapsed = Date.now() - startTime;
    document.getElementById('calcTime').textContent = `${elapsed}ms`;
    setStatus('ok', 'ready');

  } catch (err) {
    showError(err.message);
    setStatus('err', 'error');
  } finally {
    document.getElementById('chartLoader').classList.remove('show');
  }
}

async function fetchFootballResults(team, apiKey, fromDate, toDate) {
  const teamIds = {
    'Arsenal': 57, 'Manchester City': 65, 'Liverpool': 64,
    'Chelsea': 61, 'Tottenham Hotspur': 73, 'Manchester United': 66
  };
  const teamId = teamIds[team] || 57;
  const url = `https://api.football-data.org/v4/teams/${teamId}/matches?dateFrom=${fromDate}&dateTo=${toDate}&competitions=PL`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': apiKey } });
  if (!res.ok) throw new Error('Football API error');
  const data = await res.json();
  return data.matches.map(m => {
    const isHome = m.homeTeam.id === teamId;
    const homeScore = m.score.fullTime.home;
    const awayScore = m.score.fullTime.away;
    let outcome = 'D';
    if (homeScore !== null && awayScore !== null) {
      if (isHome) outcome = homeScore > awayScore ? 'W' : homeScore < awayScore ? 'L' : 'D';
      else outcome = awayScore > homeScore ? 'W' : awayScore < homeScore ? 'L' : 'D';
    }
    return { date: m.utcDate.slice(0, 10), outcome, team };
  });
}

// ============================================================
// UI STATE
// ============================================================

function setStatus(state, text) {
  const dot = document.getElementById('statusDot');
  const label = document.getElementById('statusText');
  dot.className = 'status-dot ' + state;
  label.textContent = text;
}

function showError(msg) {
  const el = document.getElementById('errorBanner');
  if (msg) { el.textContent = '⚠ ' + msg; el.classList.add('show'); }
  else el.classList.remove('show');
}

// ============================================================
// EVENT WIRING
// ============================================================

// Strategy switching
// Recommended start dates per strategy (earliest date with meaningful signal data)
const STRATEGY_START_DATES = {
  ma_crossover: '2015-01-01',
  rsi: '2015-01-01',
  bollinger: '2015-01-01',
  dual_momentum: '2015-01-01',
  congressional: '2023-03-01',
  rotation: '2015-01-01',
  mercury: '2015-01-01',
  moon: '2015-01-01',
  friday13: '2015-01-01',
  sports: '2015-08-01',
};

document.getElementById('strategyList').addEventListener('click', e => {
  const btn = e.target.closest('.strategy-btn');
  if (!btn) return;
  document.querySelectorAll('.strategy-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.params-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('params_' + btn.dataset.strategy);
  if (panel) panel.classList.add('active');
  const startDate = STRATEGY_START_DATES[btn.dataset.strategy];
  if (startDate) document.getElementById('dateFrom').value = startDate;

  // Hide ETF picker + hedge controls for rotation (it picks its own ETFs)
  const isRotation = btn.dataset.strategy === 'rotation';
  document.getElementById('etfSection').style.display = isRotation ? 'none' : '';

  debouncedRun();
});

// Range slider labels
document.querySelectorAll('input[type="range"]').forEach(slider => {
  const valId = 'val_' + slider.id;
  const valEl = document.getElementById(valId);
  if (valEl) {
    // Special formatting
    slider.addEventListener('input', () => {
      let display = slider.value;
      if (slider.id === 'bb_std') display = (parseInt(slider.value) / 10).toFixed(1);
      valEl.textContent = display;
    });
  }
});

// Hedge toggle
document.getElementById('hedgeEnabled').addEventListener('change', e => {
  document.getElementById('hedgeControls').classList.toggle('active', e.target.checked);
  debouncedRun();
});
document.getElementById('hedge_normal').addEventListener('input', () => {
  const v = document.getElementById('hedge_normal').value;
  document.getElementById('val_hedge_normal').textContent = v;
  document.getElementById('hedgeNormalDesc').textContent = `${v}% primary / ${100 - v}% hedge`;
});
document.getElementById('hedge_defensive').addEventListener('input', () => {
  const v = document.getElementById('hedge_defensive').value;
  document.getElementById('val_hedge_defensive').textContent = v;
  document.getElementById('hedgeDefensiveDesc').textContent = `${v}% primary / ${100 - v}% hedge`;
});
document.querySelectorAll('#hedgeEtf, #hedge_normal, #hedge_defensive').forEach(el => {
  el.addEventListener('change', () => debouncedRun());
});

// Debounced run
let debounceTimer = null;
function debouncedRun(delay = 400) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runBacktestFull, delay);
}

// Wire all param inputs
document.querySelectorAll('[data-param], #primaryEtf, #dateFrom, #dateTo').forEach(el => {
  el.addEventListener('change', () => debouncedRun());
  if (el.tagName === 'INPUT' && el.type !== 'text') {
    el.addEventListener('input', () => debouncedRun());
  }
});

// Manual run button
document.getElementById('runBtn').addEventListener('click', runBacktestFull);

// ============================================================
// INIT
// ============================================================

initCharts();
// Auto-run on load with a slight delay to let fonts settle
setTimeout(runBacktestFull, 500);
