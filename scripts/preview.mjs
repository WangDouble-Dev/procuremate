import http from 'node:http';
import {readFile} from 'node:fs/promises';
http.createServer(async(req,res)=>{const name=req.url?.split('?')[0];if(!['/','/index.html','/app.js'].includes(name)){res.writeHead(404).end();return;}try{const body=await readFile('preview/'+(name==='/app.js'?'app.js':'index.html'));res.writeHead(200,{'Content-Type':name==='/app.js'?'text/javascript':'text/html; charset=utf-8'}).end(body);}catch{res.writeHead(500).end('先运行 npm run build');}}).listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173'));
