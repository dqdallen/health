import {State} from './core.js';
export const profileLabels={'pushup.wall':'靠墙俯卧撑','pushup.floor':'地面俯卧撑','kneeraise.standing':'站姿交替抬膝','legraise.side':'站姿交替侧抬腿'};
export function view(s:State){
 const standing=s.levelId==='knee-01';
 const names=standing?['抬膝铺路','侧抬点灯','抬膝抵达']:['炉心封印','双生护盾','守卫核心'];
 const nextStage=s.stage+(s.phase==='stageClear'?1:0);
 const exerciseLabel=standing?profileLabels[nextStage===1?'legraise.side':'kneeraise.standing']:'俯卧撑';
 const round=s.rounds.find(r=>r.id===s.currentRoundId)??s.rounds[s.rounds.length-1];
 const screen=({ready:'ready',active:'battle',paused:'rest',stageClear:'stageClear',complete:'win'} as const)[s.phase];
 return {screen,standing,gameTitle:standing?'踏光栈道':'炉心守卫',islandLabel:standing?'第二座岛':'第一座岛',goalLabel:standing?'栈道微光':'护盾',total:s.initialShield,exerciseLabel,
  instruction:standing?(nextStage===1?'保持正对镜头，双脚站稳后向侧面抬腿、放下；左右交替。':'正对镜头，交替抬膝并放下；每次完整抬起、放下计 1 次。'):'请侧身，让肩、肘、手腕和髋部进入画面。',
  steps:standing?Array.from({length:22},(_,i)=>({number:i+1,lit:s.damage>=(i+1)*10})):[],
  sourceLabel:round?.source==='camera'?'摄像头识别':'按钮模拟',primary:({ready:'start',active:'hit',paused:'resume',stageClear:'advance',complete:'none'} as const)[s.phase],stage:s.stage+1,stageName:names[s.stage],nextStage:names[s.stage+1]??'',roundActions:round?.actions??0,roundDamage:round?.damage??0,damage:s.damage,totalActions:s.totalActions,roundCount:s.rounds.length,percent:Math.round(s.damage/s.initialShield*100),activeRound:!!s.currentRoundId,skillLabel:s.scheduledSkill==='focus'?'聚光':s.scheduledSkill==='split'?'散光':'',skills:s.skills,rounds:s.rounds.map((r,i)=>({...r,number:i+1,sourceLabel:r.source==='button'?'按钮模拟':'摄像头识别',profileLabel:profileLabels[r.exerciseProfileId]})),targets:s.targets.map((t,i)=>({...t,label:standing?(s.targets.length===1?'待点亮栈道':'灯台 '+(i+1)):(s.targets.length===1?'炉心护盾':'护盾 '+(i+1)),percent:Math.round(t.hp/t.maxHp*100)}))};
}
export function feedback(previous:State,next:State){return {damage:next.totalActions>previous.totalActions?next.damage-previous.damage:0,stageClear:previous.phase!=='stageClear'&&next.phase==='stageClear',win:previous.phase!=='complete'&&next.phase==='complete'};}
