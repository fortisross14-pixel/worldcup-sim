import { ovr, getEffStats } from './match.js'

const RIVALRIES = new Set([
  'Argentina|Brazil','Argentina|England','Argentina|Uruguay','Brazil|Uruguay','England|Germany','England|Scotland',
  'France|Germany','France|Spain','Germany|Italy','Netherlands|Germany','Portugal|Spain','Mexico|United States',
  'Japan|South Korea','Morocco|Spain','Croatia|Serbia','Chile|Peru','Algeria|Egypt'
])
const pair=(a,b)=>[a,b].sort().join('|')
export function meetings(history,a,b){
  const games=[]
  ;(history||[]).forEach(h=>(h.matches||h.topGames||[]).forEach(m=>{if(pair(m.t1name||m.t1,m.t2name||m.t2)===pair(a,b))games.push(m)}))
  return games
}
export function previewStory(state,t1,t2,round){
  const r1=ovr(getEffStats(t1,true)), r2=ovr(getEffStats(t2,true)); const gap=Math.abs(r1-r2)
  const rivalry=RIVALRIES.has(pair(t1.name,t2.name)); const prior=meetings(state.history,t1.name,t2.name); const last=prior.at(-1)
  let headline='A PLACE IN HISTORY', body=`${t1.name} and ${t2.name} meet in the ${round}.`
  if(rivalry){headline='A DESPERATE RIVALRY';body=`Old enemies collide with a place in the next round at stake.`}
  if(round.includes('Final')){headline='THE WORLD AWAITS';body=`Everything comes down to one match.`}
  else if(round.includes('Semi')){headline='ONE STEP FROM GLORY';body=`Two nations stand ninety minutes from the final.`}
  else if(round.includes('Quarter') && Math.min(r1,r2)>=82){headline='THE BIG CLASH';body=`Two tournament heavyweights collide earlier than expected.`}
  else if(gap>=12){headline='GIANT AGAINST DREAMER';body=`${r1>r2?t1.name:t2.name} are clear favourites, but knockout football has ruined stronger teams before.`}
  const fav=gap<3?'The bookmakers can barely separate them.':`${r1>r2?t1.name:t2.name} enter as slight favourites.`
  const memory=last?` Their last recorded meeting ended ${last.g1}–${last.g2}.`:''
  return {headline,body:`${body} ${fav}${memory}`}
}
export function resultStory(r,round){
  const margin=Math.abs(r.g1-r.g2), total=r.g1+r.g2, winner=r.g1>r.g2?r.t1:r.t2, loser=winner===r.t1?r.t2:r.t1
  let headline=`${winner?.name||'Nobody'} ADVANCE`, body=`${r.t1.name} ${r.g1}–${r.g2} ${r.t2.name}.`
  if(r.penalties){headline='NERVES OF STEEL';body=`${winner.name} survive a penalty shootout after a match that refused to choose a winner.`}
  else if(margin>=3){headline=`${winner.name.toUpperCase()} OVERWHELM ${loser.name.toUpperCase()}`;body=`A statement victory, far easier than expected.`}
  else if(total>=6 && margin<=1){headline='AN INSTANT CLASSIC';body=`Seven shades of chaos in one of the tournament’s great shootouts.`}
  else if(r.extraTime){headline='DECIDED AT THE EDGE';body=`Extra time finally separated two exhausted sides.`}
  else if(r.g1===r.g2){headline='NOTHING BETWEEN THEM';body=`Neither side could find the decisive moment.`}
  return {headline,body}
}
