/* 全屏天气画布：雨雪强度、昼夜、风速和风向都由当前天气驱动。 */
const PRECIPITATION_SCENES = {
 drizzle:{kind:'rain',count:30,length:9,speed:200,alpha:.19},
 lightRain:{kind:'rain',count:65,length:15,speed:350,alpha:.27},
 rain:{kind:'rain',count:115,length:22,speed:480,alpha:.32},
 heavyRain:{kind:'rain',count:205,length:32,speed:690,alpha:.42},
 thunder:{kind:'rain',count:220,length:30,speed:730,alpha:.4},
 lightSnow:{kind:'snow',count:42,length:3,speed:29,alpha:.82},
 snow:{kind:'snow',count:80,length:4,speed:42,alpha:.9},
 heavySnow:{kind:'snow',count:145,length:5,speed:56,alpha:.96}
};
function windLevel(speed){return speed>=50?'strong':speed>=28?'windy':speed>=12?'breezy':'calm'}
function createWeatherAtmosphere(canvas){
 const ctx=canvas.getContext('2d');
 if(!ctx)return {update(){},setEnabled(){},isEnabled:()=>false};
 const media=window.matchMedia('(prefers-reduced-motion: reduce)');
 let enabled=!media.matches,width=0,height=0,dpr=1,frame=0,last=0,time=0;
 let weather={scene:'cloudy',night:false,wind:0,direction:0},particles=[],signature='';
 const stars=Array.from({length:34},(_,i)=>({x:((i*31.57)%100)/100,y:((i*13.1)%49)/100,r:.7+i%3*.45}));
 const random=(min,max)=>min+Math.random()*(max-min);
 function populate(){const config=PRECIPITATION_SCENES[weather.scene];const count=config?Math.round(config.count*(width<560?.58:1)):0;particles=Array.from({length:count},()=>({x:random(0,width),y:random(0,height),size:random(.55,1.4),phase:random(0,Math.PI*2)}));canvas.dataset.kind=config?.kind||'none';canvas.dataset.particles=String(count)}
 function resize(){width=window.innerWidth;height=window.innerHeight;dpr=Math.min(window.devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);populate();draw(0)}
 function cloud(x,y,scale,alpha){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle=weather.night?`rgba(232,224,251,${alpha*.75})`:`rgba(255,255,255,${alpha})`;ctx.beginPath();ctx.ellipse(0,0,65,20,0,0,Math.PI*2);ctx.ellipse(-22,-14,28,25,0,0,Math.PI*2);ctx.ellipse(14,-24,36,32,0,0,Math.PI*2);ctx.ellipse(45,-7,24,22,0,0,Math.PI*2);ctx.fill();ctx.restore()}
 function landscape(){const snowy=(PRECIPITATION_SCENES[weather.scene]?.kind==='snow');ctx.save();ctx.globalAlpha=.24;ctx.fillStyle=snowy?'#bdd5ed':weather.night?'#b8add4':'#d2c9e8';ctx.beginPath();ctx.moveTo(0,height);ctx.lineTo(0,height-65);ctx.bezierCurveTo(width*.22,height-150,width*.45,height-20,width*.63,height-76);ctx.bezierCurveTo(width*.77,height-115,width*.88,height-165,width,height-80);ctx.lineTo(width,height);ctx.closePath();ctx.fill();ctx.globalAlpha=.2;ctx.fillStyle=snowy?'#ffffff':weather.night?'#a9b6d8':'#c5ddd0';ctx.beginPath();ctx.moveTo(0,height);ctx.lineTo(0,height-20);ctx.bezierCurveTo(width*.28,height-95,width*.43,height-40,width*.65,height-30);ctx.bezierCurveTo(width*.8,height-8,width*.91,height-75,width,height-42);ctx.lineTo(width,height);ctx.fill();ctx.restore()}
 function draw(delta){ctx.clearRect(0,0,width,height);landscape();
  if(weather.night){ctx.save();ctx.fillStyle='#fff5d5';for(const s of stars){ctx.globalAlpha=.35+Math.sin(time*.6+s.x*15)*.12;ctx.beginPath();ctx.arc(s.x*width,s.y*height,s.r,0,Math.PI*2);ctx.fill()}ctx.restore()}
  const cloudSpeed=enabled?time*(1+Math.min(weather.wind,70)/14):0;
  cloud(width*.08+Math.sin(cloudSpeed*.055)*25,height*.18,width<560?.75:1.4,.52);
  cloud(width*.93+Math.sin(cloudSpeed*.045+2)*22,height*.1,width<560?1:1.8,.6);
  cloud(width*.02+Math.sin(cloudSpeed*.04+4)*18,height*.62,width<560?.75:1.2,.37);
  if(weather.scene==='fog'){for(let i=0;i<3;i++){const y=height*(.24+i*.26),fog=ctx.createLinearGradient(0,y-80,0,y+80);fog.addColorStop(0,'rgba(255,255,255,0)');fog.addColorStop(.5,'rgba(255,255,255,.55)');fog.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=fog;ctx.fillRect(0,y-80,width,160)}}
  const config=PRECIPITATION_SCENES[weather.scene],wind=Math.min(weather.wind,85);
  const horizontal=Math.sin((weather.direction+180)*Math.PI/180);
  if(config){ctx.save();ctx.lineCap='round';for(const p of particles){if(enabled&&delta){p.y+=config.speed*p.size*delta;p.x+=horizontal*wind*(config.kind==='snow'?2:1.4)*delta;if(config.kind==='snow')p.x+=Math.sin(time+p.phase)*9*delta;if(p.y>height+40){p.y=-35;p.x=random(0,width)}if(p.x< -60)p.x=width+20;if(p.x>width+60)p.x=-20}if(config.kind==='rain'){ctx.globalAlpha=config.alpha;ctx.strokeStyle=weather.night?'#b9b4e0':'#99afd0';ctx.lineWidth=weather.scene==='heavyRain'||weather.scene==='thunder'?1.7:1;const dx=horizontal*wind*.2,dy=config.length*p.size;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+dx,p.y+dy);ctx.stroke()}else{ctx.globalAlpha=config.alpha;ctx.fillStyle='#fff';ctx.strokeStyle='#c8daec';ctx.lineWidth=.5;const r=config.length*p.size;ctx.beginPath();ctx.arc(p.x,p.y,r*.65,0,Math.PI*2);ctx.fill();if(r>4){ctx.strokeStyle='#deebf7';ctx.beginPath();for(let a=0;a<3;a++){const angle=a*Math.PI/3;ctx.moveTo(p.x-Math.cos(angle)*r,p.y-Math.sin(angle)*r);ctx.lineTo(p.x+Math.cos(angle)*r,p.y+Math.sin(angle)*r)}ctx.stroke()}}}ctx.restore()}
  if(wind>=12){ctx.save();ctx.strokeStyle=weather.night?'#cec7e7':'#c3b4d8';ctx.lineWidth=1.3;ctx.lineCap='round';const count=wind>=50?11:wind>=28?7:4;for(let i=0;i<count;i++){const dir=horizontal<-.2?-1:1;const phase=(time*(24+wind*2)+i*width/count)%(width+230);const x=dir===1?phase-160:width+160-phase;const y=height*(.15+(i*.157)% .75);ctx.globalAlpha=.22+wind/350;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+dir*30,y-6,x+dir*70,y+6,x+dir*105,y);ctx.bezierCurveTo(x+dir*125,y-5,x+dir*132,y-20,x+dir*119,y-23);ctx.stroke();if(!config&&i%2===0){ctx.save();ctx.translate(x+dir*55,y+10);ctx.rotate(Math.sin(time+i)*.8);ctx.fillStyle='#bfd2b4';ctx.globalAlpha=.4;ctx.beginPath();ctx.ellipse(0,0,5,2.5,.5,0,Math.PI*2);ctx.fill();ctx.restore()}}ctx.restore()}
 }
 function tick(now){frame=0;if(!enabled||document.hidden)return;const delta=Math.min((now-last)/1000||0,.04);last=now;time+=delta;draw(delta);frame=requestAnimationFrame(tick)}
 function start(){if(frame)cancelAnimationFrame(frame);frame=0;last=performance.now();if(enabled&&!document.hidden)frame=requestAnimationFrame(tick);else draw(0)}
 function setEnabled(value){enabled=!!value;document.body.classList.toggle('motion-paused',!enabled);canvas.dataset.animated=String(enabled);start();return enabled}
 function update(next){weather={...weather,...next};weather.wind=Number.isFinite(weather.wind)?Math.max(0,weather.wind):0;const nextSignature=`${weather.scene}:${width<560}`;if(nextSignature!==signature){signature=nextSignature;populate()}document.body.dataset.wind=windLevel(weather.wind);canvas.dataset.scene=weather.scene;canvas.dataset.wind=String(weather.wind);canvas.dataset.direction=String(weather.direction);document.documentElement.style.setProperty('--wind-motion',String(1+Math.min(weather.wind,60)/20));draw(0);start()}
 window.addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',start);media.addEventListener('change',e=>{setEnabled(!e.matches);document.dispatchEvent(new CustomEvent('weather-motion-change'))});resize();setEnabled(enabled);
 return {update,setEnabled,isEnabled:()=>enabled};
}
