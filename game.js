'use strict';
(function() {

const CFG = {
  courtL: 24, courtW: 10, margin: 10,
  ballR: 0.22, mingoR: 0.16,
  friction: 3.2, mingoFriction: 4.2,
  maxSpeed: 17.5, minSpeed: 2.0,
  wallRest: 0.55, ballRest: 0.93,
  throwX: 1.8, throwY: 5.0,
  chargeTime: 1000,
  winScoreTeams: 20, winScoreIndividual: 10,
  breakScore: 10,
  freezeThrows: 2,
  explosionRadius: 2.5,
  explosionForce: 12,
  chargeSlowMul: 1.5,
  palette: {
    0: ['#3b8bff', '#06d6a0', '#22d3ee', '#8b5cf6'],
    1: ['#ff5d7d', '#f97316', '#eab308', '#ec4899']
  },
  indivPalette: ['#3b8bff', '#ff5d7d', '#06d6a0', '#f97316', '#8b5cf6', '#22d3ee', '#eab308', '#ec4899']
};

/* ===== MÚSICA DE FONDO (YouTube) ===== */
// 👇 CAMBIÁ ESTE ID POR TU VIDEO/PLAYLIST DE SALSA
const MUSIC_VIDEO_ID = '';
// Si tenés una playlist, poné el ID acá (ej: 'PLxxxxxxxx'). Si está vacío, usa solo el video.
const MUSIC_PLAYLIST_ID = 'PL0e6V9PqyPjpgURhiqLD3vXJ-3gQyVbAd';

const FIXED = 1/240;
const rnd = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
const $ = id => document.getElementById(id);

const DRINKS = {
  ron: {
    name:'Ron', brand:'El Cacique', icon:'🥃', color:'#d4a017',
    buffs:'Doble puntos si anotas',
    others:'-0.10 rad a rivales (próximo tiro)',
    othersIcon:'🎯',
    debuffs:'Si tocas el mingo: pierdes turno',
    phrases:["¡Cacique e' oro, vale!","¡Pampero pa' los panas!","¡Santa Teresa y pa' fuera!"],
    buchi:"¡Ese Cacique sí es de ley!"
  },
  cerveza: {
    name:'Cerveza', brand:'La Polar', icon:'🍺', color:'#06d6a0',
    buffs:'Precisión perfecta · sin temblor',
    others:'Congela el mingo 2 turnos',
    othersIcon:'🧊',
    debuffs:'Velocidad -25%',
    phrases:['¡Polar bien fría, mi pana!','Polar o nada, mi socio.','¡Una Regional y arrancamos!'],
    buchi:'Polar o nada, mi socio.'
  },
  cocuy: {
    name:'Cocuy', brand:'El Arrecho', icon:'🥃', color:'#ff3b30',
    buffs:'Masa +30% · NO te descalifica en mingo',
    others:'Explota al impactar (radio 2.5)',
    othersIcon:'💥',
    debuffs:'40% desvío ±0.30 rad',
    phrases:["¡Cocuy e' Falcón, pa' los arrechos!","¡Cocuy de penca, no seas marico!","¡Epa, que esto pega!"],
    buchi:"Cocuy e' penca, no seas marico."
  },
  cafe: {
    name:'Cafecito', brand:'El Contra', icon:'☕', color:'#8b5a2b',
    buffs:'Limpia tus efectos · precisión perfecta',
    others:'Bloquea neveras rivales 1 turno',
    othersIcon:'🛡️',
    debuffs:'Pierdes el turno',
    phrases:["¡Un cafecito pa' bajar la rascao!","Métale bolita, que se le pasó."],
    buchi:"¡Métale bolita, que se le pasó!"
  }
};
const DRINK_KEYS = ['ron','cerveza','cocuy','cafe'];

const DRINK_ASSETS = {
  ron: 'assets/botella_ron.png',
  cerveza: 'assets/lata_cerveza.png',
  cocuy: 'assets/botella_cocuy.png',
  cafe: 'assets/taza_cafe.png'
};

const PEER_OPTS = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ]
  }
};
const PEER_PREFIX = 'BC';
const JOIN_TIMEOUT = 15000;
const WELCOME_TIMEOUT = 10000;
const HEARTBEAT_INTERVAL = 5000;
const HEARTBEAT_TIMEOUT = 15000;

let _joinTimer = null;
let _welcomeTimer = null;
let _hbTimer = null;
let _modalTimer = null;

const S = {
  screen: 'menu', username: '', portrait: false, ppm: 30, cvW: 0, cvH: 0,
  mode: 'solo', isHost: true, isMultiplayer: false, isSpectator: false,
  myPlayerId: null, roomCode: '',
  config: {
    gameMode: 'teams', playersPerTeam: 3, individualCount: 4,
    individualBallsPerPlayer: 2, maxPlayers: 4, maxRounds: 0,
    wallRest: 0.55, turnTimeout: 0,
    teamNames: ['Azul','Rojo'],
    teamColors: [CFG.palette[0][0], CFG.palette[1][0]],
    difficulty: 1, speed: 1,
    fiestaMode: false
  },
  players: [], spectators: [], teams: [{score:0},{score:0}],
  phase: 'idle', bodies: [], currentTeam: 0, currentSlot: 0,
  round: 1, roundStarter: 0, ballsLeft: [0,0], breakTaken: false,
  aimAngle: 0, charging: false, charge: 0, chargeStart: 0,
  aiPending: false, peer: null, connections: new Map(), hostConn: null,
  lastBroadcast: 0,
  turnStartedAt: 0, turnTimeoutFired: false,
  chatMessages: [],
  voiceEnabled: true,
  stats: { invalids: 0, boches: 0, roundAtWin: 0 },
  _bocheThisTurn: false,
  buchiEnabled: true,
  fiestaDefault: false,
  laRondaDone: false,
  laRondaRound: -1,
  laRondaActiveFor: {},
  _pendingLaRondaBonus: false,
  _lastCafeRound: -1,
  _usedCocuyThisGame: false,
  turnCounter: 0,
  mingoFrozenThrowsLeft: 0,
  noDrinkUntilTurnCounter: -1,
  _skipFreezeDecrement: false,
  explosions: [],
  fiesta: {
    particles: [], bubbles: [], vapor: [], floatingTexts: [],
    shakeUntil: 0, shakeMag: 0,
    cocuyFlashUntil: 0
  },
  // CAMBIO: cola de toasts bloqueantes
  toastQueue: [],
  toastActive: false,
  _toastPaused: false,
  _toastTurnStartBackup: 0,
  _toastChargeBackup: 0
};

/* ===== HELPERS DE MODO ===== */
function isIndiv(){ return S.config.gameMode === 'individual' || S.config.gameMode === 'free'; }
function sanitizeCode(s){ return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function pruneDeadConnections(){
  const toRemove = [];
  S.connections.forEach((conn, peerId) => { if (!conn.open) toRemove.push(peerId); });
  toRemove.forEach(peerId => {
    S.connections.delete(peerId);
    S.players = S.players.filter(p => p.peerId !== peerId);
    S.spectators = S.spectators.filter(s => s.peerId !== peerId);
  });
  if (toRemove.length) { renderLobby(); broadcastLobby(); }
}
function startHeartbeat(){
  stopHeartbeat();
  _hbTimer = setInterval(() => {
    if (!S.isHost || !S.isMultiplayer) return;
    const now = Date.now();
    const dead = [];
    S.connections.forEach((conn, peerId) => {
      if (!conn.open) { dead.push(peerId); return; }
      const pl = S.players.find(p => p.peerId === peerId);
      const sp = S.spectators.find(s => s.peerId === peerId);
      const last = pl ? pl.lastSeen : (sp ? sp.lastSeen : 0);
      if (last && now - last > HEARTBEAT_TIMEOUT) dead.push(peerId);
      try { conn.send({ type: 'ping', t: now }); } catch (_) {}
    });
    if (dead.length) {
      dead.forEach(peerId => {
        const c = S.connections.get(peerId);
        if (c) { try { c.close(); } catch (_) {} }
        S.connections.delete(peerId);
        S.players = S.players.filter(p => p.peerId !== peerId);
        S.spectators = S.spectators.filter(s => s.peerId !== peerId);
      });
      renderLobby(); broadcastLobby();
      if (S.phase !== 'idle') broadcastState();
    }
  }, HEARTBEAT_INTERVAL);
}
function stopHeartbeat(){ if (_hbTimer) { clearInterval(_hbTimer); _hbTimer = null; } }

/* ===== PERSISTENCIA ===== */
const RANK_KEY = 'bolasRankings_v1';
const THEME_KEY = 'bolasTheme';
const VOL_KEY = 'bolasVolumes';
const CFG_KEY = 'bolasConfig';
const ACH_KEY = 'bolasAchievements';
const VOICE_KEY = 'bolasVoice';
const BUCHI_KEY = 'bolasBuchi';

function getRankings(){try{return JSON.parse(localStorage.getItem(RANK_KEY)||'{}')}catch(e){return{}}}
function saveRankings(r){try{localStorage.setItem(RANK_KEY,JSON.stringify(r))}catch(e){}}
function getVolumes(){try{return JSON.parse(localStorage.getItem(VOL_KEY)||'{"master":0.8,"music":0.55,"sfx":0.8}')}catch(e){return{master:0.8,music:0.55,sfx:0.8}}}
function saveVolumes(v){try{localStorage.setItem(VOL_KEY,JSON.stringify(v))}catch(e){}}
function getSavedConfig(){try{return JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}catch(e){return{}}}
function saveSavedConfig(cfg){try{localStorage.setItem(CFG_KEY,JSON.stringify(cfg))}catch(e){}}

function initFiestaStats(r){
  if(!r.drinks) r.drinks={ron:0,cerveza:0,cocuy:0,cafe:0};
  if(r.soberWins===undefined) r.soberWins=0;
  if(r.drunkWins===undefined) r.drunkWins=0;
  if(r.jumaCount===undefined) r.jumaCount=0;
  return r;
}

function recordGame(name, result){
  if(!name)return;
  const r=getRankings();
  if(!r[name]) r[name]={wins:0, games:0, history:[]};
  r[name]=initFiestaStats(r[name]);
  r[name].games++;
  r[name].history = r[name].history || [];
  r[name].history.unshift({date:new Date().toISOString(), result: result || 'derrota'});
  r[name].history = r[name].history.slice(0, 10);
  if(fiestaActive()){
    const me=S.players.find(p=>p.isMe);
    if(me){
      if(me.cantina) DRINK_KEYS.forEach(k=>{ if((me.cantina[k]||0) < 1) r[name].drinks[k]=(r[name].drinks[k]||0)+1; });
      if((me.drinksTaken||0)===0) r[name].soberWins++;
      else r[name].drunkWins++;
      if(playerHasJuma(me)) r[name].jumaCount++;
    }
  }
  saveRankings(r);
  if(r[name].games>=100) unlockAchievement('centurion');
}
function recordWin(name){
  if(!name)return;
  const r=getRankings();
  if(!r[name]) r[name]={wins:0, games:0, history:[]};
  r[name]=initFiestaStats(r[name]);
  r[name].wins++;
  r[name].games++;
  r[name].history = r[name].history || [];
  r[name].history.unshift({date:new Date().toISOString(), result: 'victoria'});
  r[name].history = r[name].history.slice(0, 10);
  if(fiestaActive()){
    const me=S.players.find(p=>p.isMe);
    if(me){
      if(me.cantina) DRINK_KEYS.forEach(k=>{ if((me.cantina[k]||0) < 1) r[name].drinks[k]=(r[name].drinks[k]||0)+1; });
      if((me.drinksTaken||0)===0) r[name].soberWins++;
      else r[name].drunkWins++;
      if(playerHasJuma(me)) r[name].jumaCount++;
    }
  }
  saveRankings(r);
  renderRanking(); renderFullRanking();
  if(r[name].games>=100) unlockAchievement('centurion');
}

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function getRankIcon(pos){ return ['🥇','🥈','🥉'][pos-1] || '🏅'; }

/* ===== LOGROS ===== */
const ACHIEVEMENTS = [
  {id:'first_win', name:'Primera victoria', desc:'Ganar tu primera partida', icon:'🏆'},
  {id:'first_boche', name:'Primer boche', desc:'Desplazar una bola rival', icon:'🎯'},
  {id:'triple_invalid', name:'Triple descalificación', desc:'3 bolas descalificadas en una partida', icon:'💥'},
  {id:'fast_win', name:'Victoria exprés', desc:'Ganar en 5 rondas o menos', icon:'⚡'},
  {id:'centurion', name:'Centurión', desc:'Jugar 100 partidas', icon:'💯'},
  {id:'borrachito_feliz', name:'Borrachito Feliz', desc:'Ganar una partida con 3 tragos tomados', icon:'🍻'},
  {id:'conductor_designado', name:'El Conductor Designado', desc:'Ganar 5 partidas sin tomar ningún trago', icon:'🚗'},
  {id:'ultimo_trago', name:'El Último Trago', desc:'Ganar en la última ronda tras tomar cocuy', icon:'🥃'},
  {id:'juma_suprema', name:'Rascao Supremo', desc:'Entrar en rascao y ganar la partida', icon:'💫'},
  {id:'cafecito_salvador', name:'Cafecito Salvador', desc:'Usar el cafecito y ganar en la misma ronda', icon:'☕'},
  {id:'ronda_pagada', name:'Ronda Pagada', desc:'Ganar La Ronda (evento automático)', icon:'🎉'}
];
function getAchievements(){try{return JSON.parse(localStorage.getItem(ACH_KEY)||'{}')}catch(e){return{}}}
function unlockAchievement(id){
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return;
  const cur = getAchievements();
  if (cur[id]) return;
  cur[id] = { date: Date.now() };
  try { localStorage.setItem(ACH_KEY, JSON.stringify(cur)); } catch(_) {}
  showCenterToast(a.name, a.icon, 'logro', 4000);
  sfx('point');
}

/* ===== RANKING ===== */
function renderRanking(){
  const box=$('rankingBox'); if(!box)return;
  const r=getRankings();
  const entries=Object.entries(r).sort((a,b)=>b[1].wins-a[1].wins||a[0].localeCompare(b[0]));
  if(!entries.length){box.innerHTML='<div class="rank-empty">Aún no hay partidas. ¡Sé el primer Campeón Bolero!</div>';return}
  const champ=entries[0];
  let html=`<div class="rank-champion"><div class="trophy">🏆</div><div class="info"><span>Campeón Bolero Supremo</span><b>${escapeHtml(champ[0])}</b></div><div class="score">${champ[1].wins}</div></div>`;
  if(entries.length>1){
    html+='<div class="rank-list">';
    entries.slice(1,6).forEach(([name,data],i)=>{
      html+=`<div class="rank-row"><div class="pos">${getRankIcon(i+2)}</div><div class="nm">${escapeHtml(name)}</div><div class="sc">${data.wins} 🏅</div></div>`;
    });
    html+='</div>';
  }
  box.innerHTML=html;
}
function renderFullRanking(){
  const box=$('fullRankingTable'); if(!box)return;
  const r=getRankings();
  const entries=Object.entries(r).sort((a,b)=>b[1].wins-a[1].wins||a[0].localeCompare(b[0]));
  if(!entries.length){box.innerHTML='<div class="rank-empty">Aún no hay partidas registradas.</div>';return}
  let html='<div class="rank-table">';
  entries.forEach(([name,data],i)=>{
    const isTop=i===0;
    const totalDrinks = data.drinks ? Object.values(data.drinks).reduce((a,b)=>a+b,0) : 0;
    const statsText = `${data.games} part.` + (totalDrinks>0 ? ` · 🍹 ${totalDrinks}` : '');
    html+=`<div class="rank-table-row ${isTop?'top':''}" data-player="${escapeHtml(name)}"><div class="pos">${getRankIcon(i+1)}</div><div class="nm">${escapeHtml(name)}<span class="stats">${statsText}</span></div><div class="sc">${data.wins}</div><div class="chev">›</div></div>`;
  });
  html+='</div>';
  html+='<p class="muted" style="text-align:center;margin-top:16px;font-size:12px">Clic en un nombre para ver su historial</p>';
  box.innerHTML=html;
}
function showPlayerHistory(name){
  const r=getRankings();
  const data=r[name];
  if(!data){toast('Sin historial');return;}
  let body=`<p style="text-align:center;color:var(--sand);font-size:15px"><b>${escapeHtml(name)}</b></p>`;
  body+=`<p style="text-align:center">${data.wins} victorias · ${data.games} partidas</p>`;
  if(data.drinks){
    const total=Object.values(data.drinks).reduce((a,b)=>a+b,0);
    if(total>0){
      body+=`<p style="text-align:center;font-size:12px;color:var(--muted)">🥃 ${data.drinks.ron} · 🍺 ${data.drinks.cerveza} · 🥃 ${data.drinks.cocuy} · ☕ ${data.drinks.cafe}</p>`;
      body+=`<p style="text-align:center;font-size:11px;color:var(--muted)">🚗 ${data.soberWins||0} victorias sobrio · 🍻 ${data.drunkWins||0} con trago · 💫 ${data.jumaCount||0} rascaos</p>`;
    }
  }
  if(data.history && data.history.length){
    body+='<div style="margin-top:14px">';
    data.history.forEach(h=>{
      const d=new Date(h.date);
      const dateStr=d.toLocaleDateString()+' '+d.toLocaleTimeString().slice(0,5);
      const isWin=h.result==='victoria';
      body+=`<div class="history-row"><span class="icon">${isWin?'🏆':'📉'}</span><span class="date">${dateStr}</span><span class="result ${isWin?'win':'loss'}">${isWin?'Victoria':'Derrota'}</span></div>`;
    });
    body+='</div>';
  } else {
    body+='<p style="text-align:center;color:var(--muted);margin-top:14px">Sin historial detallado</p>';
  }
  showModal(escapeHtml(name), body, 'Cerrar', null, {autoSkip:true});
}

/* ===== UI HELPERS ===== */
function show(screen){
  S.screen=screen;
  document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));
  const el=$('screen'+screen.charAt(0).toUpperCase()+screen.slice(1));
  if(el)el.classList.add('active');
  if(screen==='game'){
    ensureAudio();
    startMusic();
    startBeach();
  } else {
    stopMusic();
    stopBeach();
  }
}
function toast(msg,ms=2400){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),ms);}

/* ===== TOASTS BLOQUEANTES EN COLA ===== */
function showCenterToast(text, icon, variant, duration){
  duration = duration || 2500;
  variant = variant || 'trago';
  S.toastQueue.push({ text, icon, variant, duration });
  _processToastQueue();
}
function _processToastQueue(){
  if (S.toastActive) return;
  if (!S.toastQueue.length) return;
  const next = S.toastQueue.shift();
  S.toastActive = true;

  // Pausar el juego
  S._toastPaused = true;
  S._toastTurnStartBackup = (S.turnStartedAt > 0) ? (performance.now() - S.turnStartedAt) : 0;
  S._toastChargeBackup = S.charging ? (performance.now() - S.chargeStart) : 0;

  const t = document.createElement('div');
  t.className = 'center-toast ' + next.variant;
  if (next.icon) {
    const iconEl = document.createElement('span');
    iconEl.className = 'toast-icon';
    iconEl.textContent = next.icon;
    t.appendChild(iconEl);
  }
  const textEl = document.createElement('span');
  textEl.className = 'toast-text';
  textEl.textContent = next.text;
  t.appendChild(textEl);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));

  S._toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => { try { t.remove(); } catch(_){} }, 300);

    S.toastActive = false;
    S._toastPaused = false;

    // Restaurar timers
    if (S.turnStartedAt > 0 && S._toastTurnStartBackup >= 0) {
      S.turnStartedAt = performance.now() - S._toastTurnStartBackup;
    }
    if (S.charging && S._toastChargeBackup >= 0) {
      S.chargeStart = performance.now() - S._toastChargeBackup;
    }
    S._toastTimer = null;

    _processToastQueue();
  }, next.duration);
}

function showModal(title,body,btn,cb,opts){
  opts = opts || {};
  clearTimeout(_modalTimer);
  $('modalTitle').innerHTML=title;
  $('modalBody').innerHTML=body;
  $('modalBtn').textContent=btn;
  $('modalBtn').onclick=()=>{clearTimeout(_modalTimer);$('modal').classList.remove('open');if(cb)cb();};
  const actionsEl=document.querySelector('.modal-actions');
  const oldSec=actionsEl.querySelector('.secondary');
  if(oldSec) oldSec.remove();
  if(opts.secondary){
    const secBtn=document.createElement('button');
    secBtn.className='secondary';
    secBtn.textContent=opts.secondary.text;
    secBtn.onclick=()=>{clearTimeout(_modalTimer);$('modal').classList.remove('open');if(opts.secondary.cb)opts.secondary.cb();};
    actionsEl.appendChild(secBtn);
  }
  $('modal').classList.add('open');
  if(opts.autoSkip !== false && cb){
    _modalTimer=setTimeout(()=>{
      if($('modal').classList.contains('open')){ $('modal').classList.remove('open'); cb(); }
    },8000);
  }
}
function closeModal(){clearTimeout(_modalTimer);$('modal').classList.remove('open')}

/* ===== TEMA ===== */
function setTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch(_){}
  const btn=document.querySelector('.theme-toggle');
  if(btn) btn.textContent = theme==='light' ? '☀️' : '🌙';
}
function toggleTheme(){
  const cur=document.documentElement.getAttribute('data-theme')||'dark';
  setTheme(cur==='dark'?'light':'dark');
  renderBackground();
}

/* ===== AUDIO (sfx / voz / ambiente) ===== */
let actx=null, masterGain=null, musicGain=null, sfxGain=null, musicFade=null, beachGain=null;
let chargeOsc=null, chargeGain=null;
let noiseBuffer=null;
let rollSource=null, rollFilter=null, rollGain=null;
let beachNodes=[];
let lastSwishAt=0, lastAimAngleForSwish=0;

function panFromWorld(wx){
  const p=(wx/CFG.courtL)*2-1;
  return clamp(p*0.8, -0.85, 0.85);
}

function ensureAudio(){
  if(actx){
    if(actx.state==='suspended') actx.resume().catch(()=>{});
    return;
  }
  try{
    actx=new (window.AudioContext||window.webkitAudioContext)();
    masterGain=actx.createGain();
    musicGain=actx.createGain();
    sfxGain=actx.createGain();
    musicFade=actx.createGain();
    beachGain=actx.createGain();
    musicFade.connect(musicGain);
    beachGain.connect(musicGain);
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(actx.destination);
    const v=getVolumes();
    masterGain.gain.value=v.master;
    musicGain.gain.value=v.music;
    sfxGain.gain.value=v.sfx;
    musicFade.gain.value=1;
    beachGain.gain.value=0;
    const len=actx.sampleRate*2;
    noiseBuffer=actx.createBuffer(1,len,actx.sampleRate);
    const data=noiseBuffer.getChannelData(0);
    for(let i=0;i<len;i++) data[i]=Math.random()*2-1;
  }catch(e){}
}

function startChargeSound(){
  if(!actx)return;
  stopChargeSound();
  chargeOsc=actx.createOscillator();
  chargeGain=actx.createGain();
  chargeOsc.type='sine';
  chargeOsc.frequency.value=200;
  chargeGain.gain.value=0.02;
  chargeOsc.connect(chargeGain);
  chargeGain.connect(sfxGain);
  chargeOsc.start();
}
function updateChargeSound(){
  if(!chargeOsc||!actx)return;
  chargeOsc.frequency.setTargetAtTime(200+S.charge*700, actx.currentTime, 0.03);
  chargeGain.gain.setTargetAtTime(0.02+S.charge*0.02, actx.currentTime, 0.03);
}
function stopChargeSound(){
  if(chargeOsc){ try{ chargeOsc.stop(); }catch(_){} try{ chargeOsc.disconnect(); }catch(_){} chargeOsc=null; }
  if(chargeGain){ try{ chargeGain.disconnect(); }catch(_){} chargeGain=null; }
}

function startRollSound(){
  if(!actx || rollSource || !noiseBuffer) return;
  rollSource=actx.createBufferSource();
  rollSource.buffer=noiseBuffer;
  rollSource.loop=true;
  rollFilter=actx.createBiquadFilter();
  rollFilter.type='lowpass';
  rollFilter.frequency.value=400;
  rollGain=actx.createGain();
  rollGain.gain.value=0;
  rollSource.connect(rollFilter);
  rollFilter.connect(rollGain);
  rollGain.connect(sfxGain);
  rollSource.start();
}
function updateRollSound(){
  if(!rollGain || !actx) return;
  let maxSp=0;
  for(const b of S.bodies){
    if(b.isMingo) continue;
    const sp=Math.hypot(b.vx,b.vy);
    if(sp>maxSp) maxSp=sp;
  }
  const gain=Math.min(0.18, maxSp*0.018);
  rollGain.gain.setTargetAtTime(gain, actx.currentTime, 0.03);
}
function stopRollSound(){
  if(rollSource){ try{ rollSource.stop(); }catch(_){} try{ rollSource.disconnect(); }catch(_){} rollSource=null; }
  if(rollGain){ try{ rollGain.disconnect(); }catch(_){} rollGain=null; }
  if(rollFilter){ try{ rollFilter.disconnect(); }catch(_){} rollFilter=null; }
}

function swishSound(){
  if(!actx || !noiseBuffer) return;
  const now=performance.now();
  if(now-lastSwishAt<150) return;
  lastSwishAt=now;
  const t=actx.currentTime;
  const src=actx.createBufferSource();
  src.buffer=noiseBuffer;
  src.playbackRate.value=1.5;
  const f=actx.createBiquadFilter();
  f.type='bandpass';
  f.frequency.value=1800;
  f.Q.value=1.2;
  const g=actx.createGain();
  g.gain.setValueAtTime(0.05,t);
  g.gain.exponentialRampToValueAtTime(0.001,t+0.06);
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t); src.stop(t+0.08);
}

/* ===== MÚSICA DE FONDO VÍA YOUTUBE ===== */
let ytPlayer = null;
let ytReady = false;
let ytApiLoading = false;
let ytApiReady = false;
let ytMusicStarted = false;

function loadYouTubeAPI(cb){
  if (ytApiReady) { cb(); return; }
  if (window.YT && window.YT.Player) { ytApiReady = true; cb(); return; }
  if (ytApiLoading) {
    const check = setInterval(() => { if (ytApiReady) { clearInterval(check); cb(); } }, 100);
    return;
  }
  ytApiLoading = true;
  window.onYouTubeIframeAPIReady = () => {
    ytApiReady = true;
    ytApiLoading = false;
    cb();
  };
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

function ensureYTPlayer(cb){
  if (ytPlayer && ytReady) { cb(ytPlayer); return; }
  loadYouTubeAPI(() => {
    const host = $('ytMusicHost');
    if (!host) { cb(null); return; }
    if (!host.querySelector('iframe') && !host.querySelector('div')) {
      const inner = document.createElement('div');
      inner.id = 'ytMusicIframe';
      host.appendChild(inner);
    }
    const playerVars = {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      playsinline: 1,
      rel: 0,
      fs: 0,
      iv_load_policy: 3
    };
    if (MUSIC_PLAYLIST_ID) {
      playerVars.listType = 'playlist';
      playerVars.list = MUSIC_PLAYLIST_ID;
    } else {
      playerVars.loop = 1;
      playerVars.playlist = MUSIC_VIDEO_ID;
    }
    ytPlayer = new YT.Player('ytMusicIframe', {
      height: '1', width: '1',
      videoId: MUSIC_VIDEO_ID,
      playerVars: playerVars,
      events: {
        onReady: (e) => {
          ytReady = true;
          const v = getVolumes();
          try { e.target.setVolume(Math.round(v.music * 100)); } catch(_){}

            // 👇 AGREGA ESTA LÍNEA PARA MEZCLAR LA PLAYLIST
  try { e.target.setShuffle(true); } catch(_){}
  
          try { e.target.playVideo(); } catch(_){}
          cb(e.target);
        },
        onError: () => {
          console.warn('[música] YouTube player error');
        }
      }
    });
  });
}

function startMusic(){
  if (ytMusicStarted) return;
  ytMusicStarted = true;
  ensureYTPlayer(p => {
    if (p) { try { p.playVideo(); } catch(_){} }
  });
}
function stopMusic(){
  ytMusicStarted = false;
  if (ytPlayer && ytReady) {
    try { ytPlayer.pauseVideo(); } catch(_){}
  }
}
function updateMusicVolume(){
  const v = getVolumes();
  if (ytPlayer && ytReady) {
    try { ytPlayer.setVolume(Math.round(v.music * 100)); } catch(_){}
  }
}

/* ===== AMBIENTE (playita) ===== */
function startBeach(){
  if(!actx || beachNodes.length || !noiseBuffer) return;
  const src=actx.createBufferSource();
  src.buffer=noiseBuffer;
  src.loop=true;
  const f=actx.createBiquadFilter();
  f.type='lowpass';
  f.frequency.value=300;
  const g=actx.createGain();
  g.gain.value=0.28;
  const lfo=actx.createOscillator();
  lfo.type='sine';
  lfo.frequency.value=0.1;
  const lfoGain=actx.createGain();
  lfoGain.gain.value=0.12;
  lfo.connect(lfoGain);
  lfoGain.connect(g.gain);
  src.connect(f); f.connect(g); g.connect(beachGain);
  src.start();
  lfo.start();
  if(beachGain) beachGain.gain.setTargetAtTime(0.6, actx.currentTime, 2);
  beachNodes=[src,f,g,lfo,lfoGain];
}
function stopBeach(){
  if(beachGain && actx) beachGain.gain.setTargetAtTime(0, actx.currentTime, 0.4);
  const nodes=beachNodes.slice();
  beachNodes=[];
  setTimeout(()=>{
    nodes.forEach(n=>{ try{ n.stop?n.stop():n.disconnect(); }catch(_){} });
  }, 1500);
}

function applauseSound(){
  if(!actx || !noiseBuffer) return;
  const t=actx.currentTime;
  for(let i=0;i<10;i++){
    const offset=i*0.025+rnd(0,0.04);
    const dur=0.12+rnd(0,0.15);
    const src=actx.createBufferSource();
    src.buffer=noiseBuffer;
    const f=actx.createBiquadFilter();
    f.type='bandpass';
    f.frequency.value=900+rnd(-300,500);
    f.Q.value=1.5;
    const g=actx.createGain();
    g.gain.setValueAtTime(0.0001,t+offset);
    g.gain.exponentialRampToValueAtTime(0.09,t+offset+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t+offset+dur);
    let panner=null;
    if(actx.createStereoPanner){
      panner=actx.createStereoPanner();
      panner.pan.value=rnd(-0.7,0.7);
    }
    src.connect(f); f.connect(g);
    if(panner){ g.connect(panner); panner.connect(sfxGain); }
    else g.connect(sfxGain);
    src.start(t+offset); src.stop(t+offset+dur+0.02);
  }
}

function speak(text){
  if(!S.voiceEnabled) return;
  if(!('speechSynthesis' in window)) return;
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.lang='es-ES';
    u.rate=1.1;
    u.pitch=1.0;
    u.volume=(sfxGain && actx) ? Math.min(1, sfxGain.gain.value*1.2) : 0.8;
    speechSynthesis.speak(u);
  }catch(_){}
}

function sfx(type,v=0.5,pan){
  if(!actx)return;
  const t=actx.currentTime;
  let panner=null;
  if(pan!==undefined && actx.createStereoPanner){
    panner=actx.createStereoPanner();
    panner.pan.value=clamp(pan,-1,1);
    panner.connect(sfxGain);
  }
  const dest = panner || sfxGain;

  if(type==='hit'){
    const o=actx.createOscillator(); o.type='triangle';
    const pitchVar=0.9+Math.random()*0.2;
    o.frequency.setValueAtTime((300+v*500)*pitchVar,t);
    o.frequency.exponentialRampToValueAtTime(110*pitchVar,t+0.09);
    const g=actx.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.02+0.16*v,t+0.005);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.13);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t+0.15);
  }else if(type==='throw'){
    const o=actx.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(520,t);
    o.frequency.exponentialRampToValueAtTime(180,t+0.18);
    const g=actx.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.09,t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.22);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t+0.24);
  }else if(type==='invalid'){
    const o=actx.createOscillator(); o.type='sawtooth';
    o.frequency.setValueAtTime(420,t);
    o.frequency.exponentialRampToValueAtTime(80,t+0.35);
    const g=actx.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.15,t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.4);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t+0.42);
  }else if(type==='point'){
    [523,659,784].forEach((f,i)=>{
      const o=actx.createOscillator(), gg=actx.createGain();
      o.type='sine'; o.frequency.value=f;
      gg.gain.setValueAtTime(0.0001,t+i*0.09);
      gg.gain.exponentialRampToValueAtTime(0.11,t+i*0.09+0.02);
      gg.gain.exponentialRampToValueAtTime(0.0001,t+i*0.09+0.3);
      o.connect(gg); gg.connect(dest);
      o.start(t+i*0.09); o.stop(t+i*0.09+0.32);
    });
  }else if(type==='mingo'){
    [880,1320,1760].forEach((f,i)=>{
      const o=actx.createOscillator();
      o.type='sine';
      o.frequency.setValueAtTime(f,t);
      o.frequency.exponentialRampToValueAtTime(f*0.8,t+0.4);
      const g=actx.createGain();
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(0.12/(i+1),t+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.6);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t+0.62);
    });
  }else if(type==='victory'){
    [523,659,784,1047].forEach((f,i)=>{
      const o=actx.createOscillator(); o.type='triangle'; o.frequency.value=f;
      const g=actx.createGain();
      g.gain.setValueAtTime(0.0001,t+i*0.12);
      g.gain.exponentialRampToValueAtTime(0.14,t+i*0.12+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001,t+i*0.12+0.4);
      o.connect(g); g.connect(dest);
      o.start(t+i*0.12); o.stop(t+i*0.12+0.42);
    });
  }else if(type==='defeat'){
    [392,294].forEach((f,i)=>{
      const o=actx.createOscillator(); o.type='sine'; o.frequency.value=f;
      const g=actx.createGain();
      g.gain.setValueAtTime(0.0001,t+i*0.25);
      g.gain.exponentialRampToValueAtTime(0.14,t+i*0.25+0.03);
      g.gain.exponentialRampToValueAtTime(0.0001,t+i*0.25+0.35);
      o.connect(g); g.connect(dest);
      o.start(t+i*0.25); o.stop(t+i*0.25+0.37);
    });
  }else if(type==='tick'){
    const o=actx.createOscillator(); o.type='sine'; o.frequency.value=1200;
    const g=actx.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.06,t+0.005);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.08);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t+0.09);
  }
}

/* ===== CANVAS ===== */
const canvas=$('court');
const ctx=canvas.getContext('2d');
let dpr=Math.min(2,window.devicePixelRatio||1);
let bgCanvas=null, bgCtx=null;
let _noiseCanvas=null;
function getNoiseCanvas(){
  if(!_noiseCanvas){
    _noiseCanvas=document.createElement('canvas');
    _noiseCanvas.width=_noiseCanvas.height=96;
    const g=_noiseCanvas.getContext('2d');
    const img=g.createImageData(96,96);
    for(let i=0;i<img.data.length;i+=4){
      const v=Math.random()*255;
      img.data[i]=v; img.data[i+1]=v; img.data[i+2]=v; img.data[i+3]=16;
    }
    g.putImageData(img,0,0);
  }
  return _noiseCanvas;
}
function noisePatternFor(c){ return c.createPattern(getNoiseCanvas(),'repeat'); }

function computePPM(){
  const isPortrait=window.innerWidth<window.innerHeight;
  S.portrait=isPortrait;
  const vw=Math.min(window.innerWidth,1200), vh=window.innerHeight;
  const boardH=isPortrait?100:72, hudH=85, quitH=32, padH=24, gap=20;
  const availW=vw-padH, availH=vh-boardH-hudH-quitH-padH-gap;
  let ppm=isPortrait?Math.min(availW/CFG.courtW, availH/CFG.courtL):Math.min(availW/CFG.courtL, availH/CFG.courtW);
  return Math.max(10, Math.floor(ppm));
}
function getTimePalette(){
  const h=new Date().getHours();
  const theme=document.documentElement.getAttribute('data-theme')||'dark';
  if(theme==='light'){
    if(h>=5 && h<8) return {outer:'#a88868',sand1:'#f0d6b0',sand2:'#d0a878',border1:'#fff0d0',border2:'#8a6038'};
    if(h>=8 && h<17) return {outer:'#c8b090',sand1:'#e8c898',sand2:'#c8a070',border1:'#fff5e0',border2:'#9a7048'};
    if(h>=17 && h<21) return {outer:'#a88868',sand1:'#e8b888',sand2:'#c09068',border1:'#f8d0a0',border2:'#8a6038'};
    return {outer:'#908070',sand1:'#c0a880',sand2:'#a08860',border1:'#d8b898',border2:'#705038'};
  }
  if(h>=5 && h<8) return {outer:'#4a3020',sand1:'#e8c496',sand2:'#c9a06a',border1:'#f0d4a8',border2:'#8a6038'};
  if(h>=8 && h<17) return {outer:'#38271a',sand1:'#d2ab74',sand2:'#b78a55',border1:'#f5d8a8',border2:'#8a6038'};
  if(h>=17 && h<21) return {outer:'#3a2518',sand1:'#d9a570',sand2:'#a67248',border1:'#e8b878',border2:'#6a4520'};
  return {outer:'#1a1208',sand1:'#7a5e40',sand2:'#5a4528',border1:'#8a6a48',border2:'#3a2510'};
}
function drawCourtBorder(g2d,x,y,w,h,p){
  const bevel=3;
  const bg=g2d.createLinearGradient(x,y,x,y+h);
  bg.addColorStop(0,p.border1);
  bg.addColorStop(0.5,p.border1);
  bg.addColorStop(0.5,p.border2);
  bg.addColorStop(1,p.border2);
  g2d.strokeStyle=bg;
  g2d.lineWidth=bevel;
  if(g2d.roundRect){ g2d.beginPath(); g2d.roundRect(x,y,w,h,8); g2d.stroke(); }
  else { g2d.strokeRect(x,y,w,h); }
  g2d.strokeStyle='rgba(0,0,0,0.3)';
  g2d.lineWidth=1;
  if(g2d.roundRect){ g2d.beginPath(); g2d.roundRect(x+bevel,y+bevel,w-bevel*2,h-bevel*2,6); g2d.stroke(); }
  else { g2d.strokeRect(x+bevel,y+bevel,w-bevel*2,h-bevel*2); }
}
function renderBackground(){
  if(!S.cvW || !S.cvH) return;
  if(!bgCanvas){ bgCanvas=document.createElement('canvas'); bgCtx=bgCanvas.getContext('2d'); }
  bgCanvas.width=S.cvW*dpr;
  bgCanvas.height=S.cvH*dpr;
  bgCtx.setTransform(dpr,0,0,dpr,0,0);
  bgCtx.clearRect(0,0,S.cvW,S.cvH);
  const m=S._margin||CFG.margin;
  const cw=CFG.courtL*S.ppm, ch=CFG.courtW*S.ppm;
  const p=getTimePalette();
  const isPortrait=S.portrait;
  bgCtx.fillStyle=p.outer;
  if(bgCtx.roundRect){ bgCtx.beginPath(); bgCtx.roundRect(0,0,S.cvW,S.cvH,12); bgCtx.fill(); }
  else bgCtx.fillRect(0,0,S.cvW,S.cvH);
  const cwPx = isPortrait ? ch : cw;
  const chPx = isPortrait ? cw : ch;
  const grad=bgCtx.createLinearGradient(0,0,0,S.cvH);
  grad.addColorStop(0,p.sand1); grad.addColorStop(1,p.sand2);
  bgCtx.fillStyle=grad;
  bgCtx.fillRect(m,m,cwPx,chPx);
  const noise=noisePatternFor(bgCtx);
  if(noise){ bgCtx.fillStyle=noise; bgCtx.fillRect(m,m,cwPx,chPx); }
  const cx=m+cwPx/2, cy=m+chPx/2;
  const vg=bgCtx.createRadialGradient(cx,cy,Math.min(cwPx,chPx)*0.15,cx,cy,Math.max(cwPx,chPx)*0.7);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,'rgba(0,0,0,0.35)');
  bgCtx.fillStyle=vg; bgCtx.fillRect(m,m,cwPx,chPx);
  bgCtx.strokeStyle='rgba(120,80,40,0.08)';
  bgCtx.lineWidth=1;
  for(let y=m+2;y<m+chPx;y+=5){
    bgCtx.beginPath(); bgCtx.moveTo(m,y); bgCtx.lineTo(m+cwPx,y); bgCtx.stroke();
  }
  drawCourtBorder(bgCtx,m,m,cwPx,chPx,p);
  const tP=worldToScreen(CFG.throwX,CFG.throwY);
  bgCtx.beginPath(); bgCtx.arc(tP.x,tP.y,1.0*S.ppm,0,Math.PI*2);
  bgCtx.setLineDash([6,5]); bgCtx.strokeStyle='rgba(255,252,240,0.42)'; bgCtx.lineWidth=2; bgCtx.stroke(); bgCtx.setLineDash([]);
  const l1=worldToScreen(3.4,0), l2=worldToScreen(3.4,CFG.courtW);
  bgCtx.beginPath(); bgCtx.moveTo(l1.x,l1.y); bgCtx.lineTo(l2.x,l2.y);
  bgCtx.strokeStyle='rgba(255,252,240,0.20)'; bgCtx.lineWidth=2; bgCtx.stroke();
}
function resizeCanvas(){
  const wasPortrait=S.portrait;
  S.ppm=computePPM();
  const margin=Math.max(8, Math.round(S.ppm*0.4));
  if(S.portrait){S.cvW=CFG.courtW*S.ppm+margin*2; S.cvH=CFG.courtL*S.ppm+margin*2;}
  else{S.cvW=CFG.courtL*S.ppm+margin*2; S.cvH=CFG.courtW*S.ppm+margin*2;}
  S._margin=margin;
  dpr=Math.min(2,window.devicePixelRatio||1);
  canvas.width=S.cvW*dpr; canvas.height=S.cvH*dpr;
  canvas.style.width=S.cvW+'px'; canvas.style.height=S.cvH+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(wasPortrait!==S.portrait)S.aimAngle=defaultAimAngle();
  renderBackground();
}
function worldToScreen(x,y){
  const m=S._margin||CFG.margin;
  if(S.portrait)return{x:m+y*S.ppm, y:S.cvH-m-x*S.ppm};
  return{x:m+x*S.ppm, y:m+y*S.ppm};
}
function screenToWorld(sx,sy){
  const m=S._margin||CFG.margin;
  if(S.portrait)return{x:(S.cvH-m-sy)/S.ppm, y:(sx-m)/S.ppm};
  return{x:(sx-m)/S.ppm, y:(sy-m)/S.ppm};
}
window.addEventListener('resize',()=>{resizeCanvas()});
window.addEventListener('orientationchange',()=>{setTimeout(resizeCanvas,200)});

/* ===== FÍSICA ===== */
function getWallRest(){ return (typeof S.config.wallRest === 'number') ? S.config.wallRest : CFG.wallRest; }
function stepPhysics(dt){
  const bodies=S.bodies;
  const wr=getWallRest();
  for(const b of bodies){
    const sp=Math.hypot(b.vx,b.vy);
    if(sp>0){const dec=b.friction*dt; if(sp<=dec){b.vx=0;b.vy=0}else{const k=(sp-dec)/sp;b.vx*=k;b.vy*=k}}
    b.x+=b.vx*dt; b.y+=b.vy*dt;
  }
  for(const b of bodies){
    if(b.x-b.r<0){b.x=b.r;if(b.vx<0)b.vx=-b.vx*wr}
    if(b.x+b.r>CFG.courtL){b.x=CFG.courtL-b.r;if(b.vx>0)b.vx=-b.vx*wr}
    if(b.y-b.r<0){b.y=b.r;if(b.vy<0)b.vy=-b.vy*wr}
    if(b.y+b.r>CFG.courtW){b.y=CFG.courtW-b.r;if(b.vy>0)b.vy=-b.vy*wr}
  }
  for(let i=0;i<bodies.length;i++)
    for(let j=i+1;j<bodies.length;j++) collide(bodies[i],bodies[j]);
}

function triggerExplosion(ball){
  if(!ball || !ball.explosive || ball.exploded) return;
  ball.exploded = true;
  const R = CFG.explosionRadius;
  const FORCE = CFG.explosionForce;
  for(const other of S.bodies){
    if(other === ball) continue;
    const dx = other.x - ball.x;
    const dy = other.y - ball.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if(d < R && d > 0.01){
      const isMingoFrozen = other.isMingo && S.mingoFrozenThrowsLeft > 0;
      if(!isMingoFrozen){
        const f = (1 - d/R) * FORCE;
        other.vx += (dx/d) * f;
        other.vy += (dy/d) * f;
      }
      if(other.explosive && !other.exploded){
        other.exploded = true;
      }
    }
  }
  S.explosions.push({
    x: ball.x, y: ball.y,
    born: performance.now(), life: 600, radius: R
  });
  S.fiesta.shakeUntil = performance.now() + 320;
  S.fiesta.shakeMag = 6;
  sfx('hit', 1.0, panFromWorld(ball.x));
  // TODO: SFX fiesta -> explosión real
  spawnFloatingText('¡EPA!', ball.x, ball.y - 0.6, '#ff3b30');
}

function collide(a,b){
  const dx=b.x-a.x, dy=b.y-a.y;
  const d2=dx*dx+dy*dy;
  const rr=a.r+b.r;
  if(d2>=rr*rr || d2<1e-9) return;

  const now=performance.now();
  const cx=(a.x+b.x)/2;
  const pan=panFromWorld(cx);
  const isMingoHit = (a.isMingo !== b.isMingo);
  const mingoB = isMingoHit ? (a.isMingo ? a : b) : null;
  const otherB = isMingoHit ? (a.isMingo ? b : a) : null;
  const frozen = S.mingoFrozenThrowsLeft > 0;
  const isCocuy = otherB && otherB.immuneToMingo === true;

  let savedMingoPos = null;

  if(isMingoHit){
    const myTeam=(S.players.find(p=>p.isMe)||{}).team;

    if(frozen){
      if(isCocuy){
        S.mingoFrozenThrowsLeft = 0;
        spawnFloatingText('🧊💥', mingoB.x, mingoB.y - 0.5, '#4ab0d0');
      }
      savedMingoPos = { x: mingoB.x, y: mingoB.y };
      sfx('mingo', 0.3, pan);
    } else if(isCocuy){
      sfx('mingo', 0.5, pan);
    } else {
      if(!otherB.invalid){
        otherB.invalid=true;
        otherB.invalidAt=now;
        sfx('invalid', 0.5, pan);
        speak('Descalificada');
        if(otherB.causedByRon){
          const thrower = getPlayer(otherB.playerId);
          if(thrower){
            thrower.turnsToSkip = (thrower.turnsToSkip || 0) + 1;
            spawnFloatingText('¡Turno perdido!', CFG.throwX + 0.5, CFG.throwY - 1, '#ff5d7d');
          }
        }
        if(myTeam!==undefined && otherB.team===myTeam){
          S.stats.invalids++;
          if(S.stats.invalids>=3) unlockAchievement('triple_invalid');
        }
      }
      sfx('mingo', 0.5, pan);
    }
  } else if(a.team !== b.team && a.team>=0 && b.team>=0 && !a.invalid && !b.invalid){
    const aSpd=Math.hypot(a.vx,a.vy), bSpd=Math.hypot(b.vx,b.vy);
    const myTeam=(S.players.find(p=>p.isMe)||{}).team;
    if(myTeam!==undefined && !S.isSpectator){
      const aHitsB = aSpd>0.8 && bSpd<0.5;
      const bHitsA = bSpd>0.8 && aSpd<0.5;
      if((aHitsB && a.team===myTeam) || (bHitsA && b.team===myTeam)){
        if(!S._bocheThisTurn){
          S._bocheThisTurn=true;
          speak('Boche');
        }
        S.stats.boches++;
        if(S.stats.boches===1) unlockAchievement('first_boche');
      }
    }
  }

  const d=Math.sqrt(d2), nx=dx/d, ny=dy/d;
  const overlap=rr-d;
  const ima=1/a.m, imb=1/b.m, imSum=ima+imb;
  a.x-=nx*overlap*(ima/imSum); a.y-=ny*overlap*(ima/imSum);
  b.x+=nx*overlap*(imb/imSum); b.y+=ny*overlap*(imb/imSum);
  const rvx=b.vx-a.vx, rvy=b.vy-a.vy;
  const vn=rvx*nx+rvy*ny;
  if(vn>0) return;
  const J=-(1+CFG.ballRest)*vn/imSum;
  a.vx-=J*nx*ima; a.vy-=J*ny*ima;
  b.vx+=J*nx*imb; b.vy+=J*ny*imb;
  if(Math.abs(vn)>0.8) sfx('hit', Math.min(1, Math.abs(vn)/14), pan);

  if(savedMingoPos){
    mingoB.x = savedMingoPos.x;
    mingoB.y = savedMingoPos.y;
    mingoB.vx = 0;
    mingoB.vy = 0;
  }

  if(a.explosive && !a.exploded) triggerExplosion(a);
  if(b.explosive && !b.exploded) triggerExplosion(b);
}

function allStopped(){
  for(const b of S.bodies) if(Math.abs(b.vx)>0.04||Math.abs(b.vy)>0.04)return false;
  return true;
}

/* ===== HELPERS DE JUEGO ===== */
function playersOfTeam(t){return S.players.filter(p=>p.team===t).sort((a,b)=>a.slot-b.slot)}
function getPlayer(id){return S.players.find(p=>p.id===id)||null}
function teamDisplayName(i){
  if(isIndiv()){ const p=playersOfTeam(i)[0]; return p?p.name:'Jugador '+(i+1); }
  return S.config.teamNames[i]||('Equipo '+(i+1));
}
function teamDisplayColor(i){
  if(isIndiv()){ const p=playersOfTeam(i)[0]; return p?p.color:'#fff'; }
  return S.config.teamColors[i]||(i===0?'#3b8bff':'#ff5d7d');
}
function teamBallsOnCourt(t){ return S.bodies.filter(b=>!b.isMingo && b.team===t && !b.invalid).length; }
function closestOfTeam(t){
  const m=S.bodies.find(b=>b.isMingo);
  if(!m)return null;
  let best=null, bd=Infinity;
  for(const b of S.bodies){
    if(b.isMingo||b.team!==t||b.invalid)continue;
    const d=dist(b,m);
    if(d<bd){bd=d;best=b}
  }
  return best;
}
function currentPlayer(){
  const team=playersOfTeam(S.currentTeam);
  return team[S.currentSlot]||team[0]||null;
}
function defaultAimAngle(){
  const m=S.bodies.find(b=>b.isMingo);
  if(!m)return 0;
  return Math.atan2(m.y-CFG.throwY, m.x-CFG.throwX);
}
function winScore(){return isIndiv()?CFG.winScoreIndividual:CFG.winScoreTeams}
function didIWin(winner){
  if(winner<0)return false;
  if(!S.isMultiplayer) return winner===0;
  const me=S.players.find(p=>p.isMe);
  return !!(me && me.team===winner);
}

/* ===== FIESTA HELPERS ===== */
function fiestaActive(){ return S.config.fiestaMode === true; }

function ensureCantina(p){
  if(!p) return;
  if(!p.cantina) p.cantina = { ron:1, cerveza:1, cocuy:1, cafe:1 };
  if(p.drinksTaken === undefined) p.drinksTaken = 0;
  if(p.turnId === undefined) p.turnId = 0;
  if(p.lastDrinkTurnId === undefined) p.lastDrinkTurnId = -999;
  if(p.activeDrink === undefined) p.activeDrink = null;
  if(p.pendingRonDebuff === undefined) p.pendingRonDebuff = false;
  if(p.turnsToSkip === undefined) p.turnsToSkip = 0;
}
function cantinaHasAny(p){
  if(!p || !p.cantina) return false;
  return DRINK_KEYS.some(k => (p.cantina[k]||0) > 0);
}
function canPlayerDrink(p){
  if(!fiestaActive() || !p) return false;
  if(!cantinaHasAny(p)) return false;
  if(S.turnCounter < S.noDrinkUntilTurnCounter) return false;
  const turnId = p.turnId || 0;
  const last = p.lastDrinkTurnId !== undefined ? p.lastDrinkTurnId : -999;
  if(last >= turnId - 1) return false;
  return true;
}
function playerHasJuma(p){
  return fiestaActive() && p && (p.drinksTaken || 0) >= 2;
}
function jumaAimNoise(p){
  if(!playerHasJuma(p)) return 0;
  return 0.04 * Math.max(0, (p.drinksTaken || 0) - 2);
}
function showBuchiPhrase(phrase){
  if(!S.buchiEnabled || !phrase) return;
  const sp=$('buchiSpeech');
  if(!sp) return;
  sp.textContent = phrase;
  sp.style.animation='none';
  void sp.offsetWidth;
  sp.style.animation='buchiSpeechPop .3s ease-out both';
}
function spawnFloatingText(text,x,y,color){
  S.fiesta.floatingTexts.push({text, x, y, color:color||'#ffd166', born:performance.now(), life:1400});
}
function spawnBubbles(count){
  for(let i=0;i<count;i++){
    S.fiesta.bubbles.push({
      x:rnd(0, CFG.courtL), y:CFG.courtW+rnd(0,1),
      vy:-rnd(0.8,1.6), r:rnd(0.05,0.12),
      born:performance.now(), life:rnd(1800,2600)
    });
  }
}
function spawnVapor(x,y){
  for(let i=0;i<2;i++){
    S.fiesta.vapor.push({
      x:x+rnd(-0.15,0.15), y:y+rnd(-0.1,0.1),
      vy:-rnd(0.4,0.9), vx:rnd(-0.2,0.2),
      r:rnd(0.04,0.09), born:performance.now(), life:rnd(900,1400)
    });
  }
}
function triggerCocuyFlash(){
  S.fiesta.cocuyFlashUntil = performance.now() + 180;
  S.fiesta.shakeUntil = performance.now() + 320;
  S.fiesta.shakeMag = 4;
}

function applyDrinkPhraseAndFx(p, drinkType){
  const d=DRINKS[drinkType];
  if(!d) return;
  spawnFloatingText(d.phrases[Math.floor(Math.random()*d.phrases.length)],
    CFG.throwX+0.6, CFG.throwY-0.6, d.color);
  // TODO: SFX fiesta -> hielo + "¡Salud!"
  if(drinkType==='cerveza'){ spawnBubbles(30); /* TODO: SFX fiesta -> "psss" lata */ }
  if(drinkType==='cocuy'){ triggerCocuyFlash(); /* TODO: SFX fiesta -> golpe seco + "¡epa!" */ }
  if(drinkType==='cafe'){ spawnVapor(CFG.throwX, CFG.throwY); }
  if(S.buchiEnabled) showBuchiPhrase(d.buchi);
}

function applyDrinkForPlayer(p, drinkType){
  if(!p) return false;
  ensureCantina(p);
  if((p.cantina[drinkType]||0)<=0) return false;
  if(!canPlayerDrink(p)) return false;

  p.cantina[drinkType]--;
  p.lastDrinkTurnId = p.turnId || 0;

  applyDrinkPhraseAndFx(p, drinkType);
  const label = drinkType==='cafe'?'un cafecito':(drinkType==='cerveza'?'una Polar':(drinkType==='ron'?'un Cacique':'un Cocuy'));
  showCenterToast(`${p.name} se metió ${label}`, DRINKS[drinkType].icon, 'trago', 3200);

  if(drinkType==='cafe'){
    p.activeDrink = { type: 'cafe', throwsLeft: 1, effects: { perfectAim: true } };
    p.drinksTaken = 0;
    p.pendingRonDebuff = false;
    p.turnsToSkip = 0;
    delete S.laRondaActiveFor[p.id];
    S._lastCafeRound = S.round;
    S.mingoFrozenThrowsLeft = 0;
    S.noDrinkUntilTurnCounter = S.turnCounter + 2;
    S.ballsLeft[S.currentTeam] = Math.max(0, (S.ballsLeft[S.currentTeam]||1) - 1);
    S.phase='settling'; settleTimer=0.4;
    updateUI();
    showCenterToast('Turno perdido · cancha sobria', '☕', 'info', 3000);
    if(S.isMultiplayer && S.isHost) broadcastState();
    return true;
  }

  p.drinksTaken = (p.drinksTaken||0) + 1;
  const ad = { type: drinkType, throwsLeft: 1, effects: {} };

  if(drinkType==='ron'){
    ad.effects.doublePoints = true;
    ad.effects.selfMingoPenalty = true;
    S.players.forEach(other => {
      if(other.id !== p.id && other.team !== p.team) {
        other.pendingRonDebuff = true;
      }
    });
    spawnFloatingText('¡SALUD!', CFG.courtL/2, CFG.courtW/2, '#ffd166');
  } else if(drinkType==='cerveza'){
    ad.effects.perfectAim = true;
    ad.effects.speedMul = 0.75;
    S.mingoFrozenThrowsLeft = CFG.freezeThrows;
    spawnFloatingText('🧊 Mingo congelado', CFG.courtL/2, CFG.courtW - 1, '#4ab0d0');
    showCenterToast('Mingo congelado 2 turnos', '🧊', 'info', 3000);
  } else if(drinkType==='cocuy'){
    ad.effects.massMul = 1.30;
    ad.effects.immuneToMingo = true;
    ad.effects.explosive = true;
    ad.effects.wildChance = 0.40;
  }

  p.activeDrink = ad;
  if(drinkType==='cocuy') S._usedCocuyThisGame = true;
  if(p.drinksTaken>=2) {
    showCenterToast(`${p.name} está rascao`, '🍻', 'rascao', 3500);
    if(S.buchiEnabled) showBuchiPhrase("Bueno, ya estás rascao'…");
  }
  updateUI();
  if(S.isMultiplayer && S.isHost) broadcastState();
  return true;
}

function applyLaRondaDrink(p, drinkType){
  if(!p) return;
  ensureCantina(p);
  if(drinkType==='ron'){
    S.players.forEach(other => {
      if(other.id !== p.id && other.team !== p.team){
        other.pendingRonDebuff = true;
      }
    });
  } else if(drinkType==='cerveza'){
    S.mingoFrozenThrowsLeft = Math.max(S.mingoFrozenThrowsLeft, CFG.freezeThrows);
  } else if(drinkType==='cocuy'){
    triggerCocuyFlash();
  }
}

function updateDrinkButton(){
  const btn=$('drinkBtn'); if(!btn)return;
  if(!fiestaActive() || S.screen!=='game' || S.isSpectator){ btn.style.display='none'; return; }
  if(!isMyTurn()){ btn.style.display='none'; return; }
  const p=currentPlayer();
  if(!p){ btn.style.display='none'; return; }
  ensureCantina(p);
  if(!cantinaHasAny(p)){ btn.style.display='none'; return; }
  btn.style.display='';
  if(S.turnCounter < S.noDrinkUntilTurnCounter){
    btn.disabled = true;
    btn.textContent = '🍹 Nevera bloqueada';
  } else if(canPlayerDrink(p)){
    btn.disabled = false;
    btn.textContent = '🍹 Tomar';
  } else {
    btn.disabled = true;
    btn.textContent = '🍹 Ya tomaste';
  }
}

function openNevera(){
  if(!fiestaActive() || !isMyTurn()) return;
  const p=currentPlayer();
  if(!p) return;
  ensureCantina(p);
  if(S.turnCounter < S.noDrinkUntilTurnCounter){ toast('🚫 Nevera bloqueada por café rival'); return; }
  if(!canPlayerDrink(p)){ toast('Ya tomaste este turno o el anterior'); return; }
  renderDrinkGrid();
  const dm=$('drinkModal'); if(!dm) return;
  dm.classList.add('open');
  if(S.buchiEnabled) showBuchiPhrase('¿Qué se va a tomar, mi pana?');
}

function renderDrinkGrid(){
  const p=currentPlayer();
  if(!p) return;
  const grid=$('drinkGrid'); if(!grid) return;
  const blocked = S.turnCounter < S.noDrinkUntilTurnCounter;
  let html='';
  if(blocked){
    html += '<p style="grid-column:1/-1;text-align:center;color:#ff5d7d;font-size:12px;margin:0 0 8px">🚫 Nevera bloqueada por café rival</p>';
  }
  for(const k of DRINK_KEYS){
    const d=DRINKS[k];
    const stock=p.cantina[k]||0;
    const disabled=stock<=0 || blocked;
    const imgSrc = DRINK_ASSETS[k];
    html+=`<button type="button" class="drink-option" data-drink="${k}" ${disabled?'disabled':''}>
      <div class="drink-img">
        <img src="${imgSrc}" alt="${d.name}" onerror="this.style.display='none';this.nextElementSibling.style.display=''">
        <span class="drink-placeholder" style="display:none">${d.icon}</span>
      </div>
      <div class="drink-content">
        <div class="d-name">${d.name}</div>
        <div class="d-brand">${d.brand}</div>
        <div class="d-buff">✔ ${d.buffs}</div>
        <div class="d-others">${d.othersIcon} ${d.others}</div>
        <div class="d-debuff">✘ ${d.debuffs}</div>
        <div class="d-stock">Stock: ${stock}/1 ${stock<=0?'· ✓ Usado':''}</div>
      </div>
    </button>`;
  }
  grid.innerHTML=html;
  grid.querySelectorAll('[data-drink]').forEach(b=>{
    b.addEventListener('click',()=>{ selectDrink(b.dataset.drink); });
  });
}

function selectDrink(drinkType){
  if(!fiestaActive() || !isMyTurn()) return;
  const p=currentPlayer();
  if(!p) return;
  ensureCantina(p);
  if(S.turnCounter < S.noDrinkUntilTurnCounter){ toast('🚫 Nevera bloqueada'); return; }
  if(!canPlayerDrink(p)){ toast('No puedes tomar ahora'); return; }
  if((p.cantina[drinkType]||0)<=0){ toast('No te queda de eso'); return; }

  if(S.isMultiplayer && !S.isHost){
    if(S.hostConn && S.hostConn.open){
      try{ S.hostConn.send({type:'drink', playerId:p.id, drinkType}); }catch(_){}
    }
    $('drinkModal').classList.remove('open');
    return;
  }

  if(applyDrinkForPlayer(p, drinkType)){
    $('drinkModal').classList.remove('open');
    if(S.isMultiplayer && S.isHost){
      const label = drinkType==='cafe'?'un cafecito':(drinkType==='cerveza'?'una Polar':(drinkType==='ron'?'un Cacique':'un Cocuy'));
      const toastMsg = `${DRINKS[drinkType].icon} ${p.name} se metió ${label}`;
      S.connections.forEach(c => {
        if(c.open) try { c.send({type:'drinkToast', msg:toastMsg}); } catch(_){}
      });
    }
  }
}

function showLaRondaBanner(){
  const el=document.createElement('div');
  el.className='la-ronda-banner';
  el.innerHTML="🎉 ¡LA RONDA! 🎉<br><span style=\"font-size:13px;font-weight:600\">\"¡Ronda pa' todos, que la paga el que va ganando!\"</span>";
  document.body.appendChild(el);
  setTimeout(()=>{ try{el.remove();}catch(_){} }, 3400);
}

/* ===== BUILD PLAYERS ===== */
function buildPlayersSolo(){
  S.players=[];
  const me=S.username||'Tú';
  const initFiesta = fiestaActive();
  if(isIndiv()){
    const n=S.config.individualCount||4;
    for(let i=0;i<n;i++){
      const isMe=i===0;
      S.players.push({
        id:'ip'+i, name:isMe?me:('IA '+i),
        color:CFG.indivPalette[i%CFG.indivPalette.length], team:i, slot:0,
        isHuman:isMe, isMe, peerId:null,
        cantina: initFiesta?{ron:1,cerveza:1,cocuy:1,cafe:1}:null,
        drinksTaken:0, turnId:0, lastDrinkTurnId:-999, activeDrink:null,
        pendingRonDebuff:false, turnsToSkip:0
      });
    }
    S.teams=S.players.map(()=>({score:0}));
  }else{
    const n=S.config.playersPerTeam;
    for(let t=0;t<2;t++){
      for(let s=0;s<n;s++){
        const isMe=t===0;
        S.players.push({
          id:'p'+t+'_'+s, name:isMe?me:(t===0?'IA T':'IA R')+(n>1?(s+1):''),
          color:CFG.palette[t][s%CFG.palette[t].length], team:t, slot:s,
          isHuman:t===0, isMe, peerId:null,
          cantina: initFiesta?{ron:1,cerveza:1,cocuy:1,cafe:1}:null,
          drinksTaken:0, turnId:0, lastDrinkTurnId:-999, activeDrink:null,
          pendingRonDebuff:false, turnsToSkip:0
        });
      }
    }
    S.teams=[{score:0},{score:0}];
  }
}

/* ===== CONFIG PERSISTENCE ===== */
function saveConfigFromUI(prefix){
  const cfg=getSavedConfig();
  if(prefix==='solo'){
    cfg.soloGameMode=$('soloGameMode').value;
    cfg.soloPlayers=$('soloPlayers').value;
    cfg.soloTeam0=$('soloTeam0').value;
    cfg.soloTeam1=$('soloTeam1').value;
    cfg.soloPlayerCount=$('soloPlayerCount').value;
    cfg.soloDifficulty=$('soloDifficulty').value;
    cfg.soloSpeed=$('soloSpeed').value;
    cfg.soloMaxRounds=$('soloMaxRounds').value;
    cfg.soloWallRest=$('soloWallRest').value;
    cfg.soloTurnTimeout=$('soloTurnTimeout').value;
    if($('soloFiesta')) cfg.soloFiesta=$('soloFiesta').checked;
  }else if(prefix==='room'){
    cfg.roomGameMode=$('roomGameMode').value;
    cfg.roomPlayers=$('roomPlayers').value;
    cfg.roomMaxPlayers=$('roomMaxPlayers').value;
    cfg.roomSpeed=$('roomSpeed').value;
    cfg.roomMaxRounds=$('roomMaxRounds').value;
    cfg.roomWallRest=$('roomWallRest').value;
    cfg.roomTurnTimeout=$('roomTurnTimeout').value;
    if($('roomFiesta')) cfg.roomFiesta=$('roomFiesta').checked;
  }
  saveSavedConfig(cfg);
}
function applySavedConfig(){
  const cfg=getSavedConfig();
  if(cfg.soloGameMode){$('soloGameMode').value=cfg.soloGameMode; $('soloGameMode').dispatchEvent(new Event('change'));}
  if(cfg.soloPlayers)$('soloPlayers').value=cfg.soloPlayers;
  if(cfg.soloTeam0)$('soloTeam0').value=cfg.soloTeam0;
  if(cfg.soloTeam1)$('soloTeam1').value=cfg.soloTeam1;
  if(cfg.soloPlayerCount)$('soloPlayerCount').value=cfg.soloPlayerCount;
  if(cfg.soloDifficulty)$('soloDifficulty').value=cfg.soloDifficulty;
  if(cfg.soloSpeed)$('soloSpeed').value=cfg.soloSpeed;
  if(cfg.soloMaxRounds)$('soloMaxRounds').value=cfg.soloMaxRounds;
  if(cfg.soloWallRest)$('soloWallRest').value=cfg.soloWallRest;
  if(cfg.soloTurnTimeout)$('soloTurnTimeout').value=cfg.soloTurnTimeout;
  if($('soloFiesta')) $('soloFiesta').checked = !!cfg.soloFiesta;
  if(cfg.roomGameMode){$('roomGameMode').value=cfg.roomGameMode; $('roomGameMode').dispatchEvent(new Event('change'));}
  if(cfg.roomPlayers)$('roomPlayers').value=cfg.roomPlayers;
  if(cfg.roomMaxPlayers)$('roomMaxPlayers').value=cfg.roomMaxPlayers;
  if(cfg.roomSpeed)$('roomSpeed').value=cfg.roomSpeed;
  if(cfg.roomMaxRounds)$('roomMaxRounds').value=cfg.roomMaxRounds;
  if(cfg.roomWallRest)$('roomWallRest').value=cfg.roomWallRest;
  if(cfg.roomTurnTimeout)$('roomTurnTimeout').value=cfg.roomTurnTimeout;
  if($('roomFiesta')) $('roomFiesta').checked = !!cfg.roomFiesta;
}

/* ===== FLUJO SOLO ===== */
function startSoloGame(){
  const uname=(($('usernameInput').value||'').trim());
  if(uname.length<2){toast('Ingresa tu nombre (mín. 2 caracteres)');$('usernameInput').focus();return}
  S.username=uname; localStorage.setItem('bolasUsername',uname);
  S.mode='solo'; S.isMultiplayer=false; S.isHost=true; S.isSpectator=false;
  S.config.gameMode=$('soloGameMode').value||'teams';
  if(isIndiv()){
    S.config.individualCount=parseInt($('soloPlayerCount').value,10)||4;
    S.config.individualBallsPerPlayer=2;
    S.config.teamNames=['',''];
  }else{
    S.config.playersPerTeam=parseInt($('soloPlayers').value,10)||3;
    S.config.teamNames[0]=($('soloTeam0').value||'Azul').slice(0,12);
    S.config.teamNames[1]=($('soloTeam1').value||'Rojo').slice(0,12);
  }
  S.config.difficulty=parseInt($('soloDifficulty').value,10)||1;
  S.config.speed=parseFloat($('soloSpeed').value)||1;
  S.config.maxRounds=parseInt($('soloMaxRounds').value,10)||0;
  S.config.wallRest=parseFloat($('soloWallRest').value)||0.55;
  S.config.turnTimeout=parseInt($('soloTurnTimeout').value,10)||0;
  S.config.teamColors=[CFG.palette[0][0],CFG.palette[1][0]];
  S.config.fiestaMode = $('soloFiesta') ? $('soloFiesta').checked : false;
  buildPlayersSolo();
  resetFiestaState();
  newGame();
  resizeCanvas();
  show('game');
  updateUI();
  if(fiestaActive()) showCenterToast('Modo Fiesta activado. ¡Salud!', '🍹', 'info', 3500);
  if(!S._hintShown){S._hintShown=true; setTimeout(()=>toast('⚠️ Si tu bola toca el mingo, queda descalificada', 4500), 600);}
}
function resetFiestaState(){
  S.laRondaDone=false; S.laRondaRound=-1; S.laRondaActiveFor={};
  S._pendingLaRondaBonus=false; S._lastCafeRound=-1; S._usedCocuyThisGame=false;
  S.fiesta.particles=[]; S.fiesta.bubbles=[]; S.fiesta.vapor=[]; S.fiesta.floatingTexts=[];
  S.fiesta.shakeUntil=0; S.fiesta.cocuyFlashUntil=0;
  S.mingoFrozenThrowsLeft=0;
  S.noDrinkUntilTurnCounter=-1;
  S._skipFreezeDecrement=false;
  S.explosions=[];
}
function newGame(){
  if(isIndiv()) S.teams=S.players.map(()=>({score:0}));
  else S.teams=[{score:0},{score:0}];
  S.round=1; S.breakTaken=false;
  S.roundStarter=Math.floor(Math.random()*S.teams.length);
  S.stats = { invalids: 0, boches: 0, roundAtWin: 0 };
  S.turnCounter = 0;
  startRound();
}
function startRound(){
  S.bodies=[];
  const mx=rnd(14.5,21.0), my=rnd(2.0,8.0);
  S.bodies.push({x:mx,y:my,vx:0,vy:0,r:CFG.mingoR,m:0.55,friction:CFG.mingoFriction,isMingo:true,team:-1,playerId:null,color:'#fff8e0',invalid:false,invalidAt:0});
  const N=S.teams.length;
  S.ballsLeft=new Array(N).fill(0);
  if(isIndiv()){for(let i=0;i<N;i++) S.ballsLeft[i]=S.config.individualBallsPerPlayer||2;}
  else{for(let i=0;i<N;i++) S.ballsLeft[i]=playersOfTeam(i).length;}
  S.currentTeam=S.roundStarter%N;
  S.currentSlot=0;
  S.phase='aiming'; S.charging=false; S.charge=0;
  S.aimAngle=defaultAimAngle();
  S.turnStartedAt=performance.now();
  S.turnTimeoutFired=false;
  S._bocheThisTurn=false;
  S.mingoFrozenThrowsLeft = 0;
  S.noDrinkUntilTurnCounter = -1;
  S._skipFreezeDecrement = false;
  S.explosions = [];
  if(fiestaActive()){
    S.players.forEach(p=>{
      ensureCantina(p);
      p.activeDrink = null;
    });
    S.laRondaActiveFor={};
    const p0=currentPlayer();
    if(p0) p0.turnId=(p0.turnId||0)+1;
  }
  updateUI();
  sfx('tick');
  maybeAI();
}
function nextThrower(){
  const N=S.teams.length;
  const remaining=[];
  for(let i=0;i<N;i++) if(S.ballsLeft[i]>0) remaining.push(i);
  if(remaining.length===0) return null;
  if(remaining.length===1) return remaining[0];
  const m=S.bodies.find(b=>b.isMingo);
  const noBalls=remaining.filter(i=>teamBallsOnCourt(i)===0);
  if(noBalls.length>0){
    for(let k=0;k<N;k++){const i=(S.roundStarter+k)%N; if(noBalls.includes(i))return i;}
    return noBalls[0];
  }
  let farthest=-1, fd=-1;
  for(const i of remaining){
    const c=closestOfTeam(i);
    if(!c) continue;
    const d=dist(c,m);
    if(d>fd){fd=d;farthest=i}
  }
  return farthest>=0?farthest:remaining[0];
}
function performThrow(team,playerId,angle,speed){
  const p=getPlayer(playerId);
  if(!p)return;
  let speedMul=1, massMul=1, aimOffset=0, wildDeviation=null, radiusMul=1;
  let activeDrinkType=null;
  let perfectAim = false;
  let doublePoints = false;
  let selfMingoPenalty = false;
  let immuneToMingo = false;
  let explosive = false;

  if(fiestaActive()){
    ensureCantina(p);
    let ad = p.activeDrink;
    if(!ad && S.laRondaActiveFor[p.id]){
      ad = S.laRondaActiveFor[p.id];
      p.activeDrink = ad;
    }
    if(ad && ad.throwsLeft > 0){
      activeDrinkType = ad.type;
      if(ad.type==='ron'){
        speedMul *= 1.15;
        doublePoints = true;
        selfMingoPenalty = true;
      } else if(ad.type==='cerveza'){
        speedMul *= 0.75;
        perfectAim = true;
      } else if(ad.type==='cocuy'){
        massMul *= 1.30;
        radiusMul *= 1.10;
        immuneToMingo = true;
        explosive = true;
        if(Math.random() < 0.40){
          wildDeviation = (Math.random() < 0.5 ? -1 : 1) * 0.30;
        }
      } else if(ad.type==='cafe'){
        perfectAim = true;
      }
      ad.throwsLeft--;
      if(ad.throwsLeft <= 0){
        p.activeDrink = null;
        if(S.laRondaActiveFor[p.id] === ad) delete S.laRondaActiveFor[p.id];
      }
    }
    if(!perfectAim){
      if(p.pendingRonDebuff){
        aimOffset += rnd(-0.10, 0.10);
      }
      const jn = jumaAimNoise(p);
      if(jn > 0) aimOffset += (Math.random()*2-1) * jn;
      if((p.drinksTaken || 0) >= 3 && activeDrinkType !== 'cerveza'){
        if(Math.random() < 0.20){
          aimOffset += (Math.random() < 0.5 ? -1 : 1) * 0.15;
        }
      }
    }
    if(p.pendingRonDebuff) p.pendingRonDebuff = false;
  }

  const finalAngle = angle + aimOffset + (wildDeviation || 0);
  speed = clamp(speed, CFG.minSpeed, CFG.maxSpeed) * speedMul;

  S.bodies.push({
    x:CFG.throwX, y:CFG.throwY,
    vx:Math.cos(finalAngle)*speed, vy:Math.sin(finalAngle)*speed,
    r:CFG.ballR*radiusMul, m:1*massMul, friction:CFG.friction,
    isMingo:false, team, playerId, color:p.color, invalid:false, invalidAt:0,
    fiestaDrink:activeDrinkType,
    doublePoints, selfMingoPenalty, immuneToMingo, explosive,
    exploded:false,
    causedByRon: activeDrinkType==='ron',
    causedByCocuy: activeDrinkType==='cocuy'
  });
  S.ballsLeft[team]--;
  S.phase='moving'; S.charging=false; S.charge=0;
  S._bocheThisTurn=false;
  stopChargeSound();
  updateUI(); sfx('throw',0.5,panFromWorld(CFG.throwX));
  if(fiestaActive() && activeDrinkType==='cocuy') triggerCocuyFlash();
  if(S.mingoFrozenThrowsLeft > 0 && activeDrinkType !== 'cerveza'){
    S.mingoFrozenThrowsLeft--;
  }
  if(S.isMultiplayer && S.isHost) broadcastState();
}
function resolveTurn(){
  S.turnCounter++;
  let nt=nextThrower();
  if(nt===null){endRound();return}
  S.currentTeam=nt;
  if(isIndiv()){
    S.currentSlot=0;
  }else{
    S.currentSlot=0;
    const team=playersOfTeam(nt);
    while(S.currentSlot<team.length){
      const hasThrown=S.bodies.some(b=>b.playerId===team[S.currentSlot].id);
      if(!hasThrown) break;
      S.currentSlot++;
    }
    if(S.currentSlot>=team.length) S.currentSlot=0;
  }

  const p = currentPlayer();
  if(p && p.turnsToSkip > 0){
    p.turnsToSkip--;
    S.ballsLeft[S.currentTeam] = Math.max(0, S.ballsLeft[S.currentTeam] - 1);
    showCenterToast(`${p.name} pierde el turno`, '🥃', 'alerta', 2800);
    S.phase = 'settling';
    settleTimer = 0.3;
    if(S.isMultiplayer && S.isHost) broadcastState();
    return;
  }

  S.aimAngle=defaultAimAngle();
  S.charge=0; S.charging=false; S.phase='aiming';
  S.turnStartedAt=performance.now();
  S.turnTimeoutFired=false;
  S._bocheThisTurn=false;
  if(fiestaActive()){
    const pN=currentPlayer();
    if(pN) pN.turnId=(pN.turnId||0)+1;
  }
  updateUI();
  sfx('tick');
  if(S.isMultiplayer && S.isHost) broadcastState();
  maybeAI();
}
function timeoutTurn(){
  if(S.phase!=='aiming') return;
  const team=S.currentTeam;
  if(S.ballsLeft[team]>0) S.ballsLeft[team]--;
  S.charging=false; stopChargeSound();
  S.phase='settling';
  settleTimer=0.3;
  updateUI();
  toast('⏱️ Tiempo agotado');
  sfx('invalid');
  if(S.isMultiplayer && S.isHost) broadcastState();
}

/* ===== IA ===== */
function maybeAI(){
  if(S.isMultiplayer)return;
  if(S.phase!=='aiming')return;
  if(S._toastPaused)return;
  const p=currentPlayer();
  if(!p||p.isHuman)return;
  if(S.aiPending)return;
  if(fiestaActive() && aiMaybeDrink()){
    const pAfter=currentPlayer();
    if(!pAfter || !pAfter.activeDrink || pAfter.activeDrink.throwsLeft<=0){
      return;
    }
    setTimeout(()=>{ if(S.phase==='aiming') aiThrow(); }, 600);
    return;
  }
  S.aiPending=true;
  setTimeout(()=>{
    S.aiPending=false;
    if(S.phase==='aiming' && !currentPlayer()?.isHuman) aiThrow();
  },700+Math.random()*500);
}

function aiMaybeDrink(){
  if(!fiestaActive()) return false;
  const p=currentPlayer();
  if(!p || p.isHuman) return false;
  ensureCantina(p);
  if(!canPlayerDrink(p)) return false;

  const diff = S.config.difficulty || 0;
  const probs = [0.20, 0.40, 0.60];
  const prob = probs[diff] || 0.40;
  if(Math.random() >= prob) return false;

  const myScore = S.teams[p.team]?.score || 0;
  const maxOther = Math.max(...S.teams.map((t, i) => i !== p.team ? t.score : 0));
  const scoreDiff = myScore - maxOther;

  if(diff === 0 && scoreDiff > -5) return false;

  if(diff === 2 && p.cantina.cafe > 0){
    const someoneJuma = S.players.some(other => other.id !== p.id && playerHasJuma(other));
    const mingoFrozen = S.mingoFrozenThrowsLeft > 0;
    const someoneRon = S.players.some(other => other.id !== p.id && other.pendingRonDebuff);
    if((someoneJuma || (mingoFrozen && scoreDiff < -3) || someoneRon) && Math.random() < 0.7){
      if(applyDrinkForPlayer(p, 'cafe')) return true;
    }
  }

  if(diff >= 1 && !p.cantina.cafe){
    const rivalRon = S.players.some(other => other.id !== p.id && other.pendingRonDebuff);
    if(rivalRon && p.cantina.cerveza > 0 && Math.random() < 0.6){
      if(applyDrinkForPlayer(p, 'cerveza')) return true;
    }
  }

  let choice = null;
  if(scoreDiff < 0){
    const avail = ['ron','cocuy'].filter(k => p.cantina[k] > 0);
    if(avail.length) choice = avail[Math.floor(Math.random()*avail.length)];
  } else {
    if(p.cantina.cerveza > 0) choice = 'cerveza';
    else if(p.cantina.ron > 0) choice = 'ron';
  }
  if(!choice) return false;
  return applyDrinkForPlayer(p, choice);
}

function aiThrow(){
  const mingo=S.bodies.find(b=>b.isMingo);
  if(!mingo)return;
  const p=currentPlayer();
  if(!p)return;
  const errors=[0.16,0.085,0.04];
  const powErrors=[0.16,0.08,0.032];
  const angErr=errors[S.config.difficulty]||0.08;
  const powErr=powErrors[S.config.difficulty]||0.075;
  const myBest=closestOfTeam(p.team);
  const dMy=myBest?dist(myBest,mingo):Infinity;
  let oppBest=null, dOpp=Infinity;
  for(let i=0;i<S.teams.length;i++){
    if(i===p.team)continue;
    const c=closestOfTeam(i);
    if(c){const d=dist(c,mingo); if(d<dOpp){dOpp=d;oppBest=c}}
  }
  let target={x:mingo.x,y:mingo.y}, powerMul=1;
  if(oppBest && dMy>dOpp){
    if(Math.random()<0.6){target={x:oppBest.x,y:oppBest.y};powerMul=1.5;}
    else target={x:mingo.x+rnd(-0.7,0.7),y:mingo.y+rnd(-0.7,0.7)};
  }else{
    target={x:mingo.x+rnd(-0.55,0.55),y:mingo.y+rnd(-0.55,0.55)};
  }
  const dx=target.x-CFG.throwX, dy=target.y-CFG.throwY;
  const d=Math.hypot(dx,dy);
  let speed=Math.sqrt(2*CFG.friction*d)*powerMul;
  speed*=1+rnd(-powErr,powErr);
  const angle=Math.atan2(dy,dx)+rnd(-angErr,angErr);
  performThrow(p.team, p.id, angle, speed);
}

/* ===== FIN DE RONDA ===== */
function endRound(){
  S.phase='roundEnd';
  const mingo=S.bodies.find(b=>b.isMingo);
  const N=S.teams.length;
  const dists=[];
  for(let i=0;i<N;i++){
    const c=closestOfTeam(i);
    dists.push(c?dist(c,mingo):Infinity);
  }
  let scorer=-1, bestDist=Infinity;
  for(let i=0;i<N;i++) if(dists[i]<bestDist){bestDist=dists[i];scorer=i}
  let pts=0;
  if(scorer>=0 && bestDist<Infinity){
    let secondBest=Infinity;
    for(let i=0;i<N;i++) if(i!==scorer && dists[i]<secondBest) secondBest=dists[i];
    const myBalls=S.bodies.filter(b=>!b.isMingo && b.team===scorer && !b.invalid);
    let scoringBalls;
    if(secondBest===Infinity) scoringBalls = myBalls;
    else scoringBalls = myBalls.filter(b=>dist(b,mingo)<secondBest);
    scoringBalls.forEach(b => { pts += (b.doublePoints ? 2 : 1); });
    if(pts<1) pts=1;
    S.teams[scorer].score+=pts;
    S.roundStarter=scorer;
    sfx('point');
    applauseSound();
    const myTeam = S.isMultiplayer ? (S.players.find(p=>p.isMe)||{}).team : 0;
    if(scorer===myTeam) speak('Buen tiro');
  }
  let body='';
  if(scorer>=0) body+=`<p><b>${escapeHtml(teamDisplayName(scorer))}</b> anota <b>${pts}</b> ${pts===1?'tanto':'tantos'}.</p>`;
  else body+='<p>Ronda empatada.</p>';
  body+=`<div class="big">${S.teams.map(t=>t.score).join(' — ')}</div>`;
  updateUI();

  if(fiestaActive() && !S.laRondaDone){
    const anyTen = S.teams.some(t=>t.score>=10);
    const roundHit = (S.round>0 && S.round%4===0);
    if(anyTen || roundHit){
      S.laRondaDone = true;
      S.laRondaRound = S.round;
      showLaRondaBanner();
      S.players.forEach(p=>{
        const rand=DRINK_KEYS[Math.floor(Math.random()*3)];
        S.laRondaActiveFor[p.id]={ type:rand, throwsLeft: 2 };
        applyLaRondaDrink(p, rand);
      });
      if(S.buchiEnabled) showBuchiPhrase("¡Ronda pa' todos, que la paga el que va ganando!");
      S._pendingLaRondaBonus = true;
      if(S.isMultiplayer && S.isHost) broadcastState();
    }
  }
  if(S._pendingLaRondaBonus && scorer>=0){
    S._pendingLaRondaBonus = false;
    const winnerP = playersOfTeam(scorer)[0];
    if(winnerP){
      ensureCantina(winnerP);
      const freeKey = DRINK_KEYS[Math.floor(Math.random()*DRINK_KEYS.length)];
      winnerP.cantina[freeKey] = (winnerP.cantina[freeKey]||0) + 1;
      showCenterToast(`${winnerP.name} ganó un ${DRINKS[freeKey].name} extra`, '🎁', 'info', 3500);
      if(S.isMultiplayer && S.isHost) broadcastState();
    }
  }

  const maxRounds=S.config.maxRounds||0;
  let winner=-1;
  let isDraw=false;
  if(maxRounds>0 && S.round>=maxRounds){
    let bestScore=-1;
    for(let i=0;i<N;i++) if(S.teams[i].score>bestScore){bestScore=S.teams[i].score; winner=i;}
    const tiedCount=S.teams.filter(t=>t.score===bestScore).length;
    if(tiedCount>1){isDraw=true; winner=-1;}
  } else {
    const ws=winScore();
    for(let i=0;i<N;i++) if(S.teams[i].score>=ws && (winner<0 || S.teams[i].score>S.teams[winner].score)) winner=i;
  }

  if(isDraw){
    S.phase='gameOver';
    if(S.username) recordGame(S.username, 'empate');
    showModal('🤝 ¡Empate!',
      body+`<p style="text-align:center;color:var(--muted)">Ronda límite alcanzada</p>`,
      'Revancha',
      ()=>{closeModal(); resetFiestaState(); newGame(); show('game');},
      { secondary: { text: 'Volver al menú', cb: () => { closeModal(); cleanupGame(); show('menu'); renderRanking(); renderFullRanking(); } }, autoSkip: false }
    );
    if(S.isMultiplayer && S.isHost) broadcastState();
    return;
  }

  if(winner>=0){
    S.phase='gameOver';
    if(S.isMultiplayer){
      if(S.isHost) S.players.filter(p=>p.team===winner && p.name && p.isHuman).forEach(p=>recordWin(p.name));
    }else{
      if(winner===0 && S.username) recordWin(S.username);
      else if(S.username) recordGame(S.username, 'derrota');
    }
    if(didIWin(winner)){
      sfx('victory');
      unlockAchievement('first_win');
      if(S.round<=5) unlockAchievement('fast_win');
      if(fiestaActive()){
        const me=S.players.find(p=>p.isMe);
        if(me){
          ensureCantina(me);
          if((me.drinksTaken||0)>=3) unlockAchievement('borrachito_feliz');
          if((me.drinksTaken||0)>=2) unlockAchievement('juma_suprema');
          if(S._lastCafeRound===S.round) unlockAchievement('cafecito_salvador');
          if(S._usedCocuyThisGame && S.round>=((maxRounds||99)-1)) unlockAchievement('ultimo_trago');
          const r=getRankings();
          if(r[me.name] && (me.drinksTaken||0)===0){
            r[me.name].soberWins=(r[me.name].soberWins||0)+1;
            if(r[me.name].soberWins>=5) unlockAchievement('conductor_designado');
            saveRankings(r);
          }
          if(S.laRondaDone) unlockAchievement('ronda_pagada');
        }
      }
    } else {
      sfx('defeat');
    }
    const roundInfo = maxRounds>0 && S.round>=maxRounds ? 'Ronda límite alcanzada' : `Ronda ${S.round}`;
    showModal(
      `🏆 ¡Gana ${escapeHtml(teamDisplayName(winner))}!`,
      body+`<p style="text-align:center;color:var(--muted)">${roundInfo}</p>`,
      'Revancha',
      ()=>{closeModal(); resetFiestaState(); newGame(); show('game');},
      { secondary: { text: 'Volver al menú', cb: () => { closeModal(); cleanupGame(); show('menu'); renderRanking(); renderFullRanking(); } }, autoSkip: false }
    );
    if(S.isMultiplayer && S.isHost) broadcastState();
    return;
  }

  if(!S.breakTaken && S.teams.some(t=>t.score>=CFG.breakScore)){S.breakTaken=true; body+='<p class="break">☕ Descanso de 10 minutos</p>';}

  const nextRoundCb=()=>{
    S.round++;
    startRound();
    if(S.isMultiplayer && S.isHost) broadcastState();
  };

  if(S.isMultiplayer && S.isHost){
    broadcastState();
    showModal(`Fin de la ronda ${S.round}`, body, 'Siguiente ronda', nextRoundCb, {autoSkip:true});
  }else if(!S.isMultiplayer){
    showModal(`Fin de la ronda ${S.round}`, body, 'Siguiente ronda', nextRoundCb, {autoSkip:true});
  }
}

/* ===== INPUT ===== */
function eventToWorld(e){
  const rect=canvas.getBoundingClientRect();
  const sx=(e.clientX-rect.left)*(S.cvW/rect.width);
  const sy=(e.clientY-rect.top)*(S.cvH/rect.height);
  return screenToWorld(sx,sy);
}
function isMyTurn(){
  if(S.isSpectator)return false;
  if(S.phase!=='aiming')return false;
  if(S._toastPaused)return false;
  const p=currentPlayer();
  if(!p)return false;
  if(!S.isMultiplayer) return p.isHuman && p.isMe;
  return p.isMe===true;
}
canvas.addEventListener('pointerdown',e=>{
  if(!isMyTurn())return;
  e.preventDefault();
  ensureAudio();
  if(actx&&actx.state==='suspended')actx.resume();
  S.charging=true; S.charge=0; S.chargeStart=performance.now();
  lastAimAngleForSwish=S.aimAngle;
  startChargeSound();
  const p=eventToWorld(e);
  const dx=p.x-CFG.throwX, dy=p.y-CFG.throwY;
  if(Math.hypot(dx,dy)>0.6) S.aimAngle=Math.atan2(dy,dx);
  try{canvas.setPointerCapture(e.pointerId)}catch(_){}
});
canvas.addEventListener('pointermove',e=>{
  if(!S.charging)return;
  e.preventDefault();
  const p=eventToWorld(e);
  const dx=p.x-CFG.throwX, dy=p.y-CFG.throwY;
  if(Math.hypot(dx,dy)>0.6){
    const newAngle=Math.atan2(dy,dx);
    if(Math.abs(newAngle - lastAimAngleForSwish) > 0.05){
      lastAimAngleForSwish=newAngle;
      swishSound();
    }
    S.aimAngle=newAngle;
  }
});
function releaseThrow(e){
  if(!S.charging)return;
  e.preventDefault();
  S.charging=false;
  stopChargeSound();
  const p=currentPlayer();
  if(!p)return;
  let baseSpeed=CFG.minSpeed+(CFG.maxSpeed-CFG.minSpeed)*S.charge;
  let angle=S.aimAngle;
  if(fiestaActive() && p.activeDrink && p.activeDrink.type==='ron'){
    angle += Math.sin(performance.now()*0.02)*0.08;
  }
  if(S.isMultiplayer){
    if(S.isHost) performThrow(S.currentTeam,p.id,angle,baseSpeed);
    else if(S.hostConn&&S.hostConn.open){
      try{S.hostConn.send({type:'throw',playerId:p.id,angle,speed:baseSpeed})}catch(_){}
      S.charge=0;
    }
  }else performThrow(S.currentTeam,p.id,angle,baseSpeed);
}
canvas.addEventListener('pointerup',releaseThrow);
canvas.addEventListener('pointercancel',()=>{S.charging=false;S.charge=0;stopChargeSound();});

/* ===== RENDER ===== */
function simulatePath(angle,speed){
  const pts=[{x:CFG.throwX,y:CFG.throwY}];
  let x=CFG.throwX,y=CFG.throwY;
  let vx=Math.cos(angle)*speed, vy=Math.sin(angle)*speed;
  const dt=FIXED, R=CFG.ballR;
  const wr=getWallRest();
  for(let i=0;i<960;i++){
    const sp=Math.hypot(vx,vy);
    if(sp<0.15)break;
    const dec=CFG.friction*dt;
    const k=Math.max(0,(sp-dec)/sp);
    vx*=k;vy*=k; x+=vx*dt; y+=vy*dt;
    if(x-R<0){x=R;vx=-vx*wr}
    if(x+R>CFG.courtL){x=CFG.courtL-R;vx=-vx*wr}
    if(y-R<0){y=R;vy=-vy*wr}
    if(y+R>CFG.courtW){y=CFG.courtW-R;vy=-vy*wr}
    if(i%6===0) pts.push({x,y});
  }
  pts.push({x,y});
  return {pts, endX:x, endY:y, distance:Math.hypot(x-CFG.throwX, y-CFG.throwY)};
}
function drawBall(sx,sy,r,c0,c1,elevation){
  elevation=elevation||0;
  const shadowOffX=1.6+elevation*4;
  const shadowOffY=2.6+elevation*6;
  const shadowScale=1+elevation*0.3;
  ctx.beginPath();
  ctx.ellipse(sx+shadowOffX,sy+shadowOffY,r*1.02*shadowScale,r*0.88*shadowScale,0,0,Math.PI*2);
  ctx.fillStyle='rgba(45,25,5,'+(0.30-elevation*0.1)+')'; ctx.fill();
  const g=ctx.createRadialGradient(sx-r*0.42,sy-r*0.48,r*0.08,sx,sy,r*1.2);
  g.addColorStop(0,c0); g.addColorStop(1,c1);
  ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
  ctx.lineWidth=1; ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.stroke();
  ctx.save();
  ctx.translate(sx-r*0.35,sy-r*0.40);
  ctx.rotate(-30*Math.PI/180);
  const spec=ctx.createRadialGradient(0,0,0,0,0,r*0.5);
  spec.addColorStop(0,'rgba(255,255,255,0.85)');
  spec.addColorStop(1,'rgba(255,255,255,0)');
  ctx.beginPath(); ctx.ellipse(0,0,r*0.42,r*0.22,0,0,Math.PI*2);
  ctx.fillStyle=spec; ctx.fill();
  ctx.restore();
}
function drawInvalidX(sx,sy,r,age){
  if(age!==undefined && age<400 && age>=0){
    const burst=age/400;
    const burstR=r*(1+burst*3);
    ctx.beginPath(); ctx.arc(sx,sy,burstR,0,Math.PI*2);
    ctx.strokeStyle=`rgba(255,255,255,${(1-burst)*0.8})`;
    ctx.lineWidth=3*(1-burst); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx,sy,burstR*0.7,0,Math.PI*2);
    ctx.fillStyle=`rgba(255,255,255,${(1-burst)*0.3})`; ctx.fill();
  }
  ctx.save();
  ctx.strokeStyle='rgba(255,255,255,0.97)';
  ctx.lineWidth=Math.max(2,r*0.24);
  ctx.lineCap='round';
  const d=r*0.52;
  ctx.beginPath();
  ctx.moveTo(sx-d,sy-d); ctx.lineTo(sx+d,sy+d);
  ctx.moveTo(sx+d,sy-d); ctx.lineTo(sx-d,sy+d);
  ctx.stroke(); ctx.restore();
}
function lighten(hex,amt){
  if(!hex)return '#fff'; if(hex.startsWith('rgb'))return hex;
  const h=hex.replace('#',''); const n=parseInt(h,16);
  let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  r=Math.min(255,Math.floor(r+(255-r)*amt)); g=Math.min(255,Math.floor(g+(255-g)*amt)); b=Math.min(255,Math.floor(b+(255-b)*amt));
  return `rgb(${r},${g},${b})`;
}
function darken(hex,amt){
  if(!hex)return '#000'; if(hex.startsWith('rgb'))return hex;
  const h=hex.replace('#',''); const n=parseInt(h,16);
  let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  r=Math.max(0,Math.floor(r*(1-amt))); g=Math.max(0,Math.floor(g*(1-amt))); b=Math.max(0,Math.floor(b*(1-amt)));
  return `rgb(${r},${g},${b})`;
}

function render(t){
  ctx.clearRect(0,0,S.cvW,S.cvH);
  if(bgCanvas) ctx.drawImage(bgCanvas,0,0,S.cvW,S.cvH);

  ctx.save();
  try {
    if(fiestaActive() && performance.now()<S.fiesta.shakeUntil){
      const m=S.fiesta.shakeMag * (S.fiesta.shakeUntil-performance.now())/320;
      ctx.translate(rnd(-m,m), rnd(-m,m));
    }

    if(S.phase==='moving'){
      for(const b of S.bodies){
        if(b.isMingo) continue;
        const sp=worldToScreen(b.x,b.y);
        const r=b.r*S.ppm;
        const speed=Math.hypot(b.vx,b.vy);
        const trailLen=Math.min(r*1.8, speed*S.ppm*0.035);
        const angle=Math.atan2(b.vy,b.vx);
        ctx.save();
        ctx.translate(sp.x,sp.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(-trailLen*0.5, r*0.55, r*1.05 + trailLen*0.5, r*0.45, 0, 0, Math.PI*2);
        const isCocuy = fiestaActive() && b.fiestaDrink==='cocuy';
        ctx.fillStyle= isCocuy ? 'rgba(255,59,48,0.35)' : 'rgba(20,15,8,0.28)';
        ctx.fill();
        ctx.restore();
      }
    }

    for(const b of S.bodies){
      const sp=worldToScreen(b.x,b.y);
      const r=b.r*S.ppm;

      if(fiestaActive() && !b.isMingo){
        if(b.fiestaDrink && !b.invalid){
          const auraMap = { ron:'212,160,23', cerveza:'6,214,160', cocuy:'255,59,48', cafe:'139,90,43' };
          const auraCol = auraMap[b.fiestaDrink];
          if(auraCol){
            const pulse = 0.6 + 0.4 * Math.sin(t/250);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, r + 4 + pulse*3, 0, Math.PI*2);
            ctx.strokeStyle = `rgba(${auraCol},${0.5 + pulse*0.3})`;
            ctx.lineWidth = 2.5;
            ctx.stroke();
          }
        }
        const owner = getPlayer(b.playerId);
        if(owner && playerHasJuma(owner)){
          const jp = 0.5 + 0.5 * Math.sin(t/300);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, r + 2 + jp*5, 0, Math.PI*2);
          ctx.strokeStyle = `rgba(255,50,50,${0.35 + jp*0.4})`;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }

      if(b.isMingo){
        const frozen = S.mingoFrozenThrowsLeft > 0;
        const c1 = frozen ? '6,214,160' : '255,209,102';
        const pulse=0.5+0.5*Math.sin(t/380);
        const pulse2=0.5+0.5*Math.sin(t/380+Math.PI*0.66);
        const pulse3=0.5+0.5*Math.sin(t/380+Math.PI*1.33);
        ctx.beginPath(); ctx.arc(sp.x,sp.y,r+4+pulse*3,0,Math.PI*2);
        ctx.strokeStyle=`rgba(${c1},${0.18+pulse*0.22})`; ctx.lineWidth=2; ctx.stroke();
        ctx.beginPath(); ctx.arc(sp.x,sp.y,r+10+pulse2*4,0,Math.PI*2);
        ctx.strokeStyle=`rgba(${c1},${0.10+pulse2*0.15})`; ctx.lineWidth=1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(sp.x,sp.y,r+16+pulse3*5,0,Math.PI*2);
        ctx.strokeStyle=`rgba(${c1},${0.06+pulse3*0.10})`; ctx.lineWidth=1; ctx.stroke();
        for(let i=0;i<6;i++){
          const angle=(i/6)*Math.PI*2 + t/1500;
          const distP=r+8+pulse*4+Math.sin(t/300+i)*2;
          const px=sp.x+Math.cos(angle)*distP;
          const py=sp.y+Math.sin(angle)*distP;
          const pSize=1.5+pulse*1;
          ctx.beginPath(); ctx.arc(px,py,pSize,0,Math.PI*2);
          ctx.fillStyle= frozen ? `rgba(150,230,255,${0.5+pulse*0.4})` : `rgba(255,230,150,${0.5+pulse*0.4})`;
          ctx.fill();
        }
        drawBall(sp.x,sp.y,r, frozen?'#d0eef5':'#ffffff', frozen?'#7ab0c0':'#cfc6ae',0.5);
        ctx.beginPath(); ctx.arc(sp.x,sp.y,r*0.30,0,Math.PI*2);
        ctx.fillStyle= frozen ? '#4ab0d0' : '#e0553f';
        ctx.fill();
        if(frozen){
          ctx.font = `bold ${Math.max(10, Math.floor(S.ppm*0.42))}px -apple-system,sans-serif`;
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillStyle='rgba(0,0,0,0.5)';
          ctx.fillText('🧊', sp.x+1, sp.y - r - 5);
          ctx.fillStyle='#fff';
          ctx.fillText('🧊', sp.x, sp.y - r - 6);
        }
      }else{
        drawBall(sp.x,sp.y,r,lighten(b.color,0.3),darken(b.color,0.35),0);
        if(b.invalid){
          const age=t-(b.invalidAt||0);
          if(age<700 && age>=0){
            const flash=1-age/700;
            ctx.beginPath(); ctx.arc(sp.x,sp.y,r*(1+flash*0.6),0,Math.PI*2);
            ctx.strokeStyle=`rgba(255,255,255,${flash*0.9})`; ctx.lineWidth=3; ctx.stroke();
          }
          drawInvalidX(sp.x,sp.y,r,age);
        }
      }
    }

    const mingo=S.bodies.find(b=>b.isMingo);
    if(mingo && !S.isSpectator){
      let myTeamForDist=null;
      const cur=currentPlayer();
      if(cur) myTeamForDist=cur.team;
      else if(!S.isMultiplayer) myTeamForDist=0;
      if(myTeamForDist!==null){
        ctx.font=`bold ${Math.max(9,Math.floor(S.ppm*0.32))}px -apple-system,sans-serif`;
        ctx.textAlign='center'; ctx.textBaseline='top';
        for(const b of S.bodies){
          if(b.isMingo || b.team!==myTeamForDist || b.invalid) continue;
          const sp=worldToScreen(b.x,b.y);
          const r=b.r*S.ppm;
          const d=Math.hypot(b.x-mingo.x,b.y-mingo.y);
          const txt=d.toFixed(2)+' m';
          ctx.fillStyle='rgba(0,0,0,0.55)';
          ctx.fillText(txt,sp.x+1,sp.y+r+5);
          ctx.fillStyle=(S.phase==='aiming' && b.team===S.currentTeam)?'#ffd166':'rgba(255,255,255,0.75)';
          ctx.fillText(txt,sp.x,sp.y+r+4);
        }
      }
    }

    if(S.phase==='aiming' && isMyTurn()){
      const speed=CFG.minSpeed+(CFG.maxSpeed-CFG.minSpeed)*S.charge;
      const pCur = currentPlayer();
      let previewWobble = 0;
      if(pCur && fiestaActive()){
        if(pCur.pendingRonDebuff) previewWobble += Math.sin(t/120) * 0.06;
        if(playerHasJuma(pCur)) previewWobble += Math.sin(t/150) * 0.02 * Math.max(0,(pCur.drinksTaken-2));
      }
      if(S.charging && speed>2.5){
        const preview=simulatePath(S.aimAngle + previewWobble, speed);
        const pts=preview.pts;
        ctx.save();
        ctx.setLineDash([7,6]); ctx.lineWidth=2.5;
        ctx.strokeStyle='rgba(255,255,255,0.85)';
        ctx.beginPath();
        const s0=worldToScreen(pts[0].x,pts[0].y); ctx.moveTo(s0.x,s0.y);
        for(let i=1;i<pts.length;i++){const s=worldToScreen(pts[i].x,pts[i].y);ctx.lineTo(s.x,s.y);}
        ctx.stroke(); ctx.restore();
        const last=pts[pts.length-1];
        const sL=worldToScreen(last.x,last.y);
        const prev=pts[Math.max(0,pts.length-6)];
        const sP=worldToScreen(prev.x,prev.y);
        const ang=Math.atan2(sL.y-sP.y, sL.x-sP.x);
        const arrowLen=10;
        ctx.save();
        ctx.translate(sL.x,sL.y); ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(arrowLen,0);
        ctx.lineTo(-arrowLen*0.4,arrowLen*0.55);
        ctx.lineTo(-arrowLen*0.4,-arrowLen*0.55);
        ctx.closePath();
        ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fill();
        ctx.restore();
        ctx.beginPath(); ctx.arc(sL.x,sL.y,CFG.ballR*S.ppm*1.5,0,Math.PI*2);
        ctx.setLineDash([3,3]); ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=2; ctx.stroke();
        ctx.setLineDash([]);
        ctx.font=`bold ${Math.max(12,Math.floor(S.ppm*0.42))}px -apple-system,sans-serif`;
        ctx.textAlign='center'; ctx.textBaseline='bottom';
        const distText=preview.distance.toFixed(1)+' m';
        ctx.fillStyle='rgba(0,0,0,0.55)';
        ctx.fillText(distText,sL.x+1,sL.y-CFG.ballR*S.ppm-7);
        ctx.fillStyle='#ffd166';
        ctx.fillText(distText,sL.x,sL.y-CFG.ballR*S.ppm-8);
      }
    }

    if(S.phase==='aiming'){
      const p=currentPlayer();
      if(p){
        const tP2=worldToScreen(CFG.throwX,CFG.throwY);
        const r=CFG.ballR*S.ppm;
        const bob=Math.sin(t/260)*1.6;
        ctx.beginPath(); ctx.arc(tP2.x,tP2.y,r+4+bob,0,Math.PI*2);
        ctx.strokeStyle=(p.color||'#fff')+'cc'; ctx.lineWidth=2.5; ctx.stroke();
      }
    }

    if(S.explosions.length){
      const now=performance.now();
      S.explosions.forEach(ex=>{
        const age=(now-ex.born)/ex.life;
        if(age>=0 && age<=1){
          const sp=worldToScreen(ex.x, ex.y);
          const r = ex.radius * S.ppm * (0.3 + age*0.9);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, r, 0, Math.PI*2);
          ctx.strokeStyle=`rgba(255,140,0,${(1-age)*0.9})`;
          ctx.lineWidth = 6 * (1-age);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, r*0.65, 0, Math.PI*2);
          ctx.fillStyle=`rgba(255,80,0,${(1-age)*0.45})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, r*0.35, 0, Math.PI*2);
          ctx.fillStyle=`rgba(255,220,100,${(1-age)*0.7})`;
          ctx.fill();
        }
      });
      S.explosions = S.explosions.filter(ex => now - ex.born < ex.life);
    }

    if(fiestaActive() && S.fiesta.bubbles.length){
      const now=performance.now();
      S.fiesta.bubbles.forEach(b=>{
        const age=(now-b.born)/b.life;
        if(age>=0 && age<=1){
          const sp=worldToScreen(b.x, b.y + b.vy*age);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, b.r*S.ppm, 0, Math.PI*2);
          ctx.fillStyle=`rgba(6,214,160,${(1-age)*0.55})`;
          ctx.strokeStyle=`rgba(255,255,255,${(1-age)*0.5})`;
          ctx.lineWidth=1;
          ctx.fill(); ctx.stroke();
        }
      });
    }
    if(fiestaActive() && S.fiesta.vapor.length){
      const now=performance.now();
      S.fiesta.vapor.forEach(v=>{
        const age=(now-v.born)/v.life;
        if(age>=0 && age<=1){
          const sp=worldToScreen(v.x + v.vx*age, v.y + v.vy*age);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, v.r*S.ppm, 0, Math.PI*2);
          ctx.fillStyle=`rgba(180,140,100,${(1-age)*0.6})`;
          ctx.fill();
        }
      });
    }
    if(fiestaActive() && S.fiesta.floatingTexts.length){
      const now=performance.now();
      ctx.save();
      ctx.textAlign='center'; ctx.textBaseline='middle';
      S.fiesta.floatingTexts.forEach(ft=>{
        const age=(now-ft.born)/ft.life;
        if(age>=0 && age<=1){
          const sp=worldToScreen(ft.x, ft.y - age*0.8);
          ctx.globalAlpha=1-age;
          ctx.font=`bold ${Math.max(12,Math.floor(S.ppm*0.5))}px -apple-system,sans-serif`;
          ctx.fillStyle='rgba(0,0,0,.7)';
          ctx.fillText(ft.text, sp.x+1, sp.y+1);
          ctx.fillStyle=ft.color;
          ctx.fillText(ft.text, sp.x, sp.y);
        }
      });
      ctx.restore();
    }

    if(fiestaActive()){
      const cur=currentPlayer();
      if(cur && cur.activeDrink){
        const type=cur.activeDrink.type;
        const col=type==='ron'?'212,160,23':type==='cerveza'?'6,214,160':type==='cocuy'?'255,59,48':'139,90,43';
        ctx.fillStyle=`rgba(${col},0.08)`;
        ctx.fillRect(0,0,S.cvW,S.cvH);
      }
      if(performance.now()<S.fiesta.cocuyFlashUntil){
        const a=0.25*(S.fiesta.cocuyFlashUntil-performance.now())/180;
        if(a>0){ ctx.fillStyle=`rgba(255,59,48,${a})`; ctx.fillRect(0,0,S.cvW,S.cvH); }
      }
      const me = S.players.find(pl=>pl.isMe);
      if(me && playerHasJuma(me) && !S.isSpectator){
        ctx.fillStyle='rgba(255,40,40,0.08)';
        ctx.fillRect(0,0,S.cvW,S.cvH);
      }
    }
  } finally {
    ctx.restore();
  }
}

/* ===== SCOREBOARD ===== */
function renderScoreboard(){
  const sb=$('scoreboard'); if(!sb)return;
  const N=S.teams.length;
  if(isIndiv()){
    sb.classList.add('individual');
    let html='';
    for(let i=0;i<N;i++){
      const p=playersOfTeam(i)[0]||{name:'J'+(i+1),color:'#fff'};
      const isActive=S.phase==='aiming' && S.currentTeam===i;
      const juma=playerHasJuma(p);
      let cantina='';
      if(fiestaActive() && p.cantina){
        cantina='<span class="cantina-icons">'+DRINK_KEYS.map(k=>{
          const d=DRINKS[k];
          return `<span class="${(p.cantina[k]||0)<=0?'used':''}" title="${d.name}">${d.icon}</span>`;
        }).join('')+'</span>';
      }
      html+=`<div class="player-chip ${isActive?'active':''}"><span class="chip-dot" style="background:${p.color}"></span><span class="chip-name">${escapeHtml(p.name)}${juma?'<span class="juma-indicator">🍻</span>':''}</span>${cantina}<span class="chip-score">${S.teams[i].score}</span></div>`;
    }
    sb.innerHTML=html;
  }else{
    sb.classList.remove('individual');
    let html='';
    for(let i=0;i<2;i++){
      const isActive=S.phase==='aiming' && S.currentTeam===i;
      html+=`<div class="team t${i} ${isActive?'active':''}"><div class="tname">${escapeHtml(teamDisplayName(i))}</div><div class="tscore">${S.teams[i]?.score||0}</div></div>`;
    }
    sb.innerHTML=html;
  }
  const lbl=$('turnLabel');
  if(lbl && fiestaActive()){
    const p=currentPlayer();
    if(p){
      ensureCantina(p);
      const juma=playerHasJuma(p)?' 🍻':'';
      const cant=' <span class="cantina-icons">'+DRINK_KEYS.map(k=>{
        const d=DRINKS[k]; return `<span class="${(p.cantina[k]||0)<=0?'used':''}">${d.icon}</span>`;
      }).join('')+'</span>';
      lbl.innerHTML = escapeHtml(p.name)+juma+cant;
    }
  }
}
function updateUI(){
  renderScoreboard();
  const rn=$('roundNum'); if(rn)rn.textContent=S.round;
  const lbl=$('turnLabel'), hint=$('hint');
  if(!lbl||!hint)return;
  const banner=$('spectatorBanner');
  if(banner) banner.style.display = S.isSpectator ? 'block' : 'none';
  const cir=$('chatInputRow');
  if(cir) cir.style.display = S.isMultiplayer ? '' : 'none';

  if(canvas){
    const me = S.players.find(pl=>pl.isMe);
    if(fiestaActive() && me && playerHasJuma(me) && !S.isSpectator) canvas.classList.add('canvas-juma');
    else canvas.classList.remove('canvas-juma');
  }

  if(S.isSpectator){
    const p=currentPlayer();
    if(p) lbl.textContent=p.name; else lbl.textContent='—';
    hint.textContent='👁️ Modo espectador · solo mirando';
    const pf=$('powerFill'); if(pf)pf.style.width='0%';
    return;
  }
  const p=currentPlayer();
  if(S.phase==='aiming' && p){
    if(!lbl || !fiestaActive() || !p.cantina) lbl.textContent=p.name;
    if(isMyTurn()) hint.textContent='Apunta · mantén para cargar · ⚠️ tocar el mingo descalifica';
    else hint.textContent=S.isMultiplayer?('Esperando a '+p.name+'…'):'El rival apunta…';
  }else if(S.phase==='moving'){lbl.textContent='En juego…'; hint.textContent='Bolas rodando…';}
  else if(S.phase==='settling'){lbl.textContent='Calculando…'; hint.textContent='';}
  else if(S.phase==='roundEnd'){lbl.textContent='Fin de ronda'; hint.textContent='';}
  else if(S.phase==='gameOver'){lbl.textContent='Partida terminada'; hint.textContent='';}
  else{lbl.textContent='—'; hint.textContent='';}
  updateDrinkButton();
}

/* ===== CHAT ===== */
let _chatCounter = 0;
function sendChat(){
  const inp=$('chatInput');
  if(!inp) return;
  const msg=(inp.value||'').trim().slice(0,80);
  if(!msg) return;
  inp.value='';
  if(!S.isMultiplayer){ addChatMessage(S.username||'Tú', msg); return; }
  if(S.isHost){
    addChatMessage(S.username, msg);
    const payload={type:'chat', name:S.username, msg};
    S.connections.forEach(c=>{ if(c.open) try{c.send(payload);}catch(_){}});
  } else if(S.hostConn && S.hostConn.open){
    try{ S.hostConn.send({type:'chat', name:S.username, msg}); }catch(_){}
  }
}
function addChatMessage(name, msg){
  S.chatMessages.push({id:++_chatCounter, name, msg, ts:Date.now()});
  renderChat();
  clearTimeout(addChatMessage._t);
  addChatMessage._t=setTimeout(renderChat, 1200);
}
function renderChat(){
  const el=$('chatFloating');
  if(!el) return;
  const now=Date.now();
  const active=S.chatMessages.filter(m=>now-m.ts<5000).slice(-3);
  el.innerHTML=active.map(m=>`<div class="chat-msg"><b>${escapeHtml(m.name)}:</b> ${escapeHtml(m.msg)}</div>`).join('');
}

/* ===== MULTI ===== */
function peerAvailable(){return typeof Peer!=='undefined' && !window.__peerjsFailed}
function generateRoomCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<6;i++)s+=chars[Math.floor(Math.random()*chars.length)]; return s;}

function createRoom(){
  if(!peerAvailable()){toast('Multijugador no disponible (sin conexión)');return}
  const uname=(($('usernameInput').value||'').trim());
  if(uname.length<2){toast('Ingresa tu nombre');return}
  S.username=uname; localStorage.setItem('bolasUsername',uname);
  ensureAudio();
  S.isMultiplayer=true; S.isHost=true; S.isSpectator=false; S.mode='multi';

  S.config.gameMode=$('roomGameMode').value||'teams';
  if(S.config.gameMode==='free'){
    S.config.maxPlayers=8;
    S.config.playersPerTeam=0;
    S.config.teamNames=['',''];
    S.config.individualBallsPerPlayer=2;
  }else if(S.config.gameMode==='individual'){
    S.config.maxPlayers=parseInt($('roomMaxPlayers').value,10)||4;
    S.config.playersPerTeam=0;
    S.config.teamNames=['',''];
    S.config.individualBallsPerPlayer=2;
  }else{
    S.config.playersPerTeam=parseInt($('roomPlayers').value,10)||3;
    S.config.teamNames=['Azul','Rojo'];
    S.config.maxPlayers=S.config.playersPerTeam*2;
  }
  S.config.speed=parseFloat($('roomSpeed').value)||1;
  S.config.maxRounds=parseInt($('roomMaxRounds').value,10)||0;
  S.config.wallRest=parseFloat($('roomWallRest').value)||0.55;
  S.config.turnTimeout=parseInt($('roomTurnTimeout').value,10)||0;
  S.config.difficulty=1;
  S.config.teamColors=[CFG.palette[0][0],CFG.palette[1][0]];
  S.config.fiestaMode = $('roomFiesta') ? $('roomFiesta').checked : false;

  function tryCreate(attempt){
    const code=generateRoomCode();
    S.roomCode=code;
    let peer;
    try{ peer=new Peer(PEER_PREFIX+code, PEER_OPTS); }
    catch(e){ toast('Error al crear la sala'); return; }
    S.peer=peer;
    let created=false;
    const openT=setTimeout(()=>{
      if(!created){
        try{ peer.destroy(); }catch(_){}
        if(attempt<2) tryCreate(attempt+1);
        else toast('No se pudo crear la sala. Reintenta.');
      }
    }, 12000);

    peer.on('open',()=>{
      created=true;
      clearTimeout(openT);
      S.myPlayerId='host';
      const initFiesta = fiestaActive();
      S.players=[{
        id:'host', name:S.username,
        color:isIndiv()?CFG.indivPalette[0]:CFG.palette[0][0],
        team:0, slot:0, isHuman:true, isMe:true,
        peerId:peer.id, lastSeen:Date.now(), ping:0, ready:true,
        cantina: initFiesta?{ron:1,cerveza:1,cocuy:1,cafe:1}:null,
        drinksTaken:0, turnId:0, lastDrinkTurnId:-999, activeDrink:null,
        pendingRonDebuff:false, turnsToSkip:0
      }];
      S.teams=isIndiv()?[{score:0}]:[{score:0},{score:0}];
      S.spectators=[];
      startHeartbeat();
      renderLobby();
      show('lobby');
    });
    peer.on('connection',conn=>{
      conn.on('open',()=>{ S.connections.set(conn.peer, conn); conn.on('data',d=>handleGuestMessage(conn,d)); });
      conn.on('close',()=>{
        S.connections.delete(conn.peer);
        S.players=S.players.filter(p=>p.peerId!==conn.peer);
        S.spectators=S.spectators.filter(s=>s.peerId!==conn.peer);
        renderLobby(); broadcastLobby();
        if(S.phase!=='idle') broadcastState();
      });
      conn.on('error',err=>{ console.error('conn error',err); });
    });
    peer.on('error',err=>{
      console.error(err);
      if(err.type==='unavailable-id' && !created){
        clearTimeout(openT);
        try{ peer.destroy(); }catch(_){}
        if(attempt<3) setTimeout(()=>tryCreate(attempt+1), 400);
        else toast('No se pudo asignar código. Intenta de nuevo.');
      }else if(!created){
        clearTimeout(openT);
        toast('Error de conexión');
      }
    });
  }
  tryCreate(0);
}

function handleGuestMessage(conn,data){
  const pl=S.players.find(p=>p.peerId===conn.peer);
  if(pl) pl.lastSeen=Date.now();
  const sp=S.spectators.find(s=>s.peerId===conn.peer);
  if(sp) sp.lastSeen=Date.now();

  if(data.type==='pong') return;
  if(data.type==='ping'){
    if(conn.open){ try{ conn.send({type:'pong', t:data.t}); }catch(_){} }
    return;
  }
  if(data.type==='chat'){
    const name=(pl?pl.name:(data.name||'Jugador')).slice(0,16);
    const msg=(data.msg||'').slice(0,80);
    if(!msg) return;
    addChatMessage(name, msg);
    const payload={type:'chat', name, msg};
    S.connections.forEach(c=>{ if(c.open && c.peer!==conn.peer) try{c.send(payload);}catch(_){}});
    return;
  }

  if(data.type==='drink'){
    const p=getPlayer(data.playerId);
    if(!p) return;
    const cur=currentPlayer();
    if(!cur || cur.id!==p.id){ try{conn.send({type:'error',msg:'No es tu turno'});}catch(_){}; return; }
    if(!DRINK_KEYS.includes(data.drinkType)){ try{conn.send({type:'error',msg:'Trago inválido'});}catch(_){}; return; }
    if(!applyDrinkForPlayer(p, data.drinkType)){
      try{conn.send({type:'error',msg:'No válido'});}catch(_){}
      return;
    }
    const label = data.drinkType==='cafe'?'un cafecito':(data.drinkType==='cerveza'?'una Polar':(data.drinkType==='ron'?'un Cacique':'un Cocuy'));
    const toastMsg = `${DRINKS[data.drinkType].icon} ${p.name} se metió ${label}`;
    S.connections.forEach(c => {
      if(c.open) try { c.send({type:'drinkToast', msg:toastMsg}); } catch(_){}
    });
    return;
  }

  if(data.type==='join'){
    pruneDeadConnections();
    if(S.players.some(p=>p.peerId===conn.peer)) return;
    const normName=(data.name||'Jugador').trim().slice(0,16);

    const existing=S.players.find(p=>p.name===normName && !p.isMe);
    if(existing){
      const oldConn=S.connections.get(existing.peerId);
      if(!oldConn || !oldConn.open){
        const oldPeerId=existing.peerId;
        existing.peerId=conn.peer; existing.lastSeen=Date.now(); existing.ping=0;
        S.connections.set(conn.peer, conn);
        if(oldConn){ try{ oldConn.close(); }catch(_){} }
        S.connections.delete(oldPeerId);
        conn.send({type:'welcome', playerId:existing.id, roomCode:S.roomCode, players:S.players, config:S.config});
        broadcastLobby();
        if(S.phase!=='idle') setTimeout(()=>{ if(conn.open) broadcastState(); }, 80);
        return;
      }else{
        conn.send({type:'error', msg:'Ese nombre ya está en uso en esta sala'});
        return;
      }
    }
    if(S.phase!=='idle'){
      if(S.spectators.length>=16){ conn.send({type:'error', msg:'Sala llena'}); return; }
      S.spectators.push({peerId:conn.peer, name:normName, lastSeen:Date.now()});
      S.connections.set(conn.peer, conn);
      conn.send({type:'welcome', playerId:null, isSpectator:true, roomCode:S.roomCode, players:S.players, config:S.config});
      setTimeout(()=>{ if(conn.open) broadcastState(); }, 80);
      return;
    }
    const initFiesta = fiestaActive();
    if(isIndiv()){
      const max=S.config.maxPlayers||8;
      if(S.players.length>=max){ conn.send({type:'error', msg:'Sala llena'}); return; }
      const idx=S.players.length;
      const color=CFG.indivPalette[idx%CFG.indivPalette.length];
      const newP={id:'p_'+conn.peer, name:normName, color, team:idx, slot:0, isHuman:true, isMe:false, peerId:conn.peer, lastSeen:Date.now(), ping:0, ready:false,
        cantina: initFiesta?{ron:1,cerveza:1,cocuy:1,cafe:1}:null,
        drinksTaken:0, turnId:0, lastDrinkTurnId:-999, activeDrink:null,
        pendingRonDebuff:false, turnsToSkip:0};
      S.players.push(newP);
      conn.send({type:'welcome', playerId:newP.id, roomCode:S.roomCode, players:S.players, config:S.config});
      renderLobby(); broadcastLobby();
      return;
    }
    const counts=[0,0];
    S.players.forEach(p=>{counts[p.team]=(counts[p.team]||0)+1});
    let team=counts[0]<=counts[1]?0:1;
    if(counts[team]>=S.config.playersPerTeam) team=1-team;
    if(counts[team]>=S.config.playersPerTeam){conn.send({type:'error',msg:'Sala llena'}); return;}
    const slot=counts[team];
    const color=CFG.palette[team][slot%CFG.palette[team].length];
    const newP={id:'p_'+conn.peer, name:normName, color, team, slot, isHuman:true, isMe:false, peerId:conn.peer, lastSeen:Date.now(), ping:0, ready:false,
      cantina: initFiesta?{ron:1,cerveza:1,cocuy:1,cafe:1}:null,
      drinksTaken:0, turnId:0, lastDrinkTurnId:-999, activeDrink:null,
      pendingRonDebuff:false, turnsToSkip:0};
    S.players.push(newP);
    conn.send({type:'welcome', playerId:newP.id, roomCode:S.roomCode, players:S.players, config:S.config});
    renderLobby(); broadcastLobby();
  }else if(data.type==='throw'){
    const p=getPlayer(data.playerId);
    if(!p)return;
    const cur=currentPlayer();
    if(!cur||cur.id!==p.id||S.currentTeam!==p.team)return;
    performThrow(p.team,p.id,data.angle,data.speed);
  }else if(data.type==='ready'){
    if(pl){ pl.ready=true; renderLobby(); broadcastLobby(); }
  }else if(data.type==='switch-team'){
    const requester=S.players.find(p=>p.peerId===conn.peer);
    const target=S.players.find(p=>p.id===data.playerId);
    if(requester && target && requester.team!==target.team){
      const tmpTeam=requester.team, tmpSlot=requester.slot;
      requester.team=target.team; requester.slot=target.slot;
      target.team=tmpTeam; target.slot=tmpSlot;
      requester.color=CFG.palette[requester.team][requester.slot%CFG.palette[requester.team].length];
      target.color=CFG.palette[target.team][target.slot%CFG.palette[target.team].length];
      renderLobby(); broadcastLobby();
    }
  }else if(data.type==='update-name'){
    if(pl){
      const nn=(data.name||'').trim().slice(0,16);
      if(nn.length>=2){ pl.name=nn; renderLobby(); broadcastLobby(); if(S.phase!=='idle') broadcastState(); }
    }
  }
}

function joinRoom(){
  if(!peerAvailable()){toast('Multijugador no disponible (sin conexión)');return}
  const uname=(($('usernameInput').value||'').trim());
  if(uname.length<2){toast('Ingresa tu nombre');return}
  S.username=uname; localStorage.setItem('bolasUsername',uname);
  const code=sanitizeCode($('joinCodeInput').value);
  if(code.length<4){$('joinStatus').textContent='Código inválido';return}
  if(S.peer){ try{S.peer.destroy()}catch(_){} S.peer=null; }
  if(S.hostConn){ try{S.hostConn.close()}catch(_){} S.hostConn=null; }
  clearTimeout(_joinTimer); clearTimeout(_welcomeTimer);
  $('joinStatus').textContent='Conectando…';
  S.isMultiplayer=true; S.isHost=false; S.mode='multi';
  S.myPlayerId=null; S.isSpectator=false;
  let connected=false;
  const abort=(msg)=>{
    clearTimeout(_joinTimer); clearTimeout(_welcomeTimer);
    if(!connected){ S.isMultiplayer=false; S.isHost=true; $('joinStatus').textContent=msg||'No se pudo conectar'; }
    if(S.hostConn){ try{S.hostConn.close()}catch(_){} S.hostConn=null; }
    if(S.peer){ try{S.peer.destroy()}catch(_){} S.peer=null; }
  };
  try{ S.peer=new Peer(PEER_OPTS); }
  catch(e){ abort('Error al iniciar conexión'); return; }
  _joinTimer=setTimeout(()=>{ if(!connected) abort('Tiempo de espera agotado. Verifica el código y tu red.'); }, JOIN_TIMEOUT);
  S.peer.on('open',()=>{
    let conn;
    try{ conn=S.peer.connect(PEER_PREFIX+code,{reliable:true}); }
    catch(e){ abort('Error al conectar con la sala'); return; }
    S.hostConn=conn;
    conn.on('open',()=>{
      connected=true;
      clearTimeout(_joinTimer);
      conn.send({type:'join', name:S.username});
      $('joinStatus').textContent='¡Conectado! Esperando al anfitrión…';
      _welcomeTimer=setTimeout(()=>{
        if(S.myPlayerId==null && !S.isSpectator){
          $('joinStatus').textContent='Sin respuesta del anfitrión. Reintenta.';
          try{ conn.close(); }catch(_){}
          try{ S.peer.destroy(); }catch(_){}
          S.isMultiplayer=false;
        }
      }, WELCOME_TIMEOUT);
    });
    conn.on('data',data=>handleHostMessage(data));
    conn.on('error',err=>{
      console.error('conn error',err);
      if(!connected) abort('Error de conexión. Verifica el código.');
    });
    conn.on('close',()=>{
      clearTimeout(_joinTimer); clearTimeout(_welcomeTimer);
      toast('El anfitrión cerró la sala');
      cleanupGame();
      show('menu');
    });
  });
  S.peer.on('error',err=>{
    console.error(err);
    let msg='No se pudo conectar';
    if(err.type==='peer-unavailable') msg='Sala no encontrada. Verifica el código.';
    else if(err.type==='network') msg='Error de red. Revisa tu conexión.';
    else if(err.type==='server-error') msg='Servidor no disponible';
    else if(err.type==='browser-incompatible') msg='Navegador no compatible';
    abort(msg);
  });
}

function handleHostMessage(data){
  if(data.type==='ping'){
    if(S.hostConn && S.hostConn.open){ try{ S.hostConn.send({type:'pong', t:data.t}); }catch(_){} }
    return;
  }
  if(data.type==='welcome'){
    clearTimeout(_welcomeTimer);
    S.myPlayerId=data.playerId;
    S.isSpectator=!!data.isSpectator;
    S.roomCode=data.roomCode;
    S.config=data.config;
    S.players=(data.players||[]).map(p=>({...p,isMe:p.id===S.myPlayerId}));
    if(S.isSpectator){
      S.teams=isIndiv()?S.players.map(()=>({score:0})):[{score:0},{score:0}];
      S.bodies=[];
      S.phase='idle';
      resizeCanvas();
      show('game');
      updateUI();
    }else{
      S.teams=[{score:0},{score:0}];
      renderLobby();
      show('lobby');
    }
  }else if(data.type==='lobby'){
    S.config=data.config;
    S.players=(data.players||[]).map(p=>({...p,isMe:p.id===S.myPlayerId}));
    renderLobby();
  }else if(data.type==='state'){
    applyRemoteState(data);
  }else if(data.type==='chat'){
    addChatMessage(data.name, data.msg);
  }else if(data.type==='drinkToast'){
    const msg = data.msg || '';
    showCenterToast(msg.replace(/^[^\s]+\s/, ''), msg.split(' ')[0] || '🍹', 'trago', 3200);
  }else if(data.type==='error'){
    toast(data.msg||'Error');
    if(data.msg && data.msg.toLowerCase().includes('nombre')){
      try{ S.hostConn && S.hostConn.close(); }catch(_){}
      S.isMultiplayer=false;
    }
  }else if(data.type==='kicked'){
    toast('Fuiste expulsado de la sala');
    cleanupGame();
    show('menu');
  }
}

function broadcastState(){
  if(!S.isHost||!S.isMultiplayer)return;
  const payload={
    type:'state',
    bodies:S.bodies.map(b=>({
      x:b.x,y:b.y,vx:b.vx,vy:b.vy,r:b.r,m:b.m,isMingo:b.isMingo,team:b.team,playerId:b.playerId,
      color:b.color,invalid:b.invalid,invalidAt:b.invalidAt,fiestaDrink:b.fiestaDrink,
      doublePoints:b.doublePoints||false,immuneToMingo:b.immuneToMingo||false,
      explosive:b.explosive||false,exploded:b.exploded||false,
      causedByRon:b.causedByRon||false,causedByCocuy:b.causedByCocuy||false
    })),
    teams:S.teams.map(t=>({score:t.score})),
    currentTeam:S.currentTeam, currentSlot:S.currentSlot, round:S.round, phase:S.phase,
    ballsLeft:S.ballsLeft.slice(), config:S.config,
    players:S.players.map(p=>({
      id:p.id, name:p.name, color:p.color, team:p.team, slot:p.slot, isMe:p.isMe,
      peerId:p.peerId, ready:p.ready, ping:p.ping, lastSeen:p.lastSeen,
      cantina:p.cantina, drinksTaken:p.drinksTaken, turnId:p.turnId,
      lastDrinkTurnId:p.lastDrinkTurnId, activeDrink:p.activeDrink,
      pendingRonDebuff:p.pendingRonDebuff, turnsToSkip:p.turnsToSkip
    })),
    mingoFrozenThrowsLeft:S.mingoFrozenThrowsLeft,
    noDrinkUntilTurnCounter:S.noDrinkUntilTurnCounter,
    turnCounter:S.turnCounter,
    fiesta: fiestaActive() ? {
      laRondaDone: S.laRondaDone,
      laRondaRound: S.laRondaRound,
      laRondaActiveFor: S.laRondaActiveFor
    } : null
  };
  S.connections.forEach(c=>{if(c.open)try{c.send(payload)}catch(e){}});
}
function broadcastLobby(){
  if(!S.isHost||!S.isMultiplayer)return;
  const payload={type:'lobby',players:S.players,config:S.config};
  S.connections.forEach(c=>{if(c.open)try{c.send(payload)}catch(e){}});
}
function applyRemoteState(data){
  const prevPhase=S.phase;
  const wasLobby=S.screen==='lobby';
  S.bodies=data.bodies.map(b=>({...b}));
  S.teams=data.teams; S.currentTeam=data.currentTeam; S.currentSlot=data.currentSlot;
  S.round=data.round; S.phase=data.phase; S.ballsLeft=data.ballsLeft; S.config=data.config;
  S.players=(data.players||[]).map(p=>({...p,isMe:p.id===S.myPlayerId}));
  S.mingoFrozenThrowsLeft = data.mingoFrozenThrowsLeft || 0;
  S.noDrinkUntilTurnCounter = (data.noDrinkUntilTurnCounter !== undefined) ? data.noDrinkUntilTurnCounter : -1;
  S.turnCounter = data.turnCounter || 0;
  if(data.fiesta){
    S.laRondaDone = data.fiesta.laRondaDone;
    S.laRondaRound = data.fiesta.laRondaRound;
    S.laRondaActiveFor = data.fiesta.laRondaActiveFor || {};
  }
  if(wasLobby && data.phase!=='idle' && data.phase!=='lobby'){resizeCanvas(); show('game');}
  if(S.isSpectator && S.screen!=='game'){resizeCanvas(); show('game');}
  if(data.phase==='aiming' && prevPhase!=='aiming'){
    S.turnStartedAt = performance.now();
    S.turnTimeoutFired = false;
  } else if(data.phase!=='aiming'){
    S.turnStartedAt = 0;
    S.turnTimeoutFired = false;
  }
  if(data.phase==='aiming' && $('modal').classList.contains('open')) closeModal();
  if(!S.isHost && data.phase==='roundEnd' && prevPhase!=='roundEnd'){
    const body=`<div class="big">${S.teams.map(t=>t.score).join(' — ')}</div>`;
    showModal('Fin de la ronda '+S.round, body, 'Esperando al anfitrión…', null);
  }
  updateUI();
}

/* ===== LOBBY ===== */
function renderLobby(){
  $('lobbyCode').textContent=S.roomCode;
  const teamsEl=$('lobbyTeams');
  let html='';
  if(isIndiv()){
    teamsEl.classList.add('single');
    const title=S.config.gameMode==='free'?'Modo libre':'Todos contra todos';
    html+=`<div class="lobby-team tI"><h3><span class="dot"></span>${title}</h3>`;
    S.players.forEach(p=>{
      const ping=p.ping!=null ? `<span class="ping ${p.ping<100?'good':p.ping>250?'bad':''}">${p.ping||0}ms</span>` : '';
      const ready=p.isMe ? '' : (p.ready?'<span class="ready-badge">✓</span>':'<span class="ping">…</span>');
      const kick=(S.isHost && !p.isMe) ? `<button class="mini-btn kick-btn" data-action="kick" data-peer="${p.peerId}" title="Expulsar">✕</button>` : '';
      const swap=(!S.isHost && !p.isMe) ? `<button class="mini-btn switch-btn" data-action="request-switch" data-target="${p.id}" title="Cambiar equipo">⇄</button>` : '';
      html+=`<div class="lobby-slot"><span class="avatar" style="background:${p.color}"></span><span class="name">${escapeHtml(p.name)}</span>${p.isMe?'<span class="you">TÚ</span>':''}${ready}${ping}${swap}${kick}</div>`;
    });
    const max=S.config.maxPlayers||4;
    for(let i=S.players.length;i<max;i++){
      html+=`<div class="lobby-slot empty"><span class="avatar" style="background:rgba(255,255,255,.1)"></span><span class="name">Esperando…</span></div>`;
    }
    html+='</div>';
  }else{
    teamsEl.classList.remove('single');
    const n=S.config.playersPerTeam;
    for(let t=0;t<2;t++){
      const pTeam=S.players.filter(p=>p.team===t).sort((a,b)=>a.slot-b.slot);
      html+=`<div class="lobby-team t${t}"><h3><span class="dot"></span>${escapeHtml(S.config.teamNames[t]||(t===0?'Azul':'Rojo'))}</h3>`;
      for(let s=0;s<n;s++){
        const p=pTeam[s];
        if(p){
          const ping=p.ping!=null ? `<span class="ping ${p.ping<100?'good':p.ping>250?'bad':''}">${p.ping||0}ms</span>` : '';
          const ready=p.isMe ? '' : (p.ready?'<span class="ready-badge">✓</span>':'<span class="ping">…</span>');
          const kick=(S.isHost && !p.isMe) ? `<button class="mini-btn kick-btn" data-action="kick" data-peer="${p.peerId}" title="Expulsar">✕</button>` : '';
          const swap=(!S.isHost && !p.isMe) ? `<button class="mini-btn switch-btn" data-action="request-switch" data-target="${p.id}" title="Cambiar equipo">⇄</button>` : '';
          html+=`<div class="lobby-slot"><span class="avatar" style="background:${p.color}"></span><span class="name">${escapeHtml(p.name)}</span>${p.isMe?'<span class="you">TÚ</span>':''}${ready}${ping}${swap}${kick}</div>`;
        }else{
          html+=`<div class="lobby-slot empty"><span class="avatar" style="background:rgba(255,255,255,.1)"></span><span class="name">Esperando…</span></div>`;
        }
      }
      html+='</div>';
    }
  }
  teamsEl.innerHTML=html;

  const actions=$('lobbyActions');
  if(S.isHost){
    const guests=S.players.filter(p=>!p.isMe);
    const allReady=guests.every(p=>p.ready);
    const canStart=S.players.length>=2 && allReady;
    let notReadyMsg='';
    if(S.players.length<2) notReadyMsg='Necesitas al menos 2 jugadores';
    else if(!allReady) notReadyMsg='Esperando a que todos estén listos';
    actions.innerHTML=`<div class="btn-row"><button data-action="leave-room">Salir</button><button class="primary" data-action="start-room" ${canStart?'':'disabled'}>Empezar</button></div>${canStart?'':`<p class="muted" style="text-align:center;margin-top:10px">${notReadyMsg}</p>`}`;
  }else{
    const me=S.players.find(p=>p.isMe);
    const isReady=me && me.ready;
    actions.innerHTML=`<div class="btn-row"><button data-action="leave-room">Salir</button><button class="ready-btn ${isReady?'is-ready':''}" data-action="toggle-ready" ${isReady?'disabled':''}>${isReady?'✓ Listo':'Listo ✓'}</button></div><div class="waiting" style="margin-top:10px">${isReady?'Esperando a que el anfitrión inicie…':'Presiona Listo cuando estés preparado'}</div>`;
  }
}
function startRoomGame(){
  if(!S.isHost)return;
  if(S.players.length<2){toast('Faltan jugadores');return}
  const guests=S.players.filter(p=>!p.isMe);
  if(!guests.every(p=>p.ready)){toast('Todos deben estar listos');return}
  if(isIndiv()){
    S.players.forEach((p,i)=>{p.team=i; p.slot=0;});
    S.teams=S.players.map(()=>({score:0}));
    S.roundStarter=Math.floor(Math.random()*S.players.length);
  }else{
    for(const t of [0,1]) S.players.filter(p=>p.team===t).sort((a,b)=>a.slot-b.slot).forEach((p,i)=>{p.slot=i});
    S.teams=[{score:0},{score:0}];
    S.roundStarter=Math.random()<0.5?0:1;
  }
  S.round=1; S.breakTaken=false;
  S.stats = { invalids: 0, boches: 0, roundAtWin: 0 };
  S.turnCounter = 0;
  if(fiestaActive()){ S.players.forEach(p=>{ ensureCantina(p); p.activeDrink = null; }); }
  resetFiestaState();
  startRound();
  resizeCanvas();
  show('game');
  broadcastState();
  updateUI();
  if(fiestaActive()) showCenterToast('Modo Fiesta activado. ¡Salud!', '🍹', 'info', 3500);
  if(!S._hintShown){S._hintShown=true; setTimeout(()=>toast('⚠️ Si tu bola toca el mingo, queda descalificada', 4500), 600);}
}
function requestSwitchTeam(targetId){
  if(!S.isMultiplayer || S.isHost) return;
  if(S.hostConn && S.hostConn.open){
    try { S.hostConn.send({type:'switch-team', playerId: targetId}); }catch(_){}
  }
}
function kickPlayer(peerId){
  if(!S.isHost) return;
  const conn=S.connections.get(peerId);
  if(conn){
    try { conn.send({type:'kicked'}); }catch(_){}
    setTimeout(()=>{
      try{ conn.close(); }catch(_){}
      S.connections.delete(peerId);
      S.players=S.players.filter(p=>p.peerId!==peerId);
      S.spectators=S.spectators.filter(s=>s.peerId!==peerId);
      renderLobby(); broadcastLobby();
    }, 200);
  }
}
function toggleReady(){
  if(!S.isMultiplayer || S.isHost) return;
  if(S.hostConn && S.hostConn.open){
    try { S.hostConn.send({type:'ready'}); }catch(_){}
    const me=S.players.find(p=>p.isMe);
    if(me) me.ready=true;
    renderLobby();
  }
}
async function copyLobbyCode(){
  const code=S.roomCode;
  if(!code) return;
  try {
    await navigator.clipboard.writeText(code);
    const el=$('lobbyCode');
    if(el){
      const orig=el.textContent;
      el.textContent='✓ Copiado';
      setTimeout(()=>{ el.textContent=orig; }, 1500);
    }
    toast('¡Copiado!');
  } catch(e) { toast('No se pudo copiar'); }
}

/* ===== LIMPIEZA ===== */
function cleanupGame(){
  stopHeartbeat();
  clearTimeout(_joinTimer); clearTimeout(_welcomeTimer);
  stopChargeSound(); stopRollSound();
  stopMusic(); stopBeach();
  if(S.peer){try{S.peer.destroy()}catch(e){} S.peer=null}
  S.connections.forEach(c=>{try{c.close()}catch(e){}}); S.connections.clear();
  if(S.hostConn){try{S.hostConn.close()}catch(e){} S.hostConn=null}
  S.isMultiplayer=false; S.isHost=true; S.isSpectator=false;
  S.phase='idle'; S.bodies=[]; S.charging=false; S.charge=0;
  S.spectators=[]; S.turnStartedAt=0; S.turnTimeoutFired=false;
  resetFiestaState();
  if(canvas) canvas.classList.remove('canvas-juma');
  const pf=$('powerFill'); if(pf)pf.style.width='0%';
  const ttw=$('turnTimerWrap'); if(ttw)ttw.style.display='none';
  const dm=$('drinkModal'); if(dm) dm.classList.remove('open');
  // Limpiar cola de toasts
  S.toastQueue=[];
  S.toastActive=false;
  S._toastPaused=false;
}

/* ===== FIESTA PARTICLES ===== */
function updateFiestaParticles(dt){
  const now=performance.now();
  S.fiesta.bubbles=S.fiesta.bubbles.filter(b=>now-b.born<b.life);
  S.fiesta.vapor=S.fiesta.vapor.filter(v=>now-v.born<v.life);
  S.fiesta.floatingTexts=S.fiesta.floatingTexts.filter(f=>now-f.born<f.life);
  S.explosions = S.explosions.filter(ex => now - ex.born < ex.life);
  const cur=currentPlayer();
  if(cur && cur.activeDrink && cur.activeDrink.type==='cerveza' && Math.random()<0.15){
    spawnBubbles(1);
  }
  if(cur && cur.activeDrink && cur.activeDrink.type==='cafe'){
    spawnVapor(CFG.throwX, CFG.throwY);
  }
}

/* ===== LOOP ===== */
let lastT=0, acc=0, settleTimer=0, lastBroadcastSync=0;
let _lastBgHour=new Date().getHours();
function loop(t){
  if(!lastT) lastT=t;
  let dt=(t-lastT)/1000; lastT=t;
  if(dt>0.1)dt=0.1;

  // CAMBIO: si hay un toast activo, PAUSAR todo el juego
  if (S._toastPaused) {
    if(S.screen==='game') render(t);
    requestAnimationFrame(loop);
    return;
  }

  if(S.charging && S.phase==='aiming'){
    const p=currentPlayer();
    const hasSlowBuff = fiestaActive() && p && p.activeDrink &&
      (p.activeDrink.type==='ron' || p.activeDrink.type==='cerveza' || p.activeDrink.type==='cafe');
    const chargeTime = hasSlowBuff ? CFG.chargeTime * CFG.chargeSlowMul : CFG.chargeTime;
    const elapsed=t-S.chargeStart;
    const cycle=elapsed/chargeTime;
    const phase=cycle%2;
    S.charge=phase<1?phase:2-phase;
    const pf=$('powerFill'); if(pf)pf.style.width=(S.charge*100)+'%';
    updateChargeSound();
  } else if(!S.charging){
    const pf=$('powerFill'); if(pf)pf.style.width=(S.charge*100)+'%';
  }

  if(S.phase==='aiming' && S.config.turnTimeout>0 && S.turnStartedAt>0 && !S.turnTimeoutFired){
    const elapsed=performance.now()-S.turnStartedAt;
    if(elapsed>=S.config.turnTimeout){
      S.turnTimeoutFired=true;
      if(!S.isMultiplayer || S.isHost){
        timeoutTurn();
      }
    }
  }
  const dm=$('drinkModal');
  if(dm && dm.classList.contains('open') && S.phase==='aiming' && S.config.turnTimeout>0 && S.turnStartedAt>0){
    const rem = S.config.turnTimeout - (performance.now()-S.turnStartedAt);
    if(rem < 3000){
      dm.classList.remove('open');
      toast('⏱️ Se cerró la nevera');
    }
  }
  const ttw=$('turnTimerWrap'), ttf=$('turnTimerFill');
  if(ttw && ttf){
    if(S.phase==='aiming' && S.config.turnTimeout>0 && S.turnStartedAt>0){
      const elapsed=performance.now()-S.turnStartedAt;
      const remaining=Math.max(0, S.config.turnTimeout-elapsed);
      const pct=(remaining/S.config.turnTimeout)*100;
      ttw.style.display='';
      ttf.style.width=pct+'%';
      if(remaining<5000) ttf.classList.add('warning');
      else ttf.classList.remove('warning');
    } else {
      ttw.style.display='none';
    }
  }

  if(S.phase==='moving'){
    if(!rollSource) startRollSound();
    updateRollSound();
    if(S.isMultiplayer && !S.isHost){}
    else{
      const dtScaled=dt*(S.config.speed||1);
      acc+=dtScaled; let n=0;
      while(acc>=FIXED && n<24){stepPhysics(FIXED);acc-=FIXED;n++}
      if(n>=24)acc=0;
      if(S.isMultiplayer && S.isHost && t-lastBroadcastSync>60){lastBroadcastSync=t; broadcastState();}
      if(allStopped()){S.phase='settling'; settleTimer=0.45; updateUI(); if(S.isMultiplayer && S.isHost) broadcastState();}
    }
  } else {
    if(rollSource) stopRollSound();
    if(S.phase==='settling'){
      if(S.isMultiplayer && !S.isHost){}
      else{settleTimer-=dt; if(settleTimer<=0) resolveTurn();}
    }
  }

  if(fiestaActive()) updateFiestaParticles(dt);
  updateDrinkButton();

  const h=new Date().getHours();
  if(h!==_lastBgHour){ _lastBgHour=h; renderBackground(); }
  if(S.screen==='game') render(t);
  requestAnimationFrame(loop);
}

/* ===== ACCIONES ===== */
function handleAction(action,el){
  switch(action){
    case 'goto-solo': show('soloConfig'); break;
    case 'goto-multi': show('multiMenu'); break;
    case 'goto-ranking': renderFullRanking(); show('ranking'); break;
    case 'goto-create': show('createRoom'); break;
    case 'goto-join': $('joinStatus').textContent=''; show('joinRoom'); break;
    case 'back': cleanupGame(); show('menu'); renderRanking(); break;
    case 'start-solo': startSoloGame(); break;
    case 'create-room': createRoom(); break;
    case 'join-room': joinRoom(); break;
    case 'start-room': startRoomGame(); break;
    case 'leave-room': cleanupGame(); show('multiMenu'); break;
    case 'toggle-theme': toggleTheme(); break;
    case 'open-settings': openSettings(); break;
    case 'kick': if(el) kickPlayer(el.dataset.peer); break;
    case 'request-switch': if(el) requestSwitchTeam(el.dataset.target); break;
    case 'toggle-ready': toggleReady(); break;
    case 'send-chat': sendChat(); break;
    case 'open-nevera': openNevera(); break;
    case 'close-nevera': { const m=$('drinkModal'); if(m) m.classList.remove('open'); break; }
    case 'quit-game':
      showModal('¿Salir de la partida?',
        '<p style="text-align:center">Perderás el progreso de esta partida.</p>',
        'Sí, salir',
        ()=>{closeModal(); cleanupGame(); show('menu'); renderRanking(); renderFullRanking();},
        { secondary: { text: 'Cancelar', cb: ()=>closeModal() }, autoSkip: false }
      );
      break;
  }
}
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-action]');
  if(btn){ e.preventDefault(); handleAction(btn.dataset.action,btn); }
});

/* ===== SETTINGS ===== */
function openSettings(){
  ensureAudio();
  $('settingsName').value=S.username||'';
  const v=getVolumes();
  $('volMaster').value=v.master;
  $('volMusic').value=v.music;
  $('volSfx').value=v.sfx;
  $('voiceEnabled').checked=S.voiceEnabled;
  updateVolLabels();
  $('settingsModal').classList.add('open');
}
function updateVolLabels(){
  $('volMasterVal').textContent=Math.round($('volMaster').value*100)+'%';
  $('volMusicVal').textContent=Math.round($('volMusic').value*100)+'%';
  $('volSfxVal').textContent=Math.round($('volSfx').value*100)+'%';
}
function applyVolumes(){
  const v={
    master: parseFloat($('volMaster').value),
    music: parseFloat($('volMusic').value),
    sfx: parseFloat($('volSfx').value)
  };
  saveVolumes(v);
  if(masterGain) masterGain.gain.value=v.master;
  if(musicGain) musicGain.gain.value=v.music;
  if(sfxGain) sfxGain.gain.value=v.sfx;
  updateMusicVolume();
  updateVolLabels();
}
function updateMyName(newName){
  const trimmed=(newName||'').trim().slice(0,16);
  if(trimmed.length<2) return;
  S.username=trimmed;
  localStorage.setItem('bolasUsername', trimmed);
  const me=S.players.find(p=>p.isMe);
  if(me) me.name=trimmed;
  if(S.isMultiplayer){
    if(S.isHost){ broadcastLobby(); if(S.phase!=='idle') broadcastState(); }
    else if(S.hostConn && S.hostConn.open){
      try{ S.hostConn.send({type:'update-name', name:trimmed}); }catch(_){}
    }
  }
  updateUI();
}

/* ===== INIT ===== */
function init(){
  const savedTheme=localStorage.getItem(THEME_KEY)||'dark';
  setTheme(savedTheme);
  S.voiceEnabled = localStorage.getItem(VOICE_KEY) !== '0';
  S.buchiEnabled = localStorage.getItem(BUCHI_KEY) !== '0';

  const r=getRankings();
  let changed=false;
  Object.keys(r).forEach(name=>{
    if(!r[name].drinks){ r[name]=initFiestaStats(r[name]); changed=true; }
  });
  if(changed) saveRankings(r);

  const saved=localStorage.getItem('bolasUsername');
  if(saved){$('usernameInput').value=saved; S.username=saved}
  $('usernameInput').addEventListener('input',e=>{S.username=e.target.value.trim(); localStorage.setItem('bolasUsername',S.username);});

  applySavedConfig();

  $('soloGameMode').addEventListener('change',e=>{
    const isInd=e.target.value==='individual';
    $('soloTeamsConfig').style.display=isInd?'none':'';
    $('soloIndividualConfig').style.display=isInd?'':'none';
    saveConfigFromUI('solo');
  });
  $('roomGameMode').addEventListener('change',e=>{
    const v=e.target.value;
    $('roomTeamsConfig').style.display=v==='teams'?'':'none';
    $('roomIndividualConfig').style.display=v==='individual'?'':'none';
    $('roomFreeConfig').style.display=v==='free'?'':'none';
    saveConfigFromUI('room');
  });
  ['soloPlayers','soloTeam0','soloTeam1','soloPlayerCount','soloDifficulty','soloSpeed','soloMaxRounds','soloWallRest','soloTurnTimeout'].forEach(id=>{
    const el=$(id); if(el) el.addEventListener('change',()=>saveConfigFromUI('solo'));
    if(el && el.tagName==='INPUT') el.addEventListener('blur',()=>saveConfigFromUI('solo'));
  });
  ['roomPlayers','roomMaxPlayers','roomSpeed','roomMaxRounds','roomWallRest','roomTurnTimeout'].forEach(id=>{
    const el=$(id); if(el) el.addEventListener('change',()=>saveConfigFromUI('room'));
  });

  if($('soloFiesta')) $('soloFiesta').addEventListener('change',()=>saveConfigFromUI('solo'));
  if($('roomFiesta')) $('roomFiesta').addEventListener('change',()=>saveConfigFromUI('room'));
  if($('buchiEnabledToggle')) $('buchiEnabledToggle').checked = S.buchiEnabled;
  if($('fiestaDefaultToggle')){
    const cfg=getSavedConfig();
    $('fiestaDefaultToggle').checked = !!cfg.fiestaDefault;
    $('fiestaDefaultToggle').addEventListener('change',e=>{
      const v = e.target.checked;
      const c = getSavedConfig();
      c.fiestaDefault = v;
      c.soloFiesta = v;
      c.roomFiesta = v;
      saveSavedConfig(c);
      if($('soloFiesta')) $('soloFiesta').checked = v;
      if($('roomFiesta')) $('roomFiesta').checked = v;
    });
  }
  if($('buchiEnabledToggle')){
    $('buchiEnabledToggle').addEventListener('change',e=>{
      S.buchiEnabled=e.target.checked;
      try{ localStorage.setItem(BUCHI_KEY, S.buchiEnabled?'1':'0'); }catch(_){}
    });
  }
  if($('drinkModal')){
    $('drinkModal').addEventListener('click',e=>{
      if(e.target === $('drinkModal')) $('drinkModal').classList.remove('open');
    });
  }

  $('settingsClose').onclick=()=>{ $('settingsModal').classList.remove('open'); updateMyName($('settingsName').value); };
  $('settingsName').addEventListener('change',()=>updateMyName($('settingsName').value));
  ['volMaster','volMusic','volSfx'].forEach(id=>{
    const el=$(id); if(el) el.addEventListener('input',applyVolumes);
  });
  $('voiceEnabled').addEventListener('change',e=>{
    S.voiceEnabled=e.target.checked;
    try{ localStorage.setItem(VOICE_KEY, S.voiceEnabled?'1':'0'); }catch(_){}
  });
  $('themeDarkBtn').onclick=()=>{ setTheme('dark'); renderBackground(); };
  $('themeLightBtn').onclick=()=>{ setTheme('light'); renderBackground(); };
  $('settingsModal').addEventListener('click',(e)=>{
    if(e.target===$('settingsModal')){ $('settingsModal').classList.remove('open'); updateMyName($('settingsName').value); }
  });

  const codeEl=$('lobbyCode');
  if(codeEl) codeEl.addEventListener('click', copyLobbyCode);

  const fTbl=$('fullRankingTable');
  if(fTbl){
    fTbl.addEventListener('click',e=>{
      const row=e.target.closest('[data-player]');
      if(row) showPlayerHistory(row.dataset.player);
    });
  }

  const chatInp=$('chatInput');
  if(chatInp) chatInp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){ e.preventDefault(); sendChat(); }
  });

  renderRanking();
  renderFullRanking();
  resizeCanvas();
  S.bodies=[{x:18,y:5,vx:0,vy:0,r:CFG.mingoR,m:0.55,friction:CFG.mingoFriction,isMingo:true,team:-1,playerId:null,color:'#fff8e0',invalid:false,invalidAt:0}];
  S.aimAngle=defaultAimAngle();
  updateUI();
  requestAnimationFrame(loop);
  show('menu');
}

init();

})();