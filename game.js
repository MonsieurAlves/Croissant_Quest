"use strict";
// Macaron Quest v0.4 — movement, maze generation and collection.
const canvas = document.getElementById("maze");
const ctx = canvas.getContext("2d");
const $ = id => document.getElementById(id);
const SIZE = 17;
const CELL = canvas.width / SIZE;
const DIRECTIONS = {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
let walls, macarons, player, direction, desiredDirection, lastMoveAt;
let playing = false, finished = false, score = 0, animationHandle = 0, lastFrame = 0;
// Two sprite frames. Each is a pixel-art SVG in this repository.
const sprites = { closed: new Image(), open: new Image() };
sprites.closed.src = "assets/player-closed.svg";
sprites.open.src = "assets/player-open.svg";
const macaronSprites = ["raspberry", "pistachio", "lavender"].map(flavor => {
  const image = new Image();
  image.src = "assets/macaron-" + flavor + ".svg";
  return image;
});
let lastStepAt = 0;
ctx.imageSmoothingEnabled = false;

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
  // Recursive-backtracker maze: passages are connected, so every macaron is reachable.
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
  // Fewer, larger pickups remain readable; a shuffled subset of reachable corridors.
  const openSpaces = [];
  for(let y=1;y<SIZE-1;y++){
    for(let x=1;x<SIZE-1;x++){
      if(!walls[y][x]&&(x!==1||y!==1)) openSpaces.push(key(x,y));
    }
  }
  macarons=new Set(shuffle(openSpaces).slice(0,Math.min(38,openSpaces.length)));
  player={x:1,y:1};
  direction=null;
  desiredDirection=null;
  lastMoveAt=0;
  score=0;
  finished=false;
  $("score").textContent="0";
  $("remaining").textContent=String(macarons.size);
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
  lastStepAt=performance.now();
  const k=key(player.x,player.y);
  if(macarons.delete(k)){
    score+=10;
    $("score").textContent=String(score);
    $("remaining").textContent=String(macarons.size);
    if(macarons.size===0){
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
  showOverlay("Game paused","Ready for more macarons?","Resume");
}
function finish(){
  playing=false;finished=true;
  $("status").textContent="Won!";
  showOverlay("Bravo! You did it!","All macarons collected. Final score: "+score+" points.","Play Again");
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
  const x = (player.x + .5) * CELL;
  const y = (player.y + .5) * CELL;
  // The sprite is 1.5 maze tiles wide, not restricted to its collision tile.
  // Draw it last so the face appears in front of nearby maze features.
  const side = CELL * 1.58;
  const chomping = playing && Math.floor(time / 145) % 2 === 0 && direction !== null;
  const sprite = sprites[chomping ? "open" : "closed"];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.shadowColor = "#0009";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 3;
  if(sprite.complete && sprite.naturalWidth){
    ctx.translate(x,y);
    // Flip while moving left, rather than rotating the face upside down.
    if(direction === "left") ctx.scale(-1,1);
    ctx.drawImage(sprite,-side/2,-side/2,side,side);
  } else {
    ctx.fillStyle="#E9AC83";
    ctx.fillRect(x-CELL*.4,y-CELL*.4,CELL*.8,CELL*.8);
  }
  ctx.restore();
}
function drawMacaron(x,y){
  const cx=(x+.5)*CELL,cy=(y+.5)*CELL;
  // Each coordinate has a consistent macaron flavor.
  const sprite=macaronSprites[(x*7+y*11)%macaronSprites.length];
  const size=CELL*.82;
  if(sprite.complete && sprite.naturalWidth){
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(sprite,cx-size/2,cy-size/2,size,size);
    ctx.restore();
    return;
  }
  ctx.fillStyle="#F1789C";
  ctx.beginPath();
  ctx.arc(cx,cy,CELL*.31,0,Math.PI*2);
  ctx.fill();
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
  for(const k of macarons){
    const [x,y]=k.split(",").map(Number);
    drawMacaron(x,y);
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
