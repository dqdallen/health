const config=require('./config.js');
const {modelLoadOptions}=require('./model-access.js');
const {decodeMoveNet}=require('../lib/recognition.js');
async function createDetector(){
 if(!config.enabled||!/^https:\/\/.+\/model\.json(?:\?.*)?$/.test(config.modelUrl))throw Error('识别尚未配置：请按 docs/recognition.md 启用插件并设置模型地址');
 const tf=require('@tensorflow/tfjs-core');
 const webgl=require('@tensorflow/tfjs-backend-webgl');
 const {loadGraphModel}=require('@tensorflow/tfjs-converter');
 const fetchWechat=require('fetch-wechat');
 const plugin=requirePlugin('tfjsPlugin');
 const backendName='wechat-webgl-'+Date.now();
 plugin.configPlugin({tf,webgl,fetchFunc:fetchWechat.fetchFunc(),canvas:wx.createOffscreenCanvas({type:'webgl',width:192,height:192}),backendName});
 await tf.setBackend(backendName);await tf.ready();
 let model;try{model=await loadGraphModel(config.modelUrl,modelLoadOptions(config))}catch(e){tf.removeBackend(backendName);throw e}
 let active=0,disposed=false,cleaned=false;
 const clean=()=>{if(disposed&&!active&&!cleaned){cleaned=true;model.dispose();tf.removeBackend(backendName)}};
 return {
  async estimate(frame){
   if(disposed)throw Error('识别会话已关闭');
   const {width,height,data}=frame;
   if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||data.byteLength!==width*height*4)throw Error('摄像头帧格式不是 RGBA');
   active++;let input,output;
   try{
    const size=Math.max(width,height),top=Math.floor((size-height)/2),left=Math.floor((size-width)/2);
    input=tf.tidy(()=>{
     const rgba=tf.tensor3d(new Uint8Array(data),[height,width,4],'int32');
     const rgb=tf.slice(rgba,[0,0,0],[height,width,3]);
     const square=tf.pad(rgb,[[top,size-height-top],[left,size-width-left],[0,0]]);
     const resized=tf.image.resizeBilinear(square,[192,192]);
     return tf.expandDims(tf.cast(resized,'int32'),0);
    });
    output=await model.executeAsync(input);
    const tensors=Array.isArray(output)?output:output&&typeof output.data==='function'?[output]:Object.values(output);
    if(tensors.length!==1||tensors[0].shape.join(',')!=='1,1,17,3')throw Error('需要 MoveNet SinglePose Lightning 的 TFJS GraphModel');
    return decodeMoveNet(await tensors[0].data(),width,height);
   }finally{if(input)input.dispose();if(output)tf.dispose(output);active--;clean()}
  },
  dispose(){disposed=true;clean()}
 };
}
module.exports={createDetector};
