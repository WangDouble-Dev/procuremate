import {build} from 'esbuild';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
await mkdir('lib',{recursive:true});
await copyFile('src/index.mjs','lib/index.js');
const r=await build({entryPoints:['src/client.jsx'],bundle:true,format:'cjs',platform:'browser',external:['react','react/jsx-runtime'],write:false,minify:true,loader:{'.css':'text'}});
await writeFile('lib/client.js',`window.__ModuleLoader__.load({id:"dsh-procurement-workbench",factory:(require)=>{var module={exports:{}};var exports=module.exports;\n${r.outputFiles[0].text}\nreturn module.exports;}});`);
await build({entryPoints:['src/preview.jsx'],bundle:true,format:'esm',platform:'browser',outfile:'preview/app.js',loader:{'.css':'text'}});
await copyFile('src/preview.html','preview/index.html');
