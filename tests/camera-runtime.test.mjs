import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('camera preprocessing uses core functions without Tensor chain methods and releases inference tensors',async()=>{
 const calls=[];let inputDisposed=0,outputDisposed=0,modelDisposed=0;
 // Core-only tensors deliberately have no slice/cast/expandDims methods.
 const tensor={dispose(){inputDisposed++}};
 const output={shape:[1,1,17,3],async data(){return new Float32Array(51)}};
 const tf={
  async setBackend(){},async ready(){},removeBackend(){},
  tidy:fn=>fn(),
  tensor3d(data,shape,dtype){calls.push(['tensor3d',shape,dtype]);return tensor},
  slice(value,begin,size){assert.equal(value,tensor);calls.push(['slice',begin,size]);return tensor},
  pad(value,padding){calls.push(['pad',padding]);return tensor},
  image:{resizeBilinear(value,size){calls.push(['resize',size]);return tensor}},
  cast(value,dtype){calls.push(['cast',dtype]);return tensor},
  expandDims(value,axis){calls.push(['expandDims',axis]);return tensor},
  dispose(value){assert.equal(value,output);outputDisposed++}
 };
 const model={async executeAsync(value){assert.equal(value,tensor);return output},dispose(){modelDisposed++}};
 const modules={
  './config.js':{enabled:true,modelUrl:'https://example.com/model.json'},
  './model-access.js':{modelLoadOptions:()=>({})},
  '../lib/recognition.js':{decodeMoveNet:()=>['decoded']},
  '@tensorflow/tfjs-core':tf,
  '@tensorflow/tfjs-backend-webgl':{},
  '@tensorflow/tfjs-converter':{loadGraphModel:async()=>model},
  'fetch-wechat':{fetchFunc:()=>()=>{}}
 };
 const context={module:{exports:{}},require:name=>modules[name],requirePlugin:()=>({configPlugin(){}}),wx:{createOffscreenCanvas:()=>({})},Date,Uint8Array};
 vm.runInNewContext(readFileSync('miniprogram/recognition/camera-runtime.js','utf8'),context);
 const detector=await context.module.exports.createDetector();
 assert.deepEqual(await detector.estimate({width:2,height:1,data:new ArrayBuffer(8)}),['decoded']);
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
  ['tensor3d',[1,2,4],'int32'],['slice',[0,0,0],[1,2,3]],
  ['pad',[[0,1],[0,0],[0,0]]],['resize',[192,192]],
  ['cast','int32'],['expandDims',0]
 ]);
 assert.equal(inputDisposed,1);assert.equal(outputDisposed,1);
 detector.dispose();assert.equal(modelDisposed,1);
});
