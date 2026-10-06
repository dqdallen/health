const {createRun,getLevel,stageProfiles}=require('../../lib/core.js');
const {SnapshotStore,Coordinator}=require('../../lib/storage.js');
const {view,feedback,profileLabels}=require('../../lib/ui.js');
const {PushupCounter,KneeRaiseCounter,FramePump}=require('../../lib/recognition.js');
const {createDetector}=require('../../recognition/camera-runtime.js');
const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
Page({
 data:{s:null,v:null,fxDamage:0,atHome:true,gameCards:[],showRecords:false,showProbe:false,error:'',profileIndex:0,profiles:['靠墙俯卧撑','地面俯卧撑'],blocked:false,cameraVisible:false,recognitionLoading:false,recognitionMessage:'实验功能，需要配置后真机测试',cameraMode:'diagnostic',probe:'未启动摄像头'},
 store(levelId){return new SnapshotStore({get:k=>wx.getStorageSync(k)||null,set:(k,v)=>wx.setStorageSync(k,v)},levelId==='hearth-01'?'weiguang':'weiguang:'+levelId)},
 loadGame(id){const c=new Coordinator(this.store(id),createRun(uid(),getLevel(id)));this.c=c;this.setData({profileIndex:0,showRecords:false,error:''});this.render()},
 onLoad(){try{this.loadGame('hearth-01')}catch(e){this.setData({error:'记录读取失败，请保留数据：'+e.message})}},
 openGame(e){if(this.c?.blocked)return;this.closeCamera();if(this.c?.blocked)return;try{this.loadGame(e.currentTarget.dataset.level);this.setData({atHome:false,showProbe:false})}catch(e){this.setData({error:'记录读取失败，请保留数据：'+e.message})}},
 selectedProfile(){const s=this.c.state;const profiles=stageProfiles(s.levelId,s.stage+(s.phase==='stageClear'?1:0));return profiles[this.data.profileIndex]||profiles[0]},
 render(){if(this.c){const s=this.c.state,r=s.rounds.find(r=>r.id===s.currentRoundId),profiles=stageProfiles(s.levelId,s.stage+(s.phase==='stageClear'?1:0));const gameCards=['hearth-01','knee-01'].map(id=>{try{const state=id===s.levelId?s:this.store(id).load()||createRun('overview',getLevel(id));return {id,...view(state),description:id==='knee-01'?'抬膝铺路 → 侧抬点灯 → 抬膝抵达':'俯卧撑汇聚微光，解除炉心护盾'}}catch{return {id,gameTitle:id==='knee-01'?'踏光栈道':'炉心守卫',description:'存档需要检查，未清空记录',loadError:true}}});this.setData({s,v:view(s),gameCards,profiles:profiles.map(p=>profileLabels[p]),blocked:this.c.blocked,percent:Math.round(s.damage/s.initialShield*100),profileIndex:r?Math.max(0,profiles.indexOf(r.exerciseProfileId)):Math.min(this.data.profileIndex,profiles.length-1)})}},
 send(cmd){if(!this.c)return false;this.stopFx();const before=this.c.state;try{this.c.dispatch(cmd);this.setData({error:''});this.render();this.emitFx(feedback(before,this.c.state));return true}catch(e){this.setData({error:this.c.blocked?'保存失败，已停止计数。请重试保存。':e.message});this.render();if(this.c.blocked&&wx.pageScrollTo)wx.pageScrollTo({selector:'#save-failure',duration:0});return false}},
 emitFx(fx){if(!fx.damage)return;this.setData({fxDamage:fx.damage});this.fxTimer=setTimeout(()=>this.setData({fxDamage:0}),550)},
 stopFx(){if(this.fxTimer)clearTimeout(this.fxTimer);this.setData({fxDamage:0})},
 profile(e){this.setData({profileIndex:Number(e.detail.value)})},
 start(){return this.send({type:'startRound',roundId:uid(),source:'button',exerciseProfileId:this.selectedProfile()})},
 hit(){if(!this.c)return;const s=this.c.state,r=s.rounds.find(r=>r.id===s.currentRoundId);if(r&&r.source==='button')this.send({type:'action',eventId:uid(),roundId:r.id,inputEpoch:s.inputEpoch,source:r.source,exerciseProfileId:r.exerciseProfileId})},
 pause(){this._stopCamera();this.send({type:'pause'})},async resume(){const r=this.c?.state.rounds.find(r=>r.id===this.c.state.currentRoundId);if(r?.source==='camera'){if(!await this.prepareRecognition())return;if(this.send({type:'resume'}))this.showRecognition()}else this.send({type:'resume'})},end(){this._stopCamera();this.send({type:'endRound'})},async advance(){
  if(!this.c||this.c.blocked||this.c.state.phase!=='stageClear')return;
  let r=this.c.state.rounds.find(r=>r.id===this.c.state.currentRoundId);
  const source=r?.source||'button';if(source==='camera'&&!await this.prepareRecognition())return;
  const nextProfile=this.selectedProfile();
  if(r&&!stageProfiles(this.c.state.levelId,this.c.state.stage+1).includes(r.exerciseProfileId)){if(!this.send({type:'endRound'}))return;r=null;}
  if(!r&&!this.send({type:'startRound',roundId:uid(),source,exerciseProfileId:nextProfile}))return;
  if(this.send({type:'advanceStage'})&&source==='camera')this.showRecognition();
 },
 skill(e){this.send({type:'scheduleSkill',skill:e.currentTarget.dataset.skill})},
 retry(){const before=this.c.state;try{this.c.retry();this.setData({error:''});this.emitFx(feedback(before,this.c.state));const r=this.c.state.rounds.find(r=>r.id===this.c.state.currentRoundId);if(r?.source==='camera'&&this.c.state.phase==='active')this.pause()}catch{this.setData({error:'仍未保存，请保留页面稍后重试。'})}this.render()},
 async prepareRecognition(){
  if(this.detector)return true;if(this.data.recognitionLoading)return false;
  const epoch=this.cameraEpoch||0;this.setData({recognitionLoading:true,error:'',recognitionMessage:'正在加载本地推理模型…'});
  try{const detector=await createDetector();if((this.cameraEpoch||0)!==epoch){detector.dispose();return false}this.detector=detector;return true}catch(e){if((this.cameraEpoch||0)===epoch)this.setData({error:e.message,recognitionMessage:'模型未就绪，未开始计数'});return false}finally{this.setData({recognitionLoading:false})}
 },
 async startCamera(){if(!this.c||this.c.blocked||!['ready','stageClear'].includes(this.c.state.phase)||this.c.state.currentRoundId)return;if(!await this.prepareRecognition())return;const nextStage=this.c.state.phase==='stageClear';if(this.send({type:'startRound',roundId:uid(),source:'camera',exerciseProfileId:this.selectedProfile()})){if(nextStage&&!this.send({type:'advanceStage'}))return;this.showRecognition()}},
 showRecognition(){this._stopCamera();this.setData({cameraVisible:true,cameraMode:'recognition',showProbe:true,recognitionMessage:view(this.c.state).instruction});if(wx.pageScrollTo)wx.pageScrollTo({selector:'#camera-panel',duration:0})},
 openCamera(){if(this.c?.state.phase==='active')this.pause();this._stopCamera();this.setData({cameraVisible:true,cameraMode:'diagnostic',probe:'等待摄像头初始化；不会记录运动次数'})},
 cameraReady(){try{
  const context=wx.createCameraContext();if(!context.onCameraFrame)throw Error('基础库不支持帧回调');const epoch=this.cameraEpoch||0;let frames=0,reported=0,lastFrame=-Infinity;const start=Date.now();
  if(this.data.cameraMode==='recognition'){
   const s=this.c.state,r=s.rounds.find(r=>r.id===s.currentRoundId);if(!r||r.source!=='camera'||!this.detector)throw Error('识别轮次未就绪');
   const standing=['kneeraise.standing','legraise.side'].includes(r.exerciseProfileId);
   const counter=standing?new KneeRaiseCounter(r.exerciseProfileId):new PushupCounter(r.exerciseProfileId);const inputEpoch=s.inputEpoch,roundId=r.id;
   this.pump=new FramePump(this.detector,(points,time)=>{
    if(epoch!==(this.cameraEpoch||0)||this.c.blocked||this.c.state.phase!=='active'||this.c.state.inputEpoch!==inputEpoch||this.c.state.currentRoundId!==roundId)return;
    const result=counter.update(points,time);this.setData({recognitionMessage:result.message+(result.angle===null?'':(standing?' · 外展角 ':' · 肘角 ')+result.angle+'°')});
    if(result.counted){const ok=this.send({type:'action',eventId:uid(),roundId,inputEpoch,source:'camera',exerciseProfileId:r.exerciseProfileId});if(!ok||this.c.state.phase!=='active')this._stopCamera()}
   },e=>{this.closeCamera();this.setData({error:'识别停止：'+e.message,recognitionMessage:'请重试；已保留关卡进度'})});
  }
  this.frameListener=context.onCameraFrame(frame=>{
   if(epoch!==(this.cameraEpoch||0)||!this.data.cameraVisible)return;frames++;const now=Date.now();
   if(this.data.cameraMode==='recognition'&&now-lastFrame>=100){lastFrame=now;this.acceptFrame(frame,now)}
   if(now-reported>=1000){reported=now;this.setData({probe:JSON.stringify({frames,width:frame.width,height:frame.height,elapsedMs:now-start,model:this.data.cameraMode==='recognition'?'movenet-experimental':'not_connected'})})}
  });this.frameListener.start();
 }catch(e){this.closeCamera();this.setData({error:'摄像头启动失败：'+e.message})}},
 acceptFrame(frame,time){return this.pump?.push(frame,time)},
 cameraError(e){this.closeCamera();this.setData({error:'摄像头未就绪：'+(e.detail?.errMsg||'请检查权限与隐私设置')})},
 _stopCamera(){this.cameraEpoch=(this.cameraEpoch||0)+1;this.pump?.stop();this.pump=null;if(this.frameListener){this.frameListener.stop();this.frameListener=null}this.setData({cameraVisible:false})},
 closeCamera(){this._stopCamera();if(this.c?.state.phase==='active'&&!this.c.blocked)this.send({type:'pause'})},
 onHide(){this.stopFx();this.closeCamera();if(this.c?.state.phase==='active'&&!this.c.blocked)this.pause()},onUnload(){this.stopFx();this.closeCamera();this.detector?.dispose();this.detector=null},
 home(){this.closeCamera();if(this.c?.state.phase==='active'&&!this.send({type:'pause'}))return;this.setData({atHome:true})},
 enter(){this.setData({atHome:false})},records(){this.setData({showRecords:!this.data.showRecords})},toggleProbe(){this.setData({showProbe:!this.data.showProbe})},
 help(){wx.showModal({title:'把努力变成微光',content:this.c?.state.levelId==='knee-01'?'抬膝铺路、侧抬点灯、抬膝抵达。左右交替，抬起并放下才计1次。全程正对镜头，让双脚入镜；每段结束暂停并提示下一动作。每次贡献10，每4次获得技能能量。可随时休息，存档与炉心守卫分开。识别阈值待真机校准。':'每次按钮动作贡献10；每4次获得1份能量，最多2份。聚光额外10，散光对两个存活护盾各5。普通攻击击破目标时保留技能。随时休息，分多轮通关。当前按钮模拟不代表真实运动。',showCancel:false})},
 copyDiagnostics(){if(wx.setClipboardData)wx.setClipboardData({data:this.data.probe})}
});
