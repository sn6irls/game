import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../shared/camera.js',import.meta.url),'utf8');
const {CameraSession}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
Object.defineProperty(globalThis,'isSecureContext',{value:true,configurable:true});
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{}},configurable:true});
globalThis.document={hidden:false};
const constraints={audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280}}};
function media(){
 const track=new EventTarget();track.readyState='live';track.muted=false;track.stop=()=>track.readyState='ended';
 return {getTracks:()=>[track],getVideoTracks:()=>[track]};
}
function video(){
 const v=new EventTarget();Object.assign(v,{srcObject:null,paused:true,videoWidth:0,videoHeight:0,readyState:0,currentTime:0});
 v.setAttribute=()=>{};v.pause=()=>v.paused=true;v.play=()=>{v.paused=false;return Promise.resolve();};return v;
}
test('requests permission synchronously and releases late grants after cancellation',async()=>{
 let grant,calls=0;
 navigator.mediaDevices.getUserMedia=()=>{calls++;return new Promise(resolve=>grant=resolve);};
 const session=new CameraSession(),pending=session.open(constraints);
 assert.equal(calls,1);session.stop();await assert.rejects(pending,{name:'AbortError'});
 const stream=media();grant(stream);await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(stream.getTracks()[0].readyState,'ended');assert.equal(session.stream,null);
});
test('retries transient device failure once with a facing preference and no hard constraints',async()=>{
 const calls=[];navigator.mediaDevices.getUserMedia=c=>{calls.push(c);return calls.length===1?Promise.reject(new DOMException('busy','NotReadableError')):Promise.resolve(media());};
 const session=new CameraSession();await session.open(constraints);
 assert.deepEqual(calls,[constraints,{audio:false,video:{facingMode:{ideal:'environment'}}}]);session.stop();
});
test('does not repeatedly request permission after denial',async()=>{
 let calls=0;navigator.mediaDevices.getUserMedia=()=>{calls++;return Promise.reject(new DOMException('denied','NotAllowedError'));};
 const session=new CameraSession();await assert.rejects(session.open(constraints),{name:'NotAllowedError'});assert.equal(calls,1);assert.equal(session.stream,null);
});
test('waits for dimensions and usable frames, even without loadeddata',async()=>{
 navigator.mediaDevices.getUserMedia=()=>Promise.resolve(media());
 const session=new CameraSession();await session.open(constraints);const v=video();let ready=false;
 const pending=session.attach(v).then(()=>ready=true);await new Promise(resolve=>setTimeout(resolve,20));assert.equal(ready,false);
 Object.assign(v,{videoWidth:640,videoHeight:480,readyState:2});v.dispatchEvent(new Event('resize'));await pending;
 assert.equal(ready,true);assert.equal(v.muted,true);assert.equal(v.defaultMuted,true);assert.equal(v.playsInline,true);session.stop();assert.equal(v.srcObject,null);
});
test('a cancelled startup never interrupts or stops the replacement stream',async()=>{
 const old=media(),current=media();let grant;
 navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>grant=resolve);
 const session=new CameraSession(),first=session.open(constraints);const rejected=assert.rejects(first,{name:'AbortError'});
 navigator.mediaDevices.getUserMedia=()=>Promise.resolve(current);await session.open(constraints);await rejected;
 grant(old);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(old.getTracks()[0].readyState,'ended');assert.equal(current.getTracks()[0].readyState,'live');assert.equal(session.stream,current);session.stop();
});
test('device end stops all resources and notifies once',async()=>{
 const stream=media();navigator.mediaDevices.getUserMedia=()=>Promise.resolve(stream);let interrupted=0;
 const session=new CameraSession(()=>interrupted++);await session.open(constraints);
 stream.getTracks()[0].dispatchEvent(new Event('ended'));stream.getTracks()[0].dispatchEvent(new Event('ended'));
 assert.equal(interrupted,1);assert.equal(stream.getTracks()[0].readyState,'ended');assert.equal(session.stream,null);
});
