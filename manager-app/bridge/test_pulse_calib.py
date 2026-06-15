"""Self-test for the pulse learning loop (fetch_demand_calibration + compute_pulse).
Runs with a fake DB cursor so it needs no live connection. Exit 0 = all green."""
import sys
import datetime

sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else ".")
import luna_iggys_bridge as b  # noqa: E402

FAILS = []


def check(name, cond):
    print(("PASS" if cond else "FAIL"), name)
    if not cond:
        FAILS.append(name)


def next_weekday(d, target):
    while d.weekday() != target:
        d += datetime.timedelta(days=1)
    return d


def weekdays(start, count):
    out, d = [], start
    while len(out) < count:
        if d.weekday() not in (4, 5):
            out.append(d)
        d += datetime.timedelta(days=1)
    return out


class _FakeCur:
    def __init__(self, rows):
        self.rows = rows

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, *a, **k):
        pass

    def fetchall(self):
        return self.rows


class _FakeConn:
    def __init__(self, rows):
        self.rows = rows

    def cursor(self):
        return _FakeCur(self.rows)


W = {"high": 60, "low": 50, "precip": 10, "code": 1, "gust": 5, "pdx_high": 62, "sunset": "8:30 PM"}
BASE = datetime.date(2026, 6, 15)
WEEKDAY = next_weekday(BASE, 2)   # a Wednesday
WEEKEND = next_weekday(BASE, 5)   # a Saturday

# ── compute_pulse ──
p = b.compute_pulse(W, [], WEEKDAY, None)
check("no-calib confidence is plain 'learning'", p["confidence"] == "learning")
check("no-calib base_score == score", p["base_score"] == p["score"])
check("no-calib has no learning driver", not any(n == "learning" for (n, s, d) in p["drivers"]))

calib_wd = {"n": 10, "bias": 15.0, "weekend_bias": None, "weekday_bias": 15.0, "hit_rate": 0}
p2 = b.compute_pulse(W, [], WEEKDAY, calib_wd)
check("weekday correction shifts score by +15", p2["score"] == p2["base_score"] + 15)
check("weekday correction adds a '+' learning driver",
      any(n == "learning" and s == "+" for (n, s, d) in p2["drivers"]))
check("n=10 -> 'calibrating' confidence", p2["confidence"] == "calibrating · 10 nights logged")

calib_we = {"n": 8, "bias": -10.0, "weekend_bias": -12.0, "weekday_bias": None, "hit_rate": 50}
pw = b.compute_pulse(W, [], WEEKEND, calib_we)
check("weekend prefers weekend_bias (-12)", pw["score"] == pw["base_score"] - 12)

calib_g = {"n": 7, "bias": -10.0, "weekend_bias": None, "weekday_bias": None, "hit_rate": 40}
pg = b.compute_pulse(W, [], WEEKDAY, calib_g)
check("weekday falls back to global bias (-10)", pg["score"] == pg["base_score"] - 10)

calib_20 = {"n": 25, "bias": 3.0, "weekend_bias": None, "weekday_bias": 3.0, "hit_rate": 72}
p20 = b.compute_pulse(W, [], WEEKDAY, calib_20)
check("n>=20 -> 'calibrated' confidence with hit-rate",
      p20["confidence"] == "calibrated · 25 nights logged, 72% exact")

# ── fetch_demand_calibration ──
cold = [(d, 48, "BUSY") for d in weekdays(BASE, 3)]  # err +20 each, but n<MIN
c = b.fetch_demand_calibration(_FakeConn(cold))
check("cold start counts n=3", c["n"] == 3)
check("cold start bias stays 0 (below MIN_NIGHTS)", c["bias"] == 0.0)
check("cold start hit_rate 0 (STEADY!=BUSY)", c["hit_rate"] == 0)

wd_rows = [(d, 48, "BUSY") for d in weekdays(BASE, 10)]  # err +20 -> clamp +15
c2 = b.fetch_demand_calibration(_FakeConn(wd_rows))
check("enough data n=10", c2["n"] == 10)
check("weekday_bias clamped to +15", c2["weekday_bias"] == 15.0)
check("global bias clamped to +15", c2["bias"] == 15.0)
check("weekend_bias None when no weekend rows", c2["weekend_bias"] is None)

hit_rows = [(d, 68, "BUSY") for d in weekdays(BASE, 6)]  # base 68 == BUSY, err 0
c3 = b.fetch_demand_calibration(_FakeConn(hit_rows))
check("perfect hits -> hit_rate 100", c3["hit_rate"] == 100)
check("perfect hits -> bias 0", c3["bias"] == 0.0)

empty = b.fetch_demand_calibration(_FakeConn([]))
check("no rows -> n=0 / bias 0", empty["n"] == 0 and empty["bias"] == 0.0)

print("\nRESULT:", "ALL GREEN" if not FAILS else f"{len(FAILS)} FAILED: {FAILS}")
sys.exit(1 if FAILS else 0)
