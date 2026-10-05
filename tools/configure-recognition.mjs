import {readFileSync,writeFileSync} from 'node:fs';
const args=process.argv.slice(2),get=key=>args[args.indexOf(key)+1];
const appid=args.includes('--appid')?get('--appid'):'',modelUrl=args.includes('--model')?get('--model'):'';
const version=args.includes('--plugin-version')?get('--plugin-version'):'0.2.0';
if(!/^wx[0-9a-f]{16}$/.test(appid)||!/^https:\/\/.+\/model\.json(?:\?.*)?$/.test(modelUrl)||!/^\d+\.\d+\.\d+$/.test(version)){
 console.error('用法：npm run configure:recognition -- --appid wx你的AppID --model https://你的域名/movenet/model.json --plugin-version 后台可用版本');process.exit(1);
}
const app=JSON.parse(readFileSync('miniprogram/app.json','utf8'));app.plugins={...app.plugins,tfjsPlugin:{version,provider:'wx6afed118d9e81df9'}};
const project=JSON.parse(readFileSync('project.config.json','utf8'));project.appid=appid;
writeFileSync('miniprogram/app.json',JSON.stringify(app,null,2)+'\n');writeFileSync('project.config.json',JSON.stringify(project,null,2)+'\n');
writeFileSync('miniprogram/recognition/config.js','// Experimental local inference configuration; no camera frames are uploaded.\nmodule.exports='+JSON.stringify({enabled:true,modelUrl},null,2)+';\n');
console.log('识别配置已写入。仍需在微信后台添加插件、配置模型域名与隐私声明，并在开发者工具构建 npm 后真机验证。');
