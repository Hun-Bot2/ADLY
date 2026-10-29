"""Audit of liquidslr/leetcode-company-wise-problems (local, read-only). Prints aggregates only; never writes the data.
Usage: python3 -I audit_dataset.py <checkout> <catalog-v4.sqlite3>"""
import csv, sys, os, re, sqlite3, statistics as st
from collections import Counter, defaultdict
root, catalog = sys.argv[1], sys.argv[2]
EXPECTED = ['Difficulty','Title','Frequency','Acceptance Rate','Link','Topics']
WINDOWS = ['1. Thirty Days','2. Three Months','3. Six Months','4. More Than Six Months','5. All']
companies = sorted(d for d in os.listdir(root) if os.path.isdir(os.path.join(root,d)) and not d.startswith('.'))
files = rows = bad_header = bad_link = dup_in_file = empty = 0
window_counts = Counter(); per_company_all = {}; slugs_all = set(); slug_companies = defaultdict(set)
diff = Counter(); freq = []; acc = []; topics_by_slug = {}; diff_by_slug = {}; title_by_slug = {}
inconsistent_diff = set(); inconsistent_title = set(); unknown_files = Counter(); empty_by_window = Counter()
for c in companies:
    present = set()
    for f in os.listdir(os.path.join(root,c)):
        if not f.endswith('.csv'): unknown_files[f]+=1; continue
        name = f[:-4]
        if name not in WINDOWS: unknown_files[f]+=1
        present.add(name); files += 1; window_counts[name]+=1
        with open(os.path.join(root,c,f), newline='', encoding='utf-8') as h:
            r = list(csv.reader(h))
        if r and r[0] == EXPECTED[:5] and len(r) == 1: empty += 1; empty_by_window[name] += 1; continue  # header-only file
        if not r or r[0] != EXPECTED: bad_header += 1; continue
        body = r[1:]
        if not body: empty += 1; empty_by_window[name] += 1
        seen = set()
        for row in body:
            if len(row) != 6: bad_link += 1; continue
            d, t, fq, ar, link, tp = row
            m = re.fullmatch(r'https://leetcode\.com/problems/([a-z0-9-]+)/?', link.strip())
            if not m: bad_link += 1; continue
            s = m.group(1); rows += 1
            if s in seen: dup_in_file += 1
            seen.add(s)
            if name == '5. All': slugs_all.add(s); slug_companies[s].add(c)
            if s in diff_by_slug and diff_by_slug[s] != d: inconsistent_diff.add(s)
            if s in title_by_slug and title_by_slug[s] != t: inconsistent_title.add(s)
            diff_by_slug[s] = d; title_by_slug[s] = t
            topics_by_slug[s] = {x.strip() for x in tp.split(',') if x.strip()}
            if name == '5. All':
                diff[d] += 1
                try: freq.append(float(fq))
                except ValueError: pass
                try: acc.append(float(ar))
                except ValueError: pass
    per_company_all[c] = present
all_slugs = set(diff_by_slug)
print('commit-pinned checkout:', os.path.basename(root))
print('companies', len(companies), 'csv files', files, 'bad headers', bad_header, 'empty files', empty, 'unexpected files', dict(unknown_files))
print('files per window', dict(window_counts)); print('empty (header-only) files per window', dict(empty_by_window))
print('companies missing the All file', sum('5. All' not in v for v in per_company_all.values()))
print('rows (all windows)', rows, 'malformed rows/links', bad_link, 'duplicate slug within a file', dup_in_file)
print('unique slugs any window', len(all_slugs), 'in All files', len(slugs_all))
print('All-file row difficulty', dict(diff))
q = lambda v,p: sorted(v)[int(p*(len(v)-1))] if v else None
print('Frequency (All rows) min/median/max', q(freq,0), q(freq,.5), q(freq,1), 'share == 100.0:', round(sum(x==100.0 for x in freq)/len(freq),3) if freq else None)
print('Acceptance Rate (All rows) min/median/max', q(acc,0), q(acc,.5), q(acc,1), 'share <= 0.01:', round(sum(x<=0.01 for x in acc)/len(acc),3) if acc else None)
print('slugs with conflicting difficulty across files', len(inconsistent_diff), 'conflicting titles', len(inconsistent_title))
cs = sorted((len(v) for v in slug_companies.values()), reverse=True)
print('companies per slug (All) median', q(cs,.5), 'max', cs[0] if cs else None, 'slugs in exactly one company', sum(x==1 for x in cs))
sizes = sorted(len(open(os.path.join(root,c,'5. All.csv'),encoding='utf-8').read().splitlines())-1 for c in companies if '5. All' in per_company_all[c])
print('rows per company All file: min/median/p90/max', q(sizes,0), q(sizes,.5), q(sizes,.9), q(sizes,1), 'companies with <10 problems', sum(s<10 for s in sizes))
db = sqlite3.connect(f'file:{catalog}?mode=ro&immutable=1', uri=True)
cat = {r[0].split(':',1)[1]: r[1:] for r in db.execute("SELECT problem_key, difficulty_value, eligible FROM problems WHERE platform='leetcode'")}
tags = defaultdict(set)
for k,t in db.execute("SELECT problem_key, native_tag FROM problem_tags WHERE problem_key LIKE 'leetcode:%'"): tags[k.split(':',1)[1]].add(t)
inc = all_slugs & set(cat); eligible = {s for s in inc if cat[s][1]==1}
print('dataset slugs found in catalog-v4', len(inc), 'of', len(all_slugs), f'({len(inc)/len(all_slugs):.1%})', 'eligible', len(eligible))
print('dataset slugs NOT in catalog-v4', len(all_slugs - set(cat)), '(premium-only at collection, newer, or renamed)')
print('catalog-v4 LeetCode rows covered by any company list', len(inc), 'of', len(cat), f'({len(inc)/len(cat):.1%})')
lv = {'EASY':1.0,'MEDIUM':2.0,'HARD':3.0}
print('difficulty disagreement with catalog', sum(1 for s in inc if lv.get(diff_by_slug[s]) != cat[s][0]))
jac = [len(topics_by_slug[s] & tags[s]) / len(topics_by_slug[s] | tags[s]) for s in inc if topics_by_slug[s] | tags[s]]
print('topic vs catalog tag Jaccard median', round(q(jac,.5),3), 'exact match share', round(sum(j==1 for j in jac)/len(jac),3))
