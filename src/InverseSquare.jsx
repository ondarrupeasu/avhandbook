import React, { useRef, useEffect, useState, useCallback } from "react";

// Inverse-Square Law — how light falls off with distance. Five tabs: the units (lm, cd, lux, nits),
// why it is "squared", a 3D lab on the lighting-studio engine (the dof-test set with its distance
// signs), the formula with real numbers, and the cases where the law does NOT hold.

const C = { accent:"#ff5a4d", panel:"#16171c", card:"#1c1d23", line:"#2a2b32", text:"#e5e7eb", muted:"#8a8a94", muted2:"#6b7280",
  yellow:"#facc15", cyan:"#22d3ee", green:"#34d399", violet:"#a78bfa", orange:"#fb923c" };

// Engine calibration: intensity 1 at 2 m (E = 12/4 = 3 engine units) is a correct exposure at ISO 400 · 1/50 · f/2.8,
// which an incident meter (C = 250) calls 245 lux. Rendering is linear, so the picture and these numbers agree.
const LUX_PER_UNIT = 245/3, CD_PER_UNIT = 12*LUX_PER_UNIT, SUN_PER_UNIT = 3*LUX_PER_UNIT;
const ISO = 400, SHUT = 1/50, KMETER = 250;
const luxForF = (N) => N*N*KMETER/(SHUT*ISO);          // lux a correct exposure needs at f/N
const fForLux = (E) => Math.sqrt(E*SHUT*ISO/KMETER);   // f-number that exposes E lux correctly

const fmtN = (x) => !isFinite(x) ? "∞" : x>=1000 ? Math.round(x).toLocaleString("en-US") : x>=100 ? String(Math.round(x))
  : x>=10 ? (Math.round(x*10)/10).toString() : x>=1 ? (Math.round(x*100)/100).toString() : x>0 ? x.toPrecision(2) : "0";
const fmtSt = (s) => Math.abs(s)<0.05 ? "±0" : (s>0?"+":"−")+Math.abs(s).toFixed(1);
const fmtF = (N) => "f/"+(N<10 ? (Math.round(N*10)/10).toString() : Math.round(N));
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));

const panel = {background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:"14px 16px"};
const sBtn = (on) => ({padding:"5px 11px",borderRadius:6,border:`1px solid ${on?C.accent:C.line}`,background:on?"#ff5a4d22":"#26262c",color:on?C.accent:C.text,cursor:"pointer",fontSize:12.5});
const H = ({children,style}) => <div style={{color:C.text,fontWeight:"bold",fontSize:14,margin:"0 0 8px",...style}}>{children}</div>;
const P = ({children,style}) => <div style={{color:"#b8bcc6",fontSize:13,lineHeight:1.65,...style}}>{children}</div>;
const Mono = ({children,color=C.text,size=13}) => <span style={{fontFamily:"monospace",color,fontSize:size}}>{children}</span>;

function Ctl({label,min,max,step=1,value,onChange,disp,log=false,w=96}){
  const toT = (v) => log ? Math.log(v/min)/Math.log(max/min)*1000 : v;
  const fromT = (t) => log ? min*Math.pow(max/min,t/1000) : t;
  return (
    <div style={{display:"grid",gridTemplateColumns:`${w}px 1fr 92px`,gap:10,alignItems:"center",margin:"9px 0"}}>
      <span style={{color:C.muted,fontSize:12.5}}>{label}</span>
      <input type="range" min={log?0:min} max={log?1000:max} step={log?1:step} value={toT(value)}
        onChange={e=>{ let v=fromT(+e.target.value); if(!log) v=Math.round(v/step)*step; onChange(v); }} style={{width:"100%",accentColor:C.accent}}/>
      <span style={{color:C.text,fontSize:12.5,fontFamily:"monospace",textAlign:"right",whiteSpace:"nowrap"}}>{disp?disp(value):value}</span>
    </div>
  );
}

// Canvas sized to its parent's width (crisp on HiDPI); returns [ctx, W, H] in CSS pixels.
function prep(c, h){
  const pe = c.parentElement, cs = pe ? getComputedStyle(pe) : null;
  const W = Math.max(280, (pe?.clientWidth||600) - (cs ? parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight) : 0));
  const dpr = window.devicePixelRatio||1;
  c.width = Math.round(W*dpr); c.height = Math.round(h*dpr); c.style.width = W+"px"; c.style.height = h+"px";
  const x = c.getContext("2d"); x.setTransform(dpr,0,0,dpr,0,0); return [x,W,h];
}
function useResizeTick(){
  const [t,setT] = useState(0);
  useEffect(()=>{ let id; const on=()=>{ clearTimeout(id); id=setTimeout(()=>setT(v=>v+1),120); }; window.addEventListener("resize",on); return ()=>{ clearTimeout(id); window.removeEventListener("resize",on); }; },[]);
  return t;
}

// Simple line chart. series: [{fn, color, label, dash, width}]; marks: [{x, y, color, label}]
function plot(x, W, Hh, o){
  const L=58, R=18, T=22, B=36, pw=W-L-R, ph=Hh-T-B;
  const X = (v) => L+(v-o.xmin)/(o.xmax-o.xmin)*pw, Y = (v) => T+(1-(v-o.ymin)/(o.ymax-o.ymin))*ph;
  x.fillStyle="#0c0d11"; x.fillRect(0,0,W,Hh);
  x.font="11px monospace"; x.lineWidth=1;
  o.yTicks.forEach(v=>{ x.strokeStyle=v===o.yZero?"#3f4250":"#1f2129"; x.beginPath(); x.moveTo(L,Y(v)); x.lineTo(W-R,Y(v)); x.stroke();
    x.fillStyle=C.muted2; x.textAlign="right"; x.fillText(o.yFmt?o.yFmt(v):v, L-6, Y(v)+4); });
  o.xTicks.forEach(v=>{ x.strokeStyle="#1f2129"; x.beginPath(); x.moveTo(X(v),T); x.lineTo(X(v),T+ph); x.stroke();
    x.fillStyle=C.muted2; x.textAlign="center"; x.fillText(v+(o.xUnit||""), X(v), T+ph+15); });
  if(o.xLab){ x.fillStyle=C.muted; x.textAlign="center"; x.fillText(o.xLab, L+pw/2, Hh-3); }
  if(o.yLab){ x.save(); x.translate(12,T+ph/2); x.rotate(-Math.PI/2); x.textAlign="center"; x.fillStyle=C.muted; x.fillText(o.yLab,0,0); x.restore(); }
  x.save(); x.beginPath(); x.rect(L,T,pw,ph); x.clip();
  o.series.forEach(s=>{ x.strokeStyle=s.color; x.lineWidth=s.width||2.2; x.setLineDash(s.dash||[]); x.beginPath(); let pen=false;
    for(let i=0;i<=400;i++){ const v=o.xmin+(o.xmax-o.xmin)*i/400, y=s.fn(v); if(!isFinite(y)){ pen=false; continue; }
      const yy=Y(clamp(y,o.ymin-(o.ymax-o.ymin),o.ymax+(o.ymax-o.ymin))); if(pen) x.lineTo(X(v),yy); else { x.moveTo(X(v),yy); pen=true; } }
    x.stroke(); x.setLineDash([]); });
  (o.marks||[]).forEach(m=>{ const px=X(m.x), py=Y(m.y);
    if(m.guides){ x.strokeStyle=m.color+"88"; x.setLineDash([3,3]); x.beginPath(); x.moveTo(px,T+ph); x.lineTo(px,py); x.lineTo(L,py); x.stroke(); x.setLineDash([]); }
    x.fillStyle=m.color; x.beginPath(); x.arc(px,py,m.r||4.5,0,7); x.fill();
    if(m.label){ x.font="bold 11px monospace"; x.textAlign=m.align||"left"; x.fillText(m.label, px+(m.align==="right"?-8:8), py-8); } });
  x.restore();
  // legend
  x.font="11.5px sans-serif"; x.textAlign="left";
  const labs=o.series.filter(s=>s.label); let lx=W-R-8-labs.reduce((a,s)=>a+x.measureText(s.label).width+40,0)+16;
  labs.forEach(s=>{ x.fillStyle="rgba(12,13,17,.85)"; x.fillRect(lx-4,T+1,x.measureText(s.label).width+28,16); x.fillStyle=s.color; x.fillRect(lx,T+7,14,3); x.fillStyle=C.text; x.fillText(s.label,lx+19,T+12); lx+=x.measureText(s.label).width+40; });
  return {X,Y};
}

/* ------------------------------------------------------------------ 1 · UNITS */
const REFL = [["White card",0.9],["Skin (light)",0.35],["Grey card",0.18],["Black velvet",0.03]];
function Units(){
  const [lm,setLm]=useState(1600), [beam,setBeam]=useState(360), [d,setD]=useState(2), [rho,setRho]=useState(0.18);
  const omega = 2*Math.PI*(1-Math.cos(beam/2*Math.PI/180));   // solid angle of the beam (sr); 360° = whole sphere = 4π
  const cd = lm/omega, E = cd/(d*d), L = E*rho/Math.PI;
  const step = (n,color,title,unit,value,text,ctrl) => (
    <div style={{...panel,flex:"1 1 230px",minWidth:220,borderTop:`3px solid ${color}`,display:"flex",flexDirection:"column"}}>
      <div style={{color,fontSize:11,fontFamily:"monospace",letterSpacing:".08em",textTransform:"uppercase"}}>{n}</div>
      <div style={{color:C.text,fontWeight:"bold",fontSize:15,marginTop:2}}>{title}</div>
      <div style={{margin:"8px 0 6px"}}><Mono color={color} size={24}>{value}</Mono> <Mono color={C.muted} size={13}>{unit}</Mono></div>
      <P style={{fontSize:12.5,flex:1}}>{text}</P>
      <div style={{marginTop:6}}>{ctrl}</div>
    </div>
  );
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <P style={{maxWidth:1100}}>Four words describe the journey of light from a lamp to the camera. Each one measures a <strong>different thing</strong>, and mixing them up is the most common mistake. Follow the chain and move the controls: every number is computed from the one before it.</P>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"stretch"}}>
        {step("1 · source",C.yellow,"Luminous flux","lumen (lm)",fmtN(lm),
          <>All the visible light the lamp puts out, <strong>in every direction</strong> together. It is the figure on the box of a bulb or LED panel. It says nothing about where the light goes.</>,
          <Ctl w={70} label="Lumens" log min={50} max={50000} value={lm} onChange={setLm} disp={v=>fmtN(v)+" lm"}/>)}
        {step("2 · beam",C.orange,"Luminous intensity","candela (cd)",fmtN(cd),
          <>How much of that light goes <strong>in one direction</strong>. Squeeze the same lumens into a narrower beam (a spot, a fresnel flooded → spotted) and the candela go up. The inverse-square formula starts here: <Mono>E = I / d²</Mono>.</>,
          <Ctl w={70} label="Beam" min={10} max={360} value={beam} onChange={setBeam} disp={v=>v>=360?"bare bulb":Math.round(v)+"°"}/>)}
        {step("3 · arriving",C.green,"Illuminance","lux (lx) = lm/m²",fmtN(E),
          <>Light <strong>landing on a surface</strong>, per square metre. It is what an <strong>incident light meter</strong> reads, held at the subject. It is the one that <strong>falls with the square of the distance</strong>. In the US: foot-candles (1 fc = 10.76 lx).</>,
          <Ctl w={70} label="Distance" min={0.5} max={10} step={0.1} value={d} onChange={setD} disp={v=>v.toFixed(1)+" m"}/>)}
        {step("4 · leaving",C.cyan,"Luminance","cd/m² = “nits”",fmtN(L),
          <>Light <strong>coming off the surface</strong> towards the eye or the camera. Same lux on a white shirt and a black jacket give very different luminance. It is what the <strong>sensor records</strong>, what a <strong>spot meter</strong> reads, and how screens are rated (SDR white 100 nits, HDR highlights 1000+).</>,
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{REFL.map(([n,r])=><button key={n} style={sBtn(rho===r)} onClick={()=>setRho(r)}>{n} {Math.round(r*100)}%</button>)}</div>)}
      </div>
      <div style={{...panel,padding:"10px 16px",fontFamily:"monospace",fontSize:13,color:C.text,lineHeight:1.75}}>
        <span style={{color:C.orange}}>I</span> = {fmtN(lm)} lm ÷ {omega.toFixed(2)} sr <span style={{color:C.muted2}}>(beam solid angle{beam>=360?" — whole sphere, 4π":""})</span> = <span style={{color:C.orange}}>{fmtN(cd)} cd</span><br/>
        <span style={{color:C.green}}>E</span> = {fmtN(cd)} cd ÷ ({d.toFixed(1)} m)² = <span style={{color:C.green}}>{fmtN(E)} lux</span> <span style={{color:C.muted2}}>= {fmtN(E/10.764)} fc</span><br/>
        <span style={{color:C.cyan}}>L</span> = {fmtN(E)} lux × {Math.round(rho*100)}% ÷ π = <span style={{color:C.cyan}}>{fmtN(L)} cd/m²</span> <span style={{color:C.muted2}}>(a matte surface: reflected light spreads over a half-sphere, hence ÷ π)</span>
      </div>
      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
        <div style={{...panel,flex:"1 1 420px"}}>
          <H>Typical values</H>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"2px 18px",fontSize:12.5,color:"#b8bcc6"}}>
            {[["Full moon","0.1–0.3 lux"],["Living room, evening","50–150 lux"],["Office","300–500 lux"],["TV studio set","800–2,000 lux"],["Overcast day","1,000–10,000 lux"],["Direct sunlight","~100,000 lux"]].map(([a,b])=>
              <React.Fragment key={a}><span>{a}</span><Mono color={C.green} size={12.5}>{b}</Mono></React.Fragment>)}
          </div>
        </div>
        <div style={{...panel,flex:"1 1 420px"}}>
          <H>Don't mix them up</H>
          <P style={{fontSize:12.5}}>
            <strong style={{color:C.text}}>Watts are not light</strong> — they are the power a lamp <em>draws</em>: tungsten ~15 lm/W, LED ~100 lm/W.<br/>
            <strong style={{color:C.text}}>Lux is the light; luminance is the surface.</strong> Same lux, a dark subject still looks darker.<br/>
            <strong style={{color:C.text}}>Moving the CAMERA does not darken the subject.</strong> The law is about the distance from the <em>light</em>: a wall 2 m or 20 m from the lens has the same luminance.<br/>
            <strong style={{color:C.text}}>Stops:</strong> one stop = twice or half the light (1 EV). Meters, f-numbers, ISO and shutter all count in stops.
          </P>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 2 · WHY SQUARED */
const DOTS = Array.from({length:100},(_,i)=>{ const a=Math.sin(i*12.9898+4.1)*43758.5453, b=Math.sin(i*78.233+1.7)*43758.5453; return [a-Math.floor(a)-0.5, b-Math.floor(b)-0.5]; });
function WhySquared(){
  const ref=useRef(null); const [d,setD]=useState(2); const rt=useResizeTick();
  useEffect(()=>{
    const c=ref.current; if(!c) return; const [x,W,Hh]=prep(c,400);
    x.fillStyle="#0a0b0f"; x.fillRect(0,0,W,Hh);
    const ox=70, oy=Hh/2-4, kx=(W-260)/4.4, ky=42, zx=0.85*ky, zy=0.38*ky;
    const Pt=(px,y,z)=>[ox+px*kx+z*zx, oy-y*ky+z*zy];
    const quad=(dd,s=dd)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>Pt(dd,a*s/2,b*s/2));
    const poly=(q)=>{ x.beginPath(); q.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b)); x.closePath(); };
    // distance axis
    x.strokeStyle="#2a2d36"; x.lineWidth=1; x.beginPath(); x.moveTo(...Pt(0,0,0)); x.lineTo(...Pt(4.4,0,0)); x.stroke();
    x.font="11px monospace"; x.fillStyle=C.muted2; x.textAlign="center";
    // reference planes at 1·2·3·4 m with their 1 m² grid
    [4,3,2,1].forEach(k=>{ const q=quad(k); poly(q); x.fillStyle="rgba(255,255,255,.025)"; x.fill(); x.strokeStyle="#3a3e4a"; x.stroke();
      x.strokeStyle="#262932"; for(let i=1;i<k;i++){ const t=-k/2+i;
        x.beginPath(); x.moveTo(...Pt(k,t,-k/2)); x.lineTo(...Pt(k,t,k/2)); x.stroke();
        x.beginPath(); x.moveTo(...Pt(k,-k/2,t)); x.lineTo(...Pt(k,k/2,t)); x.stroke(); }
      const [bx,by]=Pt(k,-k/2,k/2); x.fillStyle=C.muted2; x.fillText(`${k} m · ${k*k} m²`,bx,by+18); });
    // the pyramid of light
    const far=quad(4.4); x.strokeStyle="rgba(250,204,21,.35)"; x.lineWidth=1.2; far.forEach(p=>{ x.beginPath(); x.moveTo(...Pt(0,0,0)); x.lineTo(...p); x.stroke(); });
    // the moving card
    const q=quad(d), rel=1/(d*d);
    poly(q); x.fillStyle=`rgba(250,204,21,${(0.08+0.7*Math.min(1,rel)).toFixed(3)})`; x.fill(); x.strokeStyle=C.yellow; x.lineWidth=2; x.stroke();
    x.fillStyle="#fff7cc"; DOTS.forEach(([a,b])=>{ const [px,py]=Pt(d,a*d,b*d); x.beginPath(); x.arc(px,py,1.7,0,7); x.fill(); });
    // source
    const [sx,sy]=Pt(0,0,0); const g=x.createRadialGradient(sx,sy,0,sx,sy,26); g.addColorStop(0,"rgba(255,240,180,1)"); g.addColorStop(1,"rgba(250,204,21,0)");
    x.fillStyle=g; x.beginPath(); x.arc(sx,sy,26,0,7); x.fill(); x.fillStyle=C.yellow; x.textAlign="center"; x.font="bold 11px monospace"; x.fillText("light",sx,sy+40);
    const [tx,ty]=Pt(d,d/2,-d/2); x.fillStyle=C.yellow; x.textAlign="left"; x.fillText(`d = ${d.toFixed(1)} m → ${fmtN(d*d)} m² → each m² gets ${fmtN(100*rel)}%`,Math.min(tx,W-330),Math.max(16,ty-10));
  },[d,rt]);
  const rel=1/(d*d);
  return (
    <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"stretch"}}>
      <div style={{...panel,flex:"2 1 560px",minWidth:320}}>
        <canvas ref={ref} style={{display:"block"}}/>
        <Ctl label="Card distance" min={0.6} max={4.2} step={0.05} value={d} onChange={setD} disp={v=>v.toFixed(2)+" m"}/>
      </div>
      <div style={{...panel,flex:"1 1 340px",minWidth:300}}>
        <H>The same light, spread over more area</H>
        <P>A small lamp sends its light out in straight lines, so the beam is a <strong>pyramid</strong>. The 100 dots are the <em>same</em> 100 bundles of light at every distance.</P>
        <P style={{marginTop:8}}>At <strong>1 m</strong> they cover a square <strong>1 m</strong> wide. At <strong>2 m</strong> the square is 2 m wide <em>and</em> 2 m tall: <strong>4 m²</strong>. At 3 m, <strong>9 m²</strong>. Width grows with the distance, height grows with the distance → the area grows with <strong>distance × distance = d²</strong>.</P>
        <P style={{marginTop:8}}>Same light ÷ d² of area → each square metre gets <strong>1/d²</strong>. That is the whole law. Think of a <strong>spray can</strong>: further away, a bigger patch, thinner paint.</P>
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:"6px 10px",alignItems:"center",marginTop:12,fontSize:12.5}}>
          {[1,2,3,4].map(k=>{ const r=1/(k*k), on=Math.abs(d-k)<0.08; return (
            <React.Fragment key={k}><Mono color={on?C.yellow:C.muted}>{k} m</Mono>
              <div style={{height:12,background:"#222",borderRadius:3,overflow:"hidden"}}><div style={{width:`${r*100}%`,height:"100%",background:C.yellow,opacity:on?1:0.55}}/></div>
              <Mono color={on?C.yellow:C.text}>1/{k*k} = {fmtN(100*r)}%</Mono></React.Fragment>); })}
        </div>
        <div style={{marginTop:12,padding:"10px 12px",background:"#0f1014",borderRadius:8,border:`1px solid ${C.line}`}}>
          <Mono color={C.yellow} size={15}>now: 1 / {d.toFixed(2)}² = {fmtN(100*rel)}%</Mono>
          <div style={{color:C.muted,fontSize:12,marginTop:4}}>= {fmtSt(Math.log2(rel))} stops compared with 1 m. Double the distance → ¼ of the light → −2 stops.</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 3 · 3D LAB */
// Objects of the dof-test set (camera mark at z = 3, looking down −Z; distance d from the camera ↔ z = 3 − d).
// p = where an incident meter would sit on each object (m).
const MARKS = [{n:"Vase",d:2,p:[0.5,1.15,1]},{n:"Garfield",d:4,p:[-0.45,1.25,-1]},{n:"Armchair",d:6,p:[0.75,0.6,-3]},{n:"Oil lamp",d:8,p:[-0.75,0.85,-5]},{n:"Shelf",d:11,p:[0.5,1.1,-8]}];
const CAMZ = 3, LX = 0.25, LY = 1.9, METER_Y = 1.0;
const BANDS = [[2.5,"#ef4444","clipped"],[1.5,"#f97316","+2"],[0.5,"#facc15","+1"],[-0.5,"#34d399","correct"],[-1.5,"#22d3ee","−1"],[-2.5,"#3b82f6","−2"],[-3.5,"#6366f1","−3"],[-1e9,"#2e2a5c","darker"]];
const band = (st) => BANDS.find(b=>st>=b[0]);
const hex2 = (h) => [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));

function Lab({active}){
  const viewRef=useRef(null), topRef=useRef(null), studioRef=useRef(null);
  const [phase,setPhase]=useState("loading"); const [err,setErr]=useState("");
  const [mode,setMode]=useState("bulb"); const [back,setBack]=useState(0); const [cd,setCd]=useState(1000);
  const [sunLux,setSunLux]=useState(245); const [fstop,setFstop]=useState(2.8);
  const rt=useResizeTick();

  const lightId=useRef(null); const [tick,setTick]=useState(0);
  useEffect(()=>{
    let disposed=false; const offs=[];
    (async()=>{
      try{
        const mod=await import("./lighting-studio/lighting-studio.js"); if(disposed) return;
        const S=await mod.createLightingStudio(viewRef.current,{subject:"dof-test",preset:"falloff"});
        if(disposed){ try{S.dispose();}catch{} return; }
        lightId.current=S.listLights()[0]?.id;                  // the preset's single bare bulb: pure inverse square
        S.setView("camera"); S.setAspect("16:9");
        S.setCamera({focalMm:40, fstop:2.8, iso:ISO, shutter:SHUT, dof:{on:false}});
        S.updateLight(lightId.current,{kelvin:3200, shadow:{on:true,softness:0.15}});
        ["camera","resize","view"].forEach(ev=>offs.push(S.on(ev,()=>setTick(t=>t+1))));
        studioRef.current=S; setPhase("ready");
      }catch(e){ console.error("[InverseSquare]",e); if(!disposed){ setErr(String(e?.message||e)); setPhase("error"); } }
    })();
    return ()=>{ disposed=true; offs.forEach(o=>{ try{o();}catch{} }); try{studioRef.current?.dispose();}catch{} studioRef.current=null; };
  },[]);
  const ready = phase==="ready";
  useEffect(()=>{ const S=studioRef.current; if(!ready||!S) return;
    S.updateLight(lightId.current, mode==="bulb"
      ? {type:"point", position:[LX,LY,CAMZ+back], target:[LX,1,-8], intensity:cd/CD_PER_UNIT}
      : {type:"sun", position:[LX,9,CAMZ+25], target:[LX,0,-6], intensity:sunLux/SUN_PER_UNIT});
    setTick(t=>t+1);
  },[ready,mode,back,cd,sunLux]);
  useEffect(()=>{ if(ready) studioRef.current?.setCamera({fstop}); },[ready,fstop]);
  useEffect(()=>{ if(active&&ready){ const t=setTimeout(()=>{ try{studioRef.current?.resize();}catch{} },60); return ()=>clearTimeout(t); } },[active,ready]);

  const Lz = CAMZ+back, Eexp = luxForF(fstop);
  const Eat = (px,py,pz) => mode==="sun" ? sunLux : cd/((px-LX)**2+(py-LY)**2+(pz-Lz)**2);
  const S0 = ready ? studioRef.current : null;
  const rows = MARKS.map(m=>{ const r=Math.hypot(m.p[0]-LX,m.p[1]-LY,m.p[2]-Lz);
    let E=Eat(...m.p), tag=null;
    if(S0){ try{ const mt=S0.meterAt?.(m.tp||m.p); if(mt && isFinite(mt.lux) && !mt.lights?.some(l=>l.blocked)) E=mt.lux*LUX_PER_UNIT; tag=S0.project?.(m.tp||m.p); }catch{} }
    return {...m,r,E:Math.max(E,1e-6),st:Math.log2(Math.max(E,1e-6)/Eexp),N:fForLux(E),tag}; });
  const vase=rows[0], gar=rows[1], arm=rows[2];
  const spread=Math.abs(vase.st-arm.st), garOk=Math.abs(gar.st)<=0.4, win=mode==="bulb"&&spread<=1.0&&garOk;

  // top view: corridor seen from above, coloured by exposure (one colour per stop)
  useEffect(()=>{
    const c=topRef.current; if(!c) return; const [x,W,Hh]=prep(c,140);
    const dmin=-13, dmax=12.5, padL=14, padR=14, sx=(W-padL-padR)/(dmax-dmin), cy=Hh/2-8;
    const X=(d)=>padL+(d-dmin)*sx, Y=(lat)=>cy+lat*sx;
    const img=x.createImageData(Math.round(W),Math.round(Hh)); const dpr=1;
    for(let py=0;py<img.height;py++) for(let px=0;px<img.width;px++){
      const d=dmin+(px/dpr-padL)/sx, lat=(py/dpr-cy)/sx, z=CAMZ-d;
      const E= mode==="sun" ? sunLux : cd/((lat-LX)**2+(METER_Y-LY)**2+(z-Lz)**2);
      const [r,g,b]=hex2(band(Math.log2(E/Eexp))[1]); const i=(py*img.width+px)*4;
      img.data[i]=r*0.55+10*0.45; img.data[i+1]=g*0.55+11*0.45; img.data[i+2]=b*0.55+15*0.45; img.data[i+3]=255;
    }
    // ImageData ignores the transform: draw it through an offscreen canvas so HiDPI scaling applies
    const off=document.createElement("canvas"); off.width=img.width; off.height=img.height; off.getContext("2d").putImageData(img,0,0);
    x.drawImage(off,0,0,W,Hh);
    // ruler
    x.fillStyle="rgba(0,0,0,.55)"; x.fillRect(0,Hh-22,W,22);
    x.font="11px monospace"; x.textAlign="center"; x.fillStyle="#c8ccd6";
    for(let d=-12; d<=12; d+=2){ x.fillRect(X(d),Hh-22,1,5); x.fillText(d===0?"camera":(d<0?`−${-d}`:`${d} m`),X(d),Hh-7); }
    // camera
    x.fillStyle="#e5e7eb"; x.beginPath(); x.moveTo(X(0)+9,Y(LX)); x.lineTo(X(0)-5,Y(LX)-7); x.lineTo(X(0)-5,Y(LX)+7); x.closePath(); x.fill();
    // objects
    rows.forEach(m=>{ const px=X(m.d), py=Y(m.p[0]); x.fillStyle="#0b0b0f"; x.beginPath(); x.arc(px,py,6,0,7); x.fill(); x.strokeStyle="#fff"; x.lineWidth=1.5; x.stroke();
      x.fillStyle="#fff"; x.font="bold 11px sans-serif"; x.textAlign="center"; x.fillText(m.n,px,py-11); x.font="11px monospace"; x.fillText(fmtSt(m.st),px,py+19); });
    // light
    if(mode==="bulb"){ const lx=X(-back), ly=Y(LX); const g=x.createRadialGradient(lx,ly,0,lx,ly,16); g.addColorStop(0,"#fffbe0"); g.addColorStop(1,"rgba(250,204,21,0)");
      x.fillStyle=g; x.beginPath(); x.arc(lx,ly,16,0,7); x.fill(); x.fillStyle=C.yellow; x.font="bold 11px monospace"; x.textAlign="center"; x.fillText("light",lx,ly-14); }
    else { x.fillStyle=C.yellow; x.font="bold 11px monospace"; x.textAlign="left"; x.fillText("☀ sun: parallel rays — the same light everywhere",10,16); }
  },[rows.map(r=>r.st.toFixed(3)).join(),mode,back,cd,sunLux,fstop,rt,tick]);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"stretch"}}>
        <div style={{...panel,flex:"0 1 380px",minWidth:300}}>
          <P style={{fontSize:12.5,marginBottom:4}}>One bare bulb, nothing else. Camera fixed at <strong>ISO {ISO} · 1/50</strong>; you set the aperture. Move the light back and watch the far objects catch up.</P>
          <div style={{display:"flex",gap:6,margin:"6px 0 4px"}}>
            <button style={sBtn(mode==="bulb")} onClick={()=>setMode("bulb")}>💡 Bare bulb</button>
            <button style={sBtn(mode==="sun")} onClick={()=>setMode("sun")}>☀ Sun</button>
          </div>
          {mode==="bulb" ? <>
            <Ctl label="Behind camera" min={0} max={12} step={0.1} value={back} onChange={setBack} disp={v=>v.toFixed(1)+" m"} w={118}/>
            <Ctl label="Intensity" log min={50} max={150000} value={cd} onChange={setCd} disp={v=>fmtN(v)+" cd"} w={118}/>
          </> : <Ctl label="Sunlight" log min={20} max={5000} value={sunLux} onChange={setSunLux} disp={v=>fmtN(v)+" lx"} w={118}/>}
          <Ctl label="Aperture" min={1} max={22} step={0.1} value={fstop} onChange={setFstop} disp={fmtF} w={118}/>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center",marginTop:4}}>
            <span style={{color:C.muted,fontSize:12}}>Expose for:</span>
            {rows.map(m=><button key={m.n} style={{...sBtn(Math.abs(m.st)<0.05),padding:"3px 8px",fontSize:12}} onClick={()=>setFstop(clamp(Math.round(m.N*10)/10,1,22))}>{m.n}</button>)}
          </div>
          <div style={{color:C.muted,fontSize:12,fontFamily:"monospace",marginTop:8}}>{fmtF(fstop)} at ISO {ISO}, 1/50 s ⇒ correct for <span style={{color:C.green}}>{fmtN(Eexp)} lux</span></div>
          <div title="Hint: the ratio that matters is (6 + x) / (2 + x). Pull the light back, then win the brightness back with intensity or aperture." style={{marginTop:8,padding:"8px 10px",borderRadius:8,border:`1px solid ${win?C.green:C.line}`,background:win?"#34d39914":"#0f1014"}}>
            <div style={{color:"#b8bcc6",fontSize:12,lineHeight:1.5}}><strong style={{color:win?C.green:C.accent}}>{win?"✓ Solved! ":"Challenge: "}</strong>{win
              ? "A light far away (and stronger) lights the whole depth evenly; up close it only lights what is nearest."
              : <>with the bulb, get the <strong>vase (2 m)</strong> and <strong>armchair (6 m)</strong> within 1 stop, <strong>Garfield</strong> correctly exposed.</>}</div>
            <div style={{fontFamily:"monospace",fontSize:11.5,marginTop:3,color:C.text}}>
              vase↔armchair <span style={{color:spread<=1?C.green:C.accent}}>{spread.toFixed(2)} stops</span> · Garfield <span style={{color:garOk?C.green:C.accent}}>{fmtSt(gar.st)}</span>
            </div>
          </div>
        </div>
        <div style={{flex:"1 1 560px",minWidth:320,display:"flex",flexDirection:"column",gap:6}}>
          <div ref={viewRef} style={{position:"relative",width:"100%",height:"min(35vh,460px)",background:"#08080a",borderRadius:10,overflow:"hidden",border:`1px solid ${C.line}`,touchAction:"none"}}>
            {ready && (()=>{ // tags float above their object; pushed up when they would overlap, with a leader line
              const placed=[], out=[];
              rows.forEach(m=>{ if(!m.tag) return; const txt=`${m.n} ${fmtSt(m.st)} · ${fmtN(m.E)} lx`, w=txt.length*6.9+16, h=19;
                let y=m.tag.y-22; const hit=()=>placed.some(q=>Math.abs(q.x-m.tag.x)<(q.w+w)/2+4 && Math.abs(q.y-y)<h+3);
                while(hit() && y>h) y-=h+3;
                if(y<h+2){ y=m.tag.y+h+24; while(hit()) y+=h+3; }   // no room above: hang it below
                placed.push({x:m.tag.x,y,w}); out.push({m,y,txt}); });
              return <>
                <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:2}}>
                  {out.map(({m,y})=>{ const col=band(m.st)[1]; return <g key={m.n}><line x1={m.tag.x} y1={m.tag.y} x2={m.tag.x} y2={y} stroke={col} strokeWidth="1" opacity=".8"/><circle cx={m.tag.x} cy={m.tag.y} r="3" fill={col}/></g>; })}
                </svg>
                {out.map(({m,y})=>{ const b=band(m.st); return (
                  <div key={m.n} style={{position:"absolute",left:m.tag.x,top:y,transform:"translate(-50%,-100%)",pointerEvents:"none",zIndex:3,
                    background:"rgba(8,9,12,.85)",border:`1px solid ${b[1]}`,borderRadius:6,padding:"1px 7px",whiteSpace:"nowrap",fontFamily:"monospace",fontSize:11.5,color:C.text,lineHeight:1.45}}>
                    {m.n} <span style={{color:b[1],fontWeight:"bold"}}>{fmtSt(m.st)}</span> · {fmtN(m.E)} lx</div>); })}
              </>; })()}
            {phase!=="ready" && (
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",padding:24,color:phase==="error"?"#fca5a5":C.muted,fontSize:13}}>
                {phase==="error" ? <div><div style={{fontWeight:"bold",marginBottom:6}}>Couldn't load the 3D view</div><div style={{fontSize:12}}>{err}</div></div> : <div>Loading the 3D scene…</div>}
              </div>)}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"stretch"}}>
        <div style={{...panel,flex:"1.3 1 520px",minWidth:320,padding:"10px 12px"}}>
          <div style={{color:C.cyan,fontSize:11,fontFamily:"monospace",fontWeight:"bold",marginBottom:6}}>TOP VIEW — each colour band is one stop; green = correctly exposed · left of the camera = behind it</div>
          <canvas ref={topRef} style={{display:"block",borderRadius:6}}/>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:6}}>
            {BANDS.map(([,col,l])=><span key={l} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11.5,color:C.muted}}><span style={{width:11,height:11,borderRadius:2,background:col}}/>{l}</span>)}
          </div>
        </div>
        <div style={{...panel,flex:"1 1 420px",minWidth:320,padding:"10px 12px",overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5,fontFamily:"monospace"}}>
            <thead><tr style={{color:C.muted,textAlign:"right"}}>
              <th style={{textAlign:"left",fontWeight:"normal",padding:"3px 4px"}}>object</th><th style={{fontWeight:"normal"}}>sign</th>
              <th style={{fontWeight:"normal"}} title="Distance from the LIGHT (what the law uses)">light→obj</th><th style={{fontWeight:"normal"}}>lux</th>
              <th style={{fontWeight:"normal"}}>vs camera</th><th style={{fontWeight:"normal"}} title="Aperture that would expose this object correctly">needs</th></tr></thead>
            <tbody>{rows.map(m=>{ const b=band(m.st); return (
              <tr key={m.n} style={{borderTop:`1px solid ${C.line}`,textAlign:"right",color:C.text}}>
                <td style={{textAlign:"left",padding:"5px 4px",fontFamily:"sans-serif"}}>{m.n}</td><td style={{color:C.muted}}>{m.d} m</td>
                <td style={{color:mode==="sun"?C.muted2:C.text}}>{mode==="sun"?"—":m.r.toFixed(2)+" m"}</td><td style={{color:C.green}}>{fmtN(m.E)}</td>
                <td><span style={{display:"inline-block",minWidth:52,padding:"1px 6px",borderRadius:4,background:b[1]+"33",color:b[1]}}>{fmtSt(m.st)}</span></td>
                <td style={{color:m.N<1||m.N>22?C.muted2:C.text}}>{fmtF(m.N)}</td></tr>); })}</tbody>
          </table>
          <div style={{color:C.muted,fontSize:11.5,marginTop:8,lineHeight:1.5}}>
            {mode==="bulb"
              ? <>lux = {fmtN(cd)} cd ÷ (light→obj)². Note the law uses the distance from the <strong>light</strong>, not the sign (camera distance): pull the light back and they differ.</>
              : <>The sun is 150 million km away: walking 10 m changes its distance by nothing. Same lux everywhere.</>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 4 · FORMULA & RULES */
function Formula(){
  const [I,setI]=useState(1000), [d,setD]=useState(2), [th,setTh]=useState(0);
  const chartRef=useRef(null), cosRef=useRef(null); const rt=useResizeTick();
  const E=I/(d*d), Ec=E*Math.cos(th*Math.PI/180);
  useEffect(()=>{ const c=chartRef.current; if(!c) return; const [x,W,Hh]=prep(c,200);
    const ymax=I/1; plot(x,W,Hh,{xmin:0.5,xmax:8,ymin:0,ymax:ymax*1.08,xTicks:[1,2,3,4,5,6,7,8],xUnit:" m",
      yTicks:[0,0.25,0.5,0.75,1].map(k=>k*ymax),yFmt:v=>fmtN(v),yLab:"lux",xLab:"distance from the light",
      series:[{fn:v=>I/(v*v),color:C.yellow,label:`E = ${fmtN(I)} / d²`}],
      marks:[{x:1,y:I,color:"#9ca3af",label:"100%"},{x:2,y:I/4,color:"#9ca3af",label:"¼"},{x:4,y:I/16,color:"#9ca3af",label:"1/16"},
        {x:d,y:E,color:C.green,label:`${fmtN(E)} lx`,guides:true,r:6}]}); },[I,d,rt]);
  useEffect(()=>{ const c=cosRef.current; if(!c) return; const [x,W,Hh]=prep(c,120);
    x.fillStyle="#0c0d11"; x.fillRect(0,0,W,Hh);
    const cx=W*0.62, cy=Hh/2, bw=50, t=th*Math.PI/180, len=bw/Math.cos(t);
    // parallel beam
    const hit=(y)=>cx+(y-cy)*Math.tan(t);   // where a horizontal ray at height y meets the tilted card
    x.fillStyle="rgba(250,204,21,.16)"; x.beginPath(); x.moveTo(20,cy-bw/2); x.lineTo(hit(cy-bw/2),cy-bw/2); x.lineTo(hit(cy+bw/2),cy+bw/2); x.lineTo(20,cy+bw/2); x.closePath(); x.fill();
    x.strokeStyle="rgba(250,204,21,.6)"; for(let i=0;i<=6;i++){ const y=cy-bw/2+i*bw/6; x.beginPath(); x.moveTo(20,y); x.lineTo(hit(y),y); x.stroke(); }
    // tilted card
    x.save(); x.translate(cx,cy); x.rotate(-t); x.fillStyle="#d4d4d8"; x.fillRect(-3,-len/2,6,len); x.restore();
    x.fillStyle=C.green; x.font="bold 12px monospace"; x.textAlign="left";
    x.fillText(`footprint ×${(1/Math.cos(t)).toFixed(2)}`,cx+26,cy-len/2*Math.cos(t)-6>14?cy-len/2*Math.cos(t)-6:16);
    x.fillStyle=C.muted; x.font="11px sans-serif"; x.fillText(`card tilted ${th}° from facing the light`,20,Hh-10);
  },[th,rt]);
  const table=[1,1.4,2,2.8,4,5.6,8];
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"stretch"}}>
        <div style={{...panel,flex:"1 1 400px",minWidth:300}}>
          <div style={{textAlign:"center",margin:"0 0 6px"}}>
            <Mono color={C.green} size={24}>E</Mono><Mono color={C.text} size={24}> = </Mono>
            <span style={{display:"inline-flex",flexDirection:"column",verticalAlign:"middle",alignItems:"center",fontFamily:"monospace",fontSize:21}}>
              <span style={{color:C.orange,borderBottom:`2px solid ${C.text}`,padding:"0 8px"}}>I</span><span style={{color:C.cyan}}>d²</span></span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:"3px 10px",fontSize:12.5,color:"#b8bcc6",marginBottom:6}}>
            <Mono color={C.green}>E</Mono><span>illuminance at the subject, in <strong>lux</strong></span>
            <Mono color={C.orange}>I</Mono><span>luminous intensity of the light towards the subject, in <strong>candela</strong></span>
            <Mono color={C.cyan}>d</Mono><span>distance <strong>from the light</strong> to the subject, in <strong>metres</strong></span>
          </div>
          <Ctl label="Intensity I" log min={50} max={100000} value={I} onChange={setI} disp={v=>fmtN(v)+" cd"}/>
          <Ctl label="Distance d" min={0.5} max={8} step={0.05} value={d} onChange={setD} disp={v=>v.toFixed(2)+" m"}/>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",margin:"2px 0 6px"}}>
            <span style={{color:C.muted,fontSize:12}}>Try:</span>
            <button style={sBtn(false)} onClick={()=>setD(v=>clamp(v*Math.SQRT2,0.5,8))}>d × 1.4</button>
            <button style={sBtn(false)} onClick={()=>setD(v=>clamp(v*2,0.5,8))}>d × 2</button>
            <button style={sBtn(false)} onClick={()=>setD(v=>clamp(v/2,0.5,8))}>d ÷ 2</button>
          </div>
          <div style={{padding:"10px 12px",background:"#0f1014",borderRadius:8,border:`1px solid ${C.line}`,fontFamily:"monospace",fontSize:14,color:C.text}}>
            E = {fmtN(I)} ÷ {d.toFixed(2)}² = {fmtN(I)} ÷ {fmtN(d*d)} = <span style={{color:C.green,fontWeight:"bold"}}>{fmtN(E)} lux</span>
            <div style={{fontSize:12,color:C.muted,marginTop:4}}>For a target lux, solve for the distance: d = √(I ÷ E). For {fmtN(I)} cd and 250 lux → {Math.sqrt(I/250).toFixed(2)} m.</div>
          </div>
        </div>
        <div style={{...panel,flex:"1.4 1 520px",minWidth:320}}><canvas ref={chartRef} style={{display:"block"}}/>
          <P style={{fontSize:12,marginTop:6,color:C.muted}}>Steep close to the light, flat far away: the first metre costs much more light than the tenth. Close to a lamp, a small step changes the exposure a lot.</P></div>
      </div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"stretch"}}>
        <div style={{...panel,flex:"1 1 380px",minWidth:300}}>
          <H>Rules you use on set</H>
          <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"monospace",fontSize:12.5,color:C.text}}>
            <thead><tr style={{color:C.muted,textAlign:"right"}}><th style={{textAlign:"left",fontWeight:"normal"}}>distance</th><th style={{fontWeight:"normal"}}>light</th><th style={{fontWeight:"normal"}}>stops</th><th style={{fontWeight:"normal"}}>f-number</th></tr></thead>
            <tbody>{table.map((k,i)=><tr key={k} style={{borderTop:`1px solid ${C.line}`,textAlign:"right"}}>
              <td style={{textAlign:"left",padding:"2px 0"}}>{k} m</td><td>{fmtN(100/(k*k))}%</td><td style={{color:C.cyan}}>{i?"−"+i:"0"}</td><td style={{color:C.orange}}>f/{["1","1.4","2","2.8","4","5.6","8","11"][i]}</td></tr>)}</tbody>
          </table>
          <P style={{fontSize:12.5,marginTop:8}}>
            • <strong>× 2 the distance → ¼ of the light → −2 stops.</strong> <strong>× 1.4 (√2) → ½ → −1 stop.</strong><br/>
            • The distances <Mono>1 · 1.4 · 2 · 2.8 · 4</Mono> are <strong>the f-stop series</strong>: both are about an area (the lens opening grows with its diameter squared). Light from 2 m to 2.8 m → open from f/4 to f/2.8.
          </P>
        </div>
        <div style={{...panel,flex:"1 1 380px",minWidth:300}}>
          <H>Advanced: the angle (cosine law)</H>
          <canvas ref={cosRef} style={{display:"block",borderRadius:6}}/>
          <Ctl label="Card angle" min={0} max={85} value={th} onChange={setTh} disp={v=>v+"°"}/>
          <div style={{fontFamily:"monospace",fontSize:13,color:C.text}}>E = I · cos θ / d² = {fmtN(E)} × {Math.cos(th*Math.PI/180).toFixed(2)} = <span style={{color:C.green}}>{fmtN(Ec)} lux</span> <span style={{color:C.muted}}>({fmtSt(Math.log2(Math.max(1e-6,Math.cos(th*Math.PI/180))))} stops)</span></div>
          <P style={{fontSize:12,marginTop:6,color:C.muted}}>A surface turned away from the light catches the same beam over a longer footprint. That's why the side of a face turning away from the key gets darker even at the same distance. Up to ~30° it barely matters (−0.2 stops); at 60° it's −1 stop.</P>
        </div>
        <div style={{...panel,flex:"1 1 380px",minWidth:300}}>
          <H>What changes the light on the subject — and what doesn't</H>
          <div style={{display:"flex",flexDirection:"column",gap:6,fontSize:12.5,color:"#b8bcc6",lineHeight:1.55}}>
            <div><strong style={{color:C.green}}>Changes it</strong><br/>
              1. <strong>Intensity</strong> (cd): more power, or a tighter beam (spot vs flood).<br/>
              2. <strong>Distance from the light</strong> — squared: your strongest lever.<br/>
              3. <strong>Angle</strong> of the surface to the light (cos θ).<br/>
              4. <strong>What's in the way</strong>: diffusion, gels, scrims, ND (ND 0.3 ≈ −1 stop).</div>
            <div><strong style={{color:C.accent}}>Doesn't change it</strong><br/>
              • <strong>Camera settings</strong> (f/, ISO, shutter): change the <em>exposure</em>, not the light on set.<br/>
              • <strong>Camera distance</strong>: the subject's luminance is the same near or far.<br/>
              • <strong>The subject's colour</strong>: same lux; a dark one just reflects less.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 5 · WHEN IT BREAKS */
function Limits(){
  const [R,setR]=useState(0.6), [d0,setD0]=useState(3), [bounce,setBounce]=useState(0.05);
  const ref=useRef(null); const rt=useResizeTick();
  // all curves normalised to 0 stops at 1 m — "how much do I lose moving the subject from 1 m to d?"
  const pt=v=>Math.log2(1/(v*v)), box=v=>Math.log2((R*R+1)/(R*R+v*v)), fre=v=>Math.log2(((1+d0)/(v+d0))**2), room=v=>Math.log2((1/(v*v)+bounce)/(1+bounce));
  useEffect(()=>{ const c=ref.current; if(!c) return; const [x,W,Hh]=prep(c,330);
    plot(x,W,Hh,{xmin:0.25,xmax:8,ymin:-7,ymax:3,xTicks:[1,2,3,4,5,6,7,8],xUnit:" m",yTicks:[3,2,1,0,-1,-2,-3,-4,-5,-6,-7],yZero:0,yFmt:v=>fmtSt(v),
      yLab:"stops vs 1 m",xLab:"distance from the light",
      series:[{fn:pt,color:C.yellow,label:"bare bulb (1/d²)",width:2.6},{fn:box,color:C.cyan,label:`soft box ${(R*2).toFixed(1)} m`},
        {fn:fre,color:C.orange,label:"fresnel / PAR (spot)"},{fn:()=>0,color:"#fde68a",label:"sun",dash:[6,4]},{fn:room,color:C.violet,label:"small room (bounce)",dash:[2,3]}],
      marks:[{x:4,y:pt(4),color:C.yellow,label:fmtSt(pt(4)),r:3.5},{x:4,y:box(4),color:C.cyan,label:fmtSt(box(4)),r:3.5,align:"right"},{x:4,y:fre(4),color:C.orange,label:fmtSt(fre(4)),r:3.5}]}); },[R,d0,bounce,rt]);
  const card=(color,title,children)=>(<div style={{...panel,flex:"1 1 260px",minWidth:240,borderTop:`3px solid ${color}`}}><H style={{color}}>{title}</H><P style={{fontSize:12.5}}>{children}</P></div>);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"stretch"}}>
        <div style={{...panel,flex:"2 1 600px",minWidth:320}}><canvas ref={ref} style={{display:"block"}}/></div>
        <div style={{...panel,flex:"1 1 340px",minWidth:300}}>
          <P>The inverse-square law is exact for a <strong>tiny source radiating freely</strong>. Real lights are not tiny, beams are shaped and rooms bounce light back. Every curve starts at 0 at 1 m: read how much each one loses by 4 m.</P>
          <Ctl label="Soft box size" min={0.2} max={2} step={0.05} value={R} onChange={setR} disp={v=>(v*2).toFixed(1)+" m"} w={110}/>
          <Ctl label="Fresnel: virtual source behind" min={0} max={8} step={0.1} value={d0} onChange={setD0} disp={v=>v.toFixed(1)+" m"} w={110}/>
          <Ctl label="Room bounce" min={0} max={0.3} step={0.01} value={bounce} onChange={setBounce} disp={v=>Math.round(v*100)+"%"} w={110}/>
          <P style={{fontSize:12,color:C.muted,marginTop:6}}>Rule of thumb: the law holds well once you are about <strong>5 × the size of the source</strong> away from it.</P>
        </div>
      </div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"stretch"}}>
        {card(C.yellow,"Bare bulb, small LED, flash",<>Small source, light in all directions: the textbook case. Follows 1/d² closely.</>)}
        {card(C.cyan,"Big soft box close up",<>Up close, the subject "sees" a wide surface; each part of it is at a different distance and angle, so light drops <strong>less than 1/d²</strong> at first. Further away the box looks small and the law takes over again.</>)}
        {card(C.orange,"Fresnel / PAR spotted",<>The lens bends the rays so they leave almost parallel: the beam behaves as if it came from a point <strong>far behind the lamp</strong>. Use 1/(d + d₀)²: it falls off more slowly. Flood it and it behaves like a bare bulb again.</>)}
        {card("#fde68a","The sun",<>So far away that its rays arrive parallel: <strong>no falloff</strong> across a set. That's why daylight looks even from foreground to background — and why it's hard to fake with one lamp.</>)}
        {card(C.violet,"Rooms, walls, bounce",<>White walls and ceilings send light back. Far from the lamp that bounce is a bigger share, so the real drop is <strong>smaller</strong> than the formula says. In a black studio the law is almost exact.</>)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ module */
const TABS = [["units","1 · Light units"],["why","2 · Why “squared”?"],["lab","3 · 3D lab"],["formula","4 · Formula & rules"],["limits","5 · When it breaks"]];
export default function InverseSquare(){
  const [tab,setTab]=useState("units");
  const [labSeen,setLabSeen]=useState(false);
  const pick=useCallback((t)=>{ setTab(t); if(t==="lab") setLabSeen(true); },[]);
  return (
    <div>
      <div role="tablist" style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,borderBottom:`1px solid ${C.line}`,paddingBottom:10}}>
        {TABS.map(([id,l])=><button key={id} role="tab" aria-selected={tab===id} onClick={()=>pick(id)}
          style={{...sBtn(tab===id),padding:"7px 14px",fontSize:13,fontWeight:tab===id?"bold":"normal"}}>{l}</button>)}
      </div>
      {tab==="units" && <Units/>}
      {tab==="why" && <WhySquared/>}
      {labSeen && <div style={{display:tab==="lab"?"block":"none"}}><Lab active={tab==="lab"}/></div>}
      {tab==="formula" && <Formula/>}
      {tab==="limits" && <Limits/>}
    </div>
  );
}
