import yfinance as yf
import json
from datetime import datetime

def get_price(symbol):
    try:
        t = yf.Ticker(symbol)
        h = t.history(period="2d")
        if len(h) >= 2:
            prev = h["Close"].iloc[-2]
            curr = h["Close"].iloc[-1]
            chg = curr - prev
            pct = (chg / prev) * 100
            return {"curr": float(curr), "chg": float(chg), "pct": float(pct)}
        elif len(h) == 1:
            curr = h["Close"].iloc[-1]
            return {"curr": float(curr), "chg": 0.0, "pct": 0.0}
    except Exception as e:
        print(f"  Warning: {symbol} failed: {e}")
    return None

def fmt(p):
    if not p:
        return "N/A", "N/A", "N/A", True
    arrow = "▲" if p["chg"] >= 0 else "▼"
    sign = "+" if p["pct"] >= 0 else ""
    return f"{p['curr']:,.0f}", f"{arrow} {abs(p['chg']):,.0f}", f"{sign}{p['pct']:.2f}%", p["chg"] >= 0

def sentiment(chg):
    return "positive" if chg > 0 else "negative" if chg < 0 else "neutral"

print("Fetching live prices...")
sensex = get_price("^BSESN")
nifty  = get_price("^NSEI")
sp500  = get_price("^GSPC")
nasdaq = get_price("^IXIC")
dow    = get_price("^DJI")

si, sc, sp, s_up = fmt(sensex)
ni, nc, np_, n_up = fmt(nifty)
ui, uc, up_, u_up = fmt(sp500)
nqi, nqc, nqp, nq_up = fmt(nasdaq)
di, dc, dp, d_up = fmt(dow)

now   = datetime.now().strftime("%I:%M %p IST")
today = datetime.now().strftime("%Y-%m-%d")

iv = f"Indian markets {'rose' if s_up else 'fell'} today; Sensex {si} ({sp}), Nifty {ni} ({np_})."
if_ = f"Sensex {si} ({sc}, {sp}), Nifty {ni} ({nc}, {np_}), FII activity and global cues influenced trade"
is_ = sentiment(sensex["chg"] if sensex else 0)

uv = f"US markets {'rose' if u_up else 'fell'} today; S&P 500 at {ui} ({up_}), tech stocks led the move."
uf = f"S&P 500 {ui} ({uc}, {up_}), Nasdaq {nqi} ({nqc}, {nqp}), Dow {di} ({dc}, {dp})"
us = sentiment(sp500["chg"] if sp500 else 0)

data = {
    "today": {
        "date": today, "readyAt": "16:00",
        "indian": {"verdict": iv, "factors": if_, "verdictSentiment": is_, "marketTime": "3:30 PM IST", "updatedAt": f"Updated {now}"},
        "us":     {"verdict": uv, "factors": uf,  "verdictSentiment": us,  "marketTime": "4:00 PM EST", "updatedAt": f"Updated {now}"}
    },
    "yesterday": {
        "date": today,
        "indian": {"verdict": iv, "factors": if_, "verdictSentiment": is_, "marketTime": "3:30 PM IST", "updatedAt": f"Updated {now}"},
        "us":     {"verdict": uv, "factors": uf,  "verdictSentiment": us,  "marketTime": "4:00 PM EST", "updatedAt": f"Updated {now}"}
    }
}

with open("public/market-reasoning.json", "w") as f:
    json.dump(data, f, indent=2)

print(f"✅ Done! Sensex: {si} | S&P: {ui}")
print(f"   Indian: {iv}")
print(f"   US:     {uv}")
