import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createStorage,createStorageHandler,API_PATH} from '../src/storage.mjs';
const storage=createStorage({...(process.env.PROCUREMENT_CONFIG_PATH?{configPath:process.env.PROCUREMENT_CONFIG_PATH}:{}),...(process.env.PROCUREMENT_DATA_DIR?{dataDir:process.env.PROCUREMENT_DATA_DIR}:{})});
const handler=createStorageHandler(storage),port=Number(process.env.PORT||4173);
const server=http.createServer(async(req,res)=>{const name=req.url?.split('?')[0];if(name===API_PATH){await handler(req,res);return;}if(!['/','/index.html','/app.js'].includes(name)){res.writeHead(404).end();return;}try{const body=await readFile('preview/'+(name==='/app.js'?'app.js':'index.html'));res.writeHead(200,{'Content-Type':name==='/app.js'?'text/javascript':'text/html; charset=utf-8','Cache-Control':'no-store'}).end(body);}catch{res.writeHead(500).end('先运行 npm run build');}});
server.listen(port,'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port));
