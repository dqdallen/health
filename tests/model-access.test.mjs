import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {modelLoadOptions}=require('../miniprogram/recognition/model-access.js');
const modelUrl='https://bucket.cos.ap-shanghai.myqcloud.com/movenet/model.json?q-signature=model';
test('private model weights use their own signatures unchanged',async()=>{
 const url='https://bucket.cos.ap-shanghai.myqcloud.com/movenet/group.bin?q-signature=weight&x-cos-security-token=a%2Fb';
 const options=modelLoadOptions({modelUrl,weightUrls:{'group.bin':url}});
 assert.equal(await options.weightUrlConverter('group.bin'),url);
});
test('missing private weight authorization stops loading',()=>{
 const options=modelLoadOptions({modelUrl,weightUrls:{}});
 assert.throws(()=>options.weightUrlConverter('missing.bin'),/missing.bin/);
});
test('weight links must use HTTPS',()=>{
 const options=modelLoadOptions({modelUrl,weightUrls:{'group.bin':'http://example.com/group.bin'}});
 assert.throws(()=>options.weightUrlConverter('group.bin'),/HTTPS/);
});
test('existing public model URLs retain relative weight loading',()=>{
 assert.deepEqual(modelLoadOptions({modelUrl:'https://example.com/model.json'}),{});
});
