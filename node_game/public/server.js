import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import crypto from "crypto";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const PHP_API_BASE = (process.env.PHP_API_BASE || "").replace(/\/+$/,""); // set to your PHP service base url

const app = express();
app.use(express.json({limit:"1mb"}));
app.use(express.static("public"));

// Proxy /api/* -> PHP to avoid CORS
async function proxyToPhp(req, res){
  if(!PHP_API_BASE) return res.status(503).json({error:"PHP_API_BASE not set"});
  const url = PHP_API_BASE + req.originalUrl;
  const init = { method: req.method, headers: {"content-type":"application/json"} };
  if(req.method !== "GET" && req.method !== "HEAD"){
    init.body = JSON.stringify(req.body ?? {});
  }
  try{
    const r = await fetch(url, init);
    const txt = await r.text();
    res.status(r.status);
    try{ res.json(JSON.parse(txt)); }catch{ res.send(txt); }
  }catch(e){
    res.status(502).json({error:"Proxy failed", detail:String(e)});
  }
}
app.all("/api/*", proxyToPhp);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

function uuid(){ return crypto.randomUUID(); }
function token(){ return crypto.randomBytes(16).toString("hex"); }
function nowHHMM(){ return new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}); }
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function normName(s){ return (s||"").toString().trim().replace(/\s+/g," ").slice(0,24); }
function nameTaken(room, name, exceptPlayerToken=null){
  const n=name.toLowerCase();
  return room.players.some(p=>p.name.toLowerCase()===n && p.playerToken!==exceptPlayerToken);
}
function makeRoomCode(){
  const a="ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let c=""; for(let i=0;i<5;i++) c+=a[Math.floor(Math.random()*a.length)];
  return c;
}

function buildDeck(players, modeKey){
  const boom = players-1;
  const defuse = Math.max(8, Math.ceil(players));
  const base = modeKey==="space"
    ? [["RADAR",8],["TOC",6],["DICH",6],["TAN3",5],["NGUOC",6],["BIEN",12],["RAC",20]]
    : [["SOI",8],["XAO",6],["NE",8],["DAO",6],["CUOPN",8],["TAN2",5],["COMBO",10],["RAC",20]];
  const deck=[];
  base.forEach(([k,n])=>{ for(let i=0;i<n;i++) deck.push({key:k,id:uuid()}); });
  const boomPool = Array.from({length:boom},()=>({key:"BOOM",id:uuid()}));
  const defusePool = Array.from({length:defuse},()=>({key:"DEFUSE",id:uuid()}));
  shuffle(deck);
  return {deck, boomPool, defusePool};
}
function nextAliveIndex(players, from, step){
  const n=players.length; let idx=from;
  for(let t=0;t<n;t++){
    idx=(idx+step+n)%n;
    if(players[idx].alive) return idx;
  }
  return from;
}

// PHP API helpers
async function apiPost(path, body){
  if(!PHP_API_BASE) return null;
  try{
    const r = await fetch(PHP_API_BASE + path, {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify(body||{})});
    const j = await r.json().catch(()=>null);
    return {status:r.status, json:j};
  }catch{ return null; }
}
async function persistUpsertPlayer(p){
  await apiPost("/api/player_upsert.php", {player_token:p.playerToken, display_name:p.name});
}
async function persistRoom(room){
  await apiPost("/api/room_upsert.php", {
    room_code: room.code,
    mode: room.modeKey,
    status: room.started ? "started" : "open",
    players_count: room.players.length,
    started: room.started ? 1 : 0
  });
}
async function persistMatchStart(room){
  const players = room.players.map(p=>({player_token:p.playerToken, display_name:p.name}));
  const resp = await apiPost("/api/match_start.php", {room_code:room.code, mode:room.modeKey, players});
  if(resp?.json?.match_id) room.matchId = resp.json.match_id;
}
async function persistMatchEnd(room){
  if(!room.matchId) return;
  const alive = room.players.filter(p=>p.alive);
  const winnerToken = alive.length===1 ? alive[0].playerToken : null;

  const ordered = [...room.players].sort((a,b)=>{
    if(a.playerToken===winnerToken) return -1;
    if(b.playerToken===winnerToken) return 1;
    if(a.exploded && !b.exploded) return 1;
    if(!a.exploded && b.exploded) return -1;
    return 0;
  });
  const results = ordered.map((p,idx)=>({
    player_token:p.playerToken,
    display_name:p.name,
    placement: idx+1,
    exploded: !!p.exploded
  }));
  await apiPost("/api/match_end.php", {match_id:room.matchId, results});
  await apiPost("/api/room_close.php", {room_code: room.code});
}

const rooms=new Map();
const clients=new Map();

function publicState(room){
  return {
    code: room.code,
    hostPlayerToken: room.hostPlayerToken,
    modeKey: room.modeKey,
    started: room.started,
    direction: room.direction,
    turnIndex: room.turnIndex,
    deckCount: room.deck.length,
    log: room.log.slice(0,80),
    turnDeadline: room.turnDeadline,
    players: room.players.map(p=>({
      playerToken:p.playerToken, name:p.name, alive:p.alive, handCount:p.hand.length, mustDraw:p.mustDraw,
      connected: !!clients.get(p.wsId)
    }))
  };
}
function send(ws,obj){ if(ws && ws.readyState===1) ws.send(JSON.stringify(obj)); }
function sendToWsId(wsId,obj){ send(clients.get(wsId), obj); }
function broadcast(room,obj){ room.players.forEach(p=>sendToWsId(p.wsId,obj)); }
function sendPrivate(room, playerToken, obj){
  const p = room.players.find(x=>x.playerToken===playerToken);
  if(p) sendToWsId(p.wsId,obj);
}
function log(room,msg,cls=""){ room.log.unshift({t:nowHHMM(),msg,cls}); }
function currentPlayer(room){ return room.players[room.turnIndex]; }

function sync(room){
  broadcast(room,{type:"state",state:publicState(room)});
  room.players.forEach(p=>sendToWsId(p.wsId,{type:"hand",hand:p.hand,youToken:p.playerToken}));
  if(room.pending) sendPrivate(room, room.pending.forPlayerToken, {type:"prompt", prompt: room.pending});
  persistRoom(room);
}
function deal(room){
  room.players.forEach(p=>{p.hand=[];p.alive=true;p.mustDraw=1;p.exploded=false;});
  room.players.forEach(p=>p.hand.push(room.defusePool.pop()));
  for(let r=0;r<7;r++) room.players.forEach(p=>p.hand.push(room.deck.pop()));
  room.deck.push(...room.defusePool, ...room.boomPool);
  room.defusePool=[]; room.boomPool=[];
  shuffle(room.deck);
}

const TURN_SECONDS=20;
function stopTurnTimer(room){ if(room.turnTimer){ clearInterval(room.turnTimer); room.turnTimer=null; } }
function startOrResetTurnTimer(room){
  room.turnDeadline = Date.now() + TURN_SECONDS*1000;
  if(room.turnTimer) return;
  room.turnTimer = setInterval(()=>{
    if(!room.started) return;
    if(room.pending) return;
    const p = currentPlayer(room);
    if(!p || !p.alive) return;
    if(room.turnDeadline - Date.now() > 0) return;
    actDraw(room, p.playerToken, true);
  }, 500);
}
function announceNextDrawer(room){
  const p=currentPlayer(room);
  if(p && p.alive) log(room, `Đến lượt ${p.name} rút.`);
}
function advanceIfDoneDrawing(room){
  const p=currentPlayer(room);
  if(!p) return;
  if(p.mustDraw<=0){
    p.mustDraw=1;
    room.turnIndex = nextAliveIndex(room.players, room.turnIndex, room.direction);
    announceNextDrawer(room);
  }else{
    announceNextDrawer(room);
  }
}
function winCheck(room){
  const alive=room.players.filter(p=>p.alive);
  if(alive.length<=1){
    if(alive.length===1) log(room,`🎉 ${alive[0].name} thắng!`,"ok");
    else log(room,"Không còn ai sống...","bad");
    stopTurnTimer(room);
    persistMatchEnd(room);
    return true;
  }
  return false;
}
function isMyTurn(room, playerToken){
  const p=currentPlayer(room);
  return p && p.alive && p.playerToken===playerToken;
}
function actDraw(room, playerToken, auto=false){
  if(!isMyTurn(room, playerToken)) return;
  const p=currentPlayer(room);
  if(room.deck.length===0){ sync(room); startOrResetTurnTimer(room); return; }
  const c=room.deck.pop();
  p.hand.push(c);

  if(c.key==="BOOM"){
    log(room, `${auto?"⏱️ ":""}💥 ${p.name} bốc phải Mèo Boom!`, "bad");
    const defIdx=p.hand.findIndex(x=>x.key==="DEFUSE");
    if(defIdx>=0){
      p.hand.splice(defIdx,1);
      p.hand=p.hand.filter(x=>x.id!==c.id);
      room.pending={id:uuid(), type:"insert_boom", forPlayerToken: playerToken, data:{}};
      sync(room);
      return;
    }else{
      p.alive=false; p.exploded=true;
      p.hand=p.hand.filter(x=>x.id!==c.id);
      log(room, `💥 ${p.name} bị loại.`, "bad");
      if(!winCheck(room)){
        room.turnIndex = nextAliveIndex(room.players, room.turnIndex, room.direction);
        announceNextDrawer(room);
        sync(room);
        startOrResetTurnTimer(room);
      }else sync(room);
      return;
    }
  }

  p.mustDraw=Math.max(0,p.mustDraw-1);
  advanceIfDoneDrawing(room);
  sync(room);
  startOrResetTurnTimer(room);
}
function resolvePrompt(room, playerToken, promptId, payload){
  const pend=room.pending;
  if(!pend || pend.forPlayerToken!==playerToken || pend.id!==promptId) return;
  room.pending=null;
  if(pend.type==="insert_boom"){
    const pos=payload?.pos||"top";
    const boom={key:"BOOM",id:uuid()};
    if(pos==="top") room.deck.push(boom);
    else if(pos==="bottom") room.deck.unshift(boom);
    else room.deck.splice(Math.floor(Math.random()*(room.deck.length+1)),0,boom);
    const p=currentPlayer(room);
    p.mustDraw=Math.max(0,p.mustDraw-1);
    advanceIfDoneDrawing(room);
    sync(room);
    startOrResetTurnTimer(room);
  }
}

wss.on("connection",(ws)=>{
  const wsId=uuid();
  clients.set(wsId,ws);
  ws.isAlive=true;
  ws.on("pong",()=>{ws.isAlive=true;});
  send(ws,{type:"hello_ok",wsId});

  ws.on("message",(buf)=>{
    let msg; try{msg=JSON.parse(buf.toString("utf8"));}catch{return;}
    const t=msg.type;

    if(t==="create_room"){
      const modeKey = msg.modeKey==="space"?"space":"classic";
      let code=makeRoomCode(); while(rooms.has(code)) code=makeRoomCode();
      const room={code,hostPlayerToken:null,modeKey,started:false,direction:1,turnIndex:0,deck:[],boomPool:[],defusePool:[],players:[],log:[],pending:null,turnDeadline:0,turnTimer:null,matchId:null};
      rooms.set(code,room);

      const name=normName(msg.name||"Host");
      const pTok=token();
      room.hostPlayerToken=pTok;
      room.players.push({wsId,playerToken:pTok,name,alive:true,hand:[],mustDraw:1,exploded:false});
      persistUpsertPlayer(room.players[0]);
      persistRoom(room);

      send(ws,{type:"room_ok",code,playerToken:pTok,state:publicState(room)});
      sync(room);
      return;
    }

    if(t==="join_room"){
      const code=(msg.code||"").toString().trim().toUpperCase();
      const room=rooms.get(code);
      if(!room) return send(ws,{type:"error",message:"Không tìm thấy phòng."});
      if(room.started) return send(ws,{type:"error",message:"Phòng đã bắt đầu."});
      if(room.players.length>=10) return send(ws,{type:"error",message:"Phòng đủ 10 người."});

      const name=normName(msg.name||`Người ${room.players.length+1}`);
      if(!name) return send(ws,{type:"error",message:"Tên không hợp lệ."});
      if(nameTaken(room,name)) return send(ws,{type:"error",message:"Tên đã có người dùng trong phòng. Hãy chọn tên khác."});

      const pTok=token();
      room.players.push({wsId,playerToken:pTok,name,alive:true,hand:[],mustDraw:1,exploded:false});
      persistUpsertPlayer(room.players.at(-1));
      persistRoom(room);

      send(ws,{type:"room_ok",code,playerToken:pTok,state:publicState(room)});
      sync(room);
      return;
    }

    if(t==="resume"){
      const code=(msg.code||"").toString().trim().toUpperCase();
      const room=rooms.get(code);
      if(!room) return send(ws,{type:"error",message:"Không tìm thấy phòng để vào lại."});
      const pTok=(msg.playerToken||"").toString().trim();
      const p=room.players.find(x=>x.playerToken===pTok);
      if(!p) return send(ws,{type:"error",message:"Không tìm thấy người chơi (token sai)."});
      p.wsId=wsId;
      send(ws,{type:"room_ok",code,playerToken:pTok,state:publicState(room)});
      sync(room);
      if(room.started) startOrResetTurnTimer(room);
      return;
    }

    if(t==="start_game"){
      const code=(msg.code||"").toString().trim().toUpperCase();
      const room=rooms.get(code);
      if(!room) return send(ws,{type:"error",message:"Không tìm thấy phòng."});
      const me=room.players.find(p=>p.wsId===wsId);
      if(!me) return send(ws,{type:"error",message:"Bạn chưa ở trong phòng."});
      if(me.playerToken!==room.hostPlayerToken) return send(ws,{type:"error",message:"Chỉ host được bắt đầu."});
      if(room.players.length<4) return send(ws,{type:"error",message:"Cần ít nhất 4 người."});
      if(room.started) return;

      const {deck,boomPool,defusePool}=buildDeck(room.players.length, room.modeKey);
      room.deck=deck; room.boomPool=boomPool; room.defusePool=defusePool;
      room.started=true; room.direction=1; room.turnIndex=0; room.pending=null;
      deal(room);
      room.log=[];
      announceNextDrawer(room);
      sync(room);
      startOrResetTurnTimer(room);
      persistMatchStart(room);
      persistRoom(room);
      return;
    }

    if(t==="action"){
      const code=(msg.code||"").toString().trim().toUpperCase();
      const room=rooms.get(code);
      if(!room || !room.started) return send(ws,{type:"error",message:"Phòng chưa bắt đầu."});
      const me=room.players.find(p=>p.wsId===wsId);
      if(!me) return send(ws,{type:"error",message:"Bạn chưa ở trong phòng."});
      if(room.pending) return send(ws,{type:"error",message:"Đang chờ lựa chọn."});
      if(msg.kind==="draw") return actDraw(room, me.playerToken, false);
      if(msg.kind==="peek"){
        const n = room.modeKey==="space" ? 5 : 3;
        const top = room.deck.slice(-n).reverse().map(c=>c.key);
        return sendPrivate(room, me.playerToken, {type:"peek",cards:top});
      }
      return;
    }

    if(t==="prompt_reply"){
      const code=(msg.code||"").toString().trim().toUpperCase();
      const room=rooms.get(code);
      if(!room || !room.pending) return;
      const me=room.players.find(p=>p.wsId===wsId);
      if(!me) return;
      resolvePrompt(room, me.playerToken, msg.promptId, msg.payload||{});
      return;
    }
  });

  ws.on("close",()=>{ clients.delete(wsId); });
});

setInterval(()=>{
  for(const [id,ws] of clients.entries()){
    if(ws.isAlive===false){
      try{ws.terminate();}catch{}
      clients.delete(id);
      continue;
    }
    ws.isAlive=false;
    try{ws.ping();}catch{}
  }
}, 25000);

server.listen(PORT,"0.0.0.0",()=>console.log("Server running on",PORT));
