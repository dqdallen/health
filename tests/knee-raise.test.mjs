import test from 'node:test';
import assert from 'node:assert/strict';
import {KneeRaiseCounter} from '../preview/lib/recognition.js';
import {createRun,reduce,kneeRaiseLevel,validateState} from '../preview/lib/core.js';
import {SnapshotStore,Coordinator} from '../preview/lib/storage.js';
import {view} from '../preview/lib/ui.js';
function points(raised=''){
 return ['left','right'].flatMap((side,i)=>[
  {name:side+'_shoulder',x:100+i*100,y:100,score:1},
  {name:side+'_hip',x:100+i*100,y:200,score:1},
  {name:side+'_knee',x:100+i*100,y:raised===side?210:300,score:1},
  {name:side+'_ankle',x:100+i*100,y:raised===side?290:400,score:1}
 ]);
}
function stream(counter){let time=0;return (pose,n=3)=>{let counted=0;for(let i=0;i<n;i++){time+=150;counted+=Number(counter.update(pose,time).counted)}return counted}}
test('knee raise counts a complete lift and return, alternates sides, and held poses do not repeat',()=>{
 const feed=stream(new KneeRaiseCounter());assert.equal(feed(points(),3),0);
 assert.equal(feed(points('left'),6),0);assert.equal(feed(points()),1);
 assert.equal(feed(points(),6),0);assert.equal(feed(points('left'),6),0);assert.equal(feed(points()),0);
 assert.equal(feed(points('right'),6),0);assert.equal(feed(points()),1);
});
test('occlusion and reset cannot combine incomplete knee raises',()=>{
 const counter=new KneeRaiseCounter(),feed=stream(counter);
 feed(points());feed(points('left'));feed([]);assert.equal(feed(points()),0);
 feed(points('right'));counter.reset();assert.equal(feed(points()),0);
});
test('shallow lifts and crouching do not count',()=>{
 const feed=stream(new KneeRaiseCounter());feed(points());
 const shallow=points().map(p=>p.name==='left_knee'?{...p,y:260}:p);
 feed(shallow,6);assert.equal(feed(points()),0);
 const crouch=points().map(p=>p.name.endsWith('_knee')?{...p,y:210}:p);
 feed(crouch,6);assert.equal(feed(points()),0);
});
function sidePose(side=''){
 return points().map(p=>{
  if(p.name===side+'_knee')return {...p,x:p.x+(side==='left'?-55:55),y:280};
  if(p.name===side+'_ankle')return {...p,x:p.x+(side==='left'?-110:110),y:360};
  return p;
 });
}
test('side raises use straight leg abduction rather than knee lifts and alternate sides',()=>{
 const feed=stream(new KneeRaiseCounter('legraise.side'));feed(sidePose());
 feed(points('left'),6);assert.equal(feed(sidePose()),0);
 feed(sidePose('left'),6);assert.equal(feed(sidePose()),1);
 feed(sidePose('left'),6);assert.equal(feed(sidePose()),0);
 feed(sidePose('right'),6);assert.equal(feed(sidePose()),1);
});
test('stale frames and long gaps cancel partial standing repetitions',()=>{
 const c=new KneeRaiseCounter();c.update(points(),100);c.update(points(),250);c.update(points(),400);
 c.update(points('left'),550);c.update(points('left'),700);c.update(points('left'),850);
 assert.equal(c.update(points(),850).counted,false);
 for(let t=3000;t<=3300;t+=150)assert.equal(c.update(points(),t).counted,false);
});
test('crossing a leg inward does not count as a side raise',()=>{
 const feed=stream(new KneeRaiseCounter('legraise.side'));feed(sidePose());
 const inward=sidePose('left').map(p=>p.name==='left_knee'||p.name==='left_ankle'?{...p,x:200-p.x}:p);
 feed(inward,6);assert.equal(feed(sidePose()),0);
});
test('new knee raise level has distinct targets and profile without changing hearth saves',()=>{
 const original=createRun('old');validateState(original);assert.equal(original.initialShield,180);
 let s=createRun('new',kneeRaiseLevel);assert.equal(s.initialShield,220);
 assert.throws(()=>reduce(s,{type:'startRound',roundId:'wrong',source:'button',exerciseProfileId:'pushup.wall'}),/profile/);
 s=reduce(s,{type:'startRound',roundId:'one',source:'button',exerciseProfileId:'kneeraise.standing'});
 for(let i=0;s.phase!=='complete';i++){
  if(s.phase==='stageClear'){
   s=reduce(s,{type:'endRound'});
   s=reduce(s,{type:'startRound',roundId:'stage'+i,source:'button',exerciseProfileId:s.stage===0?'legraise.side':'kneeraise.standing'});
   s=reduce(s,{type:'advanceStage'});
  }
  const r=s.rounds.find(r=>r.id===s.currentRoundId);
  s=reduce(s,{type:'action',eventId:String(i),roundId:r.id,inputEpoch:s.inputEpoch,source:'button',exerciseProfileId:r.exerciseProfileId});
 }
 assert.equal(s.totalActions,22);assert.equal(s.damage,220);assert.equal(view(s).percent,100);
 assert.equal(view(s).gameTitle,'踏光栈道');
 assert.deepEqual(s.rounds.map(r=>r.exerciseProfileId),['kneeraise.standing','legraise.side','kneeraise.standing']);
});
test('separate game storage preserves existing progress and restores the correct game',()=>{
 const data=new Map(),io={get:key=>data.get(key)??null,set:(key,value)=>data.set(key,value)};
 const old=new Coordinator(new SnapshotStore(io),createRun('hearth'));
 old.dispatch({type:'startRound',roundId:'h',source:'button',exerciseProfileId:'pushup.wall'});
 old.dispatch({type:'action',eventId:'h1',roundId:'h',inputEpoch:old.state.inputEpoch,source:'button',exerciseProfileId:'pushup.wall'});
 const knees=new Coordinator(new SnapshotStore(io,'weiguang:knee-01'),createRun('knees',kneeRaiseLevel));
 assert.equal(knees.state.totalActions,0);
 assert.equal(new Coordinator(new SnapshotStore(io),createRun('reopen')).state.damage,10);
 assert.throws(()=>new Coordinator(new SnapshotStore(io),createRun('wrong',kneeRaiseLevel)),/level/);
});
