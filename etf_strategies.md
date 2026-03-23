# ETF Trading Strategies

A collection of strategies for backtesting against historical ETF price data. Ranges from
classic technical analysis to congressional mimicry to the completely unhinged. All strategies
are described in terms of signals, parameters, and implementation notes suitable for Claude Code.

---

## Suggested ETFs for Testing

| Ticker | Fund | Category |
|--------|------|----------|
| SPY | SPDR S&P 500 | US Large Cap |
| QQQ | Invesco Nasdaq-100 | Tech-heavy |
| IWM | iShares Russell 2000 | Small Cap |
| GLD | SPDR Gold Shares | Commodities |
| TLT | iShares 20+ Year Treasury | Bonds |
| VNQ | Vanguard Real Estate | REITs |
| EEM | iShares Emerging Markets | International |

## Suggested Data Source

Use the `yfinance` Python library — no API key needed, free, covers 20+ years of daily OHLCV data.

```python
import yfinance as yf
df = yf.download("SPY", start="2000-01-01", end="2024-12-31")
```

---

## Strategy 1: Moving Average Crossover (Momentum)

**Type:** Trend-following / Momentum  
**Complexity:** Low  
**Best in:** Trending markets  

### Concept

When a short-term moving average crosses above a long-term moving average, it signals
upward momentum — buy. When it crosses below — sell. The logic is that the short MA
reflects recent price action faster than the long MA, so a crossover indicates a shift
in trend direction.

### Signal Rules

| Signal | Condition |
|--------|-----------|
| BUY | Fast MA crosses **above** Slow MA (Golden Cross) |
| SELL | Fast MA crosses **below** Slow MA (Death Cross) |

### Parameters

| Parameter | Suggested Default | Notes |
|-----------|------------------|-------|
| `fast_window` | 50 days | Shorter = more signals, more noise |
| `slow_window` | 200 days | The classic "Golden Cross" pair |
| `ma_type` | SMA | Can also try EMA for more recency weighting |

### Variants to Explore

- **Triple MA:** Add a medium window (e.g. 50/100/200). Only trade when all three are aligned.
- **EMA Crossover:** Use exponential MAs (e.g. 12/26, the basis of MACD) for faster signals.
- **Short-term:** 10/30 for more active trading; expect more whipsaws.

### Implementation Notes

- Calculate rolling MAs on closing price.
- Generate a `signal` column: 1 when fast > slow, 0 otherwise.
- Detect crossovers where `signal` changes value — those are your entry/exit points.
- Hold cash (or a bond ETF like TLT) when out of position.
- Compare returns against a buy-and-hold benchmark.

### Known Weaknesses

- Lags badly in choppy, sideways markets — produces frequent false signals ("whipsaws").
- The 50/200 crossover is so widely watched that its predictive power may be reduced.

---

## Strategy 2: RSI Mean Reversion

**Type:** Mean Reversion  
**Complexity:** Low–Medium  
**Best in:** Sideways / range-bound markets  

### Concept

The Relative Strength Index (RSI) measures how overbought or oversold an asset is on
a scale of 0–100. When RSI drops below 30, the asset is considered oversold and likely
to bounce back up. When RSI rises above 70, it's overbought and may pull back. This
strategy fades extremes — buying dips and selling rips.

### Signal Rules

| Signal | Condition |
|--------|-----------|
| BUY | RSI drops **below** oversold threshold |
| SELL | RSI rises **above** overbought threshold, or crosses back above oversold after entry |

### Parameters

| Parameter | Suggested Default | Notes |
|-----------|------------------|-------|
| `rsi_period` | 14 days | Wilder's original recommendation |
| `oversold` | 30 | Lower = rarer but stronger signals |
| `overbought` | 70 | Higher = rarer but stronger signals |

### Variants to Explore

- **Tighter bands:** Use 40/60 for more frequent trading.
- **Wider bands:** Use 20/80 for only the most extreme reversals.
- **RSI + Volume filter:** Only take signals when volume is above its 20-day average,
  confirming real market interest.
- **RSI + Bollinger Bands:** Require the price to also touch a Bollinger Band for confirmation.

### Implementation Notes

- Use `pandas_ta` or compute manually: RSI = 100 - (100 / (1 + avg_gain/avg_loss)).
- Enter on the day RSI crosses the threshold, exit when RSI returns to neutral (50) or crosses the opposite threshold.
- Consider adding a stop-loss (e.g. -5% from entry) to prevent riding a real trend down.

### Known Weaknesses

- In a strong trend, RSI can stay overbought/oversold for extended periods — fighting the trend is painful.
- Works best on mean-reverting instruments (broad index ETFs) rather than single-sector ETFs in strong trends.

---

## Strategy 3: Bollinger Band Squeeze Breakout

**Type:** Volatility Breakout  
**Complexity:** Medium  
**Best in:** Post-consolidation breakouts  

### Concept

Bollinger Bands are envelopes drawn 2 standard deviations above and below a 20-day moving
average. When the bands contract (the "squeeze"), volatility is low and a big move is
likely coming. When the price breaks out of the bands after a squeeze, trade in the
direction of the breakout.

### Signal Rules

| Signal | Condition |
|--------|-----------|
| BUY | Band width at N-day low, then price closes **above** upper band |
| SELL | Band width at N-day low, then price closes **below** lower band |
| EXIT | Price returns to middle band (20-day SMA) |

### Parameters

| Parameter | Suggested Default | Notes |
|-----------|------------------|-------|
| `bb_window` | 20 days | Moving average period |
| `bb_std` | 2.0 | Standard deviations for band width |
| `squeeze_lookback` | 120 days | Period over which to detect if bandwidth is at a minimum |

### Implementation Notes

- Compute: `upper = SMA + 2*STD`, `lower = SMA - 2*STD`, `bandwidth = (upper - lower) / SMA`.
- Define a "squeeze" as bandwidth being at its lowest in the past `squeeze_lookback` days.
- Only enter a position during or immediately after a squeeze — avoid chasing extended moves.

### Known Weaknesses

- False breakouts are common — price breaks the band and immediately reverses.
- Adding a volume confirmation filter helps reduce false signals.

---

## Strategy 4: Dual Momentum (Absolute + Relative)

**Type:** Momentum / Rotation  
**Complexity:** Medium  
**Best in:** Long-term trend-following across asset classes  

### Concept

Developed by Gary Antonacci. Uses two momentum checks:

1. **Relative momentum:** Which ETF has performed best over the past 12 months?
2. **Absolute momentum:** Has that ETF outperformed cash (e.g. T-bills or a short-term
   bond ETF) over the same period?

If the winner beats cash → hold it. If not → hold cash/bonds. Rebalance monthly.

### Signal Rules

| Signal | Condition |
|--------|-----------|
| HOLD winner | Best 12-month returner also beats the risk-free rate |
| HOLD cash/TLT | Best 12-month returner does NOT beat the risk-free rate |

### Parameters

| Parameter | Suggested Default | Notes |
|-----------|------------------|-------|
| `lookback` | 252 days (~12 months) | Can try 6 or 3 months |
| `universe` | [SPY, EEM, TLT] | Stocks, international, bonds |
| `rebalance` | Monthly | On the first trading day of each month |
| `risk_free_proxy` | BIL (1–3mo T-bills) | Or use a fixed 0% / 2% annual rate |

### Implementation Notes

- On each rebalance date, compute total return over the lookback window for each ETF.
- Rank them. Pick the top performer.
- Check if its return exceeds the risk-free proxy return over the same period.
- If yes → invest 100%. If no → move to cash or TLT.

### Known Weaknesses

- Monthly rebalancing means you can be slow to exit during fast crashes.
- A 1-month lag between signal and action can be costly in volatile markets.

---

## Strategy 5: Congressional Trade Following

**Type:** Alternative / Event-driven  
**Complexity:** Medium–High  
**Best in:** Any market (theory: legislators have informational edge)  

### Concept

US lawmakers are required by the STOCK Act to disclose trades within 45 days via
Periodic Transaction Reports (PTRs). Research suggests congressional members have
historically outperformed the market — possibly due to access to non-public policy
information. This strategy mimics their disclosed trades with a delay.

Two real ETFs already do this: **NANC** (Democratic trades) and **KRUZ** (Republican
trades). For backtesting purposes, you can approximate this by using NANC/KRUZ price
history directly, or use the Unusual Whales data API to reconstruct a signal from
raw PTR filings.

### Signal Rules (Simplified / ETF-proxy approach)

| Signal | Condition |
|--------|-----------|
| BUY | NANC or KRUZ closes above its 50-day SMA (uptrend in congressional activity) |
| SELL | Falls below 50-day SMA |

### Signal Rules (Data-driven approach, if using PTR data)

| Signal | Condition |
|--------|-----------|
| BUY | Net congressional purchases of ETF's underlying sector exceed sales over rolling 30 days |
| SELL | Net sales exceed purchases |

### Parameters

| Parameter | Suggested Default | Notes |
|-----------|------------------|-------|
| `disclosure_lag` | 45 days | Max legal delay on trade disclosure |
| `proxy_etf` | NANC or KRUZ | Use as a benchmark / direct instrument |
| `filter_party` | None / Dem / Rep | Optionally track one party's trades |

### Data Sources

- **Unusual Whales** (unusualwhales.com) — congressional trade database, has an API.
- **House Disclosures:** efts.house.gov
- **Senate Disclosures:** efts.senate.gov
- **NANC / KRUZ price history:** via `yfinance` tickers `NANC` and `KRUZ` (launched Feb 2023).

### Caveats

- NANC and KRUZ only launched in February 2023 — limited backtest history.
- The 45-day disclosure lag means you're always trading stale information.
- Legislation to ban congressional stock trading is periodically proposed — a ban
  would make this strategy unworkable.
- Neither NANC nor KRUZ significantly outperforms the market on a risk-adjusted basis
  per academic analysis; NANC's raw outperformance is largely explained by its heavy
  tech weighting (Nvidia, Microsoft, Alphabet, Amazon, Apple).

---

## Strategy 6: Mercury Retrograde Avoidance 🪐

**Type:** Astrological / Silly  
**Complexity:** Low (the logic is simple; justifying it is harder)  
**Best in:** When Mercury is not retrograde, apparently  

### Concept

Mercury retrograde is an astrological phenomenon occurring 3–4 times per year, lasting
roughly 3 weeks each time, during which Mercury appears to move backward in the sky.
Astrologers warn of communication breakdowns, travel chaos, and — crucially for our
purposes — financial mishaps. Some retail traders genuinely avoid making trades during
Mercury retrograde. Let's find out if they're onto something.

### Signal Rules

| Signal | Condition |
|--------|-----------|
| HOLD | Mercury is NOT in retrograde |
| CASH | Mercury IS in retrograde — exit all positions |

### Mercury Retrograde Dates (2020–2025, approximate)

| Period |
|--------|
| Feb 17 – Mar 10, 2020 |
| Jun 18 – Jul 12, 2020 |
| Oct 14 – Nov 3, 2020 |
| Jan 30 – Feb 21, 2021 |
| May 29 – Jun 22, 2021 |
| Sep 27 – Oct 23, 2021 |
| Jan 14 – Feb 4, 2022 |
| May 10 – Jun 3, 2022 |
| Sep 10 – Oct 2, 2022 |
| Dec 29, 2022 – Jan 18, 2023 |
| Apr 21 – May 15, 2023 |
| Aug 23 – Sep 15, 2023 |
| Dec 13, 2023 – Jan 2, 2024 |
| Apr 2 – Apr 25, 2024 |
| Aug 5 – Aug 28, 2024 |
| Nov 26 – Dec 15, 2024 |
| Mar 15 – Apr 7, 2025 |
| Jul 18 – Aug 11, 2025 |
| Nov 9 – Nov 29, 2025 |

### Implementation Notes

- Build a boolean time series: `in_retrograde = True/False` for each trading day.
- When `in_retrograde = True`, hold cash (or TLT as a safe haven).
- When `in_retrograde = False`, hold the target ETF.
- Compare against buy-and-hold and against a random equivalent cash-out schedule
  (same number of days out of market, randomly placed) to test whether any
  outperformance is due to Mercury or just luck of the calendar.

### Hypothesis

Mercury retrograde periods cover roughly 19% of the calendar year. If markets are
slightly negative during those periods on average, the strategy could outperform
buy-and-hold — not because of Mercury, but because staying in cash during historically
weak stretches has value. Whether those stretches correlate with Mercury is the fun part.

---

## Strategy 7: Full Moon / New Moon Cycle 🌕

**Type:** Lunatic (literally) / Silly  
**Complexity:** Low  
**Best in:** Unclear. Possibly never. But let's check.  

### Concept

Some traders and a handful of academic papers claim lunar cycles correlate with stock
market returns. The theory: full moons affect human psychology (sleep disruption,
mood shifts), leading to risk-averse behavior and lower returns around full moons,
with recovery around new moons.

### Signal Rules

| Signal | Condition |
|--------|-----------|
| BUY | New Moon (within ±2 trading days) |
| SELL / CASH | Full Moon (within ±2 trading days) |

### Implementation Notes

- Use the `ephem` or `astral` Python library to generate exact moon phase dates.
- Create a signal column keyed to lunar phase.
- Test multiple window sizes around the phase (±1, ±2, ±3 days).
- Also test the simple version: hold during the "waxing" half (New → Full), cash during "waning" (Full → New).

```python
import ephem

def get_moon_phases(start_date, end_date):
    # Returns list of (date, phase) tuples
    # phase: 'new', 'full', 'first_quarter', 'last_quarter'
    ...
```

---

## Strategy 8: The Inverse Cramer

**Type:** Contrarian / Meme  
**Complexity:** Low  
**Best in:** When Jim Cramer is confidently wrong, which is reportedly often  

### Concept

Jim Cramer, host of CNBC's Mad Money, is famous for enthusiastic stock picks — and
for those picks frequently going the wrong way. An actual ETF (the Inverse Cramer
Tracker, ticker SJIM) existed briefly to bet against his recommendations. It was
delisted in 2023 due to poor performance. Still, as a backtesting exercise, you can
reconstruct a "fade Cramer" signal using his archived Mad Money picks.

### Signal Rules

| Signal | Condition |
|--------|-----------|
| BUY | Cramer issues a SELL recommendation on the ETF or its primary holdings |
| SELL | Cramer issues a BUY recommendation |
| HOLD | Cramer says nothing |

### Data Source

- **Cramer tracker databases:** Several GitHub repos and community projects have scraped
  and catalogued Cramer's historical picks.
- Limit to ETF-level calls (e.g. when he recommends or pans QQQ, SPY, or sector ETFs).

### Caveats

- SJIM was delisted — the pure inverse strategy didn't work reliably in practice.
- Cramer's picks are noisy and infrequent at the ETF level.
- More fun as a benchmark than a real strategy. Compare it against everything else.

---

## Strategy 9: Friday the 13th Avoidance 🔪

**Type:** Superstition / Silly  
**Complexity:** Very Low  
**Best in:** Hopefully never applicable, but let's find out  

### Concept

Friday the 13th is widely considered the unluckiest day in Western superstition. Some
traders genuinely avoid making moves on this date. The question isn't really whether
bad luck is real — it's whether enough people *believe* in it to create a measurable
self-fulfilling effect on market behaviour. Also it's just fun to check.

### Signal Rules

| Signal | Condition |
|--------|-----------|
| CASH | The current trading day is a Friday and the date is the 13th |
| HOLD | All other days |

### Parameters

| Parameter | Suggested Default | Notes |
|-----------|------------------|-------|
| `avoidance_window` | 1 day | Just the day itself |
| `extended_window` | 3 days | Optionally avoid Thu 12th–Mon 15th for the superstitious maximalist |

### Implementation Notes

- Friday the 13th occurs 1–3 times per year. Over a 20-year backtest, you'll have
  roughly 30–35 avoidance days — a small sample, so treat results with appropriate scepticism.
- The strategy is almost entirely in the market (~99.6% of days), so any difference
  from buy-and-hold will be very small. The interesting question is the *direction*.
- As a control, also test "Monday the 13th avoidance" and "Friday the 7th avoidance"
  to see if Friday the 13th is special or if any arbitrary date filter produces similar noise.

```python
import pandas as pd

def is_friday_13th(date):
    return date.weekday() == 4 and date.day == 13
```

### Hypothesis

No serious edge expected. But if markets are measurably down on Friday the 13th across
a large sample, that would be genuinely weird and worth writing a Medium article about.

---

## Strategy 10: The Arsenal FC Indicator 🔴

**Type:** Sports Sentiment / Silly  
**Complexity:** Medium (data wrangling)  
**Best in:** August–May (Premier League season). Completely useless June–July.  

### Concept

Arsenal's results drive the emotional state of millions of fans worldwide. This strategy
hypothesises that Arsenal winning creates optimism and risk appetite (buy), while Arsenal
losing creates despair and risk aversion (sell). The offseason (roughly June–July) is
treated as a cash period — there are no results to trade on, and frankly everyone needs
a break.

Two variants are documented below.

---

### Variant A: React to Every Result

**Logic:** Trade on the next market open after every Arsenal match.

| Signal | Condition |
|--------|-----------|
| BUY | Arsenal won their last match |
| SELL / CASH | Arsenal lost their last match |
| HOLD current position | Arsenal drew |
| CASH | Offseason (no fixtures) |

**Characteristics:** Active strategy — Arsenal play ~38 Premier League games per season
plus cups, so expect 40–55 signals per year. Draws (~25% of matches typically) produce
no action, which will frustrate you in different ways depending on your position.

---

### Variant B: Ride the Streak

**Logic:** Only change position when Arsenal's form *momentum* shifts.

| Signal | Condition |
|--------|-----------|
| BUY | Arsenal's current winning streak begins (first win after a non-win) |
| SELL / CASH | Arsenal's winning streak ends (first non-win after a win streak) |
| HOLD | Streak continues in either direction |
| CASH | Offseason (no fixtures) |

**Characteristics:** Much fewer trades — you're only acting on streak reversals, not
every result. Ignores draws entirely for streak purposes (a draw neither continues nor
breaks a winning streak). This variant will keep you in the market longer during good
runs and get you out faster during collapses, which given Arsenal's history of
spectacular late-season implosions, may actually have some accidental merit.

---

### Parameters

| Parameter | Suggested Default | Notes |
|-----------|------------------|-------|
| `team` | Arsenal | Swap out for any PL team for comparison |
| `signal_delay` | 1 trading day | Act on next market open after match |
| `draw_action` | Hold (Variant A) / Ignored (Variant B) | How to handle draws |
| `offseason_position` | Cash | June–July, no fixtures |
| `competitions` | Premier League only | Optionally include FA Cup, Champions League |

### Data Sources

- **football-data.org** — free API with historical Premier League results going back
  to ~2000. No key needed for basic tier. Returns JSON with date, home team, away team,
  score.
- **API-Football** (via RapidAPI) — more comprehensive, includes cups and European games.
  Free tier available.
- **Manually scraped:** Arsenal's historical results are also available as CSV from
  several open football data repos on GitHub (search `football-data-csv`).

```python
import requests

# football-data.org free tier
url = "https://api.football-data.org/v4/teams/57/matches"  # 57 = Arsenal
headers = {"X-Auth-Token": "YOUR_FREE_TOKEN"}
params = {"competitions": "PL", "season": "2023"}
response = requests.get(url, headers=headers, params=params)
matches = response.json()["matches"]
```

### Implementation Notes

- Map match dates to the next trading day (markets are closed weekends — most PL
  fixtures are Saturday/Sunday, so the signal fires Monday morning).
- Handle the offseason gap cleanly — don't carry a position over the summer.
- For Variant B, define streak as consecutive wins in all tracked competitions, or
  Premier League only. The latter is more stable.

### The Uncomfortable Truth

Arsenal have finished 2nd without winning the title in agonising fashion multiple
recent seasons. Any strategy that tracks their results will likely spend a lot of time
bullishly in the market from August through March, then get whipsawed in April as
the wheels come off. Whether this mirrors the broader market cycle is left as an
exercise for the reader.

---

## Backtesting Framework Recommendations

For implementation in Claude Code, a clean structure to apply across all strategies:

```
project/
├── data/
│   └── fetch_prices.py        # yfinance downloader
├── strategies/
│   ├── base.py                # Abstract strategy class
│   ├── ma_crossover.py
│   ├── rsi_mean_reversion.py
│   ├── bollinger_breakout.py
│   ├── dual_momentum.py
│   ├── congressional.py
│   ├── mercury_retrograde.py
│   ├── moon_cycle.py
│   ├── inverse_cramer.py
│   ├── friday_13th.py
│   └── arsenal_fc.py
├── backtest/
│   └── engine.py              # Applies signals, calculates returns
└── report/
    └── metrics.py             # Sharpe, max drawdown, CAGR, etc.
```

### Key Metrics to Track

| Metric | Description |
|--------|-------------|
| CAGR | Compound annual growth rate |
| Sharpe Ratio | Risk-adjusted return (return / volatility) |
| Max Drawdown | Worst peak-to-trough decline |
| Win Rate | % of trades that were profitable |
| Benchmark Delta | Outperformance vs SPY buy-and-hold |
| Time in Market | % of days holding a position (vs cash) |
