import { S, CFG, rnd, isIndiv, fiestaActive, DRINK_KEYS, DRINKS, escapeHtml } from './state.js';
import { currentPlayer, playersOfTeam, closestOfTeam, defaultAimAngle, didIWin, winScore, ensureCantina, getPlayer } from './game-core.js';
import { broadcastState } from './broadcast.js';
import { showCenterToast, showBuchiPhrase, showLaRondaBanner, toast } from './notify.js';
import { resetFiestaState } from './fiesta.js';
import { maybeAI } from './ai.js';
import { recordGame, recordWin, unlockAchievement } from './config.js';
import { sfx, applauseSound, speak } from './audio.js';
import { renderScoreboard, updateUI, show as showScreen, showModal, closeModal } from './ui.js';
import { dist } from './state.js';

export function startSoloGame(){
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
  if (typeof window.__resizeCanvas === 'function') window.__resizeCanvas();
  showScreen('game');
  updateUI();
  if(fiestaActive()) showCenterToast('Modo Fiesta activado. ¡Salud!', '🍹', 'info', 3500);
  if(!S._hintShown){S._hintShown=true; setTimeout(()=>toast('⚠️ Si tu bola toca el mingo, queda descalificada', 4500), 600);}
}

export function buildPlayersSolo(){
  S.players=[];
  const me=S.username||'Tú';
  if(isIndiv()){
    const n=S.config.individualCount||4;
    for(let i=0;i<n;i++){
      const isMe=i===0;
      S.players.push({
        id:'ip'+i, name:isMe?me:('IA '+i),
        color:CFG.indivPalette[i%CFG.indivPalette.length], team:i, slot:0,
        isHuman:isMe, isMe, peerId:null,
        cantina: fiestaActive()?{ron:1,cerveza:1,cocuy:1,cafe:1}:null,
        drinksTaken:0, turnId:0, lastDrinkTurnId:-999, activeDrink:null
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
          cantina: fiestaActive()?{ron:1,cerveza:1,cocuy:1,cafe:1}:null,
          drinksTaken:0, turnId:0, lastDrinkTurnId:-999, activeDrink:null
        });
      }
    }
    S.teams=[{score:0},{score:0}];
  }
}

export function newGame(){
  if(isIndiv()) S.teams=S.players.map(()=>({score:0}));
  else S.teams=[{score:0},{score:0}];
  S.round=1; S.breakTaken=false;
  S.roundStarter=Math.floor(Math.random()*S.teams.length);
  S.stats = { invalids: 0, boches: 0, roundAtWin: 0 };
  startRound();
}

export function startRound(){
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
  if(fiestaActive()){
    S.players.forEach(p=>ensureCantina(p));
    const p0=currentPlayer();
    if(p0) p0.turnId=(p0.turnId||0)+1;
    S.laRondaActiveFor={};
  }
  updateUI();
  sfx('tick');
  maybeAI();
}

export function nextThrower(){
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
import { teamBallsOnCourt } from './game-core.js';

export function resolveTurn(){
  const nt=nextThrower();
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

export function timeoutTurn(){
  if(S.phase!=='aiming') return;
  const team=S.currentTeam;
  if(S.ballsLeft[team]>0) S.ballsLeft[team]--;
  S.charging=false;
  S.phase='settling';
  S._settleTimer=0.3;
  updateUI();
  toast('⏱️ Tiempo agotado');
  sfx('invalid');
  if(S.isMultiplayer && S.isHost) broadcastState();
}

export function endRound(){
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
    if(secondBest===Infinity) pts=myBalls.length;
    else pts=myBalls.filter(b=>dist(b,mingo)<secondBest).length;
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
        S.laRondaActiveFor[p.id]={ type:rand, throwsLeft:2 };
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
      ()=>{closeModal(); resetFiestaState(); newGame(); showScreen('game');},
      { secondary: { text: 'Volver al menú', cb: () => { closeModal(); if(typeof window.__cleanupGame === 'function') window.__cleanupGame(); showScreen('menu'); if(typeof window.__renderRankings === 'function') window.__renderRankings(); } }, autoSkip: false }
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
          const r=(typeof window.__getRankings === 'function') ? window.__getRankings() : {};
          if(r[me.name] && (me.drinksTaken||0)===0){
            r[me.name].soberWins=(r[me.name].soberWins||0)+1;
            if(r[me.name].soberWins>=5) unlockAchievement('conductor_designado');
            if(typeof window.__saveRankings === 'function') window.__saveRankings(r);
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
      ()=>{closeModal(); resetFiestaState(); newGame(); showScreen('game');},
      { secondary: { text: 'Volver al menú', cb: () => { closeModal(); if(typeof window.__cleanupGame === 'function') window.__cleanupGame(); showScreen('menu'); if(typeof window.__renderRankings === 'function') window.__renderRankings(); } }, autoSkip: false }
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

import { teamDisplayName } from './game-core.js';
import { $ } from './state.js';