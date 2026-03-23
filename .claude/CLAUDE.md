# ETF Strategy Backtester

## What This Is

A frontend ETF strategy backtester split across `index.html`, `style.css`, and `app.js`. Dark-themed terminal aesthetic using IBM Plex Mono/Sans, Chart.js for visualization. Lets users pick from 10 trading strategies, configure parameters via sliders/dropdowns, select an ETF + date range, and run a backtest comparing the strategy's equity curve against buy-and-hold. Supports optional hedging mode (split allocation between primary + hedge ETF).

## Current Architecture

Split across three files:
- **`style.css`** (~430 lines): Dark theme with CSS variables, grid layout (300px sidebar + main), sticky header, custom range sliders, trade log table, hedge/basket controls
- **`index.html`** (~380 lines): Header with status bar, sidebar with strategy picker / ETF selector / hedge toggle / date range / per-strategy parameter panels / run button, main area with metrics strip (6 cells), equity curve chart, delta chart, trade log table
- **`app.js`** (~1050 lines): Data fetching, technical indicators, 10 strategy implementations, backtest engine (standard + hedged + rotation), Chart.js management, UI wiring

## Data Source

Price data is pre-fetched via `data/fetch.py` (uses yfinance) and stored as static JSON files in `data/prices/`. The frontend loads these same-origin JSON files — no CORS issues, works on GitHub Pages and local file servers.

To refresh data: `pip install yfinance && python data/fetch.py`

## Data Flow

1. User clicks Run (or auto-runs on load/param change with 400ms debounce)
2. `fetchPrices(ticker, from, to)` loads `data/prices/{TICKER}.json`, filters by date range, caches in memory
3. Strategy function generates signal array (0=cash, 1=invested, undefined=hold previous). Rotation strategy returns signals with ticker field indicating which ETF to hold.
4. `runBacktest()` / `runBacktestHedged()` / `runBacktestRotation()` simulates $10k portfolio, tracks equity curve, trades, drawdown
5. `runBuyAndHold()` generates benchmark equity curve
6. Charts update (sampled to ~300 points), metrics strip updates, trade log shows last 30 trades

## The 10 Strategies

### "Legit" (6):
1. **MA Crossover** — Fast/slow moving average crossover (SMA or EMA). Params: fast_window, slow_window, ma_type
2. **RSI Mean Reversion** — Buy when RSI < oversold, sell when > overbought. Params: rsi_period, oversold, overbought
3. **Bollinger Breakout** — Buy on squeeze + upper band breakout, exit at middle band. Params: bb_window, bb_std, squeeze_lookback
4. **Dual Momentum** — Periodic rebalance: hold if 12mo return > risk-free rate, else cash. Params: dm_lookback, dm_rebal
5. **Congressional** — Uses NANC/KRUZ ETF price as proxy signal (above/below its MA). Params: congress_etf, congress_ma
6. **ETF Rotation** — Periodically picks the best-performing ETF from a user-selected basket. Params: basket, ranking metric (momentum/sharpe/min drawdown), lookback, rebalance frequency

### "Silly" (4):
7. **Mercury Retrograde** — Exit to cash during Mercury retrograde periods (hardcoded dates 2015-2024). Params: buffer days
8. **Moon Cycle** — Buy on new moon / sell on full moon, or hold waxing / cash waning. Uses simplified Meeus algorithm. Params: mode, window
9. **Friday the 13th** — Cash on Friday the 13th (optionally extended window). Params: avoidance window
10. **Sports Team (Arsenal FC)** — Buy after wins, sell after losses. Two variants: per-result or ride-the-streak. Uses football-data.org API or falls back to simulated Arsenal results. Params: team, mode, API key

## Hedging Mode
Optional for strategies 1-9 (not rotation). Splits allocation between primary and hedge ETF instead of going to cash. When strategy signals "buy", uses normal allocation (e.g., 80% primary / 20% hedge). When strategy signals "sell", shifts to defensive allocation (e.g., 30% primary / 70% hedge). Params: hedge ETF, normal allocation %, defensive allocation %.

## Technical Indicators (all implemented in JS)
- `sma(prices, window)` — simple moving average
- `ema(prices, window)` — exponential moving average
- `rsi(prices, period)` — Wilder's RSI
- `bollingerBands(prices, window, numStd)` — returns upper/mid/lower/bandwidth

## Key Constants
- `MERCURY_RETROGRADES` — array of [start, end] date pairs (2015-2024)
- `ARSENAL_SIMULATED` — generated on load via `generateArsenalResults()` with per-season win probability

## External Dependencies (CDN)
- Chart.js 4.4.1
- Google Fonts: IBM Plex Mono + IBM Plex Sans

## Project Conventions
- Pure vanilla JS, no build tools, no framework
- All state in module-level variables (priceCache, chart instances, debounce timer)
- Strategies return array of `{ date, signal, reason }` objects
- Signal values: 1=buy/hold, 0=sell/cash, undefined=hold previous position
