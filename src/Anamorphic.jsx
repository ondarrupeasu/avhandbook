import React, { useRef, useEffect, useState, useCallback } from "react";
import wideShot from "./assets/shots/ws.jpg";

// Anamorphic lenses — what the squeeze does to the picture, why the industry uses them, the look
// (oval bokeh, horizontal flares) and lens flares. Images come from the 3D set (SetFrameR renders):
// ws.jpg is the wide shot of Garfield in the living room with the oil lamp lit.

const C = { accent:"#ff5a4d", panel:"#16171c", card:"#1c1d23", line:"#2a2b32", text:"#e5e7eb", muted:"#8a8a94", muted2:"#6b7280",
  yellow:"#facc15", cyan:"#22d3ee", green:"#34d399", blue:"#60a5fa", violet:"#a78bfa", orange:"#fb923c" };
const panel = {background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:"14px 16px"};
const sBtn = (on) => ({padding:"5px 11px",borderRadius:6,border:`1px solid ${on?C.accent:C.line}`,background:on?"#ff5a4d22":"#26262c",color:on?C.accent:C.text,cursor:"pointer",fontSize:12.5});
const H = ({children,style}) => <div style={{color:C.text,fontWeight:"bold",fontSize:14,margin:"0 0 8px",...style}}>{children}</div>;
const P = ({children,style}) => <div style={{color:"#b8bcc6",fontSize:13,lineHeight:1.65,...style}}>{children}</div>;
const Mono = ({children,color=C.text,size=13}) => <span style={{fontFamily:"monospace",color,fontSize:size}}>{children}</span>;
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const fmtK = (n) => Math.round(n).toLocaleString("en-US");

function Ctl({label,min,max,step=1,value,onChange,disp,w=96}){
  return (
    <div style={{display:"grid",gridTemplateColumns:`${w}px 1fr 70px`,gap:10,alignItems:"center",margin:"8px 0"}}>
      <span style={{color:C.muted,fontSize:12.5}}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)} style={{width:"100%",accentColor:C.accent}}/>
      <span style={{color:C.text,fontSize:12.5,fontFamily:"monospace",textAlign:"right",whiteSpace:"nowrap"}}>{disp?disp(value):value}</span>
    </div>
  );
}
// canvas sized to its parent's content width (HiDPI); returns [ctx, W, H] in CSS px
function prep(c, h){
  const pe=c.parentElement, cs=pe?getComputedStyle(pe):null;
  const W=Math.max(280,(pe?.clientWidth||600)-(cs?parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight):0));
  const dpr=window.devicePixelRatio||1; c.width=Math.round(W*dpr); c.height=Math.round(h*dpr); c.style.width=W+"px"; c.style.height=h+"px";
  const x=c.getContext("2d"); x.setTransform(dpr,0,0,dpr,0,0); return [x,W,h];
}
function useResizeTick(){
  const [t,setT]=useState(0);
  useEffect(()=>{ let id; const on=()=>{ clearTimeout(id); id=setTimeout(()=>setT(v=>v+1),120); }; window.addEventListener("resize",on); return ()=>{ clearTimeout(id); window.removeEventListener("resize",on); }; },[]);
  return t;
}
function useImage(src){
  const [img,setImg]=useState(null);
  useEffect(()=>{ const i=new Image(); i.onload=()=>setImg(i); i.src=src; },[src]);
  return img;
}
const vh = () => (typeof window!=="undefined" ? window.innerHeight : 900);

/* ------------------------------------------------------------------ 1 · SQUEEZE */
// squeeze factor + sensor shape; pixel counts for a typical sensor of that shape
const SETUPS = [
  {id:"2x",  s:2,    a:4/3,  sensor:"4:3",  px:[2880,2160], label:"2× on 4:3",   note:"The classic: CinemaScope / Panavision on 35 mm film, today ARRI 4:3 and open-gate sensors."},
  {id:"1.8x",s:1.8,  a:3/2,  sensor:"3:2",  px:[4320,2880], label:"1.8× on 3:2", note:"Modern compromise (e.g. Atlas, Sirui) for full-frame 3:2 sensors: 1.5 × 1.8 = 2.7, trimmed to 2.39."},
  {id:"1.5x",s:1.5,  a:16/9, sensor:"16:9", px:[3840,2160], label:"1.5× on 16:9",note:"16:9 × 1.5 = 2.67, trimmed at the sides to 2.39. Popular on mirrorless and cinema cameras without 4:3."},
  {id:"1.33x",s:4/3, a:16/9, sensor:"16:9", px:[3840,2160], label:"1.33× on 16:9",note:"16:9 × 1.33 = 2.37 — almost exactly scope with no cropping. Common adapters and phone add-on lenses."},
];
const SCOPE = 2.39;

function Squeeze(){
  const ref=useRef(null), miniRef=useRef(null); const img=useImage(wideShot); const rt=useResizeTick();
  const [setup,setSetup]=useState("2x"); const [t,setT]=useState(0); const [playing,setPlaying]=useState(false);
  const S=SETUPS.find(x=>x.id===setup);
  const F=Math.min(SCOPE,S.a*S.s);                  // delivered aspect (≤ 2.39)
  // play: sensor → screen and back
  useEffect(()=>{ if(!playing) return; let raf, t0=performance.now();
    const step=(now)=>{ const k=((now-t0)/2600)%2; setT(k<1?ease(k):ease(2-k)); raf=requestAnimationFrame(step); };
    raf=requestAnimationFrame(step); return ()=>cancelAnimationFrame(raf); },[playing]);
  useEffect(()=>{
    const c=ref.current; if(!c||!img) return;
    const pe=c.parentElement, cw=(pe?.clientWidth||900)-32;
    const Hh=Math.round(clamp(Math.min(cw/F*0.92,(vh()-430)),200,520));
    const [x,W]=prep(c,Hh+46);
    x.fillStyle="#08090c"; x.fillRect(0,0,W,Hh+46);
    const top=30, Wf=Hh*F, sensorW=Hh*S.a, curW=Wf*(1/S.s+(1-1/S.s)*t);
    const cx=W/2;
    // the source band: 2.39-ish crop of the wide shot (Garfield + lamp)
    const sh=img.width/F, sy=clamp(600-sh/2,0,img.height-sh);
    // sensor outline (only meaningful near t=0)
    const sAlpha=1-t;
    if(sAlpha>0.02){
      x.save(); x.globalAlpha=sAlpha;
      x.strokeStyle=C.cyan; x.setLineDash([5,4]); x.lineWidth=1.5; x.strokeRect(cx-sensorW/2,top,sensorW,Hh); x.setLineDash([]);
      // recorded but trimmed later (sensor wider than the squeezed scope frame)
      if(sensorW>Wf/S.s+1){ x.fillStyle="rgba(34,211,238,.08)"; x.fillRect(cx-sensorW/2,top,(sensorW-Wf/S.s)/2,Hh); x.fillRect(cx+Wf/S.s/2,top,(sensorW-Wf/S.s)/2,Hh); }
      x.fillStyle=C.cyan; x.font="bold 11px monospace"; x.textAlign="left"; x.fillText(`SENSOR ${S.sensor} — what the camera records (squeezed ×${fmtS(S.s)})`,cx-sensorW/2,top-9);
      x.restore();
    }
    x.drawImage(img,0,sy,img.width,sh,cx-curW/2,top,curW,Hh);
    x.strokeStyle=t>0.98?C.accent:"rgba(255,255,255,.25)"; x.lineWidth=t>0.98?2:1; x.strokeRect(cx-curW/2,top,curW,Hh);
    if(t>0.02){ x.save(); x.globalAlpha=t; x.fillStyle=C.accent; x.font="bold 11px monospace"; x.textAlign="right";
      x.fillText(`SCREEN — desqueezed ×${fmtS(S.s)} → ${F.toFixed(2)}:1`,cx+curW/2,top+Hh+17); x.restore(); }
    // circle in the scene: the wall picture frame's round sun shows the distortion too — draw a reference circle
    const r=Hh*0.11, ccx=cx+curW*0.18, ccy=top+Hh*0.22;
    x.strokeStyle="rgba(250,204,21,.85)"; x.lineWidth=2; x.beginPath(); x.ellipse(ccx,ccy,r*(curW/Wf),r,0,0,7); x.stroke();
    x.fillStyle="rgba(250,204,21,.9)"; x.font="11px monospace"; x.textAlign="left"; x.fillText(t<0.98?"a circle, squeezed":"a circle again",ccx+r*(curW/Wf)+6,ccy+4);
  },[img,setup,t,rt]);
  // sensor usage: spherical crop vs anamorphic
  useEffect(()=>{
    const c=miniRef.current; if(!c) return; const [x,W,Hh]=prep(c,150);
    x.fillStyle="#0c0d11"; x.fillRect(0,0,W,Hh);
    const bh=88, bw=bh*S.a, gap=(W-2*bw)/3, y0=30;
    const draw=(ox,title,usedH,usedW,col)=>{
      x.fillStyle="#1f2129"; x.fillRect(ox,y0,bw,bh); x.strokeStyle="#3a3e4a"; x.strokeRect(ox,y0,bw,bh);
      x.fillStyle=col+"55"; x.fillRect(ox+(bw-usedW)/2,y0+(bh-usedH)/2,usedW,usedH); x.strokeStyle=col; x.lineWidth=1.5; x.strokeRect(ox+(bw-usedW)/2,y0+(bh-usedH)/2,usedW,usedH); x.lineWidth=1;
      x.fillStyle=col; x.font="bold 11px sans-serif"; x.textAlign="center"; x.fillText(title,ox+bw/2,y0-10);
      x.fillStyle=C.text; x.font="11px monospace"; x.fillText(`${Math.round(usedH*usedW/(bh*bw)*100)}% of the sensor`,ox+bw/2,y0+bh+16);
    };
    draw(gap,"Spherical, cropped to 2.39",Math.min(bh,bw/SCOPE),bw,"#9ca3af");
    draw(2*gap+bw,`Anamorphic ×${fmtS(S.s)}`,bh,Math.min(bw,bh*F/S.s),C.accent);
  },[setup,rt]);
  const [pw,ph]=S.px;
  const sphLines=Math.round(Math.min(ph,pw/SCOPE)), anaW=Math.round(Math.min(pw,ph*F/S.s));
  const outW=Math.round(anaW*S.s);
  return (
    <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"stretch"}}>
      <div style={{...panel,flex:"2 1 600px",minWidth:320}}>
        <canvas ref={ref} style={{display:"block"}}/>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginTop:4}}>
          <button style={{...sBtn(playing),minWidth:84}} onClick={()=>setPlaying(p=>!p)}>{playing?"❚❚ Pause":"▶ Play"}</button>
          <div style={{flex:1,minWidth:260}}><Ctl label="Desqueeze" min={0} max={1} step={0.01} value={t} onChange={v=>{ setPlaying(false); setT(v); }} disp={v=>v<0.01?"sensor":v>0.99?"screen":Math.round(v*100)+"%"} w={80}/></div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:2}}>
          {SETUPS.map(x=><button key={x.id} style={sBtn(setup===x.id)} onClick={()=>setSetup(x.id)}>{x.label}</button>)}
        </div>
      </div>
      <div style={{...panel,flex:"1 1 340px",minWidth:300}}>
        <H>Squeeze it in, stretch it out</H>
        <P>An anamorphic lens has a <strong>cylindrical</strong> element that compresses the picture <strong>only horizontally</strong>. A scene much wider than the sensor is squeezed onto it, so everyone looks <em>tall and thin</em>. In post (or in the projector, in film days) the picture is <strong>stretched back</strong> by the same factor: <Mono>{F.toFixed(2)}:1</Mono> widescreen, with no information thrown away.</P>
        <P style={{marginTop:8,fontSize:12.5,color:C.muted}}>{S.note}</P>
        <canvas ref={miniRef} style={{display:"block",marginTop:10,borderRadius:6}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"3px 12px",fontSize:12.5,fontFamily:"monospace",color:C.text,marginTop:8}}>
          <span style={{color:C.muted,fontFamily:"sans-serif"}}>Sensor ({S.sensor})</span><span>{fmtK(pw)} × {fmtK(ph)}</span>
          <span style={{color:C.muted,fontFamily:"sans-serif"}}>Spherical, crop to 2.39</span><span>{fmtK(pw)} × <span style={{color:"#9ca3af"}}>{fmtK(sphLines)}</span></span>
          <span style={{color:C.muted,fontFamily:"sans-serif"}}>Anamorphic, desqueezed</span><span>{fmtK(outW)} × <span style={{color:C.accent}}>{fmtK(ph)}</span></span>
        </div>
        <P style={{marginTop:8,fontSize:12.5}}>Same camera, same 2.39 frame: anamorphic gives <strong style={{color:C.accent}}>{Math.round((ph/sphLines-1)*100)}% more vertical lines</strong>, bigger photosites per detail and less noise/grain — because it uses the <strong>full height</strong> of the sensor instead of cropping off the top and bottom.</P>
      </div>
    </div>
  );
}
const ease=(k)=>k<0.5?2*k*k:1-((-2*k+2)**2)/2;
const fmtS=(s)=>Math.abs(s-4/3)<0.01?"1.33":String(+s.toFixed(2));

/* ------------------------------------------------------------------ 2 · WHY */
const TIMELINE = [
  ["1926","Henri Chrétien patents the Hypergonar, a lens that squeezes a wide view onto normal film."],
  ["1953","20th Century Fox launches CinemaScope with “The Robe” (2.55:1, later 2.35:1) to pull audiences away from TV."],
  ["1958→","Panavision's anamorphic lenses fix CinemaScope's flaws (the “mumps”) and become the industry standard."],
  ["1970","The projection standard settles at 2.39:1 (people still say “2.35”). Both names mean ‘scope’."],
  ["2010s→","Digital cinema cameras gain 4:3 / open-gate sensors: anamorphic is back. 1.33×–1.8× lenses and cheap adapters bring it to 16:9 cameras and phones."],
];
function Why(){
  const [f,setF]=useState(50); const [s,setS]=useState(2);
  const fovRef=useRef(null), bokRef=useRef(null), disRef=useRef(null), flRef=useRef(null); const rt=useResizeTick();
  const hEq=f/s;      // spherical focal with the same horizontal field
  useEffect(()=>{ // top view: same horizontal field, different lens
    const c=fovRef.current; if(!c) return; const [x,W,Hh]=prep(c,170);
    x.fillStyle="#0c0d11"; x.fillRect(0,0,W,Hh);
    // horizontal FOV of the anamorphic (f, squeeze s) = FOV of a spherical f/s on the same sensor width
    const sw=24.89; const fovA=2*Math.atan(sw*s/2/f), fovB=2*Math.atan(sw/2/hEq);
    const draw=(ox,fov,col,title,sub)=>{ const cy=Hh-22, L=Hh-46;
      x.fillStyle=col+"22"; x.strokeStyle=col; x.lineWidth=1.5; x.beginPath(); x.moveTo(ox,cy); x.lineTo(ox-Math.tan(fov/2)*L,cy-L); x.lineTo(ox+Math.tan(fov/2)*L,cy-L); x.closePath(); x.fill(); x.stroke();
      x.fillStyle=C.text; x.beginPath(); x.arc(ox,cy,5,0,7); x.fill();
      x.font="bold 12px sans-serif"; x.textAlign="center"; x.fillStyle=col; x.fillText(title,ox,Hh-4);
      x.font="11px monospace"; x.fillStyle=C.muted; x.fillText(sub,ox,16); };
    draw(W*0.27,fovA,C.accent,`${f} mm anamorphic ×${fmtS(s)}`,`${(fovA*180/Math.PI).toFixed(0)}° wide`);
    draw(W*0.73,fovB,"#9ca3af",`${Math.round(hEq)} mm spherical`,`${(fovB*180/Math.PI).toFixed(0)}° wide`);
  },[f,s,rt]);
  useEffect(()=>{ // bokeh: round vs oval
    const c=bokRef.current; if(!c) return; const [x,W,Hh]=prep(c,96); x.fillStyle="#07080b"; x.fillRect(0,0,W,Hh);
    const pts=[[0.1,0.35,1],[0.2,0.7,0.8],[0.3,0.3,0.9],[0.38,0.65,0.7]];
    x.globalCompositeOperation="lighter";
    [[0,"round",1],[0.5,"oval",0.55]].forEach(([ox,,k])=>pts.forEach(([u,v,a])=>{ const cx=(ox+u)*W, cy=v*Hh, r=15;
      const g=x.createRadialGradient(cx,cy,0,cx,cy,r); g.addColorStop(0,`rgba(255,200,120,${0.35*a})`); g.addColorStop(0.85,`rgba(255,190,110,${0.5*a})`); g.addColorStop(1,"rgba(255,190,110,0)");
      x.save(); x.translate(cx,cy); x.scale(k,1); x.translate(-cx,-cy); x.fillStyle=g; x.beginPath(); x.arc(cx,cy,r,0,7); x.fill(); x.restore(); }));
    x.globalCompositeOperation="source-over"; x.fillStyle=C.muted; x.font="11px monospace"; x.textAlign="center"; x.fillText("spherical",W*0.25,Hh-6); x.fillText("anamorphic",W*0.75,Hh-6);
  },[rt]);
  useEffect(()=>{ // barrel distortion grid
    const c=disRef.current; if(!c) return; const [x,W,Hh]=prep(c,96); x.fillStyle="#07080b"; x.fillRect(0,0,W,Hh);
    const k=0.12, cx=W/2, cy=Hh/2, sx=W*0.46, sy=Hh*0.42;
    const map=(u,v)=>{ const r2=u*u*0.6+v*v; const d=1-k*r2*(1-0.5*v*v); return [cx+u*sx*d, cy+v*sy*(1-k*0.4*u*u)]; };
    x.strokeStyle="rgba(96,165,250,.8)"; x.lineWidth=1;
    for(let i=-4;i<=4;i++){ x.beginPath(); for(let j=-10;j<=10;j++){ const [a,b]=map(j/10,i/4); j===-10?x.moveTo(a,b):x.lineTo(a,b);} x.stroke();
      x.beginPath(); for(let j=-10;j<=10;j++){ const [a,b]=map(i/4,j/10); j===-10?x.moveTo(a,b):x.lineTo(a,b);} x.stroke(); }
  },[rt]);
  useEffect(()=>{ // streak
    const c=flRef.current; if(!c) return; const [x,W,Hh]=prep(c,96); x.fillStyle="#07080b"; x.fillRect(0,0,W,Hh);
    x.globalCompositeOperation="lighter"; streak(x,W*0.5,Hh*0.5,W,1,[90,160,255]); glow(x,W*0.5,Hh*0.5,22,1,1.6);
    x.globalCompositeOperation="source-over";
  },[rt]);
  const look=(ref,col,title,text)=>(<div style={{...panel,flex:"1 1 220px",minWidth:210,padding:"10px 12px"}}>
    <canvas ref={ref} style={{display:"block",borderRadius:6}}/><div style={{color:col,fontWeight:"bold",fontSize:13,margin:"8px 0 3px"}}>{title}</div><P style={{fontSize:12.2,lineHeight:1.55}}>{text}</P></div>);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"stretch"}}>
        <div style={{...panel,flex:"1 1 420px",minWidth:300}}>
          <H>Why the industry uses them</H>
          <P style={{fontSize:12.8}}>
            <strong style={{color:C.text}}>1 · Widescreen without waste.</strong> On film the frame was a fixed size; squeezing let 2.39:1 use the whole negative instead of masking it. On digital it still means more of the sensor and more resolution (tab 1).<br/>
            <strong style={{color:C.text}}>2 · A longer lens for the same width.</strong> To fill the same width you use about <strong>×{fmtS(s)} the focal length</strong>: more background blur, more compression between planes, faces look natural even in wide shots.<br/>
            <strong style={{color:C.text}}>3 · The look.</strong> Oval bokeh, horizontal flares, gentle barrel distortion and focus fall-off at the edges read instantly as “cinema”. Today that, more than resolution, is why productions choose them.
          </P>
          <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:5}}>
            {TIMELINE.map(([y,t])=><div key={y} style={{display:"grid",gridTemplateColumns:"58px 1fr",gap:8,fontSize:12.2,color:"#b8bcc6",lineHeight:1.45}}><Mono color={C.yellow} size={12}>{y}</Mono><span>{t}</span></div>)}
          </div>
        </div>
        <div style={{...panel,flex:"1 1 420px",minWidth:300}}>
          <H>Same width, longer lens</H>
          <canvas ref={fovRef} style={{display:"block",borderRadius:6}}/>
          <Ctl label="Anamorphic" min={24} max={135} value={f} onChange={setF} disp={v=>v+" mm"}/>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}><span style={{color:C.muted,fontSize:12}}>Squeeze:</span>
            {[2,1.8,1.5,4/3].map(v=><button key={v} style={sBtn(Math.abs(s-v)<0.01)} onClick={()=>setS(v)}>×{fmtS(v)}</button>)}</div>
          <P style={{fontSize:12.5,marginTop:8}}>A <strong>{f} mm</strong> anamorphic ×{fmtS(s)} sees as <strong>wide</strong> as a <strong>{Math.round(hEq)} mm</strong> spherical, but as <strong>tall</strong> as a {f} mm — and it blurs and compresses like a {f} mm. At the same f-stop and the same framing, the longer lens gives a <strong>shallower depth of field</strong> and a bigger, softer background — a big part of the “anamorphic look”.</P>
        </div>
      </div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"stretch"}}>
        {look(bokRef,C.orange,"Oval bokeh","Out-of-focus lights become tall ovals instead of circles: the cylinder squeezes the blur disc horizontally.")}
        {look(flRef,C.blue,"Horizontal flares","A bright light throws a thin streak right across the frame, often blue from the lens coatings. See tab 4.")}
        {look(disRef,C.cyan,"Barrel distortion & fall-off","Straight lines bow near the edges and focus softens there. Close up, faces can look wider (the “mumps”).")}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ flare drawing (additive, on a 2D canvas) */
function glow(x,cx,cy,r,a,sx=1){
  x.save(); x.translate(cx,cy); x.scale(sx,1);
  const g=x.createRadialGradient(0,0,0,0,0,r); g.addColorStop(0,`rgba(255,255,245,${a})`); g.addColorStop(0.25,`rgba(255,235,200,${0.55*a})`); g.addColorStop(1,"rgba(255,200,150,0)");
  x.fillStyle=g; x.beginPath(); x.arc(0,0,r,0,7); x.fill(); x.restore();
}
function streak(x,cx,cy,W,a,[r,g,b]){
  [[1.6,0.95],[5,0.4],[14,0.14],[34,0.05]].forEach(([th,al])=>{
    const gr=x.createLinearGradient(0,0,W,0); const u=cx/W;
    gr.addColorStop(0,`rgba(${r},${g},${b},0)`); gr.addColorStop(clamp(u-0.45,0.001,0.998),`rgba(${r},${g},${b},${0.12*al*a})`);
    gr.addColorStop(clamp(u,0.002,0.999),`rgba(${Math.min(255,r+90)},${Math.min(255,g+70)},255,${al*a})`);
    gr.addColorStop(clamp(u+0.45,0.003,0.999),`rgba(${r},${g},${b},${0.12*al*a})`); gr.addColorStop(1,`rgba(${r},${g},${b},0)`);
    x.fillStyle=gr; x.fillRect(0,cy-th/2,W,th); });
}
function polygon(x,cx,cy,r,n,rot,sx=1){ x.beginPath(); for(let i=0;i<n;i++){ const t=rot+i*2*Math.PI/n; const px=cx+Math.cos(t)*r*sx, py=cy+Math.sin(t)*r; i?x.lineTo(px,py):x.moveTo(px,py); } x.closePath(); }
const GHOSTS=[[0.55,0.22,[120,255,170]],[1.05,0.12,[255,140,220]],[1.35,0.4,[255,200,110]],[1.7,0.18,[120,180,255]],[2.1,0.55,[180,255,200]],[-0.35,0.1,[255,170,120]]];
function flare(x,W,Hh,sx,sy,k,lens,opt){
  const cx=W/2, cy=Hh/2, vx=cx-sx, vy=cy-sy, sc=Math.min(W,Hh);
  if(lens==="sph"){
    glow(x,sx,sy,sc*0.16*k,0.9);
    // starburst: diffraction on the aperture blades — n spikes for even blades, 2n for odd
    const n=opt.blades%2?opt.blades*2:opt.blades;
    for(let i=0;i<n;i++){ const t=i*Math.PI*2/n+0.3, L=sc*0.38*k;
      const gr=x.createLinearGradient(sx,sy,sx+Math.cos(t)*L,sy+Math.sin(t)*L); gr.addColorStop(0,`rgba(255,240,220,${0.55*k})`); gr.addColorStop(1,"rgba(255,240,220,0)");
      x.strokeStyle=gr; x.lineWidth=1.6; x.beginPath(); x.moveTo(sx,sy); x.lineTo(sx+Math.cos(t)*L,sy+Math.sin(t)*L); x.stroke(); }
    // ghosts: reflections between elements, on the line through the centre, shaped like the aperture
    GHOSTS.forEach(([t,r,[cr,cg,cb]])=>{ const gx=sx+vx*t, gy=sy+vy*t, R=sc*0.08*(0.4+r*1.6);
      polygon(x,gx,gy,R,opt.blades,0.3); x.fillStyle=`rgba(${cr},${cg},${cb},${0.07*k})`; x.fill(); x.strokeStyle=`rgba(${cr},${cg},${cb},${0.16*k})`; x.lineWidth=1.2; x.stroke(); });
    glow(x,sx,sy,sc*0.55*k,0.08);   // veiling glare
  } else {
    glow(x,sx,sy,sc*0.13*k,0.9,1.9);
    streak(x,sx,sy,W,Math.min(1,k),opt.tint);
    // ghosts: oval (tall), tinted by the coatings, plus a faint echo of the streak
    GHOSTS.forEach(([t,r,c2])=>{ const gx=sx+vx*t, gy=sy+vy*t, R=sc*0.07*(0.4+r*1.6); const [cr,cg,cb]=mix(c2,opt.tint,0.6);
      x.save(); x.translate(gx,gy); x.scale(0.5,1); x.beginPath(); x.arc(0,0,R,0,7); x.restore(); x.fillStyle=`rgba(${cr},${cg},${cb},${0.08*k})`; x.fill();
      x.strokeStyle=`rgba(${cr},${cg},${cb},${0.18*k})`; x.lineWidth=1.2; x.stroke(); });
    const ex=sx+vx*2, ey=sy+vy*2; x.save(); x.globalAlpha=0.35; streak(x,ex,ey,W,Math.min(1,k)*0.5,opt.tint); x.restore();
    glow(x,sx,sy,sc*0.5*k,0.06,1.6);
  }
}
const mix=(a,b,t)=>a.map((v,i)=>Math.round(v*(1-t)+b[i]*t));

/* ------------------------------------------------------------------ 4 · FLARES */
const TINTS={blue:[70,140,255],amber:[255,160,60],clear:[230,230,240]};
const LAMP=[781,600];          // the oil lamp's flame in ws.jpg (px of the 1920×1080 render)
const VIEW=0.6;                // the camera sees 60 % of the set picture: drag to pan/tilt across it
function Flares(){
  const ref=useRef(null); const img=useImage(wideShot); const rt=useResizeTick();
  const [lens,setLens]=useState("ana"); const [tint,setTint]=useState("blue"); const [blades,setBlades]=useState(9); const [k,setK]=useState(1);
  const [cam,setCam]=useState([0.62,0.55]);   // camera aim, 0..1 over the pannable range
  const [auto,setAuto]=useState(false);
  useEffect(()=>{ if(!auto) return; let raf, t0=performance.now();
    const step=(now)=>{ const u=((now-t0)/7000)%1, p=0.5-0.5*Math.cos(u*2*Math.PI); setCam([p,0.5+0.12*Math.sin(u*4*Math.PI)]); raf=requestAnimationFrame(step); };
    raf=requestAnimationFrame(step); return ()=>cancelAnimationFrame(raf); },[auto]);
  useEffect(()=>{
    const c=ref.current; if(!c||!img) return;
    const pe=c.parentElement, cw=(pe?.clientWidth||900)-32;
    const Hh=Math.round(clamp(Math.min(cw*9/16,vh()-300),220,720)), W=Math.round(Hh*16/9);
    const dpr=window.devicePixelRatio||1; c.width=W*dpr; c.height=Hh*dpr; c.style.width=W+"px"; c.style.height=Hh+"px";
    const x=c.getContext("2d"); x.setTransform(dpr,0,0,dpr,0,0);
    const vw=img.width*VIEW, vhh=img.height*VIEW, ox=cam[0]*(img.width-vw), oy=cam[1]*(img.height-vhh);
    x.drawImage(img,ox,oy,vw,vhh,0,0,W,Hh);
    x.fillStyle="rgba(0,0,0,.22)"; x.fillRect(0,0,W,Hh);
    // where the lamp lands in this frame (0..1; outside = off-frame)
    const lx=(LAMP[0]-ox)/vw, ly=(LAMP[1]-oy)/vhh;
    const out=Math.max(0,-lx,lx-1,-ly,ly-1), vis=clamp(1-out/0.18,0,1);   // fades out just beyond the frame edge
    x.globalCompositeOperation="lighter";
    if(vis>0){ const opt={blades,tint:TINTS[tint]};
      const draw=(ln)=>flare(x,W,Hh,lx*W,ly*Hh,k*vis,ln,opt);
      if(lens==="split"){ x.save(); x.beginPath(); x.rect(0,0,W/2,Hh); x.clip(); draw("sph"); x.restore(); x.save(); x.beginPath(); x.rect(W/2,0,W/2,Hh); x.clip(); draw("ana"); x.restore(); }
      else draw(lens); }
    x.globalCompositeOperation="source-over";
    // centre cross: the ghosts always line up through it
    x.strokeStyle="rgba(255,255,255,.35)"; x.lineWidth=1; x.beginPath(); x.moveTo(W/2-9,Hh/2); x.lineTo(W/2+9,Hh/2); x.moveTo(W/2,Hh/2-9); x.lineTo(W/2,Hh/2+9); x.stroke();
    if(lens==="split"){ x.strokeStyle="rgba(255,255,255,.5)"; x.setLineDash([6,5]); x.beginPath(); x.moveTo(W/2,0); x.lineTo(W/2,Hh); x.stroke(); x.setLineDash([]);
      x.font="bold 12px monospace"; x.fillStyle="#fff"; x.textAlign="left"; x.fillText("SPHERICAL",10,20); x.textAlign="right"; x.fillText("ANAMORPHIC",W-10,20); }
    if(vis<1){ x.font="12px sans-serif"; x.fillStyle="rgba(255,255,255,.75)"; x.textAlign="center"; x.fillText(vis>0?"lamp just out of frame — the flare fades":"lamp out of frame — no flare",W/2,Hh-14); }
  },[img,lens,tint,blades,k,cam,rt]);
  const drag=useRef(null);
  const down=(e)=>{ setAuto(false); drag.current={x:e.clientX,y:e.clientY,c:cam}; e.currentTarget.setPointerCapture(e.pointerId); };
  const move=(e)=>{ const d=drag.current; if(!d) return; const r=e.currentTarget.getBoundingClientRect();
    // drag the camera: moving the mouse right turns the camera right (the set slides left)
    setCam([clamp(d.c[0]+(e.clientX-d.x)/r.width*1.2,0,1),clamp(d.c[1]+(e.clientY-d.y)/r.height*1.2,0,1)]); };
  return (
    <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"stretch"}}>
      <div style={{...panel,flex:"2 1 640px",minWidth:320,display:"flex",justifyContent:"center",alignItems:"center",padding:12}}>
        <canvas ref={ref} style={{display:"block",borderRadius:6,cursor:"grab",touchAction:"none"}}
          onPointerDown={down} onPointerMove={move} onPointerUp={()=>{ drag.current=null; }}/>
      </div>
      <div style={{...panel,flex:"1 1 330px",minWidth:300}}>
        <H>Move the camera, watch the flare</H>
        <P style={{fontSize:12.5}}>The oil lamp is the light source. <strong>Drag on the picture to pan and tilt the camera</strong>: as the lamp moves across the frame, the flare moves with it — and the ghosts swing round the centre of the frame (+).</P>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"10px 0 4px"}}>
          {[["sph","Spherical"],["ana","Anamorphic"],["split","Split ⇆"]].map(([id,l])=><button key={id} style={sBtn(lens===id)} onClick={()=>setLens(id)}>{l}</button>)}
          <button style={sBtn(auto)} onClick={()=>setAuto(a=>!a)}>{auto?"❚❚ Stop pan":"▶ Auto pan"}</button>
        </div>
        <Ctl label="Brightness" min={0.2} max={1.6} step={0.05} value={k} onChange={setK} disp={v=>Math.round(v*100)+"%"}/>
        {lens!=="ana" && <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",margin:"4px 0"}}><span style={{color:C.muted,fontSize:12,width:96}}>Aperture blades</span>
          {[6,8,9].map(n=><button key={n} style={sBtn(blades===n)} onClick={()=>setBlades(n)}>{n}</button>)}</div>}
        {lens!=="sph" && <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",margin:"4px 0"}}><span style={{color:C.muted,fontSize:12,width:96}}>Coating</span>
          {[["blue","Blue"],["amber","Amber"],["clear","Clear"]].map(([id,l])=><button key={id} style={sBtn(tint===id)} onClick={()=>setTint(id)}>{l}</button>)}</div>}
        <P style={{fontSize:12.4,marginTop:8}}>
          <strong style={{color:C.text}}>Spherical:</strong> a <strong>star</strong> (light diffracting on the aperture blades: 6 blades → 6 points, 9 blades → 18) and <strong>ghosts</strong> — reflections between glass elements, shaped like the aperture, lined up through the centre of the frame.<br/>
          <strong style={{color:C.text}}>Anamorphic:</strong> the light scattering inside the cylindrical elements spreads along the one axis they act on, so after the desqueeze it becomes a long <strong>horizontal streak</strong> at the lamp's height. Its colour comes from the lens <strong>coatings</strong> (classic blue, some amber). The ghosts are <strong>tall ovals</strong>, like the bokeh.
        </P>
        <P style={{fontSize:12,color:C.muted,marginTop:8}}>Camera operators "play" the flare by panning a few degrees — shining torches into Panavision anamorphics was the signature of <em>Star Trek</em> (2009). Streak filters fake it on spherical lenses, and you can tell: no oval ghosts, no oval bokeh.</P>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 3 · 3D (spherical vs anamorphic, live) */
function Compare3D(){
  return (
    <div style={{...panel,padding:"40px 24px",textAlign:"center",color:C.muted,fontSize:13}}>
      <div style={{color:C.text,fontSize:15,fontWeight:"bold",marginBottom:6}}>Coming soon</div>
      Two live 3D cameras side by side on the same set — spherical and anamorphic — with real oval bokeh and the oil lamp's streak, focus and aperture under your control.
      <div style={{marginTop:6}}>The 3D engine is getting its anamorphic lens right now. Meanwhile, tabs 1, 2 and 4 show the squeeze, the look and the flares.</div>
    </div>
  );
}

/* ------------------------------------------------------------------ module */
const TABS=[["squeeze","1 · Squeeze → desqueeze"],["why","2 · Why use them"],["compare","3 · 3D: spherical vs anamorphic"],["flares","4 · Lens flares"]];
export default function Anamorphic(){
  const [tab,setTab]=useState("squeeze");
  return (
    <div>
      <div role="tablist" style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,borderBottom:`1px solid ${C.line}`,paddingBottom:10}}>
        {TABS.map(([id,l])=><button key={id} role="tab" aria-selected={tab===id} onClick={()=>setTab(id)} style={{...sBtn(tab===id),padding:"7px 14px",fontSize:13,fontWeight:tab===id?"bold":"normal"}}>{l}</button>)}
      </div>
      {tab==="squeeze" && <Squeeze/>}
      {tab==="why" && <Why/>}
      {tab==="compare" && <Compare3D/>}
      {tab==="flares" && <Flares/>}
      <div style={{color:C.muted2,fontSize:11,marginTop:10}}>Images rendered from the 3D set — James Garfield (J. Q. A. Ward), National Portrait Gallery, Smithsonian (CC0); props Poly Haven (CC0).</div>
    </div>
  );
}
