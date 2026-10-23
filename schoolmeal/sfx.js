(()=>{
 'use strict';
 let ctx,master,enabled=false,group='reaction';const voices=new Set(),epochs={},buffers=new Map(),pending=new Map();
 const files={start:'시작.MP3',click:'클릭.MP3',wink:'윙크.MP3',dehet:'데헷.MP3',surprise:'당황.MP3',sad:'눈물.MP3',angry:'화남.mp3',disgust:'극혐.MP3',reset:'다시주기.mp3',impact1:'떨어지는소리1.MP3',impact2:'떨어지는소리2.MP3',impact3:'떨어지는소리3.MP3'};
 const raw=new Map(Object.entries(files).map(([key,file])=>[key,fetch('assets/sound/'+encodeURIComponent(file)).then(r=>{if(!r.ok)throw Error(file);return r.arrayBuffer()}).catch(()=>null)]));
 const stats={last:null,counts:{}};let impactIndex=0;
 function stop(which){for(const key of ['reaction','ui','start','impact','drop'])if(!which||key===which)epochs[key]=(epochs[key]||0)+1;for(const v of [...voices])if(!which||v.mealGroup===which){try{v.stop()}catch{}}}
 function load(key){if(!pending.has(key))pending.set(key,raw.get(key).then(b=>b?ctx.decodeAudioData(b.slice(0)):null).then(b=>{if(b)buffers.set(key,b);return b}).catch(()=>null));return pending.get(key);}
 function unlock(){try{if(!ctx){ctx=new(window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=.5;const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-12;limiter.ratio.value=5;master.connect(limiter).connect(ctx.destination);Object.keys(files).forEach(load);}return ctx.resume().catch(()=>{});}catch{return Promise.resolve();}}
 async function sample(key,{volume=.65,rate=1,max=Infinity,bus='reaction'}={}){
  if(!enabled||!ctx)return;const token=epochs[bus]||0,buffer=await load(key);if(document.hidden)return;await ctx.resume().catch(()=>{});
  if(!buffer||!ready()||token!==(epochs[bus]||0))return;
  const source=ctx.createBufferSource(),gain=ctx.createGain(),at=ctx.currentTime+.005,duration=Math.min(buffer.duration/rate,max);
  source.buffer=buffer;source.playbackRate.value=rate;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.008);gain.gain.setValueAtTime(volume,at+Math.max(.009,duration-.07));gain.gain.linearRampToValueAtTime(0,at+duration);
  source.connect(gain).connect(master);source.mealGroup=bus;track(source,[gain],at,at+duration);mark('sample-'+key);
 }
 function ready(){return enabled&&ctx?.state==='running'&&!document.hidden;}
 function track(source,nodes,at,end){source.mealGroup=source.mealGroup||group;voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();nodes.forEach(n=>n.disconnect());};source.start(at);source.stop(end);}
 function ramp(param,values,at,duration){param.setValueAtTime(values[0],at);for(let i=1;i<values.length;i++)param.linearRampToValueAtTime(values[i],at+duration*i/(values.length-1));}
 function envelope(gain,at,duration,volume){gain.setValueAtTime(0,at);gain.linearRampToValueAtTime(volume,at+Math.min(.025,duration*.2));gain.exponentialRampToValueAtTime(.0001,at+duration);}
 function tone(freq,duration,volume=.15,delay=0,type='sine',vibrato=0){const at=ctx.currentTime+.01+delay,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;ramp(o.frequency,freq,at,duration);envelope(g.gain,at,duration,volume);o.connect(g).connect(master);const nodes=[g];if(vibrato){const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.frequency.value=11;depth.gain.value=vibrato;lfo.connect(depth).connect(o.frequency);track(lfo,[depth],at,at+duration+.02);}track(o,nodes,at,at+duration+.02);}
 // Formant-filtered cartoon syllables, not recorded speech.
 function vowel(pitches,duration,formants,volume=.45,delay=0,wobble=0){const at=ctx.currentTime+.01+delay,o=ctx.createOscillator(),g=ctx.createGain();o.type='sawtooth';ramp(o.frequency,pitches,at,duration);envelope(g.gain,at,duration,volume);g.connect(master);const nodes=[g];for(const [i,values] of formants.entries()){const f=ctx.createBiquadFilter(),level=ctx.createGain();f.type='bandpass';f.Q.value=i?5:3;ramp(f.frequency,values,at,duration);level.gain.value=i?.38:1;o.connect(f).connect(level).connect(g);nodes.push(f,level);}if(wobble){const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.frequency.value=6;depth.gain.value=wobble;lfo.connect(depth).connect(o.frequency);track(lfo,[depth],at,at+duration+.02);}track(o,nodes,at,at+duration+.03);}
 function noise(duration,volume,delay=0){const at=ctx.currentTime+.01+delay,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1);const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=1300;filter.Q.value=.8;envelope(g.gain,at,duration,volume);source.connect(filter).connect(g).connect(master);track(source,[filter,g],at,at+duration);}
 function mark(name){stats.last=name;stats.counts[name]=(stats.counts[name]||0)+1;}
 function expression(i){if(i===9){stop('reaction');return;}if(!ready())return;if(i===0){stop('reaction');return;}if(i!==1)stop('reaction');mark('expression-'+i);
 switch(i){
 case 1:tone([1550,1150],.045,.025);break;
 case 2:sample('wink');break;
 case 3:
  // Cascading glass chimes with faint bell overtones and a trailing shimmer.
  [1568,2093,2637,3136,4186,3136,2637,4186].forEach((n,j)=>{
   const at=j*.052,level=j<5?.095:.065;
   tone([n*1.003,n],.68,level,at);
   tone([Math.min(n*2.76,7600),Math.min(n*2.76,7600)],.19,.014,at);
   tone([n,n],.48,level*.23,at+.16);
  });break;
 case 4:sample('dehet');break;
 case 5:sample('surprise');break;
 case 6:noise(.12,.06);vowel([430,650,580,390,280],1.05,[[380,700,750],[1500,1900,1700]],.65,.06,22);sample('sad',{volume:.48});break;
 case 7:sample('angry',{volume:.28,rate:.96,max:.85});break;
 case 8:sample('disgust',{volume:.6});break;
 }
 }
 function drop(){if(!ready())return;mark('drop');group='drop';tone([1050,730,280,155],.38,.16,0,'sine',12);noise(.23,.045,.025);tone([520,230],.13,.11,.27);group='reaction';}
 function reset(){if(!enabled)return;stop('reaction');mark('reset');sample('reset',{volume:.55,max:2});}
 function impact(){if(!enabled)return;impactIndex=impactIndex%3+1;mark('impact-'+impactIndex);sample('impact'+impactIndex,{volume:.8,bus:'impact'});}
 window.MealSFX=Object.freeze({start(){enabled=true;unlock();sample('start',{volume:.6,bus:'start'});},expression,drop,reset,impact,snapshot:()=>({enabled,running:ctx?.state==='running',active:voices.size,loaded:[...buffers.keys()],impactIndex,last:stats.last,counts:{...stats.counts}})});
 document.addEventListener('click',e=>{if(e.isTrusted&&e.target.closest('button')&&(enabled||e.target.closest('#startGame'))){enabled=true;unlock();sample('click',{volume:.38,max:.4,bus:'ui'});}},true);
 const gesture=e=>{if(e.isTrusted&&(e.type!=='keydown'||['Enter','Space'].includes(e.code)))unlock();};document.addEventListener('pointerdown',gesture,true);document.addEventListener('keydown',gesture,true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();ctx?.suspend().catch(()=>{});}else if(enabled)ctx?.resume().catch(()=>{});});window.addEventListener('pagehide',()=>{stop();ctx?.suspend().catch(()=>{});});
})();
