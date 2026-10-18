'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const PORT=Number(process.env.PORT||3000),ROOT=__dirname,DATA_DIR=path.resolve(process.env.DATA_DIR||path.join(ROOT,'data'));
const DB=path.join(DATA_DIR,'store.json'),STATIC=ROOT;fs.mkdirSync(DATA_DIR,{recursive:true});let db={users:{},sessions:{}};try{const x=JSON.parse(fs.readFileSync(DB,'utf8'));if(x.users&&x.sessions)db=x;}catch(e){if(e.code!=='ENOENT')console.warn('No se pudo cargar el almacén:',e.message);}
const now=()=>Date.now(),uid=()=>crypto.randomUUID(),safe=s=>String(s??'').trim(),has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function save(){const tmp=DB+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db),{mode:0o600});fs.renameSync(tmp,DB);}
function error(msg,status=400){return Object.assign(new Error(msg),{status});}
function passwordHash(p,salt=crypto.randomBytes(16).toString('hex')){return {salt,hash:crypto.scryptSync(p,salt,64).toString('hex')};}
function checkPassword(p,u){const got=crypto.scryptSync(p,u.salt,64);return crypto.timingSafeEqual(got,Buffer.from(u.hash,'hex'));}
function send(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
async function body(req){let chunks=[],size=0;for await(const c of req){size+=c.length;if(size>1_800_000)throw error('Archivo o solicitud demasiado grande.',413);chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}')}catch{throw error('JSON inválido.')}}
function cookies(req){const all={};for(const part of String(req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0)all[part.slice(0,i).trim()]=part.slice(i+1).trim();}return all;}
function auth(req){const token=cookies(req).mpsession,session=token&&db.sessions[crypto.createHash('sha256').update(token).digest('hex')];if(!session||session.expires<now())throw error('Inicia sesión para continuar.',401);const user=db.users[session.uid];if(!user)throw error('Sesión inválida.',401);return {user,token};}
function setCookie(res,token,clear=false){res.setHeader('Set-Cookie',`mpsession=${clear?'':token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear?0:2592000}${process.env.NODE_ENV==='production'?'; Secure':''}`);}
function createSession(res,user){const token=crypto.randomBytes(32).toString('hex');db.sessions[crypto.createHash('sha256').update(token).digest('hex')]={uid:user.id,expires:now()+30*864e5};setCookie(res,token);save();}
const models={
 pantry:['name','quantity','unit','category','minQuantity','expiry','price','location'],
 purchases:['name','quantity','unit','price','purchased','date','toPantry'],
 recipes:['name','ingredients','instructions','portions','minutes','calories','protein','carbs','fat','favorite'],
 meals:['date','type','name','quantity','calories','protein','carbs','fat','satiety','notes','photo'],
 plans:['date','type','name','calories','notes'],
 weights:['date','weight','notes'],
 measures:['date','zone','cm','notes'],
 habits:['date','activity','sleep','energy','notes'],
 shopping:['name','quantity','unit','estimatedPrice','checked'],
};
const max={name:140,unit:24,category:40,expiry:20,location:60,instructions:3000,ingredients:3500,date:20,type:40,satiety:40,notes:650,zone:50,activity:140,energy:40,photo:1_400_000};
function cleanRecord(type,record){if(!models[type]||!record||typeof record!=='object'||Array.isArray(record))throw error('Registro inválido.');const out={};for(const k of models[type]){if(!has(record,k))continue;let v=record[k];if(typeof v==='string')v=v.slice(0,max[k]||100);if(typeof v==='number'&&(!Number.isFinite(v)||Math.abs(v)>1e8))throw error('Cantidad inválida.');if(typeof v!=='string'&&typeof v!=='number'&&typeof v!=='boolean')throw error('Tipo de dato inválido.');out[k]=v;}if(!Object.keys(out).length)throw error('Completa los datos.');return out;}
const foods=[['Arroz blanco cocido',130,2.7,28,0.3],['Pechuga de pollo cocida',165,31,0,3.6],['Huevo',143,12.6,0.7,9.5],['Avena seca',389,16.9,66.3,6.9],['Banano',89,1.1,22.8,0.3],['Yogur griego natural',97,9,3.9,5],['Leche entera',61,3.2,4.8,3.3],['Papa cocida',87,1.9,20.1,0.1],['Plátano maduro',122,1.3,31.9,0.4],['Fresa',32,0.7,7.7,0.3],['Zanahoria',41,0.9,9.6,0.2],['Atún en agua',116,25.5,0,0.8],['Carne molida cocida',250,26,0,15],['Tortilla integral',300,9,50,7],['Chía',486,16.5,42.1,30.7]].map(([name,calories,protein,carbs,fat])=>({name,calories,protein,carbs,fat}));
const seedRecipes=[{name:'Avena fría con yogur y banano',ingredients:'40 g de avena\n120 g de yogur griego\n1 banano pequeño\n1 cucharadita de chía',instructions:'Mezcla los ingredientes y refrigera. Ajusta las cantidades a tu apetito.',portions:1,minutes:10},{name:'Arroz con pollo y zanahoria',ingredients:'Arroz cocido, pechuga, zanahoria y aceite al gusto',instructions:'Dora la pechuga, saltea la zanahoria y sirve con tu porción habitual de arroz.',portions:1,minutes:35},{name:'Tortilla integral con huevos',ingredients:'1 tortilla integral\n2 huevos\nMortadela de pollo al gusto',instructions:'Cocina los huevos en sartén y arma la tortilla.',portions:1,minutes:15}];
function publicUser(u){return {id:u.id,email:u.email,profile:u.profile,collections:u.collections,createdAt:u.createdAt};}
const attempts=new Map();function limit(req){const key=req.socket.remoteAddress||'local',t=now(),arr=(attempts.get(key)||[]).filter(x=>t-x<600000);if(arr.length>=20)throw error('Demasiados intentos. Espera unos minutos.',429);arr.push(t);attempts.set(key,arr);}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
 try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/')){
 if(req.method==='POST'){const origin=req.headers.origin;if(origin&&new URL(origin).host!==req.headers.host)throw error('Origen no permitido.',403);if(!String(req.headers['content-type']||'').startsWith('application/json'))throw error('Solo se acepta JSON.',415);}
 if(req.method==='GET'&&url.pathname==='/api/health')return send(res,200,{ok:true});
 if(req.method==='POST'&&url.pathname==='/api/register'){limit(req);const b=await body(req),email=safe(b.email).toLowerCase(),password=String(b.password||'');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>180)throw error('Ingresa un correo válido.');if(password.length<10||password.length>128)throw error('La contraseña debe tener entre 10 y 128 caracteres.');if(Object.values(db.users).some(x=>x.email===email))throw error('Esta cuenta ya existe.');const p=passwordHash(password),u={id:uid(),email,...p,createdAt:now(),profile:{name:'',budget:80000,goal:'bajar de peso',activity:1.2},collections:Object.fromEntries(Object.keys(models).map(k=>[k,[]]))};u.collections.recipes=seedRecipes.map(r=>({id:uid(),...r}));db.users[u.id]=u;createSession(res,u);return send(res,201,{user:publicUser(u)});}
 if(req.method==='POST'&&url.pathname==='/api/login'){limit(req);const b=await body(req),u=Object.values(db.users).find(x=>x.email===safe(b.email).toLowerCase());if(!u||!checkPassword(String(b.password||''),u))throw error('Correo o contraseña incorrectos.',401);createSession(res,u);return send(res,200,{user:publicUser(u)});}
 if(req.method==='POST'&&url.pathname==='/api/logout'){const t=cookies(req).mpsession;if(t)delete db.sessions[crypto.createHash('sha256').update(t).digest('hex')];setCookie(res,'',true);save();return send(res,200,{ok:true});}
 const {user}=auth(req);if(req.method==='GET'&&url.pathname==='/api/me')return send(res,200,{user:publicUser(user),foods});
 if(req.method==='POST'&&url.pathname==='/api/profile'){const b=await body(req),allowed=['name','age','sex','weight','height','target','activity','exercise','budget','goal'];for(const k of allowed)if(has(b,k)){const v=b[k];if(typeof v!=='string'&&typeof v!=='number')throw error('Dato de perfil inválido.');user.profile[k]=typeof v==='string'?v.slice(0,100):v;}save();return send(res,200,{user:publicUser(user)});}
 const hit=url.pathname.match(/^\/api\/records\/(pantry|purchases|recipes|meals|plans|weights|measures|habits|shopping)(?:\/([a-f0-9-]{36}))?$/);if(hit){const [,type,id]=hit,list=user.collections[type];if(req.method==='POST'&&!id){const rec={id:uid(),...cleanRecord(type,await body(req)),createdAt:now()};list.push(rec);save();return send(res,201,{record:rec});}if(id){const i=list.findIndex(x=>x.id===id);if(i<0)throw error('Registro no encontrado.',404);if(req.method==='PUT'){list[i]={...list[i],...cleanRecord(type,await body(req))};save();return send(res,200,{record:list[i]});}if(req.method==='DELETE'){list.splice(i,1);save();return send(res,200,{ok:true});}}}
 throw error('Ruta no encontrada.',404);
 }
 if(req.method!=='GET')throw error('Método no permitido.',405);
 let item;try{item=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);}catch{throw error('Ruta inválida.');}
 const file=path.resolve(STATIC,'.'+item);if(!file.startsWith(STATIC+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())throw error('Página no encontrada.',404);
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);
 }catch(e){send(res,e.status||500,{error:e.status?e.message:'Error interno del servidor.'});}});
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log(`Mi Plan Alimentario en puerto ${PORT}`));module.exports={server,foods};
