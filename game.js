"use strict";
// Macaron Quest v0.6 Étoile experiment — fixed radial maze and central ghost house.
const canvas = document.getElementById("maze");
const ctx = canvas.getContext("2d");
const $ = id => document.getElementById(id);
const SIZE = 25;
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
// Fixed Place de l'Étoile level. Ghosts will eventually spawn inside the Arc.
const CENTER = Math.floor(SIZE/2);
const GHOST_HOUSE_RADIUS = 2.65;
const keyPoint = (x,y) => key(x,y);
function buildMaze(){
  walls=Array.from({length:SIZE},()=>Array(SIZE).fill(true));
  const inside=(x,y)=>x>0&&y>0&&x<SIZE-1&&y<SIZE-1;
  const open=(x,y)=>{
    if(inside(x,y) && Math.hypot(x-CENTER,y-CENTER)>GHOST_HOUSE_RADIUS)
      walls[y][x]=false;
  };
  // Draw each circular road as a connected, orthogonal sequence of tiles.
  // Connecting horizontal + vertical steps lets arrow-key motion follow curves.
  function walkPath(points){
    if(!points.length)return;
    let [x,y]=points[0];
    open(x,y);
    for(const [tx,ty] of points.slice(1)){
      while(x!==tx){x+=Math.sign(tx-x);open(x,y);}
      while(y!==ty){y+=Math.sign(ty-y);open(x,y);}
    }
  }
  function ring(radius){
    const points=[];
    for(let i=0;i<=192;i++){
      const a=i*Math.PI*2/192;
      points.push([Math.round(CENTER+radius*Math.cos(a)),Math.round(CENTER+radius*Math.sin(a))]);
    }
    walkPath(points);
  }
  // Inner circular roadway, intermediate crossing streets, and outer boulevard.
  ring(4.5);
  ring(8);
  ring(10.2);
  // Twelve radial avenues, just like the historic Place de l'Étoile.
  for(let spoke=0;spoke<12;spoke++){
    const a=spoke*Math.PI/6;
    const points=[];
    for(let radius=4.2;radius<=11.2;radius+=.15){
      points.push([Math.round(CENTER+radius*Math.cos(a)),Math.round(CENTER+radius*Math.sin(a))]);
    }
    walkPath(points);
  }
  // Connect the final radial ends to the outer ring, and reinforce ring bends
  // where the stepped cells meet, without opening the landmark in the center.
  const start={x:CENTER,y:2};
  open(start.x,start.y);
  // Keep only squares connected to the start: every collectible is reachable.
  const reachable=new Set([key(start.x,start.y)]);
  const queue=[start];
  for(let qi=0;qi<queue.length;qi++){
    const p=queue[qi];
    for(const [dx,dy] of Object.values(DIRECTIONS)){
      const nx=p.x+dx,ny=p.y+dy,k=key(nx,ny);
      if(inside(nx,ny)&&!walls[ny][nx]&&!reachable.has(k)){
        reachable.add(k);queue.push({x:nx,y:ny});
      }
    }
  }
  const openSpaces=[...reachable].filter(k=>k!==key(start.x,start.y));
  // Keep the maze arcade-dense but don't crowd every walkway.
  macarons=new Set(shuffle(openSpaces).slice(0,Math.min(75,openSpaces.length)));
  player=start;
  direction=null;desiredDirection=null;lastMoveAt=0;score=0;finished=false;
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
function drawArcDeTriomphe(){
  // The Arc occupies the inaccessible center and doubles as a future ghost house.
  const cx=(CENTER+.5)*CELL,cy=(CENTER+.5)*CELL;
  ctx.save();
  ctx.fillStyle="#1A2947";
  ctx.fillRect(cx-2.3*CELL,cy-2.25*CELL,4.6*CELL,4.5*CELL);
  // A pixel-art top-down facade, drawn with intentionally square edges.
  const unit=CELL*.19;
  function block(x,y,w,h,color){
    ctx.fillStyle=color;
    ctx.fillRect(Math.round(cx+x*unit),Math.round(cy+y*unit),Math.ceil(w*unit),Math.ceil(h*unit));
  }
  block(-8,-11,16,3,"#E7CAA0");
  block(-9,-8,18,3,"#C8A477");
  block(-9,-5,5,14,"#E7CAA0");
  block(4,-5,5,14,"#E7CAA0");
  block(-4,-5,8,13,"#1A2947");
  block(-11,9,22,2,"#E7CAA0");
  block(-9,-9,18,1,"#FFF0CD");
  block(-8,-4,3,10,"#FFF0CD");
  block(5,-4,3,10,"#FFF0CD");
  ctx.font="bold "+Math.round(CELL*.33)+"px monospace";
  ctx.fillStyle="#FFD17A";ctx.textAlign="center";
  ctx.fillText("GHOST HOUSE",cx,cy+CELL*2.05);
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
  drawArcDeTriomphe();
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
