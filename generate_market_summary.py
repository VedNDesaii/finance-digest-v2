import anthropic
import json
import re
import time
import yfinance as yf
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime
import os
import sys

load_dotenv(override=True)

SUPABASE_URL  = os.getenv("SUPABASE_URL")
SUPABASE_KEY  = os.getenv("SUPABASE_KEY")
# Guard against a missing key so the run fails with a clear message, not a crash.
ANTHROPIC_KEY = (os.getenv("ANTHROPIC_API_KEY") or "").strip().replace("\n", "").replace("\r", "")
if not ANTHROPIC_KEY:
    raise SystemExit("❌ ANTHROPIC_API_KEY is not set — cannot generate market summary.")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
client   = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

# ── Haiku 4.5 pricing ────────────────────────────────────────────────────────
# Indian summary:  ~800 input + ~350 output = ~$0.0026
# US summary:      ~800 input + ~350 output = ~$0.0026
# Total both:      ~$0.0052/day — very cheap

# ── Shared system prompt (cached) ────────────────────────────────────────────
MARKET_SYSTEM_PROMPT = """You are a financial data analyst writing crisp market summaries
for a finance news platform aimed at Indian retail investors and curious young readers.
Your summaries must be factual, data-driven, and written in plain English.
Never use jargon without explaining it. Keep every field concise.
Always return ONLY valid JSON — no markdown, no explanation, nothing else."""


def _recent_closes(symbol: str, tries: int = 6):
    """Return (prev_close, last_close) from the last two *valid* trading days.

    yfinance is flaky (transient empties, and Yahoo often throttles CI/server
    IPs) and a 2-day window can hand back a stale previous close that produces a
    wildly wrong % (e.g. a phantom Bank Nifty -6.47%). Using a 7-day window +
    dropna() takes clean adjacent trading days, and we retry a few times."""
    last_err = None
    for attempt in range(tries):
        try:
            hist = yf.Ticker(symbol).history(period="7d")
            closes = hist["Close"].dropna() if hist is not None and not hist.empty else None
            if closes is not None and len(closes) >= 2:
                return float(closes.iloc[-2]), float(closes.iloc[-1])
            if closes is not None and len(closes) == 1:
                return None, float(closes.iloc[-1])
        except Exception as e:
            last_err = e
        time.sleep(1.5 * (attempt + 1))   # growing backoff (Yahoo throttles CI IPs)
    if last_err:
        print(f"  ⚠️  fetch failed for {symbol}: {last_err}")
    return None, None


def fetch_prices(tickers: dict) -> dict:
    """Fetch latest price + day change for {name: symbol}. Robust to yfinance flakiness."""
    results = {}
    for name, symbol in tickers.items():
        prev, curr = _recent_closes(symbol)
        if curr is None:
            print(f"  ⚠️  no data for {name} ({symbol}) — marking N/A")
            results[name] = {"value": "N/A", "change": "N/A", "pct": "N/A", "up": True}
            continue
        if prev is None:   # only one valid day (e.g. holiday) — no change to show
            results[name] = {"value": f"{curr:,.0f}", "change": "▲ 0", "pct": "0.00%", "up": True}
            continue
        change = curr - prev
        pct    = (change / prev) * 100
        results[name] = {
            "value":  f"{curr:,.0f}",
            "change": f"{'▲' if change >= 0 else '▼'} {abs(change):,.0f}",
            "pct":    f"{'+' if change >= 0 else ''}{pct:.2f}%",
            "up":     bool(change >= 0),   # native bool (numpy bool_ isn't JSON-serializable)
        }
    return results


def fetch_commodities_fx() -> dict:
    """Real Brent, USD/INR and gold levels from Yahoo — the SAME source the on-site
    Gold/FX widgets use — so AI prose can cite exact figures that match the widgets
    instead of inventing them. Decimals matter here (unlike the whole-number indices)."""
    specs = {  # name: (symbol, prefix, suffix, decimals)
        "Brent crude": ("BZ=F",  "$", "/bbl", 2),
        "USD/INR":     ("INR=X", "₹", "/$",   2),
        "Gold":        ("GC=F",  "$", "/oz",  0),
    }
    out = {}
    for name, (sym, pfx, sfx, dp) in specs.items():
        prev, curr = _recent_closes(sym)
        if curr is None:
            continue
        change = (curr - prev) if prev is not None else 0.0
        pct    = (change / prev * 100) if prev else 0.0
        out[name] = {
            "value": f"{pfx}{curr:,.{dp}f}{sfx}",
            "pct":   f"{'+' if change >= 0 else ''}{pct:.2f}%",
            "up":    bool(change >= 0),
        }
    return out


def commodities_fx_text(cfx: dict) -> str:
    """One unambiguous line for the prompt. Phrases the rupee by its OWN direction
    (USD/INR up = rupee weaker), so the model can't flip it."""
    parts = []
    b = cfx.get("Brent crude")
    if b:
        parts.append(f"Brent crude {'rose' if b['up'] else 'fell'} to {b['value']} ({b['pct']} today)")
    g = cfx.get("Gold")
    if g:
        parts.append(f"gold {'rose' if g['up'] else 'fell'} to {g['value']} ({g['pct']})")
    u = cfx.get("USD/INR")
    if u:
        parts.append(f"the rupee {'weakened' if u['up'] else 'strengthened'} to {u['value']} (USD/INR {u['pct']})")
    return "; ".join(parts) or "n/a"


def fetch_sector_moves(tickers: dict) -> list:
    """Real sector index moves (percent), sorted best→worst. Robust to yfinance flakiness."""
    out = []
    for name, symbol in tickers.items():
        prev, curr = _recent_closes(symbol)
        if prev is not None and curr is not None:
            out.append({"name": name, "pct": round((curr - prev) / prev * 100, 1)})
    out.sort(key=lambda s: s["pct"], reverse=True)
    return out


def fetch_intraday(symbol: str, points: int = 28) -> list:
    """A compact intraday close series for the index-card area charts. Falls back
    to a 7-day daily trend when intraday is unavailable (holiday/off-hours)."""
    closes = []
    try:
        hist = yf.Ticker(symbol).history(period="1d", interval="15m")
        if hist is not None and not hist.empty:
            closes = hist["Close"].dropna().tolist()
    except Exception:
        closes = []
    if len(closes) < 3:
        try:
            h2 = yf.Ticker(symbol).history(period="7d")
            if h2 is not None and not h2.empty:
                closes = h2["Close"].dropna().tolist()
        except Exception:
            closes = []
    if len(closes) > points:                      # downsample to ~points
        step = len(closes) / points
        closes = [closes[min(len(closes) - 1, int(i * step))] for i in range(points)]
    return [round(float(c), 2) for c in closes]


def compute_verdict(indices: list) -> str:
    """up / down / mixed, from how many indices closed higher."""
    ups = sum(1 for i in indices if i.get("up"))
    if ups == len(indices): return "up"
    if ups == 0:            return "down"
    return "mixed"


INDIA_SECTORS = {
    "Banking": "^NSEBANK", "IT": "^CNXIT", "Auto": "^CNXAUTO", "FMCG": "^CNXFMCG",
    "Pharma": "^CNXPHARMA", "Metal": "^CNXMETAL", "Realty": "^CNXREALTY", "Energy": "^CNXENERGY",
}
US_SECTORS = {"Tech": "XLK", "Financials": "XLF", "Energy": "XLE", "Healthcare": "XLV"}

# A liquid basket of Nifty heavyweights — top gainers/losers are computed from
# these each day for the homepage "Top movers" panel. (NSE tickers, .NS suffix.)
NIFTY_MOVERS = {
    "RELIANCE": "RELIANCE.NS", "TCS": "TCS.NS", "HDFCBANK": "HDFCBANK.NS",
    "ICICIBANK": "ICICIBANK.NS", "INFY": "INFY.NS", "SBIN": "SBIN.NS",
    "BHARTIARTL": "BHARTIARTL.NS", "ITC": "ITC.NS", "LT": "LT.NS",
    "AXISBANK": "AXISBANK.NS", "KOTAKBANK": "KOTAKBANK.NS", "HINDUNILVR": "HINDUNILVR.NS",
    "BAJFINANCE": "BAJFINANCE.NS", "MARUTI": "MARUTI.NS", "ADANIENT": "ADANIENT.NS",
    "TATASTEEL": "TATASTEEL.NS", "TATAMOTORS": "TATAMOTORS.NS", "WIPRO": "WIPRO.NS",
    "SUNPHARMA": "SUNPHARMA.NS", "NTPC": "NTPC.NS", "ONGC": "ONGC.NS",
    "COALINDIA": "COALINDIA.NS", "HCLTECH": "HCLTECH.NS", "TECHM": "TECHM.NS",
    "ASIANPAINT": "ASIANPAINT.NS", "POWERGRID": "POWERGRID.NS",
}


def fetch_movers(tickers: dict, top: int = 4) -> dict:
    """Top gainers & losers among a basket of liquid NSE names, from the last two
    valid closes. One batched yfinance download (fast, fewer throttles than
    per-symbol calls)."""
    moves = []
    data = None
    try:
        data = yf.download(list(tickers.values()), period="5d",
                           progress=False, group_by="ticker", threads=True)
    except Exception as e:
        print(f"  ⚠️  movers batch download failed: {e}")
    for name, symbol in tickers.items():
        try:
            closes = data[symbol]["Close"].dropna() if data is not None else None
            if closes is None or len(closes) < 2:
                continue
            prev, curr = float(closes.iloc[-2]), float(closes.iloc[-1])
            if prev <= 0:
                continue
            moves.append({"sym": name, "pct": round((curr - prev) / prev * 100, 2)})
        except Exception:
            continue
    gainers = sorted((m for m in moves if m["pct"] > 0), key=lambda m: m["pct"], reverse=True)[:top]
    losers  = sorted((m for m in moves if m["pct"] < 0), key=lambda m: m["pct"])[:top]
    print(f"  ✅ movers: {len(gainers)} gainers, {len(losers)} losers from {len(moves)} names")
    return {"gainers": gainers, "losers": losers}


def get_recent_articles(categories: list, limit: int = 5) -> list:
    articles = []
    for cat in categories:
        result = (
            supabase.table("processed_articles")
            .select("title, simplified_article")
            .eq("category", cat)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        articles += result.data or []
    return articles[:15]


def call_claude_cached(user_content: str, max_tokens: int = 800) -> dict:
    """Call Haiku with a cached system prompt. NEVER raises — retries a few
    times, then returns {} on any failure (timeout, API error, bad JSON) so the
    summary degrades to real data + a computed lead instead of failing the run."""
    for attempt in range(3):
        try:
            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=max_tokens,
                timeout=45,
                system=[
                    {
                        "type": "text",
                        "text": MARKET_SYSTEM_PROMPT,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[{"role": "user", "content": user_content}],
            )
            text = message.content[0].text.strip()
            if "```" in text:
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            return json.loads(text.strip())
        except Exception as e:
            print(f"  ⚠️  Claude call failed (attempt {attempt + 1}/3): {str(e)[:90]}")
            time.sleep(3 * (attempt + 1))
    print("  ⚠️  Claude unavailable — publishing a data-only summary (real numbers, no AI prose).")
    return {}


def _fallback_lead(label: str, indices: list, verdict: str) -> str:
    """A plain one-liner built from the real numbers, for when the AI call is
    down — so the summary still publishes something meaningful, never blank."""
    word = {"up": "closed higher", "down": "closed lower"}.get(verdict, "ended mixed")
    moves = ", ".join(
        f"{i['label']} {i.get('pct', '')}".strip()
        for i in indices if i.get("pct") and i.get("pct") != "N/A"
    )
    return f"{label} markets {word}." + (f" {moves}." if moves else "")


# ── Number guard — the AI may ONLY state figures we actually fetched this run ──
# Soft prompt rules aren't enough (that's how "$96 Brent" / a stale rupee slipped
# in). This validates every price/level/% in the AI prose against the real numbers
# fetched this run; anything unsourced triggers one correction retry, then is
# stripped before publish. Net effect: the site can only ever show live figures.
_UNIT_RE = re.compile(
    r'(?:\$|₹|Rs\.?\s?)\s?\d[\d,]*(?:\.\d+)?'          # $96 / ₹92.98 / Rs 92
    r'|\d[\d,]*(?:\.\d+)?\s?%'                          # 1.9% / +0.80%
    r'|\d[\d,]*(?:\.\d+)?\s?/\s?(?:bbl|oz|barrel)',     # 92.02/bbl / 3704/oz
    re.I,
)
# Bare decimals ≥10 with no unit (catches a raw FX level like "92.4450").
_DEC_RE = re.compile(r'(?<![\w.$₹])\d{1,3}(?:,\d{3})*\.\d+(?![\w%])')


def _mag(tok: str):
    m = re.search(r'\d[\d,]*(?:\.\d+)?', tok)
    if not m:
        return None
    try:
        return round(abs(float(m.group().replace(",", ""))), 2)
    except Exception:
        return None


def _candidate_tokens(text: str) -> list:
    """Price/percent/level tokens in a piece of prose that must be data-backed."""
    toks = [m.group().strip() for m in _UNIT_RE.finditer(text or "")]
    for m in _DEC_RE.finditer(text or ""):
        v = _mag(m.group())
        if v is not None and v >= 10:
            toks.append(m.group().strip())
    return toks


def build_allowed(indices=None, sectors=None, movers=None, cfx=None) -> set:
    """Every numeric magnitude we actually fetched this run — the whitelist."""
    allowed = set()

    def add(s):
        for tok in re.findall(r'\d[\d,]*(?:\.\d+)?', str(s)):
            try:
                allowed.add(round(abs(float(tok.replace(",", ""))), 2))
            except Exception:
                pass

    for ix in (indices or []):
        add(ix.get("value")); add(ix.get("pct")); add(ix.get("change"))
    for sc in (sectors or []):
        add(sc.get("pct"))
    if isinstance(movers, dict):
        for m in (movers.get("gainers", []) + movers.get("losers", [])):
            add(m.get("pct")); add(m.get("value"))
    for v in (cfx or {}).values():
        add(v.get("value")); add(v.get("pct"))
    return allowed


def _is_sourced(tok: str, allowed: set) -> bool:
    v = _mag(tok)
    if v is None:
        return True
    # Percentages tolerate rounding (1.9%→2%); price/FX levels must be near-exact
    # so a stale rupee like 92.44 can't pass as the live 92.98.
    is_pct = "%" in tok
    for a in allowed:
        tol = 0.15 if is_pct else max(0.03, a * 0.002)
        if abs(v - a) <= tol:
            return True
    return False


def _prose_fields(data: dict):
    """Yield (setter, text) for every AI-written string field in a summary dict."""
    for key in ("lead", "brief", "narrative"):
        if data.get(key):
            yield (key, None, data[key])
    for i, w in enumerate(data.get("why", []) or []):
        yield ("why", i, w)
    for i, t in enumerate(data.get("tiles", []) or []):
        if isinstance(t, dict) and t.get("sub"):
            yield ("tile.sub", i, t["sub"])
    for lbl, obj in (data.get("indexReasons") or {}).items():
        for i, dr in enumerate((obj or {}).get("drivers", []) or []):
            yield (("indexReasons", lbl), i, dr)


def find_unsourced(data: dict, allowed: set) -> list:
    """List of (field, token) the AI stated that isn't backed by fetched data."""
    bad = []
    for field, _idx, text in _prose_fields(data):
        for tok in _candidate_tokens(text):
            if not _is_sourced(tok, allowed):
                bad.append((field, tok))
    return bad


def sanitize_numbers(data: dict, allowed: set) -> list:
    """Last-resort scrub: drop list items / sentences that carry an unsourced
    number, and fall back to data-only text for lead/brief. Returns what changed."""
    removed = []

    def clean_sentences(text):
        keep = []
        for sent in re.split(r'(?<=[.!?])\s+', text or ""):
            toks = _candidate_tokens(sent)
            if any(not _is_sourced(t, allowed) for t in toks):
                removed.append(sent.strip())
            else:
                keep.append(sent)
        return " ".join(keep).strip()

    # lead / brief: drop the offending sentence(s). If nothing survives, leave it
    # empty so the caller falls back to the data-only _fallback_lead (real numbers).
    for key in ("lead", "brief"):
        if data.get(key) and any(not _is_sourced(t, allowed) for t in _candidate_tokens(data[key])):
            data[key] = clean_sentences(data[key])
    # narrative: drop only the offending sentences.
    if data.get("narrative"):
        data["narrative"] = clean_sentences(data["narrative"])
    # why bullets: drop the whole bullet if it has an unsourced number.
    if data.get("why"):
        data["why"] = [w for w in data["why"]
                       if all(_is_sourced(t, allowed) for t in _candidate_tokens(w))
                       or removed.append(w) or False]
    # index-reason drivers: same.
    for lbl, obj in (data.get("indexReasons") or {}).items():
        drs = (obj or {}).get("drivers")
        if drs:
            obj["drivers"] = [d for d in drs
                              if all(_is_sourced(t, allowed) for t in _candidate_tokens(d))
                              or removed.append(d) or False]
    # tiles: blank only the offending sub (keep the tile + its label/value).
    for t in (data.get("tiles") or []):
        if isinstance(t, dict) and t.get("sub") and any(
                not _is_sourced(x, allowed) for x in _candidate_tokens(t["sub"])):
            removed.append(t["sub"]); t["sub"] = ""
    return removed


def validate_and_fix(prompt: str, max_tokens: int, allowed: set) -> dict:
    """Generate, then guarantee no unsourced number survives: one targeted
    correction retry, then a hard scrub. Always returns a dict (never raises)."""
    ai = call_claude_cached(prompt, max_tokens)
    if not ai:
        return ai
    bad = find_unsourced(ai, allowed)
    if bad:
        toks = ", ".join(sorted({t for _, t in bad}))
        print(f"  ⚠️  unsourced numbers in AI output: {toks} — requesting correction.")
        note = ("\n\nCORRECTION: your previous reply used these numbers that are NOT "
                f"in the data provided: {toks}. Rewrite the SAME JSON, replacing each "
                "with the correct figure from the data blocks above, or rephrasing with "
                "no number. Do not introduce any other number that isn't in the data.")
        ai2 = call_claude_cached(prompt + note, max_tokens)
        bad2 = find_unsourced(ai2, allowed) if ai2 else bad
        if ai2 and len(bad2) <= len(bad):
            ai, bad = ai2, bad2
    if bad:
        dropped = sanitize_numbers(ai, allowed)
        print(f"  🧹 scrubbed {len(dropped)} unsourced figure(s) before publish.")
    else:
        print("  ✓ all figures in AI output are backed by live data.")
    return ai


def generate_indian_summary(light: bool = False) -> dict:
    print("  Fetching live Indian prices...")
    prices   = fetch_prices({"Sensex": "^BSESN", "Nifty 50": "^NSEI", "Bank Nifty": "^NSEBANK"})
    sectors  = fetch_sector_moves(INDIA_SECTORS)          # REAL sector moves, not AI guesses
    movers   = fetch_movers(NIFTY_MOVERS)                 # REAL top gainers/losers
    cfx      = fetch_commodities_fx()                     # REAL Brent/USD-INR/gold (matches the on-site widgets)
    cfx_txt  = commodities_fx_text(cfx)
    try:
        articles = get_recent_articles(["indian-markets", "banking-finance", "macro-policy"])
    except Exception as e:
        print(f"  ⚠️  recent-news fetch failed: {str(e)[:60]} — using market data only.")
        articles = []
    news     = "\n".join(f"- {a['title']}: {a['simplified_article'][:180]}" for a in articles) or "n/a"
    today    = datetime.now().strftime("%d %B %Y")

    s = prices.get("Sensex",    {})
    n = prices.get("Nifty 50",  {})
    b = prices.get("Bank Nifty",{})
    indices = [
        {"label": "Sensex",     "value": s.get("value"), "change": s.get("change"), "pct": s.get("pct"), "up": s.get("up", True)},
        {"label": "Nifty 50",   "value": n.get("value"), "change": n.get("change"), "pct": n.get("pct"), "up": n.get("up", True)},
        {"label": "Bank Nifty", "value": b.get("value"), "change": b.get("change"), "pct": b.get("pct"), "up": b.get("up", True)},
    ]
    verdict = compute_verdict(indices)
    # Intraday area-chart series for the dashboard index cards.
    spark_syms = {"Sensex": "^BSESN", "Nifty 50": "^NSEI", "Bank Nifty": "^NSEBANK"}
    for idx in indices:
        sym = spark_syms.get(idx["label"])
        if sym:
            idx["spark"] = fetch_intraday(sym)
    # Market-sentiment breadth: share of sectors advancing.
    up_sec = sum(1 for x in sectors if x.get("pct", 0) >= 0)
    s_score = round(100 * up_sec / len(sectors)) if sectors else 50
    s_label = "Bullish" if s_score >= 60 else "Bearish" if s_score <= 40 else "Neutral"
    sentiment = {"score": s_score, "label": s_label}
    sector_txt = ", ".join(f"{x['name']} {x['pct']:+.1f}%" for x in sectors) or "n/a"

    g  = movers.get("gainers", []) if isinstance(movers, dict) else []
    lo = movers.get("losers", [])  if isinstance(movers, dict) else []
    movers_txt = ", ".join(f"{m.get('sym','')} {m.get('pct',0):+.1f}%" for m in (g + lo)) or "n/a"
    fb = _fallback_lead("Indian", indices, verdict)

    if light:
        # Small intraday update: live numbers + a short per-index "why" only.
        # Skips the heavy narrative/tiles to stay fast + cheap — the full report is
        # written once by the end-of-day run.
        light_prompt = f"""Today is {today}. Intraday update — the Indian market is "{verdict}" so far.
LIVE INDEX DATA: Sensex {s.get('pct')}, Nifty 50 {n.get('pct')}, Bank Nifty {b.get('pct')}.
REAL SECTOR MOVES (reference, do NOT invent): {sector_txt}
TOP STOCK MOVES (reference, do NOT invent): {movers_txt}

NUMBERS RULE — use only the figures above. Do NOT mention oil, Brent, gold or the rupee here (no price data for them is provided this run).

Return ONLY this JSON:
{{
  "lead": "<one short sentence, max 20 words: the move so far + the single biggest driver>",
  "indexReasons": {{
    "Sensex":     {{"drivers": ["<2 short reasons the SENSEX moved so far, EACH naming a real stock/sector + its % from above>"]}},
    "Nifty 50":   {{"drivers": ["<2 reasons for the NIFTY 50; note any divergence from the Sensex>"]}},
    "Bank Nifty": {{"drivers": ["<2 BANKING-specific reasons naming banks (SBI, HDFC Bank, ICICI...) + their moves or a rate/yield/credit driver>"]}}
  }}
}}"""
        allowed = build_allowed(indices, sectors, movers, None)
        ai = validate_and_fix(light_prompt, 600, allowed)
        return {
            "verdict":      verdict,
            "lead":         ai.get("lead") or fb,
            "brief":        ai.get("lead") or fb,
            "indexReasons": ai.get("indexReasons", {}),
            "indices":      indices,
            "sectors":      sectors,
            "movers":       movers,
            "sentiment":    sentiment,
            "_light":       True,
        }

    prompt = f"""Today is {today}. The Indian market had an overall "{verdict}" day.

LIVE INDEX DATA: Sensex {s.get('pct')}, Nifty 50 {n.get('pct')}, Bank Nifty {b.get('pct')}.
REAL SECTOR MOVES (already computed — reference these, do NOT invent numbers): {sector_txt}
COMMODITIES & CURRENCY (today, REAL — these are the ONLY oil/gold/rupee figures you may cite; they match the live on-site widgets): {cfx_txt}
RECENT NEWS HEADLINES:
{news}

NUMBERS RULE — every price, level or % you write MUST come verbatim from a data block above (indices, sectors, commodities & currency, or the news). If a figure isn't listed above, describe the move in words with NO number. Never state a Brent, gold, rupee or stock price that isn't given above — do not recall or estimate one.

Write a market summary. Return ONLY this JSON:
{{
  "lead": "<ONE short sentence, max 22 words: the day's verdict + the single biggest driver, plain English>",
  "brief": "<1 sentence with the key index moves in words, e.g. 'Sensex rose 0.8% and Nifty 0.6% on ...'>",
  "why": ["<2 to 4 short cause→effect reasons the market moved TODAY. Each names a concrete driver AND its effect on the index, in that order, plain English. Ground every one in the data/news above; NEVER invent numbers. Only mention oil or the rupee if it is in the COMMODITIES & CURRENCY line, and then use that exact figure. e.g. 'A closing-auction recovery lifted the Sensex in the final hour', 'Banking gains offset weakness in IT'>"],
  "indexReasons": {{
    "Sensex":     {{"drivers": ["<2 short, plain-English reasons the SENSEX specifically moved today, EACH naming a real stock or sector and its % move from the data above>"]}},
    "Nifty 50":   {{"drivers": ["<2 reasons for the NIFTY 50 specifically; note where it diverged from the Sensex (e.g. a sector that helped or dragged more)>"]}},
    "Bank Nifty": {{"drivers": ["<2 reasons for BANK NIFTY — these MUST be banking-specific: name the banks (SBI, HDFC Bank, ICICI, etc.) and their moves, or a rate/yield/credit driver>"]}}
  }},
  "narrative": "PARA1\\n\\nPARA2 — 2 short paragraphs telling the day in full (open→close, the main driver, the undercurrents). Use ONLY facts from the data and news above; never invent figures. Any oil/gold/rupee number must be the exact one from the COMMODITIES & CURRENCY line.",
  "tiles": [
    {{"icon":"🌍","label":"Global cues",  "value":"<Weak/Mixed/Strong>","sub":"<1 line context>","subUp":false}},
    {{"icon":"🏦","label":"FII activity", "value":"<Buying/Selling/Mixed>","sub":"<1 line, only if the news mentions it, else 'No fresh data'>","subUp":null}},
    {{"icon":"🛢","label":"Crude oil",    "value":"<Rising/Falling/Steady — match the Brent direction in COMMODITIES & CURRENCY>","sub":"<1 line; cite the exact Brent figure from that line, e.g. 'Brent at $91.89/bbl (+1.4%)'>","subUp":false}}
  ],
  "watch": "<one sentence, max 22 words, the key thing to watch tomorrow>"
}}"""

    allowed = build_allowed(indices, sectors, movers, cfx)
    ai = validate_and_fix(prompt, 1400, allowed)
    fb = _fallback_lead("Indian", indices, verdict)
    return {
        "verdict":  verdict,
        "headline": ai.get("lead") or fb,         # kept for backward compat
        "lead":     ai.get("lead") or fb,
        "brief":    ai.get("brief") or fb,
        "why":      ai.get("why", []),
        "indexReasons": ai.get("indexReasons", {}),   # per-index figure-backed drivers (for the tap-to-open chart)
        "narrative": ai.get("narrative", ""),
        "indices":  indices,
        "sectors":  sectors,                      # REAL data
        "movers":   movers,                       # REAL top gainers/losers
        "sentiment": sentiment,                   # breadth gauge
        "tiles":    ai.get("tiles", []),
        "watch":    ai.get("watch", ""),
    }


def generate_us_summary() -> dict:
    print("  Fetching live US prices...")
    prices   = fetch_prices({"S&P 500": "^GSPC", "Nasdaq": "^IXIC", "Dow Jones": "^DJI"})
    try:
        articles = get_recent_articles(["us-markets", "global-economy", "technology-it"])
    except Exception as e:
        print(f"  ⚠️  recent-news fetch failed: {str(e)[:60]} — using market data only.")
        articles = []
    news     = "\n".join(f"- {a['title']}: {a['simplified_article'][:180]}" for a in articles) or "n/a"
    today    = datetime.now().strftime("%d %B %Y")

    sp = prices.get("S&P 500",  {})
    nq = prices.get("Nasdaq",   {})
    dj = prices.get("Dow Jones",{})
    sectors = fetch_sector_moves(US_SECTORS)          # REAL sector moves
    cfx     = fetch_commodities_fx()                   # REAL Brent/gold (matches on-site widgets)
    cfx_txt = commodities_fx_text(cfx)
    indices = [
        {"label": "S&P 500",   "value": sp.get("value"), "change": sp.get("change"), "pct": sp.get("pct"), "up": sp.get("up", True)},
        {"label": "Nasdaq",    "value": nq.get("value"), "change": nq.get("change"), "pct": nq.get("pct"), "up": nq.get("up", True)},
        {"label": "Dow Jones", "value": dj.get("value"), "change": dj.get("change"), "pct": dj.get("pct"), "up": dj.get("up", True)},
    ]
    verdict = compute_verdict(indices)
    sector_txt = ", ".join(f"{x['name']} {x['pct']:+.1f}%" for x in sectors) or "n/a"

    prompt = f"""Today is {today}. US markets had an overall "{verdict}" day.

LIVE INDEX DATA: S&P 500 {sp.get('pct')}, Nasdaq {nq.get('pct')}, Dow {dj.get('pct')}.
REAL SECTOR MOVES (reference these, do NOT invent numbers): {sector_txt}
COMMODITIES (today, REAL — the ONLY oil/gold figures you may cite): {cfx_txt}
RECENT NEWS HEADLINES:
{news}

NUMBERS RULE — every price, level or % you write MUST come verbatim from a data block above. If a figure isn't listed, describe the move in words with NO number. Never state an oil, gold or stock price that isn't given above.

Write a market summary. Return ONLY this JSON:
{{
  "lead": "<ONE short sentence, max 22 words: the verdict + biggest driver, plain English>",
  "brief": "<1 sentence with the key index moves in words>",
  "why": ["<2 to 4 short cause→effect reasons the market moved TODAY. Each names a concrete driver AND its effect, plain English, grounded in the data/news above; NEVER invent numbers>"],
  "narrative": "PARA1\\n\\nPARA2 — 2 short paragraphs telling the day in full. Use ONLY facts above; never invent figures.",
  "tiles": [
    {{"icon":"📈","label":"Big mover",  "value":"<name/move if in news, else 'Mixed'>","sub":"<1 line>","subUp":true}},
    {{"icon":"💰","label":"Key data",   "value":"<data point from news or 'None today'>","sub":"<context>","subUp":true}},
    {{"icon":"🏛","label":"Backdrop",   "value":"<Risk-on/Risk-off/Mixed>","sub":"<1 line>","subUp":true}}
  ],
  "watch": "<one sentence, max 22 words, key thing to watch tomorrow>"
}}"""

    allowed = build_allowed(indices, sectors, None, cfx)
    ai = validate_and_fix(prompt, 1400, allowed)
    fb = _fallback_lead("US", indices, verdict)
    return {
        "verdict":  verdict,
        "headline": ai.get("lead") or fb,
        "lead":     ai.get("lead") or fb,
        "brief":    ai.get("brief") or fb,
        "why":      ai.get("why", []),
        "narrative": ai.get("narrative", ""),
        "indices":  indices,
        "sectors":  sectors,
        "tiles":    ai.get("tiles", []),
        "watch":    ai.get("watch", ""),
    }


def save_summary(market: str, data: dict):
    """Persist the legacy columns to the DB (best effort; JSON is the source of truth)."""
    table = "indian_market_summary" if market == "indian" else "us_market_summary"
    row   = {
        "headline":   data.get("headline", ""),
        "indices":    data.get("indices", []),
        "tiles":      data.get("tiles", []),
        "sectors":    data.get("sectors", []),
        "watch":      data.get("watch", ""),
        "updated_at": datetime.utcnow().isoformat(),
    }
    try:
        existing = supabase.table(table).select("id").limit(1).execute()
        if existing.data:
            supabase.table(table).update(row).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table(table).insert(row).execute()
        print(f"  ✅ Saved legacy row to {table}")
    except Exception as e:
        print(f"  ⚠️  DB save skipped ({table}): {e}")


def _load_existing_market_data() -> dict:
    try:
        with open("public/market-data.json") as f:
            return json.load(f)
    except Exception:
        return {}


def save_to_json(indian: dict, us: dict, light: bool = False):
    """Write summaries to JSON + publish live to Supabase.

    light=True is a small intraday update: merge only the live numbers + per-index
    reasons into the existing payload, keeping the full report (narrative/why/tiles)
    from the last full run. If a side has no live prices, keep the previous data."""
    now  = datetime.utcnow().isoformat()
    prev = _load_existing_market_data()

    def _has_real(new):
        return bool(new) and any((i.get("value") not in (None, "", "N/A")) for i in (new.get("indices") or []))

    if light:
        base = dict(prev.get("indian") or {})
        if _has_real(indian):
            for k in ("verdict", "lead", "brief", "indexReasons", "indices", "sectors", "movers", "sentiment"):
                if indian.get(k) is not None:
                    base[k] = indian[k]
            base["updated_at"] = now
        else:
            print("  ⚠️  light update: no live prices — keeping previous data")
        payload = {"indian": base, "us": prev.get("us") or {}}
    else:
        def _pick(new: dict, key: str) -> dict:
            # Valid only if we got at least one REAL live index price. (The AI prose
            # can be missing — that's fine, we publish the numbers. But if yfinance
            # returned nothing, keep yesterday's data rather than publishing N/A.)
            if _has_real(new):
                return {**new, "updated_at": now}
            old = prev.get(key)
            if old:
                print(f"  ⚠️  {key}: no live prices this run — keeping previous data ({old.get('updated_at', '?')})")
                return old
            return {**(new or {}), "updated_at": now}
        payload = {"indian": _pick(indian, "indian"), "us": _pick(us, "us")}
    os.makedirs("public", exist_ok=True)
    with open("public/market-data.json", "w") as f:
        json.dump(payload, f)
    print("  ✅ Saved to public/market-data.json")
    # Publish LIVE to Supabase so the website updates instantly — no git push,
    # no Vercel deploy. The frontend reads this row first (static file is a
    # fallback). This is the permanent fix for "market summary not updating".
    try:
        supabase.table("market_data").upsert({
            "id": "latest", "data": payload, "updated_at": now,
        }).execute()
        print("  ✅ Published live to Supabase (market_data) — site updates now")
    except Exception as e:
        print(f"  ⚠️  Live publish skipped — create the market_data table (see README): {str(e)[:90]}")


if __name__ == "__main__":
    # "light" / "--light" → small intraday update (Indian numbers + per-index why).
    # Default (no arg) → full end-of-day summary (Indian + US, full report).
    LIGHT = any(a in ("light", "--light") for a in sys.argv[1:])
    print("=" * 50)
    print("📊 " + ("Intraday light update" if LIGHT else "Generating market summaries") + " (Haiku 4.5, cached)")
    print("=" * 50)

    indian, us = {}, {}
    print("\n🇮🇳 " + ("Light Indian update..." if LIGHT else "Generating Indian market summary..."))
    try:
        indian = generate_indian_summary(light=LIGHT)
        if not LIGHT:
            save_summary("indian", indian)
        print(f"  Verdict: {indian.get('verdict')} | {indian.get('lead')}")
    except Exception as e:
        print(f"  ❌ Indian summary failed: {e}")

    if not LIGHT:
        print("\n🇺🇸 Generating US market summary...")
        try:
            us = generate_us_summary()
            save_summary("us", us)
            print(f"  Verdict: {us.get('verdict')} | {us.get('lead')}")
        except Exception as e:
            print(f"  ❌ US summary failed: {e}")

    print("\n💾 Saving to JSON...")
    try:
        save_to_json(indian, us, light=LIGHT)
    except Exception as e:
        print(f"  ❌ JSON save failed: {e}")

    print("\n✅ Done!" + (" (light update)" if LIGHT else ""))