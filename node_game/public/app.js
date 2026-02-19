const $ = (id)=>document.getElementById(id);
const API = (window.__CONFIG__ && window.__CONFIG__.PHP_API_BASE) ? window.__CONFIG__.PHP_API_BASE.replace(/\/$/,"") : "";

function setStatus(t){ $("status").textContent = t; }
function getName(){ return localStorage.getItem("meoboom_name") || ""; }
function setName(n){ localStorage.setItem("meoboom_name", n); }

async function apiGet(path){ const r = await fetch(API + path); return r.json(); }
async function apiPost(path, body){
  const r = await fetch(API + path, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
  return r.json();
}

async function loadRooms(){
  if(!API){ setStatus("Thiếu PHP_API_BASE (set ENV trên Render cho Node service)"); return; }
  const data = await apiGet("/api/rooms.php");
  if(!data.ok){ setStatus("Lỗi rooms: " + (data.error||"")); return; }
  renderRooms(data.rooms || []);
  $("rankingLink").href = API + "/api/ranking.php";
  setStatus("Đã tải phòng: " + (data.rooms||[]).length);
}

function renderRooms(rooms){
  const wrap = $("rooms");
  wrap.innerHTML = "";
  rooms.forEach(r=>{
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
        <div>
          <b>${escapeHtml(r.name)}</b>
          <div style="margin-top:6px">
            <span class="pill">${escapeHtml(r.status)}</span>
            <span class="pill">${r.player_count}/${r.max_players} người</span>
          </div>
        </div>
        <button data-room="${r.id}">Vào phòng</button>
      </div>
    `;
    div.querySelector("button").onclick = ()=> joinRoom(r.id, r.name);
    wrap.appendChild(div);
  });
}

async function joinRoom(roomId, roomName){
  const name = getName().trim();
  if(!name){ alert("Nhập tên trước"); return; }
  const res = await apiPost("/api/player_upsert.php", {room_id: roomId, player_name: name});
  if(!res.ok){ alert(res.error || "Không vào được"); return; }
  window.location.href = "/room.html?room_id=" + encodeURIComponent(roomId) + "&room_name=" + encodeURIComponent(roomName);
}

$("saveName").onclick = ()=>{
  const n = $("name").value.trim();
  if(!n) return;
  setName(n);
  setStatus("Đã lưu tên: " + n);
};

$("createRoom").onclick = async ()=>{
  const room = $("newRoom").value.trim();
  const name = getName().trim();
  if(!name){ alert("Nhập tên trước"); return; }
  if(!room){ alert("Nhập tên phòng"); return; }
  const res = await apiPost("/api/room_upsert.php", {room_name: room, max_players: 10});
  if(!res.ok){ alert(res.error || "Tạo phòng lỗi"); return; }
  $("newRoom").value = "";
  await loadRooms();
  alert("Tạo phòng OK. Bấm vào phòng để vào.");
};

$("refresh").onclick = loadRooms;

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

$("name").value = getName();
loadRooms();
setInterval(loadRooms, 5000);
