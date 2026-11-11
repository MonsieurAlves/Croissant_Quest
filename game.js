"use strict";
// Croissant Quest v0.1 — movement, maze generation and collection.
const canvas = document.getElementById("maze");
const ctx = canvas.getContext("2d");
const $ = id => document.getElementById(id);
const SIZE = 17;
const CELL = canvas.width / SIZE;
const DIRECTIONS = {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
let walls, croissants, player, direction, desiredDirection, lastMoveAt;
let playing = false, finished = false, score = 0, animationHandle = 0, lastFrame = 0;
const avatar = new Image();
avatar.src = "https://monsieuralves.github.io/french-conjugation-game/assets/welcome.webp";
let avatarReady = false;
avatar.addEventListener("load",()=>{avatarReady = true; render(performance.now());});

function shuffle(items){
  const result=[...items];
  for(let i=result.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}
const key = (x,y)=>x+","+y;
function buildMaze(){
  walls = Array.from({length:SIZE},()=>Array(SIZE).fill(true));
  // Recursive-backtracker maze: passages are connected, so every croissant is reachable.
  function carve(x,y){
    walls[y][x]=false;
    for(const [dx,dy] of shuffle([[2,0],[-2,0],[0,2],[0,-2]])){
      const nx=x+dx,ny=y+dy;
      if(nx>0&&ny>0&&nx<SIZE-1&&ny<SIZE-1&&walls[ny][nx]){
        walls[y+dy/2][x+dx/2]=false;
        carve(nx,ny);
      }
    }
  }
  carve(1,1);
  // Add some shortcuts to make the routes more forgiving.
  for(let y=2;y<SIZE-2;y++){
    for(let x=2;x<SIZE-2;x++){
      if(walls[y][x]&&Math.random()<.12){
        const horizontal=!walls[y][x-1]&&!walls[y][x+1];
        const vertical=!walls[y-1][x]&&!walls[y+1][x];
        if(horizontal||vertical) walls[y][x]=false;
      }
    }
  }
  croissants=new Set();
  for(let y=1;y<SIZE-1;y++){
    for(let x=1;x<SIZE-1;x++){
      if(!walls[y][x]&&(x!==1||y!==1)&&Math.random()<.78) croissants.add(key(x,y));
    }
  }
  player={x:1,y:1};
  direction=null;
  desiredDirection=null;
  lastMoveAt=0;
  score=0;
  finished=false;
  $("score").textContent="0";
  $("remaining").textContent=String(croissants.size);
  $("status").textContent="Ready";
  $("pause").textContent="Pause";
}
function canMove(dx,dy){
  const x=player.x+dx,y=player.y+dy;
  return x>=0&&y>=0&&x<SIZE&&y<SIZE&&!walls[y][x];
}
function step(){
  if(!playing)return;
  if(desiredDirection){
    const [dx,dy]=DIRECTIONS[desiredDirection];
    if(canMove(dx,dy)) direction=desiredDirection;
  }
  if(!direction)return;
  const [dx,dy]=DIRECTIONS[direction];
  if(!canMove(dx,dy))return;
  player.x+=dx;
  player.y+=dy;
  const k=key(player.x,player.y);
  if(croissants.delete(k)){
    score+=10;
    $("score").textContent=String(score);
    $("remaining").textContent=String(croissants.size);
    if(croissants.size===0){
      finish();
    }
  }
}
function showOverlay(title,message,button){
  $("overlayTitle").textContent=title;
  $("overlayText").textContent=message;
  $("primary").textContent=button;
  $("overlay").classList.remove("hidden");
}
function hideOverlay(){$("overlay").classList.add("hidden");}
function start(){
  if(finished) buildMaze();
  playing=true;
  $("status").textContent="Playing";
  $("pause").textContent="Pause";
  hideOverlay();
}
function pause(){
  if(finished)return;
  playing=false;
  $("status").textContent="Paused";
  $("pause").textContent="Resume";
  showOverlay("Game paused","Ready for more croissants?","Resume");
}
function finish(){
  playing=false;finished=true;
  $("status").textContent="Won!";
  showOverlay("Bravo! You did it!","All croissants collected. Final score: "+score+" points.","Play Again");
}
function restart(){
  buildMaze();
  start();
}
function setDirection(d){
  if(!DIRECTIONS[d])return;
  desiredDirection=d;
  // Start moving immediately rather than waiting for the next interval.
  if(playing&&performance.now()-lastMoveAt>70){
    step();lastMoveAt=performance.now();
  }
}
function roundRect(x,y,w,h,r,color){
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.roundRect(x,y,w,h,r);
  ctx.fill();
}
function drawPlayer(time){
  const x=(player.x+.5)*CELL,y=(player.y+.5)*CELL;
  const r=CELL*.41;
  ctx.save();
  ctx.translate(x,y);
  const angles={right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2};
  const facing=direction||desiredDirection||"right";
  ctx.rotate(angles[facing]);
  ctx.shadowColor="#0009";ctx.shadowBlur=9;ctx.shadowOffsetY=3;
  // The chomp wedge indicates movement and doubles as a fallback face design.
  const mouth=playing?.18+Math.abs(Math.sin(time/110))*.27:.14;
  ctx.fillStyle="#ffcf8e";
  ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,mouth,Math.PI*2-mouth);ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.fillStyle="#17334c";ctx.beginPath();ctx.arc(-r*.06,-r*.46,r*.1,0,Math.PI*2);ctx.fill();
  ctx.restore();
  if(avatarReady){
    ctx.save();
    ctx.beginPath();ctx.arc(x,y,r*.76,0,Math.PI*2);ctx.clip();
    // Place the face within the circular playable head.
    const w=avatar.naturalWidth,h=avatar.naturalHeight;
    const side=Math.min(w,h);
    ctx.drawImage(avatar,(w-side)/2,Math.max(0,h*.02),side,Math.min(side,h*.80),x-r*.78,y-r*.78,r*1.56,r*1.56);
    ctx.restore();
  }
}
function drawCroissant(x,y){
  const cx=(x+.5)*CELL,cy=(y+.5)*CELL;
  // Small pastry-shaped canvas glyph, avoiding browser emoji differences.
  ctx.save();ctx.translate(cx,cy);ctx.rotate(-.25);
  ctx.fillStyle="#f3b45e";ctx.strokeStyle="#b76b30";ctx.lineWidth=1.7;
  ctx.beginPath();ctx.moveTo(-11,-5);ctx.quadraticCurveTo(0,7,11,-5);ctx.lineTo(13,6);
  ctx.quadraticCurveTo(0,17,-13,6);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle="#ffe1a1";ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(-5,3);ctx.lineTo(-3,10);ctx.moveTo(3,3);ctx.lineTo(5,10);ctx.stroke();
  ctx.restore();
}
function render(time){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle="#101c37";ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    if(walls[y][x]){
      roundRect(x*CELL+2,y*CELL+2,CELL-4,CELL-4,8,"#58cbb9");
      roundRect(x*CELL+6,y*CELL+5,CELL-12,4,2,"#a3f4d8");
    }
  }
  for(const k of croissants){
    const [x,y]=k.split(",").map(Number);
    drawCroissant(x,y);
  }
  drawPlayer(time);
}
function frame(time){
  if(playing&&time-lastMoveAt>=150){
    step();
    lastMoveAt=time;
  }
  render(time);
  animationHandle=requestAnimationFrame(frame);
}
$("primary").addEventListener("click",()=>{if(finished)restart();else start();});
$("pause").addEventListener("click",()=>{if(playing)pause();else start();});
$("restart").addEventListener("click",restart);
document.addEventListener("keydown",event=>{
  const k=event.key.toLowerCase();
  const mapping={arrowup:"up",w:"up",arrowdown:"down",s:"down",arrowleft:"left",a:"left",arrowright:"right",d:"right"};
  if(mapping[k]){event.preventDefault();setDirection(mapping[k]);}
  if(event.code==="Space"){
    event.preventDefault();if(playing)pause();else if(!finished)start();
  }
});
document.querySelectorAll("[data-dir]").forEach(button=>{
  button.addEventListener("pointerdown",event=>{
    event.preventDefault();
    setDirection(button.dataset.dir);
  });
});
buildMaze();
animationHandle=requestAnimationFrame(frame);
