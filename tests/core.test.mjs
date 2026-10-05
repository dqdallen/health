import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, reduce, firstLevel, validateState } from '../preview/lib/core.js';

function round(state,id='r1') { return reduce(state,{type:'startRound',roundId:id,source:'button',exerciseProfileId:'pushup.wall'}); }
function hit(state,id,extra={}) {return reduce(state,{type:'action',eventId:id,roundId:state.currentRoundId,inputEpoch:state.inputEpoch,source:'button',exerciseProfileId:'pushup.wall',...extra});}
const run=()=>createRun('run1',firstLevel);

test('fixed authored level totals 180 and user cannot change configuration through state',()=>{
 const state=run(); assert.equal(state.initialShield,180);assert.equal(state.phase,'ready');
 const next=round(state);assert.equal(state.rounds.length,0);assert.equal(next.rounds.length,1);
});
test('authored three-round example resolves to contributions 40 50 90 and 15 actions',()=>{
 let s=round(run());for(let i=1;i<=4;i++)s=hit(s,'a'+i);
 s=reduce(s,{type:'endRound'});s=round(s,'r2');s=reduce(s,{type:'advanceStage'});
 s=reduce(s,{type:'scheduleSkill',skill:'focus'});
 for(let i=5;i<=8;i++)s=hit(s,'a'+i);
 s=reduce(s,{type:'endRound'});s=round(s,'r3');s=reduce(s,{type:'scheduleSkill',skill:'focus'});
 s=hit(s,'a9');assert.equal(s.skills,1);s=reduce(s,{type:'advanceStage'});
 for(let i=10;i<=15;i++){if(i===13)s=reduce(s,{type:'scheduleSkill',skill:'focus'});s=hit(s,'a'+i);}
 assert.equal(s.phase,'complete');assert.equal(s.totalActions,15);assert.deepEqual(s.rounds.map(x=>x.damage),[40,50,90]);
 assert.deepEqual(s.rounds.map(x=>x.actions),[4,4,7]);assert.equal(s.damage,180);assert.equal(s.currentRoundId,null);
});
test('duplicate action is not counted twice even after round sealing',()=>{
 const s=hit(round(run()),'once');assert.equal(hit(s,'once').totalActions,1);
 const ended=reduce(s,{type:'endRound'});assert.deepEqual(hit(ended,'once'),ended);
});
test('pause invalidates old camera callback epochs and rejects mixed input sources',()=>{
 let s=round(run());const old=s.inputEpoch;s=reduce(s,{type:'pause'});s=reduce(s,{type:'resume'});
 assert.throws(()=>hit(s,'stale',{inputEpoch:old}),/epoch/);
 assert.throws(()=>hit(s,'camera',{source:'camera'}),/source/);assert.equal(s.totalActions,0);
});
test('invalid commands do not mutate the old snapshot',()=>{
 let s=round(run());const old=JSON.stringify(s);assert.throws(()=>reduce(s,{type:'scheduleSkill',skill:'focus'}),/skill/);
 assert.equal(JSON.stringify(s),old);assert.throws(()=>hit(s,'x',{roundId:'other'}),/round/);
});
test('damage does not overflow the target or stage and base kill retains scheduled skill',()=>{
 let s=round(run());for(let i=1;i<=4;i++)s=hit(s,'a'+i);
 s=reduce(s,{type:'advanceStage'});s=reduce(s,{type:'scheduleSkill',skill:'focus'});s=hit(s,'a5');
 for(let i=6;i<=8;i++)s=hit(s,'a'+i);
 s=reduce(s,{type:'scheduleSkill',skill:'focus'});s=hit(s,'a9');
 assert.equal(s.skills,1);assert.equal(s.scheduledSkill,'focus');assert.equal(s.phase,'stageClear');
 assert.equal(s.damage,100);assert.throws(()=>hit(s,'tooSoon'),/phase/);
 s=reduce(s,{type:'advanceStage'});s=hit(s,'a10');assert.equal(s.damage,120);
});
test('split skill hits two live targets and records actual capped damage',()=>{
 let s=round(run());for(let i=1;i<=4;i++)s=hit(s,'a'+i);s=reduce(s,{type:'advanceStage'});
 s=reduce(s,{type:'scheduleSkill',skill:'split'});s=hit(s,'a5');
 assert.deepEqual(s.targets.map(x=>x.hp),[15,25]);assert.equal(s.damage,60);
});
test('replaying accepted commands gives the same state and unknown versions are rejected',()=>{
 const cmds=[{type:'startRound',roundId:'r1',source:'button',exerciseProfileId:'pushup.floor'},{type:'pause'},{type:'resume'}];
 assert.deepEqual(cmds.reduce(reduce,run()),cmds.reduce(reduce,run()));
 assert.throws(()=>validateState({...run(),schemaVersion:99}),/version/);
});
