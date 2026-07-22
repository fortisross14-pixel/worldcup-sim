import { ALL_NATIONS } from '../data/nations.js'

export function wcYear(wcNumber=1){ return 1930 + (Math.max(1,wcNumber)-1)*4 }
export function formatForYear(year){
  if(year < 1982) return {teams:16, groups:4, knockout:8, label:'16 teams · 4 groups'}
  if(year < 1998) return {teams:24, groups:6, knockout:16, label:'24 teams · 6 groups'}
  if(year < 2026) return {teams:32, groups:8, knockout:16, label:'32 teams · 8 groups'}
  return {teams:48, groups:12, knockout:32, label:'48 teams · 12 groups'}
}

const BASE_WEIGHTS = { top:10, mid:4, rest:1 }
function weightedPick(pool, weightFn){
  const total=pool.reduce((s,x)=>s+Math.max(.01,weightFn(x)),0)
  let r=Math.random()*total
  for(const x of pool){ r-=Math.max(.01,weightFn(x)); if(r<=0)return x }
  return pool[pool.length-1]
}

export function ensureEra(state){
  const eraIndex=Math.floor((Math.max(1,state.wcNumber)-1)/5)
  if(state.era?.index===eraIndex && state.era.powers?.length) return state.era
  const previous=new Set(state.era?.powers?.map(p=>p.name)||[])
  const count=3+Math.floor(Math.random()*3)
  const available=[...ALL_NATIONS]
  const powers=[]
  while(powers.length<count && available.length){
    const pick=weightedPick(available,n=>{
      const base=BASE_WEIGHTS[n.tier]||1
      const prestige=1+Math.min(3,(n.hist||0)/100)
      const repeat=previous.has(n.name)?.55:1
      const momentum=(state.history||[]).slice(-3).some(h=>['Winner','Final','Third','Fourth','Semi-finals'].includes(h.roundReached?.[n.name]))?1.35:1
      return base*prestige*repeat*momentum
    })
    powers.push({name:pick.name,cc:pick.cc,boost:5+Math.floor(Math.random()*6)})
    available.splice(available.indexOf(pick),1)
  }
  state.era={index:eraIndex,startWC:eraIndex*5+1,endWC:eraIndex*5+5,powers}
  return state.era
}
export function eraPower(state,nationName){ return ensureEra(state).powers.find(p=>p.name===nationName)||null }
export function eraStarMultiplier(state,nationName){ return eraPower(state,nationName)?2.4:1 }
