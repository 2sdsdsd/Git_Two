'use strict';
// 使用官方签名 Node 运行服务；只提供页面、天气和地名查询。
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {execFile}=require('node:child_process');
const args=process.argv.slice(2),portIndex=args.indexOf('--port');
const port=portIndex>=0?Number(args[portIndex+1]):8787;
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid port');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'天气查询系统.html'));
const cache=new Map(),pending=new Map();let active=0;
const fields={current:'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',hourly:'temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,is_day,visibility',daily:'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant',timezone:'auto',forecast_days:'7',wind_speed_unit:'kmh'};
function send(res,status,body,type='application/json; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});res.end(body)}
function json(res,status,body){send(res,status,JSON.stringify(body))}
function retrieve(url){
 if(process.platform!=='win32'){
  return fetch(url,{signal:AbortSignal.timeout(20000)}).then(async response=>{
   if(!response.ok)throw new Error(`Weather provider HTTP ${response.status}`);
   return JSON.stringify(await response.json());
  });
 }
 // 使用 Windows 自带的网络组件，兼容本机的系统代理设置。
 const script="$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $weatherResponse=Invoke-WebRequest -UseBasicParsing -Uri $env:GUANTIAN_UPSTREAM -TimeoutSec 20; [Console]::Write($weatherResponse.Content)";
 return new Promise((resolve,reject)=>execFile(path.join(process.env.WINDIR||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:25000,maxBuffer:4*1024*1024,encoding:'utf8',env:{...process.env,GUANTIAN_UPSTREAM:url}},(error,stdout)=>{if(error)return reject(error);try{const data=JSON.parse(stdout.replace(/^\uFEFF/,''));resolve(JSON.stringify(data))}catch(e){reject(e)}}));
}
async function upstream(url,ttl){const hit=cache.get(url);if(hit&&Date.now()<hit.until)return hit.body;if(pending.has(url))return pending.get(url);if(active>=6)throw Object.assign(new Error('Busy'),{status:429});active++;const promise=retrieve(url).then(body=>{if(cache.size>=400){for(const [key,value]of cache)if(value.until<Date.now())cache.delete(key);if(cache.size>=400)cache.clear()}cache.set(url,{body,until:Date.now()+ttl});return body}).finally(()=>{active--;pending.delete(url)});pending.set(url,promise);return promise}
const server=http.createServer(async(req,res)=>{
 try {
  if(req.method!=='GET')return json(res,405,{error:'Only GET is supported'});
  const u=new URL(req.url,'http://localhost');
  if(['/','/index.html','/天气查询系统.html'].includes(decodeURIComponent(u.pathname)))return send(res,200,html,'text/html; charset=utf-8');
  if(u.pathname==='/api/health')return json(res,200,{app:'guantian',version:'2.0.0'});
  if(u.pathname==='/favicon.ico')return send(res,204,'');
  let remote,ttl;
  if(u.pathname==='/api/search'){
   const name=(u.searchParams.get('name')||'').trim();
   if(!name||name.length>80)return json(res,400,{error:'Invalid place name'});
   remote='https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name,count:'10',language:'zh',format:'json'});ttl=3600000;
  }else if(u.pathname==='/api/weather'){
   const lat=Number(u.searchParams.get('latitude')),lon=Number(u.searchParams.get('longitude'));
   if(!u.searchParams.get('latitude')||!u.searchParams.get('longitude')||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return json(res,400,{error:'Invalid coordinates'});
   remote='https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({...fields,latitude:lat,longitude:lon});ttl=300000;
  }else return json(res,404,{error:'Not found'});
  send(res,200,await upstream(remote,ttl));
 }catch(error){
  if(!res.headersSent)json(res,error.status||502,{error:error.status===429?'Busy, please retry':'Weather service unavailable, please retry'});
  else res.end();
 }
});
server.listen(port,'127.0.0.1',()=>{console.log('小刘同学的天气查询系统 v2.0');console.log(`服务地址：http://127.0.0.1:${port}`);if(process.platform==='win32'){console.log('手机公网访问：双击 启动公网访问.cmd');console.log('请保持窗口运行，按 Ctrl+C 停止。');if(!args.includes('--no-browser'))execFile('rundll32.exe',['url.dll,FileProtocolHandler',`http://127.0.0.1:${port}`],{windowsHide:true},()=>{})}else console.log('Linux 服务已启动，通过 Nginx 提供公网访问。')});
server.on('error',error=>{if(error.code==='EADDRINUSE'){http.get(`http://127.0.0.1:${port}/api/health`,res=>{let data='';res.on('data',s=>data+=s);res.on('end',()=>{if(data.includes('guantian')){console.log(`天气服务已在运行：http://127.0.0.1:${port}`);if(process.platform==='win32'&&!args.includes('--no-browser'))execFile('rundll32.exe',['url.dll,FileProtocolHandler',`http://127.0.0.1:${port}`],{windowsHide:true},()=>{})}else console.error('端口被其他程序占用，请更换端口。')})}).on('error',()=>{console.error('服务无法启动，请检查端口。');process.exitCode=1})}else{console.error(error.message);process.exitCode=1}});
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
