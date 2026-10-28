"""Focus-level check of specs/adaptive-progression/design.md formulas (proposal reference, single platform pair, no PAV).
Concept A has history; concept B is fresh. Prints every action's components and the winner."""
import math
from scipy.stats import beta
lg=lambda p:math.log(p/(1-p)); sg=lambda x:1/(1+math.exp(-x))
TAU,K,L=0.70,4,0.5; W=dict(D=0.5,I=0.3,C=0.2,F=0.3,K=0.2)
PRI={'E':0.8,'M':0.5,'H':0.2}
CFA=math.log(10)/400
def var(a,b): return a*b/((a+b)**2*(a+b+1))
def info(a,b): p=a/(a+b); return (var(a,b)-(p*var(a+1,b)+(1-p)*var(a,b+1)))/var(a,b)
fit=lambda p:1-abs(p-TAU)/max(TAU,1-TAU)
def cells(h):
    out={};prev=None
    for l in 'EMH':
        m=PRI[l] if prev is None else sg(lg(PRI[l])+L*prev)
        s,f=h.get(l,(0,0)); a,b=K*m+s,K*(1-m)+f; out[l]=(a,b,s+f)
        prev=lg(a/(a+b))-lg(PRI[l]) if True else 0
    return out
def ready(a,b,n): return n>0 and beta.sf(TAU,a,b)>=0.5
def cf_transfer(mu=1000,sd=350):
    # pick rating whose marginal p is closest to TAU (100-point grid, floor 800)
    best=None
    for d in range(800,3600,100):
        p=sg(CFA*(mu-d)/math.sqrt(1+math.pi*CFA**2*sd**2/8)); 
        if best is None or abs(p-TAU)<abs(best[1]-TAU): best=(d,p)
    d,p=best; x=sd**2*CFA**2*p*(1-p); return d,p,x/(1+x)
def actions(h,cont=False,followup=False,transfer_done=False):
    c=cells(h); acts={}
    top=max([l for l in 'EMH' if c[l][2]>0],default='E',key='EMH'.index)
    any_obs=any(c[l][2]>0 for l in 'EMH')
    for l in 'EMH':
        a,b,n=c[l]; p=a/(a+b); gap='EMH'.index(l)-'EMH'.index(top)
        kind={-2:'step_down',-1:'step_down',0:'consolidate',1:'step_up',2:'stretch'}[gap]
        if kind=='stretch' and not any_obs: continue
        acts[f'{kind}:{l}']=dict(P=round(p,3),D=round(fit(p),3),I=round(info(a,b),3))
    if ready(*c['M']) and not transfer_done:
        d,p,i=cf_transfer(); acts[f'transfer:CF{d}']=dict(P=round(p,3),D=round(fit(p),3),I=round(i,3))
    for v in acts.values():
        v['B']=round(W['D']*v['D']+W['I']*v['I']+W['C']*1+W['F']*followup+W['K']*(cont and not ready(*c['M'])),3)
    return acts
def show(label,hA,**kw):
    A=actions(hA,**kw); Bf=actions({})
    bestA=max(A,key=lambda k:A[k]['B']); bestB=max(Bf,key=lambda k:Bf[k]['B'])
    win='A:'+bestA if A[bestA]['B']>=Bf[bestB]['B'] else 'B(fresh):'+bestB
    print(f'{label:42s} -> {win:22s} A={A}  fresh_best={Bf[bestB]["B"]}')
# history: level -> (solved, failed)
show('S1 cold (A fresh too)',{})
show('S2 A Easy 2 solved, continuity',{'E':(2,0)},cont=True)
show('S3 A Easy 2, Med 2 solved, continuity',{'E':(2,0),'M':(2,0)},cont=True)
show('S4 A Easy 2, Med 0 of 1, follow-up',{'E':(2,0),'M':(0,1)},cont=True,followup=True)
show('S5 A Easy 2, Med 4, transfer done',{'E':(2,0),'M':(4,0)},cont=True,transfer_done=True)
show('S6 A Easy 1 of 3, follow-up',{'E':(1,2)},cont=True,followup=True)
show('S7 A Easy 5, Med 6, transfer done',{'E':(5,0),'M':(6,0)},cont=True,transfer_done=True)
show('S8 A Easy 2, Med 0 of 1, follow-up expired',{'E':(2,0),'M':(0,1)},cont=True)
