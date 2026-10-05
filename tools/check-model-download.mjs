import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const config=require('../miniprogram/recognition/config.js');
const files={'model.json':config.modelUrl,...config.weightUrls};
const hash=data=>createHash('sha256').update(data).digest('hex');
await Promise.all(Object.entries(files).map(async([name,url])=>{
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
  if(!response.ok){console.log(`${name}: HTTP ${response.status}`);process.exitCode=1;return;}
  const data=Buffer.from(await response.arrayBuffer());
  const local=readFileSync(new URL('../models/movenet-lightning-v4/'+name,import.meta.url));
  const matches=hash(data)===hash(local);
  console.log(`${name}: ${data.length} bytes, matches local=${matches}`);
  if(!matches)process.exitCode=1;
 }catch{console.log(`${name}: network or local file check failed`);process.exitCode=1;}
}));
