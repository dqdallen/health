/** Pure game rules: no renderer, device, network or storage dependency. */
export type Source = 'button' | 'camera';
export type Profile = 'pushup.wall' | 'pushup.floor';
export type Skill = 'focus' | 'split';
export type Phase = 'ready' | 'active' | 'paused' | 'stageClear' | 'complete';
export interface Level { id: string; version: number; stages: readonly (readonly number[])[] }
export const firstLevel: Level = Object.freeze({id:'hearth-01',version:1,stages:Object.freeze([Object.freeze([40]),Object.freeze([30,30]),Object.freeze([80])])});
export interface Round { id:string; source:Source; exerciseProfileId:Profile; actions:number; damage:number; sealed:boolean }
export interface State {
 schemaVersion:1; rulesVersion:1; levelId:string; levelVersion:number; runId:string;
 phase:Phase; stage:number; targets:{hp:number;maxHp:number}[]; initialShield:number;
 damage:number; totalActions:number; skills:number; scheduledSkill:Skill|null;
 rounds:Round[]; currentRoundId:string|null; inputEpoch:number; eventIds:string[];
}
export type Command =
 | {type:'startRound';roundId:string;source:Source;exerciseProfileId:Profile}
 | {type:'action';eventId:string;roundId:string;inputEpoch:number;source:Source;exerciseProfileId:Profile}
 | {type:'scheduleSkill';skill:Skill}
 | {type:'pause'|'resume'|'endRound'|'advanceStage'};
function requireThat(ok:unknown,message:string):asserts ok {if(!ok)throw new Error(message);}
export function createRun(runId:string,level:Level=firstLevel):State {
 requireThat(runId.length>0,'run id');requireThat(level.id===firstLevel.id&&level.version===1&&JSON.stringify(level.stages)===JSON.stringify(firstLevel.stages),'level version');
 return {schemaVersion:1,rulesVersion:1,levelId:level.id,levelVersion:level.version,runId,phase:'ready',stage:0,targets:[{hp:40,maxHp:40}],initialShield:180,damage:0,totalActions:0,skills:0,scheduledSkill:null,rounds:[],currentRoundId:null,inputEpoch:0,eventIds:[]};
}
export function reduce(state:State,cmd:Command):State {
 validateState(state);
 if(cmd.type==='action'&&state.eventIds.includes(cmd.eventId))return state;
 const s:State=JSON.parse(JSON.stringify(state));
 const current=()=>{const r=s.rounds.find(r=>r.id===s.currentRoundId);requireThat(r&&!r.sealed,'round');return r;};
 const seal=()=>{if(s.currentRoundId)current().sealed=true;s.currentRoundId=null;s.inputEpoch++;};
 switch(cmd.type){
 case 'startRound':
  requireThat(!s.currentRoundId&&s.phase!=='complete','round already active or complete');
  requireThat(cmd.roundId&& !s.rounds.some(r=>r.id===cmd.roundId),'round id');
  requireThat(['button','camera'].includes(cmd.source),'source');
  requireThat(['pushup.wall','pushup.floor'].includes(cmd.exerciseProfileId),'profile');
  s.rounds.push({id:cmd.roundId,source:cmd.source,exerciseProfileId:cmd.exerciseProfileId,actions:0,damage:0,sealed:false});s.currentRoundId=cmd.roundId;s.inputEpoch++;
  if(s.phase==='ready')s.phase='active';break;
 case 'action': {
  const r=current();requireThat(cmd.roundId===r.id,'round');requireThat(cmd.inputEpoch===s.inputEpoch,'epoch');
  requireThat(cmd.source===r.source&&cmd.exerciseProfileId===r.exerciseProfileId,'source/profile');requireThat(s.phase==='active','phase');requireThat(cmd.eventId,'event id');
  const target=s.targets.find(t=>t.hp>0);requireThat(target,'target');
  let damage=0;const hit=(t:{hp:number},n:number)=>{const dealt=Math.min(t.hp,n);t.hp-=dealt;damage+=dealt;};
  hit(target,10);
  // An ordinary hit that defeats its target keeps the skill for a later action.
  if(target.hp>0&&s.scheduledSkill){
   if(s.scheduledSkill==='focus')hit(target,10);
   else {const alive=s.targets.filter(t=>t.hp>0);for(const t of alive)hit(t,alive.length===1?10:5);}
   s.skills--;s.scheduledSkill=null;
  }
  s.eventIds.push(cmd.eventId);s.totalActions++;s.damage+=damage;r.actions++;r.damage+=damage;
  if(s.totalActions%4===0)s.skills=Math.min(2,s.skills+1);
  if(s.targets.every(t=>t.hp===0)){if(s.stage===2){s.phase='complete';seal();}else s.phase='stageClear';}
  break; }
 case 'scheduleSkill':current();requireThat(s.phase==='active','phase');requireThat(s.skills>0&&['focus','split'].includes(cmd.skill),'skill');s.scheduledSkill=cmd.skill;break;
 case 'pause':current();requireThat(s.phase==='active','phase');s.phase='paused';s.inputEpoch++;break;
 case 'resume':current();requireThat(s.phase==='paused','phase');s.phase='active';s.inputEpoch++;break;
 case 'endRound':current();seal();if(s.phase==='active'||s.phase==='paused')s.phase='ready';break;
 case 'advanceStage':current();requireThat(s.phase==='stageClear','phase');s.stage++;s.targets=firstLevel.stages[s.stage]!.map(hp=>({hp,maxHp:hp}));s.phase='active';s.inputEpoch++;break;
 default:throw new Error('command');
 }
 validateState(s);return s;
}
export function validateState(value:unknown):asserts value is State {
 const s=value as State;requireThat(s&&s.schemaVersion===1&&s.rulesVersion===1&&s.levelId===firstLevel.id&&s.levelVersion===1,'version');
 const integer=(n:unknown)=>Number.isSafeInteger(n)&&(n as number)>=0;
 requireThat(typeof s.runId==='string'&&s.runId.length>0&&integer(s.stage)&&s.stage<=2,'state identity');
 requireThat(['ready','active','paused','stageClear','complete'].includes(s.phase),'state phase');
 requireThat(integer(s.damage)&&s.damage<=180&&s.initialShield===180&&integer(s.totalActions)&&integer(s.inputEpoch)&&integer(s.skills)&&s.skills<=2,'state totals');
 requireThat(s.scheduledSkill===null||(['focus','split'].includes(s.scheduledSkill)&&s.skills>0),'state skill');
 const hp=firstLevel.stages[s.stage]!;
 requireThat(Array.isArray(s.targets)&&s.targets.length===hp.length&&s.targets.every((t,i)=>t.maxHp===hp[i]&&integer(t.hp)&&t.hp<=t.maxHp),'state targets');
 const previous=firstLevel.stages.slice(0,s.stage).flat().reduce((a,b)=>a+b,0);
 requireThat(s.damage===previous+s.targets.reduce((a,t)=>a+t.maxHp-t.hp,0),'state damage');
 requireThat(Array.isArray(s.eventIds)&&s.eventIds.every(id=>typeof id==='string'&&id.length>0)&&new Set(s.eventIds).size===s.eventIds.length&&s.eventIds.length===s.totalActions,'state events');
 requireThat(Array.isArray(s.rounds)&&new Set(s.rounds.map(r=>r.id)).size===s.rounds.length&&s.rounds.every(r=>typeof r.id==='string'&&r.id.length>0&&['button','camera'].includes(r.source)&&['pushup.wall','pushup.floor'].includes(r.exerciseProfileId)&&integer(r.actions)&&integer(r.damage)&&typeof r.sealed==='boolean'),'state rounds');
 requireThat(s.rounds.reduce((a,r)=>a+r.damage,0)===s.damage&&s.rounds.reduce((a,r)=>a+r.actions,0)===s.totalActions,'state round totals');
 requireThat(s.currentRoundId===null||typeof s.currentRoundId==='string','state round id');
 requireThat(s.rounds.filter(r=>!r.sealed).length===(s.currentRoundId?1:0)&&(!s.currentRoundId||s.rounds.some(r=>r.id===s.currentRoundId&&!r.sealed)),'state active round');
 requireThat(!['active','paused'].includes(s.phase)||s.currentRoundId!==null,'state phase round');
 const cleared=s.targets.every(t=>t.hp===0);
 requireThat((s.phase==='stageClear')===(cleared&&s.stage<2)&& (s.phase==='complete')===(s.damage===180),'state completion');
 requireThat(s.phase!=='complete'||s.currentRoundId===null,'state complete round');
}
