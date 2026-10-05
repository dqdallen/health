// COS signatures authorize individual objects, not a directory of weights.
function modelLoadOptions(config){
 const urls=config.weightUrls;
 const privateUrl=/[?&]q-signature=/i.test(config.modelUrl||'');
 if(!urls&&!privateUrl)return {};
 return {weightUrlConverter(path){
  const url=urls&&Object.prototype.hasOwnProperty.call(urls,path)?urls[path]:null;
  if(typeof url!=='string'||!url)throw Error('缺少权重文件的临时下载链接：'+path);
  if(!/^https:\/\//.test(url))throw Error('权重下载链接必须使用 HTTPS：'+path);
  return url;
 }};
}
module.exports={modelLoadOptions};
