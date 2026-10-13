# THE VAULT'S COPIES OF THE RE-SIMMED ALEMANNIAN HISTORY (13 October 2026): the Oberliga's season tables in
# Avium/Football/Historical Leagues/Alemannische Oberliga.md, and the order of Alemannia's entrants in each year's field
# in Historical CWC Fields.md, both from the new season reports in public/avium/pstats.
#
#   python3 test/hist/ale/vault.py <data.json>
import json, os, re, sys

ROOT = os.environ.get("VAULT_ROOT", "/Users/zli/Documents/NICHIRIN/Avium/Football/")
HL = ROOT + "Historical Leagues/"
P = os.environ.get("HIST_OUT", "public/avium/pstats/")
D = json.load(open(sys.argv[1], encoding="utf-8"))
years = D["seasons"]

def final_rows(path):
    txt = open(path, encoding="utf-8").read().split("## Final Table")[-1].split("\n## ")[0]
    return [l for l in txt.splitlines() if re.match(r"^\|\s*\d+\s*\|", l)]

def club(row):
    return row.split("|")[2].replace("*", "").strip()

def write(path, text):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="") as f: f.write(text)
    os.replace(tmp, path)

# The Oberliga page: every season's final table, who went down and who came up.
tables = {y: final_rows(f"{P}ao/{y}.md") for y in years}
l2 = {y: final_rows(f"{P}2ao/{y}.md") for y in years}
out = ["# Alemannische Oberliga: Re-simmed Seasons, 1900–1933", "",
       "Played on the Avium Football Engine on 13 October 2026, every fixture with its result (the season reports are in the "
       "engine's archive, ao and 2ao). No seasons 1914–1920.", "",
       "Promotion and relegation with the 2. Alemannische Oberliga from 1899/1900, three down and three up each summer. The "
       "Oberliga's new places in 1900/01, 1901/02 and 1911/12 went to Fortuna Hammersburg 01, FC Eisenfeld 02 and TSV 1912 "
       "Sturnheim in their founding seasons. Each year's Club World Cup entrants finished in the qualifying places.", "", "---", ""]
for y in years:
    t = tables[y]
    out += [f"## {y}", "", f"{len(t)} teams. Champions: **{club(t[0])}**.", ""]
    down, up = [club(r) for r in t[-3:]], [club(r) for r in l2[y][:3]]
    out += [f"Relegated: {', '.join(down)}. Promoted from the 2. Liga: {', '.join(up)}.", ""]
    out += ["| # | Team | P | W | D | L | GF | GA | GD | Pts |", "|---|------|---|---|---|---|----|----|-----|-----|", *t, "", "---", ""]
write(HL + "Alemannische Oberliga.md", "\n".join(out))

# The Club World Cup fields: Alemannia's entrants in the order they finished.
f = HL + "Historical CWC Fields.md"
txt = open(f, encoding="utf-8", newline="").read()
sections = re.split(r"(?m)^(## \d{4}\s*$)", txt)
changed = 0
for k in range(1, len(sections), 2):
    y = int(sections[k].split()[1])
    if y not in tables: continue
    order = [club(r) for r in tables[y]]
    def fix(m):
        names = [re.sub(r"^\d+\.\s*", "", x.strip(), count=1) for x in m.group(2).split(",")]
        if any(n not in order for n in names): raise SystemExit(f"{y}: {names} not all in the table")
        names.sort(key=order.index)
        return m.group(1) + ", ".join(f"{i + 1}. {n}" for i, n in enumerate(names))
    new = re.sub(r"(?m)^(\*\*Alemannia\*\* \(\d+\) — )(.+)$", fix, sections[k + 1], count=1)
    if new != sections[k + 1]: changed += 1
    sections[k + 1] = new
write(f, "".join(sections))
print(f"wrote {len(years)} Oberliga seasons to the vault page; {changed} Club World Cup fields reordered")
