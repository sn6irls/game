// Static hosts do not always compress GLB responses. Use a lossless gzip copy
// where streaming decompression is available, keeping the plain GLB fallback.
export async function loadModel(loader,url){
 if(typeof DecompressionStream==='undefined')return loader.loadAsync(url);
 try{
  const response=await fetch(url+'.gz');
  if(!response.ok)throw new Error(`Model download: ${response.status}`);
  // A host may already decode the gzip via Content-Encoding.
  const bytes=response.headers.get('content-encoding')?.includes('gzip')
   ?await response.arrayBuffer()
   :await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return await loader.parseAsync(bytes,new URL('.',new URL(url,location.href)).href);
 }catch(error){
  return loader.loadAsync(url);
 }
}
