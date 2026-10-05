import {State,Command,reduce,validateState} from './core.js';
export interface StorageIO {get(key:string):string|null;set(key:string,value:string):void}
interface Envelope {formatVersion:1;seq:number;checksum:string;state:State}
// Accidental corruption detection, not authentication or anti-cheat.
function checksum(text:string):string {let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return (hash>>>0).toString(16);}
export class SnapshotStore {
 constructor(private io:StorageIO,private prefix='weiguang'){}
 private read():Envelope|null {
  const valid:Envelope[]=[];let present=false;
  for(const slot of ['A','B']){
   const raw=this.io.get(this.prefix+':'+slot);if(raw===null)continue;present=true;
   let e:Envelope;try{e=JSON.parse(raw);}catch{continue;}
   if(e?.formatVersion!==undefined&&e.formatVersion!==1)throw new Error('storage version');
   if(e?.state?.schemaVersion!==undefined&&e.state.schemaVersion!==1)throw new Error('state version');
   try{if(e.formatVersion!==1||!Number.isSafeInteger(e.seq)||e.seq<1||checksum(JSON.stringify(e.state))!==e.checksum)continue;validateState(e.state);valid.push(e);}catch(error){if(error instanceof Error&&error.message==='version')throw error;}
  }
  if(present&&!valid.length)throw new Error('corrupt snapshots; preserve records');
  return valid.sort((a,b)=>b.seq-a.seq)[0]??null;
 }
 load():State|null {return this.read()?.state??null;}
 save(state:State):void {
  validateState(state);const seq=(this.read()?.seq??0)+1;
  const e:Envelope={formatVersion:1,seq,checksum:checksum(JSON.stringify(state)),state};
  this.io.set(this.prefix+':'+(seq%2?'A':'B'),JSON.stringify(e));
 }
}
export class Coordinator {
 state:State;blocked=false;private pending:State|null=null;
 constructor(private store:SnapshotStore,initial:State){
  const saved=store.load();this.state=saved??initial;validateState(this.state);
  if(this.state.phase==='active')this.commit(reduce(this.state,{type:'pause'}));
 }
 private commit(candidate:State):void {
  try{this.store.save(candidate);this.state=candidate;this.pending=null;this.blocked=false;}
  catch(error){this.pending=candidate;this.blocked=true;throw error;}
 }
 dispatch(command:Command):void {if(this.blocked)throw new Error('storage blocked; retry required');this.commit(reduce(this.state,command));}
 retry():void {if(this.pending)this.commit(this.pending);}
}
