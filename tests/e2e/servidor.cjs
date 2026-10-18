const http=require('http'),fs=require('fs'),path=require('path');const root=process.env.WEB_DIR ?? 'dist';
const types={'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.ico':'image/x-icon','.png':'image/png','.ttf':'font/ttf'};
http.createServer((q,r)=>{let p=path.join(root,decodeURIComponent(q.url.split('?')[0]));if(!fs.existsSync(p)||fs.statSync(p).isDirectory())p=path.join(root,'index.html');r.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(r);}).listen(8099,'127.0.0.1');
