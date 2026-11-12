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

/* ------------------------------------------------------------------ live 3D (lighting-studio engine, SetFrameR) */
// One studio on the dof-test set with the 'anamorphic-night' preset: the oil lamp at 8 m is the hero practical,
// its flame is the flare source and, defocused, the bokeh disc.
function useStudio(ref, setup){
  const [S,setS]=useState(null); const [err,setErr]=useState(""); const [,setTick]=useState(0);
  useEffect(()=>{
    let disposed=false, st=null; const offs=[];
    (async()=>{
      try{
        const mod=await import("./lighting-studio/lighting-studio.js"); if(disposed) return;
        st=await mod.createLightingStudio(ref.current,{subject:"dof-test",preset:"anamorphic-night",monitor:false});
        if(disposed){ try{st.dispose();}catch{} return; }
        st.setView("camera"); setup(st);
        offs.push(st.on("camera",()=>setTick(t=>t+1)));
        setS(st);
      }catch(e){ console.error("[Anamorphic3D]",e); if(!disposed) setErr(String(e?.message||e)); }
    })();
    return ()=>{ disposed=true; offs.forEach(o=>{ try{o();}catch{} }); try{st?.dispose();}catch{} };
  },[]);  // eslint-disable-line
  return [S,err];
}
function View3D({vref,S,err,label,col,h,grow=true}){
  return (
    <div style={{flex:grow?"1 1 420px":"none",minWidth:300,display:"flex",flexDirection:"column",gap:4}}>
      {label && <div style={{color:col,fontSize:11.5,fontFamily:"monospace",fontWeight:"bold",letterSpacing:".06em"}}>{label}</div>}
      <div ref={vref} style={{position:"relative",width:"100%",height:h,background:"#08080a",borderRadius:10,overflow:"hidden",border:`1px solid ${C.line}`,touchAction:"none"}}>
        {!S && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:err?"#fca5a5":C.muted,fontSize:13,textAlign:"center",padding:20}}>
          {err?<>Couldn't load the 3D view<br/>{err}</>:"Loading the 3D set…"}</div>}
      </div>
    </div>
  );
}
const COAT=[["blue","Blue"],["amber","Amber"],["clear","Clear"]];
const fmtSq=(s)=>Math.abs(s-1.33)<0.02?"1.33":String(s);

/* ------------------------------------------------------------------ 3 · 3D: spherical vs anamorphic */
// Guided experiments: each one sets both cameras and says what to look at.
const EXPS = [
  {id:"dof", n:"A", title:"Same framing, different focus",
   look:<>Both cameras frame <strong>the same width</strong>. To do that the anamorphic needs a lens <strong>×2 longer</strong> (75 mm vs ~42 mm), so at the same f-stop its sharp zone is <strong>shallower</strong>: look at the 2 m sign and the shelf at 11 m — softer on the right. Compare the sharp zones below.</>,
   cam:{focal:75,fstop:2.8,exp:2.5,focus:4,flare:false}, mag:null},
  {id:"bokeh", n:"B", title:"The shape of the bokeh",
   look:<>Focus close (2 m) and open the iris: the lamp at 8 m turns into a big out-of-focus disc. The magnifiers show it: <strong>round</strong> (the shape of the aperture) through the spherical lens, a <strong>tall oval</strong> through the anamorphic — the cylinder squeezes the blur horizontally.</>,
   cam:{focal:75,fstop:1.4,exp:0.5,focus:2,flare:false}, mag:{hf:0.17,label:"magnifier: the lamp, out of focus"}},
  {id:"flare", n:"C", title:"The shape of the flare",
   look:<>Focus on the lamp (8 m) and let it flare. Spherical: a <strong>star</strong> from the aperture blades plus round/polygonal ghosts. Anamorphic: a <strong>horizontal streak</strong> through the light plus tall-oval ghosts. Same light, same scene — only the lens changed.</>,
   cam:{focal:75,fstop:4,exp:3,focus:8,flare:true}, mag:{hf:0.42,label:"magnifier: around the lamp"}},
];
const LAMP_FLAME=[-0.75,1.0,-5.0];   // the oil-lamp flame on dof-test (the anamorphic-night practical sits there)
const fmtD=(m)=>m===Infinity||m>1e4?"∞":(Math.round(m*100)/100).toFixed(2);

function Compare3D(){
  const ra=useRef(null), rs=useRef(null), ma=useRef(null), ms=useRef(null);
  const [exp,setExp]=useState("dof");
  const E=EXPS.find(x=>x.id===exp);
  const [focal,setFocal]=useState(75), [fstop,setFstop]=useState(2.8), [ev,setEv]=useState(2.5), [focus,setFocus]=useState(4), [sq,setSq]=useState(2), [flareOn,setFlareOn]=useState(false);
  const [match,setMatch]=useState("width"), [coat,setCoat]=useState("blue"), [dist,setDist]=useState(0), [adv,setAdv]=useState(false);
  const base={dof:{on:true}, flare:{on:false,amount:1}};
  const [A,errA]=useStudio(ra,(st)=>{ st.setCamera({...base,lens:"anamorphic",squeeze:2,focalMm:75,fstop:2.8}); st.focusOn(4); });
  const [B,errB]=useStudio(rs,(st)=>{ st.setCamera({...base,lens:"spherical",blades:9,focalMm:42,fstop:2.8}); st.setAspect("2.39:1"); st.focusOn(4); });
  const pick=(id)=>{ const x=EXPS.find(e=>e.id===id); setExp(id); setFocal(x.cam.focal); setFstop(x.cam.fstop); setEv(x.cam.exp); setFocus(x.cam.focus); setFlareOn(x.cam.flare); setSq(2); setMatch("width"); };
  // keep both cameras in step
  useEffect(()=>{ if(!A) return; A.setWorld({exposure:ev}); A.setCamera({lens:"anamorphic",squeeze:sq,focalMm:focal,fstop,coating:coat,flare:{on:flareOn,amount:1.4},distortion:dist}); A.focusOn(focus); },[A,sq,focal,fstop,ev,focus,coat,flareOn,dist]);
  useEffect(()=>{ if(!A||!B) return;
    let f=focal;   // same width: the spherical focal with the anamorphic's horizontal field on a 2.39 frame of the same sensor
    if(match==="width"){ const ca=A.getCamera(), cb=B.getCamera(); f=Math.max(8,((cb.sensorMm||36)/2)/Math.tan((ca.fovH*Math.PI/180)/2)); }
    B.setWorld({exposure:ev}); B.setCamera({lens:"spherical",focalMm:f,fstop,flare:{on:flareOn,amount:1.4}}); B.setAspect("2.39:1"); B.focusOn(focus);
  },[A,B,match,sq,focal,fstop,ev,focus,flareOn]);
  // magnifiers: a still of each view, cropped around the lamp (the preset's warm practical sits at the flame)
  useEffect(()=>{
    if(!A||!B||!E.mag) return; let gone=false;
    const t=setTimeout(async()=>{
      for(const [S,vref,cref] of [[A,ra,ma],[B,rs,ms]]){ try{
        const c=cref.current, host=vref.current; if(!c||!host||gone) continue;
        const lamp={position:S.getFlareSources?.()[0]?.position||LAMP_FLAME};
        const p=S.project(lamp.position), cv=host.querySelector("canvas"); if(!cv) continue;
        const L=parseFloat(cv.style.left)||0, T=parseFloat(cv.style.top)||0, W=parseFloat(cv.style.width)||host.clientWidth, Hh=parseFloat(cv.style.height)||host.clientHeight;
        const blob=await S.snapshot({width:1600}); if(gone) return;
        const img=await createImageBitmap(blob);
        const [x,cw,ch]=prep(c,140); x.fillStyle="#08080a"; x.fillRect(0,0,cw,ch);
        if(!p){ x.fillStyle=C.muted; x.font="12px sans-serif"; x.textAlign="center"; x.fillText("lamp out of frame",cw/2,ch/2); continue; }
        const nx=(p.x-L)/W, ny=(p.y-T)/Hh, sh=img.height*E.mag.hf, sw=sh*cw/ch;
        x.drawImage(img,nx*img.width-sw/2,ny*img.height-sh/2,sw,sh,0,0,cw,ch);
        x.fillStyle="rgba(0,0,0,.55)"; x.fillRect(0,0,cw,18); x.fillStyle="#e5e7eb"; x.font="11px monospace"; x.textAlign="left"; x.fillText(E.mag.label,6,13);
      }catch(e){ console.warn("[Anamorphic] magnifier",e); } }
    },450);
    return ()=>{ gone=true; clearTimeout(t); };
  },[A,B,exp,focal,fstop,ev,focus,sq,flareOn,coat,dist,match]);
  const ca=A?.getCamera(), cb=B?.getCamera();
  const zone=(c)=>c?.dof ? <>sharp from <strong>{fmtD(c.dof.near)}</strong> to <strong>{fmtD(c.dof.far)}</strong> m · depth <strong style={{color:C.text}}>{c.dof.far===Infinity?"∞":fmtD(c.dof.far-c.dof.near)+" m"}</strong></> : null;
  const h="min(29vh,280px)";
  const side=(vref,S,err,col,label,cref,c)=>(
    <div style={{flex:"1 1 420px",minWidth:300,display:"flex",flexDirection:"column",gap:6}}>
      <View3D vref={vref} S={S} err={err} h={h} col={col} label={label} grow={false}/>
      {E.mag && <div style={{width:340,maxWidth:"100%",alignSelf:"center"}}><canvas ref={cref} style={{display:"block",borderRadius:8,border:`1px solid ${col}`}}/></div>}
      {exp==="dof" && <div style={{fontSize:12.5,color:"#b8bcc6",fontFamily:"monospace"}}>{zone(c)}</div>}
    </div>);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"stretch"}}>
        <div style={{display:"flex",flexDirection:"column",gap:6,flex:"0 0 auto"}}>
          {EXPS.map(x=><button key={x.id} onClick={()=>pick(x.id)} style={{...sBtn(exp===x.id),textAlign:"left",padding:"7px 12px",fontSize:13}}><strong>{x.n}</strong> · {x.title}</button>)}
        </div>
        <div style={{...panel,flex:"1 1 500px",minWidth:300,padding:"10px 14px",borderLeft:`3px solid ${C.accent}`}}>
          <div style={{color:C.accent,fontSize:11,fontFamily:"monospace",letterSpacing:".08em",marginBottom:3}}>WHAT TO LOOK AT</div>
          <P style={{fontSize:13}}>{E.look}</P>
        </div>
      </div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        {side(rs,B,errB,"#9ca3af",`SPHERICAL · ${cb?Math.round(cb.focalMm)+" mm":""} · f/${fstop.toFixed(1)}`,ms,cb)}
        {side(ra,A,errA,C.accent,`ANAMORPHIC ×${fmtSq(sq)} · ${focal} mm · f/${fstop.toFixed(1)}`,ma,ca)}
      </div>
      <div>
        <button style={sBtn(adv)} onClick={()=>setAdv(a=>!a)}>{adv?"▾":"▸"} Advanced controls</button>
        {adv && <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:8}}>
          <div style={{...panel,flex:"1 1 420px",minWidth:300,padding:"8px 14px"}}>
            <Ctl label="Focal (anam.)" min={35} max={135} value={focal} onChange={setFocal} disp={v=>v+" mm"}/>
            <Ctl label="Aperture" min={1.4} max={11} step={0.1} value={fstop} onChange={setFstop} disp={v=>"f/"+v.toFixed(1)}/>
            <Ctl label="Exposure" min={-2} max={5} step={0.1} value={ev} onChange={setEv} disp={v=>(v>=0?"+":"")+v.toFixed(1)+" EV"}/>
            <Ctl label="Focus" min={1.5} max={12} step={0.1} value={focus} onChange={setFocus} disp={v=>v.toFixed(1)+" m"}/>
          </div>
          <div style={{...panel,flex:"1 1 420px",minWidth:300,padding:"8px 14px"}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",margin:"4px 0 6px"}}><span style={{color:C.muted,fontSize:12,width:92}}>Squeeze</span>
              {[2,1.8,1.5,1.33].map(v=><button key={v} style={sBtn(sq===v)} onClick={()=>setSq(v)}>×{fmtSq(v)}</button>)}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",margin:"4px 0 6px"}}><span style={{color:C.muted,fontSize:12,width:92}}>Spherical lens</span>
              <button style={sBtn(match==="width")} onClick={()=>setMatch("width")}>same width</button>
              <button style={sBtn(match==="focal")} onClick={()=>setMatch("focal")}>same focal</button></div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",margin:"4px 0 6px"}}><span style={{color:C.muted,fontSize:12,width:92}}>Coating</span>
              {COAT.map(([id,l])=><button key={id} style={sBtn(coat===id)} onClick={()=>setCoat(id)}>{l}</button>)}
              <label style={{fontSize:12.5,color:C.text,marginLeft:8}}><input type="checkbox" checked={flareOn} onChange={e=>setFlareOn(e.target.checked)}/> Flares</label></div>
            <Ctl label="Distortion" min={0} max={1} step={0.05} value={dist} onChange={setDist} disp={v=>Math.round(v*100)+"%"} w={92}/>
          </div>
        </div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 4 · FLARES (live: drag = pan/tilt the camera) */
function Flares(){
  const ref=useRef(null);
  const [lens,setLens]=useState("anamorphic"), [coat,setCoat]=useState("blue"), [blades,setBlades]=useState(9), [amount,setAmount]=useState(1), [fstop,setFstop]=useState(2);
  const [aim,setAim]=useState([-6,0]);   // yaw, pitch (deg)
  const [auto,setAuto]=useState(false);
  const [S,err]=useStudio(ref,(st)=>{ st.setWorld({exposure:1.5}); st.setCamera({lens:"anamorphic",squeeze:2,focalMm:50,fstop:2,dof:{on:false},flare:{on:true,amount:1},yaw:-6,pitch:0}); });
  useEffect(()=>{ if(S) S.setCamera({lens,squeeze:2,coating:coat,blades,fstop,flare:{on:true,amount}}); },[S,lens,coat,blades,amount,fstop]);
  useEffect(()=>{ if(S) S.setCamera({yaw:aim[0],pitch:aim[1]}); },[S,aim]);
  useEffect(()=>{ if(!auto) return; let raf, t0=performance.now();
    const step=(now)=>{ const u=((now-t0)/8000)%1; setAim([-6+26*Math.sin(u*2*Math.PI),3*Math.sin(u*4*Math.PI)]); raf=requestAnimationFrame(step); };
    raf=requestAnimationFrame(step); return ()=>cancelAnimationFrame(raf); },[auto]);
  const drag=useRef(null);
  const down=(e)=>{ setAuto(false); drag.current={x:e.clientX,y:e.clientY,a:aim}; e.currentTarget.setPointerCapture(e.pointerId); };
  const move=(e)=>{ const d=drag.current; if(!d) return; const r=e.currentTarget.getBoundingClientRect();
    setAim([clamp(d.a[0]+(e.clientX-d.x)/r.width*40,-32,32),clamp(d.a[1]-(e.clientY-d.y)/r.height*20,-12,12)]); };
  return (
    <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"stretch"}}>
      <div style={{...panel,flex:"2 1 640px",minWidth:320,padding:10,cursor:"grab"}} onPointerDown={down} onPointerMove={move} onPointerUp={()=>{ drag.current=null; }}>
        <View3D vref={ref} S={S} err={err} h="min(60vh,640px)"/>
      </div>
      <div style={{...panel,flex:"1 1 330px",minWidth:300}}>
        <H>Move the camera, watch the flare</H>
        <P style={{fontSize:12.5}}>The oil lamp is the light source. <strong>Drag on the picture to pan and tilt the camera</strong>: as the lamp moves across the frame the flare follows it, the ghosts swing round the centre of the frame, and with the lamp just out of shot it fades away.</P>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"10px 0 4px"}}>
          {[["spherical","Spherical"],["anamorphic","Anamorphic ×2"]].map(([id,l])=><button key={id} style={sBtn(lens===id)} onClick={()=>setLens(id)}>{l}</button>)}
          <button style={sBtn(auto)} onClick={()=>setAuto(a=>!a)}>{auto?"❚❚ Stop pan":"▶ Auto pan"}</button>
          <button style={sBtn(false)} onClick={()=>{ setAuto(false); setAim([-6,0]); }}>Re-centre</button>
        </div>
        <Ctl label="Flare amount" min={0.2} max={2} step={0.05} value={amount} onChange={setAmount} disp={v=>Math.round(v*100)+"%"}/>
        <Ctl label="Aperture" min={1.4} max={16} step={0.1} value={fstop} onChange={setFstop} disp={v=>"f/"+v.toFixed(1)}/>
        {lens==="spherical" && <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",margin:"4px 0"}}><span style={{color:C.muted,fontSize:12,width:96}}>Aperture blades</span>
          {[6,8,9].map(n=><button key={n} style={sBtn(blades===n)} onClick={()=>setBlades(n)}>{n}</button>)}</div>}
        {lens==="anamorphic" && <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",margin:"4px 0"}}><span style={{color:C.muted,fontSize:12,width:96}}>Coating</span>
          {COAT.map(([id,l])=><button key={id} style={sBtn(coat===id)} onClick={()=>setCoat(id)}>{l}</button>)}</div>}
        <div style={{color:C.muted,fontSize:11.5,fontFamily:"monospace",margin:"2px 0 6px"}}>pan {aim[0]>=0?"+":""}{aim[0].toFixed(1)}° · tilt {aim[1]>=0?"+":""}{aim[1].toFixed(1)}°</div>
        <P style={{fontSize:12.4}}>
          <strong style={{color:C.text}}>Spherical:</strong> a <strong>star</strong> (light diffracting on the aperture blades: 6 blades → 6 points, 9 → 18; stronger stopped down) and <strong>ghosts</strong> — reflections between glass elements, shaped like the aperture, lined up through the centre of the frame.<br/>
          <strong style={{color:C.text}}>Anamorphic:</strong> the light scattering inside the cylindrical elements spreads along the one axis they act on, so after the desqueeze it becomes a long <strong>horizontal streak</strong> at the lamp's height, coloured by the lens <strong>coatings</strong>. The ghosts are <strong>tall ovals</strong>, like the bokeh.
        </P>
        <P style={{fontSize:12,color:C.muted,marginTop:8}}>Camera operators “play” the flare by panning a few degrees — shining torches into Panavision anamorphics was the signature of <em>Star Trek</em> (2009).</P>
      </div>
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
