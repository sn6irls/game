import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const clockSource=fs.readFileSync(new URL('../music/js/playback-clock.js',import.meta.url),'utf8');
const {playbackTime}=await import('data:text/javascript;base64,'+Buffer.from(clockSource).toString('base64'));
const scope={};vm.runInNewContext(fs.readFileSync(new URL('../shared/audio.js',import.meta.url),'utf8'),scope);
const {sampleGain,measure}=scope.GameAudio;
const cameraSource=fs.readFileSync(new URL('../frame/camera-settings.js',import.meta.url),'utf8');
const {cameraConstraints}=await import('data:text/javascript;base64,'+Buffer.from(cameraSource).toString('base64'));
test('desktop webcams use a native landscape request without a hard frame-rate constraint',()=>{
 const desktop=cameraConstraints('user',false,true);
 assert.equal(desktop.audio,false);
 assert.deepEqual(desktop.video.width,{ideal:1280});
 assert.deepEqual(desktop.video.height,{ideal:720});
 assert.equal(desktop.video.frameRate,undefined);
 assert.equal(desktop.video.aspectRatio,undefined);
 const mobile=cameraConstraints('user',false);
 assert.deepEqual(mobile.video.aspectRatio,{ideal:.75});
 assert.deepEqual(mobile.video.frameRate,{ideal:24});
});
test('valid output timestamps retain audio/visual synchronization',()=>{
 assert.equal(playbackTime({currentTime:10,getOutputTimestamp:()=>({contextTime:9.9,performanceTime:1000})},1050),9.950000000000001);
});
test('Safari-style wrong scale, stale, missing and throwing timestamps never freeze the playhead',()=>{
 for(const stamp of [{contextTime:.001,performanceTime:61000},{contextTime:.01,performanceTime:1000},{contextTime:10000,performanceTime:1000},{contextTime:NaN,performanceTime:1000},{contextTime:9.9},null]){
  const value=playbackTime({currentTime:10,baseLatency:.02,getOutputTimestamp:()=>stamp},1050);
  assert.equal(value,9.98);
 }
 assert.equal(playbackTime({currentTime:10,outputLatency:.03,getOutputTimestamp(){throw Error('device interrupted');}},1050),9.97);
 assert.equal(playbackTime(null),0);
});
function buffer(amplitude,tail=0,impulse=false){
 const data=new Float32Array(4800+tail);for(let i=0;i<4800;i++)data[i]=amplitude*Math.sin(i*.1);
 if(impulse)data[100]=1;
 return {sampleRate:48000,numberOfChannels:1,length:data.length,getChannelData:()=>data};
}
test('different source levels converge to the same active RMS',()=>{
 const quiet=buffer(.03),loud=buffer(.4);
 assert.ok(Math.abs(measure(quiet).rms*sampleGain(quiet)-measure(loud).rms*sampleGain(loud))<1e-6);
 assert.ok(sampleGain(quiet)>sampleGain(loud));
});
test('silence, long silent tails and sharp peaks cannot cause excessive gain',()=>{
 assert.equal(sampleGain(buffer(0)),0);
 assert.equal(sampleGain(buffer(.1)),sampleGain(buffer(.1,48000)));
 const transient=buffer(.01,0,true);assert.ok(sampleGain(transient)*measure(transient).peak<=.7);
 assert.ok(sampleGain(buffer(.0001))<=8);
});
test('normalized samples preserve the waveform and stereo source data',()=>{
 const b=buffer(.05),before=b.getChannelData().slice();sampleGain(b);assert.deepEqual(b.getChannelData(),before);
});
