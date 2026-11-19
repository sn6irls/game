// Validate deploy URLs, including case on GitHub Pages' case-sensitive filesystem.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),games=['desktop','frame','music','schoolmeal','kimchibingsumaker'];
let urls=0,scripts=0;
function existsExactly(file){
 const relative=path.relative(root,file);
 if(relative.startsWith('..'))throw Error('Asset outside deployment root: '+file);
 let current=root;
 for(const part of relative.split(path.sep)){
  if(!fs.readdirSync(current).includes(part))throw Error('Missing or wrong-case asset: '+relative);
  current=path.join(current,part);
 }
 urls++;
}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const game of games)for(const file of walk(path.join(root,game))){
 if(file.includes(path.sep+'vendor'+path.sep))continue;
 const ext=path.extname(file);if(!['.html','.css','.js','.mjs','.cjs'].includes(ext))continue;
 const text=fs.readFileSync(file,'utf8');
 if(['.js','.mjs','.cjs'].includes(ext)){execFileSync(process.execPath,['--check',file],{stdio:'pipe'});scripts++;}
 const re=ext==='.html'?/(?:src|href)="([^"<>]+)"/g:ext==='.css'?/url\(["']?([^"')]+)["']?\)/g:/\b(?:from\s+|import\s*\()["'](\.[^"']+)["']/g;
 for(const match of text.matchAll(re)){
  const ref=match[1];if(/^(?:[a-z]+:|\/\/|#)|[${}]/i.test(ref))continue;
  existsExactly(path.resolve(path.dirname(file),decodeURIComponent(ref.split(/[?#]/)[0])));
 }
}
existsExactly(path.join(root,'shared/audio.js'));
console.log(`PASS: ${scripts} source scripts parse; ${urls} local asset/module URLs exist with exact case.`);
