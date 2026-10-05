import {State} from './core.js';
const names=['炉心封印','双生护盾','守卫核心'] as const;
export function view(s:State){
 const round=s.rounds.find(r=>r.id===s.currentRoundId)??s.rounds[s.rounds.length-1];
 const screen=({ready:'ready',active:'battle',paused:'rest',stageClear:'stageClear',complete:'win'} as const)[s.phase];
 return {screen,sourceLabel:round?.source==='camera'?'摄像头识别':'按钮模拟',primary:({ready:'start',active:'hit',paused:'resume',stageClear:'advance',complete:'none'} as const)[s.phase],stage:s.stage+1,stageName:names[s.stage],nextStage:names[s.stage+1]??'',roundActions:round?.actions??0,roundDamage:round?.damage??0,damage:s.damage,totalActions:s.totalActions,roundCount:s.rounds.length,percent:Math.round(s.damage/180*100),activeRound:!!s.currentRoundId,skillLabel:s.scheduledSkill==='focus'?'聚光':s.scheduledSkill==='split'?'散光':'',skills:s.skills,rounds:s.rounds.map((r,i)=>({...r,number:i+1,sourceLabel:r.source==='button'?'按钮模拟':'摄像头识别',profileLabel:r.exerciseProfileId==='pushup.wall'?'靠墙俯卧撑':'地面俯卧撑'})),targets:s.targets.map((t,i)=>({...t,label:s.targets.length===1?'炉心护盾':'护盾 '+(i+1),percent:Math.round(t.hp/t.maxHp*100)}))};
}
export function feedback(previous:State,next:State){return {damage:next.totalActions>previous.totalActions?next.damage-previous.damage:0,stageClear:previous.phase!=='stageClear'&&next.phase==='stageClear',win:previous.phase!=='complete'&&next.phase==='complete'};}
