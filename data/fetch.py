#!/usr/bin/env python3
"""Download daily close prices for ETFs via yfinance and write as JSON."""

import json
import os
from datetime import datetime

import yfinance as yf

TICKERS = ["SPY", "QQQ", "IWM", "GLD", "TLT", "VNQ", "EEM", "NANC", "KRUZ"]
START = "2000-01-01"
END = datetime.today().strftime("%Y-%m-%d")
OUT_DIR = os.path.join(os.path.dirname(__file__), "prices")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for ticker in TICKERS:
        print(f"Fetching {ticker}...", end=" ")
        df = yf.download(ticker, start=START, end=END, auto_adjust=True, progress=False)
        if df.empty:
            print("NO DATA")
            continue
        records = []
        for date, row in df.iterrows():
            close = row["Close"]
            if hasattr(close, "item"):
                close = close.item()
            records.append({"date": date.strftime("%Y-%m-%d"), "close": round(float(close), 2)})
        path = os.path.join(OUT_DIR, f"{ticker}.json")
        with open(path, "w") as f:
            json.dump(records, f)
        print(f"{len(records)} rows → {path}")


if __name__ == "__main__":
    main()
