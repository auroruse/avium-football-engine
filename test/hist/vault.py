# THE VAULT'S COPIES OF THE RE-SIMMED HISTORY (13 October 2026): each season's table in
# Avium/Football/Nichirin League One/Historical Seasons (and 30:31), the league column of Historical NL1 Winners.tsv,
# and the League table of Club Lore's All-Time Title Winners, all from the new season reports in public/avium/pstats.
#
#   python3 test/hist/vault.py <plan.json>
import json, os, re, sys

ROOT = os.environ.get("VAULT_ROOT", "/Users/zli/Documents/NICHIRIN/Avium/Football/")
HS = ROOT + "Nichirin League One/Historical Seasons/"
P = os.environ.get("HIST_OUT", "public/avium/pstats/")
plan = json.load(open(sys.argv[1], encoding="utf-8"))
key = lambda y: f"{str(y - 1)[2:]}_{str(y)[2:]}"            # 1889 -> 88_89
slash = lambda y: f"{str(y - 1)[2:]}/{str(y)[2:]}"          # 1889 -> 88/89

def final(path):
    txt = open(path, encoding="utf-8").read().split("## Final Table")[-1]
    out = []
    for l in txt.splitlines():
        p = [x.strip() for x in l.split("|")]
        if len(p) > 4 and p[1].isdigit():
            out.append({"club": p[2].replace("*", "").strip(), "P": p[3], "W": p[4], "D": p[5], "L": p[6], "GD": p[9].replace("+", ""), "Pts": p[10]})
    return out

# Codes and places the vault's old tables gave each club, kept for the clubs they named.
def file_of(y):
    return ROOT + "Nichirin League One/30:31/Nichirin League One - 30_31.tsv" if y == 1931 else HS + f"Nichirin League One - {key(y)}.tsv"
known = {}
for y in [s["y"] for s in plan["seasons"]]:
    f = file_of(y)
    if not os.path.exists(f): continue
    for l in open(f, encoding="utf-8").read().splitlines()[1:]:
        c = l.split("\t")
        if len(c) >= 4 and c[1]: known.setdefault(c[1], (c[0], c[3]))
recs = {t["name"]: t for t in json.load(open("src/data/teams.json", encoding="utf-8")) if t and t.get("file") == "NCH"}
def code_place(name):
    if name in known: return known[name]
    t = recs.get(name) or recs.get("Dai-Ichi Sen'ninhara" if name == "343 Kōkūtai" else name, {})
    return (t.get("code", ""), t.get("location", ""))

champs = {}
for s in plan["seasons"]:
    y = s["y"]
    t = final(P + f"nl1/{y}.md")
    champs[y] = t[0]["club"]
    ent = lambda n: "Dai-Ichi Sen'ninhara" if n == "343 Kōkūtai" else n
    rows = ["CODE\tCLUB\tBASE SKILL\tLOCATION\t\tCLUB\tP\tW\tD\tL\tGD\tPts"]
    by_rating = sorted(t, key=lambda r: -plan["ratings"][ent(r["club"])][str(y)])
    for a, b in zip(by_rating, t):
        code, place = code_place(a["club"])
        rows.append("\t".join([code, a["club"], str(round(plan["ratings"][ent(a["club"])][str(y)])), place, "", b["club"], b["P"], b["W"], b["D"], b["L"], b["GD"], b["Pts"]]))
    open(file_of(y), "w", encoding="utf-8").write("\n".join(rows))

# The league column of the winners list.
wf = ROOT + "Historical NL1 Winners.tsv"
raw = open(wf, encoding="utf-8", newline="").read()
crlf = "\r\n" in raw
lines = raw.replace("\r\n", "\n").split("\n")
by = {slash(y): c for y, c in champs.items()}
out = []
for l in lines:
    c = l.split("\t")
    if len(c) >= 2 and c[0] in by: c[1] = by[c[0]]
    out.append("\t".join(c))
open(wf, "w", encoding="utf-8", newline="").write(("\r\n" if crlf else "\n").join(out))

# Club Lore's League table: every title from the winners list (88/89-32/33) and 33/34 off the archive, under the club's
# current name, a merged club's titles under its own name with where it went.
MERGED = {"Zōsensho": "Takarazuka Kaigun", "Kurihama Chinjufu": "Takarazuka Kaigun", "Suirai Sentai": "Takarazuka Kaigun",
          "Dai-Ichi Konoe": "Dai-Ichi Sen'ninhara", "Sasebo Shuto": "Dai-Ichi Sen'ninhara"}
won = {}
for l in open(wf, encoding="utf-8").read().splitlines()[1:]:
    c = l.split("\t")
    if len(c) >= 2 and c[1]:
        n = "Dai-Ichi Sen'ninhara (all names)" if c[1] in ("343 Kōkūtai", "Dai-Ichi Sen'ninhara") else (f"{c[1]} (→ {MERGED[c[1]]})" if c[1] in MERGED else c[1])
        won.setdefault(n, []).append(c[0])
won.setdefault(final(P + "nl1/1934.md")[0]["club"], []).append("33/34")
yr = lambda s: int(s[:2]) + (1800 if int(s[:2]) >= 50 else 1900)
rows = sorted(won.items(), key=lambda kv: (-len(kv[1]), yr(kv[1][0])))
table = "| Club | Titles | Seasons |\n|---|---|---|\n" + "\n".join(f"| {n} | {len(s)} | {', '.join(s)} |" for n, s in rows)
lf = ROOT + "Club Lore.md"
lore = open(lf, encoding="utf-8").read()
m = re.search(r"(### League\n\n)(\| Club \| Titles \| Seasons \|\n\|---\|---\|---\|\n(?:\|.*\|\n)+)", lore)
assert m, "League table not found"
lore = lore[:m.start(2)] + table + "\n" + lore[m.end(2):]
open(lf, "w", encoding="utf-8").write(lore)
print(f"vault: {len(champs)} season tables, winners list and Club Lore's League table updated")
