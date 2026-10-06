import React, { useRef, useEffect, useState, useCallback } from "react";

// Depth of Field — real, interactive 3D DoF driven by the lighting-studio engine (SetFrameR).
// The engine renders a physical circle of confusion from the f-stop, focal length, focus and sensor;
// here we expose just the camera controls + a top-down focus diagram, laid out to fit on screen.

const C = { accent:"#ff5a4d", panel:"#16171c", card:"#1c1d23", line:"#2a2b32", text:"#e5e7eb", muted:"#8a8a94", muted2:"#6b7280", cyan:"#22d3ee", green:"#34d399" };
const r1=(x,d=1)=>Math.round(x*10**d)/10**d;

function Ctl({label,min,max,step=1,value,unit="",onChange,fmt}){
  return (
    <div style={{display:"grid",gridTemplateColumns:"88px 1fr 70px",gap:8,alignItems:"center",margin:"6px 0"}}>
      <span style={{color:C.muted,fontSize:12}}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)} style={{width:"100%",accentColor:C.accent}}/>
      <span style={{color:C.text,fontSize:12,fontFamily:"monospace",textAlign:"right"}}>{fmt?fmt(value):value}{unit}</span>
    </div>
  );
}

export default function DepthOfField3D(){
  const viewRef=useRef(null), sideRef=useRef(null), studioRef=useRef(null);
  const [phase,setPhase]=useState("loading"); const [err,setErr]=useState("");
  const [,setRev]=useState(0); const bump=useCallback(()=>setRev(v=>v+1),[]);

  useEffect(()=>{
    let disposed=false, off=null, q=false;
    (async()=>{
      try{
        const mod=await import("./lighting-studio/lighting-studio.js");
        if(disposed) return;
        const S=await mod.createLightingStudio(viewRef.current,{subject:"living-room-figure",preset:"three-point"});
        if(disposed){ try{S.dispose();}catch{} return; }
        studioRef.current=S;
        S.setView("camera");
        S.setCamera({ focalMm:85, fstop:2.8, distance:4, dof:{on:true} });
        S.focusOn("subject");
        off=S.on("camera",()=>{ if(q)return; q=true; requestAnimationFrame(()=>{ q=false; bump(); }); });
        setPhase("ready"); bump();
      }catch(e){ console.error("[DoF3D]",e); if(!disposed){ setErr(String(e?.message||e)); setPhase("error"); } }
    })();
    return ()=>{ disposed=true; try{off&&off();}catch{} try{studioRef.current?.dispose();}catch{} studioRef.current=null; };
  },[bump]);

  const S=studioRef.current, ready=phase==="ready"&&S;
  const cam = ready ? S.getCamera() : null;
  const near=cam?.dof?.near??0;
  const far=(cam?.dof?.far===Infinity||cam?.dof?.far==null)?Infinity:cam.dof.far;
  const focus=cam?.dof?.focusDist??cam?.distance??4;

  // top-down focus diagram
  useEffect(()=>{
    const c=sideRef.current; if(!c||!cam) return;
    const W=Math.max(260,c.parentElement?.clientWidth-24||300); c.width=W; c.height=168; const H=c.height;
    const x=c.getContext("2d"); x.fillStyle="#0a0d12"; x.fillRect(0,0,W,H);
    const x1=48,x2=W-16,groundY=H-26,K=6;
    const dmap=d=> x1+(d/(d+K))*(x2-x1);
    x.strokeStyle=C.line; x.lineWidth=1; x.beginPath();x.moveTo(x1,groundY);x.lineTo(x2,groundY);x.stroke();
    const dn=dmap(near), df=far===Infinity?x2:dmap(far);
    const g=x.createLinearGradient(dn,0,df,0); g.addColorStop(0,"rgba(52,211,153,.07)");g.addColorStop(.5,"rgba(52,211,153,.32)");g.addColorStop(1,"rgba(52,211,153,.07)");
    x.fillStyle=g; x.fillRect(dn,18,Math.max(2,df-dn),groundY-18);
    x.strokeStyle="rgba(52,211,153,.6)"; x.setLineDash([4,3]); x.beginPath();x.moveTo(dn,18);x.lineTo(dn,groundY);x.moveTo(df,18);x.lineTo(df,groundY);x.stroke(); x.setLineDash([]);
    x.textAlign="center"; x.font="9px monospace";
    [1,2,3,4,6,10].forEach(d=>{const px=dmap(d);x.strokeStyle="#374151";x.beginPath();x.moveTo(px,groundY);x.lineTo(px,groundY+4);x.stroke();x.fillStyle="#4b5563";x.fillText(d+"m",px,groundY+14);});
    x.fillStyle="#4b5563"; x.fillText("∞",x2,groundY+14);
    const fx=dmap(focus); x.strokeStyle=C.accent;x.lineWidth=2;x.beginPath();x.moveTo(fx,12);x.lineTo(fx,groundY);x.stroke();
    x.fillStyle=C.accent;x.fillText("focus",fx,9);
    x.fillStyle="#9ca3af";x.fillRect(x1-13,groundY-11,13,11);
    [["figure",3.9,"#c08a5a"],["sofa",5.2,"#6b5a7a"],["wall",6.1,"#555b66"]].forEach(([lbl,d,col])=>{
      const px=dmap(d), sharp=d>=near && d<=(far===Infinity?1e9:far);
      x.fillStyle=col;x.fillRect(px-4,groundY-20,8,20);
      x.strokeStyle=sharp?C.green:"rgba(255,255,255,.18)";x.lineWidth=sharp?2:1;x.strokeRect(px-4,groundY-20,8,20);
      x.fillStyle=sharp?C.green:"#6b7280";x.fillText(lbl,px,groundY-23);
    });
    x.textAlign="left"; x.fillStyle=C.cyan; x.font="bold 10px monospace"; x.fillText("TOP VIEW — green = in focus",8,13);
  },[near,far,focus]);

  const set=(patch)=>{ S.setCamera(patch); bump(); };
  const dofM = far===Infinity?Infinity:(far-near);

  const panel={background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:"12px 14px"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {/* top: controls + top-down diagram */}
      <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"stretch"}}>
        <div style={{...panel,flex:"1 1 340px",minWidth:300}}>
          <div style={{color:C.muted2,fontSize:12.5,lineHeight:1.6,marginBottom:8}}>
            <strong style={{color:C.text}}>Depth of field</strong> is the range of distances that look sharp. Open the <strong style={{color:C.accent}}>aperture</strong> (smaller f/) or use a longer <strong>focal length</strong> and the focus plane and everything either side blurs — the engine renders a real circle of confusion. Drag in the view to reframe; the green zone below is what stays sharp.
          </div>
          {ready && cam && <>
            <Ctl label="Aperture" min={1.4} max={22} step={0.1} value={cam.fstop} fmt={v=>"f/"+r1(v)} onChange={v=>set({fstop:v})}/>
            <Ctl label="Focal" min={18} max={200} value={cam.focalMm} unit=" mm" onChange={v=>set({focalMm:v})}/>
            <Ctl label="Focus" min={0.6} max={10} step={0.02} value={focus} unit=" m" onChange={v=>{ S.focusOn(v); bump(); }}/>
            <Ctl label="Distance" min={1.2} max={8} step={0.05} value={cam.distance} unit=" m" onChange={v=>set({distance:v})}/>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginTop:6}}>
              <button onClick={()=>{ S.focusOn("subject"); bump(); }} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${C.line}`,background:"#26262c",color:C.text,cursor:"pointer",fontSize:12}}>Focus on subject</button>
              <span style={{color:C.muted,fontSize:12,fontFamily:"monospace"}}>sharp {r1(near,2)}–{far===Infinity?"∞":r1(far,2)} m · DoF {dofM===Infinity?"∞":r1(dofM,2)+" m"}</span>
            </div>
          </>}
        </div>
        <div style={{...panel,flex:"1 1 300px",minWidth:280,display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <canvas ref={sideRef} style={{display:"block",width:"100%"}}/>
        </div>
      </div>

      {/* big 3D camera view */}
      <div ref={viewRef} style={{position:"relative",width:"100%",height:"min(50vh,500px)",background:"#08080a",borderRadius:10,overflow:"hidden",border:`1px solid ${C.line}`,touchAction:"none"}}>
        {phase!=="ready" && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",padding:24,color:phase==="error"?"#fca5a5":C.muted,fontSize:13}}>
            {phase==="error"
              ? <div><div style={{fontWeight:"bold",marginBottom:6}}>Couldn't load the 3D view</div><div style={{fontSize:12}}>{err}</div><div style={{fontSize:11,marginTop:8,color:C.muted2}}>Needs a browser with WebGL.</div></div>
              : <div>Loading the 3D scene…</div>}
          </div>
        )}
      </div>
      <div style={{color:C.muted,fontSize:11.5}}>Drag = reframe · wheel = zoom. The scene is the 3D studio's set (Garfield statue); the same engine powers the Lighting Studio.</div>
    </div>
  );
}
