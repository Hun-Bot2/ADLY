# Independent re-derivation (no production code). Prints JSON for comparison.
import math, json
from datetime import datetime
sig=lambda x:1/(1+math.exp(-x))
def beta_sd(a,b): return math.sqrt(a*b/((a+b)**2*(a+b+1)))
PRI={1:(3.2,.8),2:(2,2),3:(.8,3.2)}
def lc(cells):
    lv=[]
    for l in (1,2,3):
        a,b=PRI[l]; s,n=cells.get(l,(0,0)); A,B=a+s,b+n-s; lv.append(dict(l=l,A=A,B=B,m=A/(A+B),w=A+B))
    # PAVA for non-increasing sequence: brute force over all 4 partitions of 3 ordered items
    best=None
    for parts in ([[0],[1],[2]],[[0,1],[2]],[[0],[1,2]],[[0,1,2]]):
        means=[sum(lv[i]['m']*lv[i]['w'] for i in p)/sum(lv[i]['w'] for i in p) for p in parts]
        if all(means[i]>=means[i+1]-1e-15 for i in range(len(means)-1)):
            fit={i:mm for p,mm in zip(parts,means) for i in p}
            loss=sum(lv[i]['w']*(lv[i]['m']-fit[i])**2 for i in range(3))
            if best is None or loss<best[0]-1e-15: best=(loss,fit)
    return {l['l']:dict(mean=round(best[1][i],6),sd_unpooled=round(beta_sd(l['A'],l['B']),6),raw_mean=round(l['m'],6)) for i,l in enumerate(lv)}
def ability(obs,prior_mean,prior_sd,slope,prior_at=None,drift=25):
    m,v,last=prior_mean,prior_sd**2,prior_at
    for t,d,y in obs:
        if last: v+=drift**2*max(0,(datetime.fromisoformat(t)-datetime.fromisoformat(last)).total_seconds()/(7*86400))
        last=t
        p=sig(slope*(m-d)); v=1/(1/v+slope*slope*p*(1-p)); m+=v*slope*(y-p)
    return dict(mean=round(m,4),sd=round(math.sqrt(v),4))
def marginal(m,s,d,a): return round(sig(a*(m-d)/math.sqrt(1+math.pi*a*a*s*s/8)),3)
def mc_marginal(m,s,d,a,n=400000):
    import random; random.seed(1); return round(sum(sig(a*(random.gauss(m,s)-d)) for _ in range(n))/n,3)
def atc_internal(r,n):
    lower=400*(1-math.log(400/r)) if r<=400 else r
    f=(math.sqrt(1-0.81**n)/(1-0.9**n)-1)/(math.sqrt(19)-1)*1200
    return round(lower+f,4)
def atc_display(internal,n):  # forward map, AtCoder's published definition
    f=(math.sqrt(1-0.81**n)/(1-0.9**n)-1)/(math.sqrt(19)-1)*1200
    r=internal-f
    return 400/math.exp((400-r)/400) if r<=400 else r
CF=math.log(10)/400
out=dict(
 lc_cold=lc({}), lc_easy_heavy=lc({1:(10,10),2:(1,4),3:(0,0)}), lc_violate=lc({1:(1,4),2:(4,4),3:(0,0)}),
 lc_hard_violate=lc({1:(0,0),2:(0,3),3:(3,3)}),
 cf_cold=ability([],1000,350,CF), cf_seq=ability([('2026-01-01T00:00:00',1200,1),('2026-01-08T00:00:00',1400,0),('2026-01-08T00:00:01',1400,0)],1000,350,CF,None),
 cf_repeat10=ability([(f'2026-01-01T00:00:{i:02d}',800,1) for i in range(10)],1000,350,CF),
 cf_marg=[marginal(1000,350,1200,CF),mc_marginal(1000,350,1200,CF)], cf_cons=round(sig(CF*(1000-350-1200)),3),
 atc_marg=[marginal(0,400,-1400,0.004479398673070138),mc_marginal(0,400,-1400,0.004479398673070138)],
 atc_internal=[atc_internal(1200,10),atc_internal(300,3),atc_internal(1200,1)],
 atc_roundtrip=[round(atc_display(atc_internal(r,n),n),6) for r,n in ((1200,10),(300,3),(50,1))],
)
print(json.dumps(out))
