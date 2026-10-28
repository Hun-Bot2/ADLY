"""Worked example and sensitivity for specs/adaptive-progression/design.md (proposal, not production)."""
import math
from scipy.stats import beta
lg=lambda p:math.log(p/(1-p)); sg=lambda x:1/(1+math.exp(-x))
PRIOR={'E':0.8,'M':0.5}
def var(a,b): return a*b/((a+b)**2*(a+b+1))
def info(a,b):
    p=a/(a+b); return (var(a,b)-(p*var(a+1,b)+(1-p)*var(a,b+1)))/var(a,b)
def cells(es,ef,ms,mf,kappa,lam):
    aE,bE=kappa*PRIOR['E']+es,kappa*(1-PRIOR['E'])+ef
    d=lg(aE/(aE+bE))-lg(PRIOR['E'])
    m=sg(lg(PRIOR['M'])+lam*d); aM,bM=kappa*m+ms,kappa*(1-m)+mf
    return (aE,bE),(aM,bM)
def choose(es,ef,ms,mf,tau=0.7,kappa=4,lam=0.5,rule='mean',w=(0.5,0.3,0.2)):
    out={}
    for name,(a,b) in zip(('easy','medium'),cells(es,ef,ms,mf,kappa,lam)):
        p=a/(a+b) if rule=='mean' or name=='easy' else beta.ppf(0.10,a,b)
        fit=1-abs(p-tau)/max(tau,1-tau)
        out[name]=(round(a/(a+b),3),round(beta.ppf(0.10,a,b),3),round(beta.ppf(0.90,a,b),3),round(fit,3),round(info(a,b),3),round(w[0]*fit+w[1]*info(a,b)+w[2],3))
    return max(out,key=lambda k:out[k][-1]),out
if __name__=='__main__':
    for rule in ('lower_bound','mean'):
        print('rule',rule)
        for s in [(0,0,0,0),(2,0,0,0),(3,0,0,0),(5,0,0,0),(2,2,0,0),(5,0,0,2),(5,0,3,0)]:
            pick,o=choose(*s,rule=rule); print(' ',s,'->',pick,o)
    print('sensitivity (rule=mean): consecutive Easy solves before step-up wins')
    for tau in (0.6,0.7,0.8):
        for lam in (0.25,0.5,1.0):
            for kappa in (2,4,8):
                n=next((k for k in range(0,21) if choose(k,0,0,0,tau,kappa,lam)[0]=='medium'),'>20')
                print(f'  tau={tau} lambda={lam} kappa={kappa}: {n}')
