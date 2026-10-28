import sqlite3, sys, json, statistics as st
from collections import Counter, defaultdict
c=sqlite3.connect(f"file:{sys.argv[1]}?mode=ro&immutable=1",uri=True)
q=lambda s,*a:c.execute(s,a).fetchall()
print("platform total/eligible/recommendable(free|free_at_collection & eligible)")
for r in q("""SELECT platform,count(*),sum(eligible),sum(eligible AND access IN ('free','free_at_collection')) FROM problems GROUP BY platform"""): print(r)
print("access x platform", q("SELECT platform,access,count(*) FROM problems GROUP BY 1,2"))
print("exclusion reasons", q("SELECT platform,exclusion_reason,count(*) FROM problems WHERE eligible=0 GROUP BY 1,2"))
print("difficulty_kind x platform", q("SELECT platform,difficulty_kind,count(*),sum(difficulty_value IS NULL) FROM problems GROUP BY 1,2"))
print("LC levels (all / recommendable)", q("SELECT difficulty_value,count(*),sum(eligible AND access IN ('free','free_at_collection')) FROM problems WHERE platform='leetcode' GROUP BY 1"))
def pct(vals,ps=(0,5,25,50,75,95,100)):
    v=sorted(vals); return {p:round(v[min(len(v)-1,int(p/100*(len(v)-1)))],1) for p in ps} if v else {}
cf=[r[0] for r in q("SELECT difficulty_value FROM problems WHERE platform='codeforces' AND difficulty_value IS NOT NULL")]
print("CF rating n",len(cf),pct(cf)); print("CF rating hist", sorted(Counter(int(x//400*400) for x in cf).items()))
at=q("SELECT difficulty_value,atc_discrimination,atc_experimental,problem_key FROM problems WHERE platform='atcoder' AND difficulty_kind='atc_irt'")
print("AtC IRT n",len(at),"difficulty",pct([r[0] for r in at]),"experimental",sum(r[2] for r in at))
print("AtC discrimination distinct",Counter(round(r[1],9) if r[1] is not None else None for r in at).most_common(4))
print("AtC extreme difficulty",sorted([(r[0],r[3]) for r in at])[:3],sorted([(r[0],r[3]) for r in at])[-3:])
print("AtC difficulty < -1000",sum(r[0]< -1000 for r in at),"<0",sum(r[0]<0 for r in at))
print("concept status/via", q("SELECT evidence_status,via,count(*) FROM problem_concepts GROUP BY 1,2"))
trusted="evidence_status IN ('approved','ai_reviewed')"
pc=defaultdict(set)
for k,cid in q(f"SELECT problem_key,concept_id FROM problem_concepts WHERE {trusted}"): pc[k].add(cid)
prob={r[0]:r[1:] for r in q("SELECT problem_key,platform,eligible AND access IN ('free','free_at_collection'),difficulty_kind,difficulty_value FROM problems")}
cov=Counter(); multi=Counter(); ncon=Counter()
for k,(pl,rec,dk,dv) in prob.items():
    if rec: cov[(pl,'rec')]+=1; cov[(pl,'rec_with_concept')]+=bool(pc[k]); ncon[(pl,len(pc[k]))]+=1
print("recommendable with >=1 trusted concept", sorted(cov.items()))
print("concepts per recommendable problem", sorted(ncon.items()))
cc=defaultdict(Counter)
for k,s in pc.items():
    pl,rec,dk,dv=prob[k]
    if rec:
        for x in s: cc[x][pl]+=1
print("concept x platform (recommendable)")
for x,v in sorted(cc.items(),key=lambda kv:-sum(kv[1].values())): print(f"  {x:22s} lc={v['leetcode']:5d} cf={v['codeforces']:5d} at={v['atcoder']:5d}")
# LC by level for each concept
lv=defaultdict(Counter)
for k,s in pc.items():
    pl,rec,dk,dv=prob[k]
    if rec and pl=='leetcode':
        for x in s: lv[x][int(dv)]+=1
print("LC concept x level (recommendable) E/M/H"); 
for x,v in sorted(lv.items()): print(f"  {x:22s} {v[1]:4d} {v[2]:4d} {v[3]:4d}")
# transfer pool: CF<=1000, AtC<=800 non-experimental irt
tp=Counter()
for k,s in pc.items():
    pl,rec,dk,dv=prob[k]
    if not rec or dv is None: continue
    if pl=='codeforces' and dv<=1000: [tp.update([(x,'cf')]) for x in s]
for k,s in pc.items():
    pl,rec,dk,dv=prob[k]
    if rec and pl=='atcoder' and dk=='atc_irt' and dv is not None and dv<=800:
        exp=q("SELECT atc_experimental FROM problems WHERE problem_key=?",k)[0][0]
        if not exp: [tp.update([(x,'at')]) for x in s]
print("transfer-stage pool per concept (cf<=1000 / atc<=800 non-exp)"); 
for x in sorted(cc): print(f"  {x:22s} cf={tp[(x,'cf')]:4d} at={tp[(x,'at')]:4d}")
print("reliability", q("SELECT p.platform,r.tier,count(*) FROM reliability r JOIN problems p USING(problem_key) GROUP BY 1,2"))
print("language_class", q("SELECT p.platform,r.language_class,count(*) FROM reliability r JOIN problems p USING(problem_key) GROUP BY 1,2"))
print("aliases", q("SELECT count(*) FROM aliases"))
print("tags per platform: problems with >=1 native tag", q("SELECT p.platform,count(DISTINCT t.problem_key) FROM problem_tags t JOIN problems p USING(problem_key) GROUP BY 1"))
