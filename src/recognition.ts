/** Experimental side-on repetition detector. Not an exercise-form assessor. */
export interface Keypoint {name?:string;x:number;y:number;score?:number}
export interface CameraFrame {width:number;height:number;data:ArrayBuffer}
export interface Detector<F> {estimate(frame:F):Promise<Keypoint[]>}
export type RecognitionResult={counted:boolean;angle:number|null;message:string};
export class PushupCounter {
 private last=-Infinity;private side='';private candidate='';private stable=0;
 private stage:'seek'|'up'|'down'='seek';private began=0;
 constructor(private profile:'pushup.wall'|'pushup.floor'='pushup.wall'){}
 reset(){this.last=-Infinity;this.side='';this.candidate='';this.stable=0;this.stage='seek';this.began=0}
 update(points:Keypoint[],time:number):RecognitionResult{
  const out=(message:string,angle:number|null=null,counted=false)=>({message,angle,counted});
  if(!Number.isFinite(time)||time<=this.last)return out('等待新画面');
  if(time-this.last>1500){this.stage='seek';this.stable=0;this.candidate=''}this.last=time;
  const arms=['left','right'].map(side=>{const p=['shoulder','elbow','wrist','hip'].map(n=>points.find(p=>p.name===side+'_'+n));return {side,p,score:Math.min(...p.map(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?p.score??0:0))}}).filter(a=>a.score>=.5);
  const arm=arms.find(a=>a.side===this.side)||arms.sort((a,b)=>b.score-a.score)[0];
  if(!arm){this.stage='seek';this.stable=0;this.candidate='';return out('请侧身，让肩、肘、手腕和髋部都进入画面')}
  if(arm.side!==this.side){this.stage='seek';this.stable=0;this.candidate='';this.side=arm.side}
  const [s,e,w,h]=arm.p as [Keypoint,Keypoint,Keypoint,Keypoint];
  const torso=Math.hypot(s.x-h.x,s.y-h.y),horizontal=Math.abs(s.x-h.x);
  if(torso<20||(this.profile==='pushup.floor'?horizontal/torso<.65:horizontal/torso>.65)){this.stage='seek';this.stable=0;return out('请调整侧面机位与运动姿势')}
  const u=[s.x-e.x,s.y-e.y],v=[w.x-e.x,w.y-e.y];const len=Math.hypot(...u)*Math.hypot(...v);
  if(len<100){this.stage='seek';this.stable=0;return out('请靠近一点，让手臂清晰可见')}
  const angle=Math.acos(Math.max(-1,Math.min(1,(u[0]!*v[0]!+u[1]!*v[1]!)/len)))*180/Math.PI;
  const band=angle>=155?'up':angle<=110?'down':'middle';
  this.stable=band===this.candidate?this.stable+1:1;this.candidate=band;
  if(this.stage!=='seek'&&time-this.began>10000){this.stage='seek'}
  if(this.stable>=3){
   if(band==='up'&&this.stage==='seek'){this.stage='up';this.began=time}
   else if(band==='down'&&this.stage==='up'){this.stage='down'}
   else if(band==='up'&&this.stage==='down'){const valid=time-this.began>=600;this.stage='up';this.began=time;return out(valid?'已完成 1 次':'请放慢节奏',Math.round(angle),valid)}
  }
  return out(this.stage==='seek'?'先稳定撑起':this.stage==='up'?'慢慢下降':'再撑起完成一次',Math.round(angle));
 }
}
/** Single in-flight inference; stopped sessions cannot emit late results. */
export class FramePump<F> {
 private busy=false;private stopped=false;
 constructor(private detector:Detector<F>,private result:(points:Keypoint[],time:number)=>void,private error:(error:unknown)=>void){}
 async push(frame:F,time:number){if(this.busy||this.stopped)return;this.busy=true;try{const points=await this.detector.estimate(frame);if(!this.stopped)this.result(points,time)}catch(e){if(!this.stopped)this.error(e)}finally{this.busy=false}}
 stop(){this.stopped=true}
}
const names=['nose','left_eye','right_eye','left_ear','right_ear','left_shoulder','right_shoulder','left_elbow','right_elbow','left_wrist','right_wrist','left_hip','right_hip','left_knee','right_knee','left_ankle','right_ankle'];
export function decodeMoveNet(raw:ArrayLike<number>,width:number,height:number):Keypoint[]{
 if(raw.length!==51||!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0)throw Error('MoveNet 输出或画面尺寸不正确');
 const size=Math.max(width,height),left=Math.floor((size-width)/2),top=Math.floor((size-height)/2);
 return names.map((name,i)=>({name,y:raw[i*3]!*size-top,x:raw[i*3+1]!*size-left,score:raw[i*3+2]!}));
}
