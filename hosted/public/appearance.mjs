/** Persisted appearance preference; system changes are live, explicit choices override them. */
export const APPEARANCE_KEY='algorithm-mastery.appearance.v1';
export function normalizeAppearance(value){return ['system','light','dark'].includes(value)?value:'light';}
export function installAppearance({onChange=()=>{}}={}){
 const media=matchMedia('(prefers-color-scheme: dark)');let mode='light';try{mode=normalizeAppearance(localStorage.getItem(APPEARANCE_KEY));}catch{}
 const apply=()=>{const effective=mode==='system'?(media.matches?'dark':'light'):mode;document.documentElement.dataset.theme=effective;document.documentElement.style.colorScheme=effective;onChange(mode,effective);};
 const set=value=>{mode=normalizeAppearance(value);try{localStorage.setItem(APPEARANCE_KEY,mode);}catch{}apply();return mode;};
 media.addEventListener('change',apply);window.addEventListener('storage',event=>{if(event.key===APPEARANCE_KEY){mode=normalizeAppearance(event.newValue);apply();}});apply();return {set,get:()=>mode};
}
