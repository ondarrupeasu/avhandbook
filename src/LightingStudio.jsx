import React, { useRef, useEffect, useState, useCallback } from "react";

// 3D Lighting Studio — React wrapper around the framework-agnostic engine built by SetFrameR.
// The heavy three.js engine is lazy-loaded (dynamic import) only when this module mounts,
// so the rest of AVHandbook stays light. Keeps src/lighting-studio/ as an unmodified copy.
// Layout mirrors the demo Alex approved: 3D view on top + a bar [camera controls | camera
// monitor | reference] you watch while lighting, and a ~400px panel on the right with the rest.

const C = { accent:"#ff5a4d", panel:"#16171c", card:"#1c1d23", line:"#2a2b32", text:"#e5e7eb", muted:"#8a8a94", muted2:"#6b7280" };
const ISOS=[100,200,400,800,1600,3200,6400,12800,25600];
const SHUTTERS=[1/8000,1/4000,1/2000,1/1000,1/500,1/250,1/125,1/60,1/50,1/30,1/15,1/8,1/4,1/2,1];
const fmtT=t=>t>=1?`${t}"`:`1/${Math.round(1/t)}`;
const r1=(x,d=1)=>Math.round(x*10**d)/10**d;
const nearestShutter=t=>SHUTTERS.reduce((a,b)=>(Math.abs(Math.log(b/t))<Math.abs(Math.log(a/t))?b:a));

const sBtn=(on)=>({padding:"5px 10px",borderRadius:6,border:`1px solid ${on?C.accent:C.line}`,background:on?"#ff5a4d22":"#26262c",color:on?C.accent:C.text,cursor:"pointer",fontSize:12,fontFamily:"inherit"});
const sSel={background:"#26262c",color:C.text,border:`1px solid ${C.line}`,borderRadius:6,padding:"4px 8px",fontSize:12};
const H=({children,style})=> <h3 style={{margin:"14px 0 6px",fontSize:11,letterSpacing:".08em",textTransform:"uppercase",color:C.muted,...style}}>{children}</h3>;
const Muted=({children,style})=> <div style={{color:C.muted,fontSize:12,...style}}>{children}</div>;
const Lab=({children})=> <label style={{color:C.muted,fontSize:12,display:"flex",gap:5,alignItems:"center"}}>{children}</label>;

function Control({label,min,max,step=1,value,onChange,onReset,def}){
  const defRef=useRef(def ?? value); const numRef=useRef(null);
  useEffect(()=>{ const n=numRef.current; if(n && document.activeElement!==n) n.value=r1(value, step<1?2:0); },[value,step]);
  const reset=()=> onReset ? onReset() : onChange(defRef.current);
  return (
    <div style={{display:"grid",gridTemplateColumns:"80px 1fr 54px 22px",gap:6,alignItems:"center",margin:"4px 0"}}>
      <span style={{color:C.muted,fontSize:11.5}}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onPointerDown={e=>{ if(e.shiftKey){ e.preventDefault(); reset(); } }}
        onChange={e=>onChange(+e.target.value)} style={{width:"100%",accentColor:C.accent}}/>
      <input ref={numRef} type="number" min={min} max={max} step={step} defaultValue={r1(value,step<1?2:0)}
        onChange={e=>{ const v=e.target.value; if(v!=="" && !isNaN(+v)) onChange(+v); }}
        style={{width:54,textAlign:"right",background:C.card,color:C.text,border:`1px solid ${C.line}`,borderRadius:6,padding:"4px 5px",fontSize:11.5}}/>
      <button onClick={reset} title="Back to default (or Shift+click the slider)"
        style={{width:22,height:24,padding:0,color:C.muted,background:"none",border:"none",cursor:"pointer",fontSize:13}}>↺</button>
    </div>
  );
}

export default function LightingStudio3D(){
  const viewRef=useRef(null), monitorRef=useRef(null), studioRef=useRef(null), readSnapRef=useRef(null), fileRef=useRef(null);
  const [phase,setPhase]=useState("loading"); const [err,setErr]=useState("");
  const [,setRev]=useState(0); const bump=useCallback(()=>setRev(r=>r+1),[]);
  const [view,setView]=useState("studio"); const [selected,setSelected]=useState(null);
  const [subjects,setSubjects]=useState([]); const [presets,setPresets]=useState([]);
  const [chSel,setChSel]=useState(""); const [challenge,setChallenge]=useState(null); // {name,description,url,out,result}
  const [shots,setShots]=useState([]); const [importMsg,setImportMsg]=useState("");
  const [narrow,setNarrow]=useState(typeof window!=="undefined" && window.innerWidth<860);

  useEffect(()=>{ const onR=()=>setNarrow(window.innerWidth<860); window.addEventListener("resize",onR); return ()=>window.removeEventListener("resize",onR); },[]);

  const rootRef=useRef(null); const [fs,setFs]=useState(false);
  useEffect(()=>{ const on=()=>setFs(document.fullscreenElement===rootRef.current); document.addEventListener("fullscreenchange",on); return ()=>document.removeEventListener("fullscreenchange",on); },[]);
  useEffect(()=>{ const t=setTimeout(()=>{ try{ studioRef.current?.resize(); }catch{} },90); return ()=>clearTimeout(t); },[fs,narrow]);
  const toggleFs=()=>{ try{ if(document.fullscreenElement) document.exitFullscreen(); else rootRef.current?.requestFullscreen?.(); }catch{} };

  useEffect(()=>{
    let disposed=false, offs=[], q=false;
    (async()=>{
      try{
        const mod=await import("./lighting-studio/lighting-studio.js");
        if(disposed) return;
        const S=await mod.createLightingStudio(viewRef.current,{subject:"bust",preset:"three-point",monitorElement:monitorRef.current});
        if(disposed){ try{S.dispose();}catch{} return; }
        studioRef.current=S; readSnapRef.current=mod.readSnapshot;
        setSubjects(S.listSubjects()); const ps=S.listPresets(); setPresets(ps); setChSel(ps[0]?.id||"");
        setView(S.getView());
        offs.push(S.on("view",d=>setView(d.view)));
        offs.push(S.on("select",l=>setSelected(l?.id??null)));
        offs.push(S.on("camera",bump));
        offs.push(S.on("change",bump));
        offs.push(S.on("focuspick",bump));
        offs.push(S.on("lightmove",()=>{ if(q)return; q=true; requestAnimationFrame(()=>{ q=false; bump(); }); }));
        setPhase("ready"); bump();
      }catch(e){ console.error("[LightingStudio]",e); if(!disposed){ setErr(String(e?.message||e)); setPhase("error"); } }
    })();
    return ()=>{ disposed=true; offs.forEach(o=>{ try{o&&o();}catch{} }); try{ studioRef.current?.dispose(); }catch{} studioRef.current=null; };
  },[bump]);

  const S=studioRef.current, ready=phase==="ready"&&S;
  const cam = ready ? S.getCamera() : null;
  const world = ready ? S.getWorld() : null;
  const lights = ready ? S.listLights() : [];
  const monCap = view==="camera" ? "Studio" : "Camera";

  // ---- challenge
  const startChallenge=async()=>{ const c=await S.startChallenge(chSel); S.setView("studio");
    setChallenge(ch=>{ if(ch?.url) URL.revokeObjectURL(ch.url); return {name:c.name,description:c.description,url:URL.createObjectURL(c.reference),out:`Recreate: ${c.name}. ${c.description}`}; }); bump(); };
  const checkChallenge=()=>{ const r=S.checkChallenge(); setChallenge(c=>({...c,result:r})); };
  const solveChallenge=async()=>{ await S.solveChallenge(); bump(); };
  const endChallenge=()=>{ S.endChallenge(); setChallenge(c=>{ if(c?.url) URL.revokeObjectURL(c.url); return null; }); bump(); };

  // ---- snapshots
  const takeShot=async()=>{ const n=shots.length+1; const blob=await S.snapshot({info:true,title:`#${n}${S.getChallenge?.()?" · challenge":""}`});
    setShots(s=>[...s,{url:URL.createObjectURL(blob),blob,pick:s.length<2}]); };
  const restoreShot=async(i)=>{ const st=await readSnapRef.current(shots[i].blob); if(st){ await S.setState(st); bump(); } };
  const openImg=(url,title)=>{ const html=`<!doctype html><meta charset=utf-8><title>${title}</title><body style="margin:0;background:#0b0b0d"><img src="${url}" style="max-width:100%;display:block;margin:auto"></body>`;
    window.open(URL.createObjectURL(new Blob([html],{type:"text/html"}))); };
  const compareShots=()=>{ const pick=shots.filter(x=>x.pick); const html=`<!doctype html><meta charset=utf-8><title>Compare</title><body style="margin:0;background:#0b0b0d"><div style="display:grid;grid-template-columns:repeat(${Math.min(pick.length,3)},1fr);gap:8px;padding:8px">${pick.map(x=>`<img src="${x.url}" style="width:100%">`).join("")}</div></body>`;
    window.open(URL.createObjectURL(new Blob([html],{type:"text/html"}))); };
  const copyState=()=>{ navigator.clipboard?.writeText(JSON.stringify(S.getState())); };
  const pickCount=shots.filter(x=>x.pick).length;

  // ---- import (optional): own model or restore a snapshot PNG
  const importFiles=async(files)=>{ files=[...files]; if(!files.length) return;
    try{
      if(files.length===1 && /\.png$/i.test(files[0].name)){ const st=await readSnapRef.current(files[0]);
        if(!st) throw new Error("That PNG is not a Lighting Studio snapshot"); await S.setState(st); bump(); setImportMsg("Setup restored from the snapshot."); return; }
      setImportMsg("Loading…"); const r=await S.importModel(files); setImportMsg(`${r.name}: ${r.credit}`); setSubjects(S.listSubjects()); bump();
    }catch(e){ setImportMsg("⚠ "+(e?.message||e)); }
  };

  const lightG=(id,k)=>k.split(".").reduce((o,p)=>o?.[p],S.getLight(id))??0;
  const lightU=(id,k)=>(v)=>{ if(k.startsWith("shadow.")) S.updateLight(id,{shadow:{[k.slice(7)]:v}}); else S.updateLight(id,{[k]:v}); bump(); };

  const capRow={display:"flex",justifyContent:"space-between",color:C.muted,fontSize:11,letterSpacing:".06em",textTransform:"uppercase",marginBottom:4};
  const frameWrap={display:"flex",flexDirection:"column",minWidth:0,minHeight:0};
  const slot={flex:1,minHeight:0,display:"flex",alignItems:"flex-start",justifyContent:"center"};
  const barH = narrow ? "auto" : (fs ? "34vh" : "min(42vh,360px)");
  const frameH = narrow ? 200 : undefined;

  // ---- Camera controls block (lives at the far-left of the bar)
  const cameraControls = ready && (
    <div style={{overflow:"auto",minHeight:0,paddingRight:4}}>
      <H style={{marginTop:0}}>Camera</H>
      <Control label="WB (camera)" min={2000} max={10000} step={100} value={cam.wb} onChange={v=>{ S.setCamera({wb:v}); bump(); }}/>
      <Control label="Focal" min={12} max={300} value={cam.focalMm} onChange={v=>{ S.setCamera({focalMm:v}); bump(); }}/>
      <Control label="Iris f/" min={1} max={22} step={0.1} value={cam.fstop} onChange={v=>{ S.setCamera({fstop:v}); bump(); }}/>
      <Control label="Distance" min={0.5} max={10} step={0.05} value={cam.distance} onChange={v=>{ S.setCamera({distance:v}); bump(); }}/>
      <Control label="Focus" min={0.3} max={15} step={0.01} value={cam.dof.focusDist} onChange={v=>{ S.focusOn(v); bump(); }} onReset={()=>{ S.focusOn("subject"); bump(); }}/>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",margin:"6px 0"}}>
        <Lab>ISO <select style={sSel} value={cam.iso} onChange={e=>{ S.setCamera({iso:+e.target.value}); bump(); }}>{ISOS.map(i=><option key={i} value={i}>{i}</option>)}</select></Lab>
        <Lab>Shutter <select style={sSel} value={nearestShutter(cam.shutter)} onChange={e=>{ S.setCamera({shutter:+e.target.value}); bump(); }}>{SHUTTERS.map(t=><option key={t} value={t}>{fmtT(t)}</option>)}</select></Lab>
        <Lab>Sensor <select style={sSel} value={cam.sensorMm} onChange={e=>{ S.setCamera({sensorMm:+e.target.value}); bump(); }}>{[["36","FF 36"],["24.89","S35"],["23.5","APS-C"],["17.3","MFT"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Lab>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",margin:"4px 0"}} title="Light meter, like the camera's: centre-weighted, in stops">
        <span style={{color:C.muted,fontSize:12}}>Meter</span>
        <div style={{flex:1,position:"relative",height:18,border:`1px solid ${C.line}`,borderRadius:4,background:"linear-gradient(90deg,#2a2a33,#3a3a44 50%,#2a2a33)"}}>
          <div style={{position:"absolute",left:"50%",top:0,bottom:0,width:1,background:"#888"}}/>
          <div style={{position:"absolute",top:2,bottom:2,width:4,borderRadius:2,background:C.accent,left:`calc(${50+Math.max(-3,Math.min(3,cam.meter))/3*48}% - 2px)`}}/>
        </div>
        <span style={{color:C.muted,fontSize:12,width:60,textAlign:"right"}}>{cam.meter>=0?"+":""}{r1(cam.meter)} EV</span>
      </div>
      <Muted>EV100 {r1(cam.ev100)} · {fmtT(cam.shutter)} · f/{r1(cam.fstop)} · ISO {cam.iso}</Muted>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",margin:"6px 0"}}>
        <Lab><input type="checkbox" checked={!!cam.dof.on} onChange={e=>{ S.setCamera({dof:{on:e.target.checked}}); bump(); }}/> Depth of field</Lab>
        <button style={sBtn(false)} onClick={()=>S.pickFocus(true)}>Focus on…</button>
        <button style={sBtn(false)} onClick={()=>{ S.focusOn("subject"); bump(); }}>Subject</button>
      </div>
      {cam.dof.on && <Muted>Focus {r1(cam.dof.focusDist,2)} m · sharp {r1(cam.dof.near,2)}–{cam.dof.far===Infinity?"∞":r1(cam.dof.far,2)} m</Muted>}
      <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",margin:"6px 0"}}>
        <Lab><input type="checkbox" defaultChecked onChange={e=>S.setGuides(e.target.checked)}/> Thirds</Lab>
        <Lab>Aspect <select style={sSel} defaultValue="3:2" onChange={e=>S.setAspect(e.target.value)}>{["3:2","4:5","2:3","1:1","16:9"].map(a=><option key={a}>{a}</option>)}</select></Lab>
      </div>
    </div>
  );

  return (
    <div ref={rootRef} style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-start",...(fs?{height:"100vh",background:"#0e0f12",padding:12,overflow:"auto",alignContent:"flex-start"}:{})}}>
      {/* LEFT: 3D view on top + the bar you watch while lighting */}
      <div style={{flex:"1 1 560px",minWidth:300,display:"flex",flexDirection:"column",gap:10}}>
        <div ref={viewRef} style={{position:"relative",width:"100%",height:narrow?"46vh":(fs?"62vh":"min(58vh,600px)"),background:"#08080a",borderRadius:10,overflow:"hidden",border:`1px solid ${C.line}`,touchAction:"none"}}>
          <button onClick={toggleFs} title="Fullscreen (great for projecting)" style={{position:"absolute",right:8,top:8,zIndex:4,...sBtn(false),padding:"4px 10px"}}>{fs?"✕ Exit":"⛶ Fullscreen"}</button>
          {phase!=="ready" && (
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",padding:24,color:phase==="error"?"#fca5a5":C.muted,fontSize:13}}>
              {phase==="error" ? <div><div style={{fontWeight:"bold",marginBottom:6}}>Couldn't load the 3D studio</div><div style={{fontSize:12}}>{err}</div><div style={{fontSize:11,marginTop:8,color:C.muted2}}>Needs a browser with WebGL.</div></div>
                              : <div>Loading the 3D studio… <div style={{fontSize:11,color:C.muted2,marginTop:4}}>(downloads the engine and the bust the first time)</div></div>}
            </div>
          )}
        </div>
        {/* BAR: camera controls | camera monitor | reference */}
        <div style={{display:"grid",gridTemplateColumns:narrow?"1fr":"minmax(250px,300px) minmax(0,1fr) minmax(0,1fr)",gap:10,height:barH,background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:10}}>
          <div style={{minHeight:0,height:frameH}}>{cameraControls}</div>
          <div style={{...frameWrap,height:frameH}}>
            <div style={capRow}><span>{monCap}</span><span>click to swap</span></div>
            <div ref={monitorRef} style={slot}/>
          </div>
          <div style={{...frameWrap,height:frameH}}>
            <div style={capRow}><span>Reference</span><span style={{textTransform:"none",letterSpacing:0}}>{challenge?.name||""}</span></div>
            <div style={slot}>
              {challenge?.url
                ? <img src={challenge.url} alt="reference" style={{maxWidth:"100%",maxHeight:"100%",borderRadius:6,display:"block"}}/>
                : <div style={{color:C.muted,fontSize:12,textAlign:"center",padding:10,border:`1px dashed ${C.line}`,borderRadius:6,width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>Start a challenge (right panel) — the reference appears here, next to your camera</div>}
            </div>
          </div>
        </div>
        <Muted style={{lineHeight:1.6}}>
          <b style={{color:C.text}}>Navigation:</b> middle button = orbit · wheel = zoom to cursor · <b>WASD</b> walk · Q/E down/up · 1/3 front/side · Home frames the subject. In <b>Studio</b> view drag a light to move it (Shift+drag = closer/further).
        </Muted>
      </div>

      {/* RIGHT: panel */}
      <aside style={{flex:narrow?"1 1 100%":"0 0 400px",maxWidth:"100%",minWidth:0,background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:"12px 14px",maxHeight:narrow?"none":(fs?"94vh":"min(92vh,900px)"),overflow:narrow?"visible":"auto"}}>
        {!ready ? <Muted>Preparing controls…</Muted> : <>
          <H style={{marginTop:0}}>View</H>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"4px 0"}}>
            <button style={sBtn(view==="studio")} onClick={()=>S.setView("studio")}>Studio (place lights)</button>
            <button style={sBtn(view==="camera")} onClick={()=>S.setView("camera")}>Camera (framing)</button>
          </div>
          <Muted>The camera monitor (in the bar below) shows the other view — click it to swap. In Camera view, orbit/pan/zoom/WASD move the photo camera. Every control: ↺ or Shift+click the slider = back to default.</Muted>

          <H>Subject</H>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"4px 0"}}>
            {subjects.map(s=><button key={s.id} style={sBtn(false)} title={s.credit} onClick={()=>{ S.loadSubject(s.id); bump(); }}>{s.name}</button>)}
            <button style={sBtn(false)} onClick={()=>fileRef.current?.click()}>Import your own model…</button>
            <input ref={fileRef} type="file" accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp,.ktx2" multiple hidden onChange={e=>{ importFiles(e.target.files); e.target.value=""; }}/>
          </div>
          {importMsg && <Muted>{importMsg}</Muted>}
          <Control label="Turn subject" min={-60} max={60} value={S.getTurn()} onChange={v=>{ S.setTurn(v); bump(); }}/>

          <H>Presets</H>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"4px 0"}}>
            {presets.map(p=><button key={p.id} style={sBtn(false)} title={p.description} onClick={()=>{ S.applyPreset(p.id); bump(); }}>{p.name}</button>)}
          </div>

          <H>Challenge — recreate the reference</H>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"4px 0",alignItems:"center"}}>
            <select style={sSel} value={chSel} onChange={e=>setChSel(e.target.value)}>{presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <button style={sBtn(false)} onClick={startChallenge}>Start</button>
            <button style={sBtn(false)} onClick={checkChallenge}>Check</button>
            <button style={sBtn(false)} onClick={solveChallenge}>Show solution</button>
            <button style={sBtn(false)} onClick={endChallenge}>End</button>
          </div>
          {challenge?.result && <div style={{color:C.text,fontSize:12,margin:"4px 0"}}><b style={{color:C.accent,fontSize:15}}>{challenge.result.score}/100</b>{challenge.result.hints?.map((h,i)=><div key={i} style={{color:C.muted}}>· {h.text}</div>)}</div>}
          {challenge?.out && !challenge?.result && <Muted>{challenge.out}</Muted>}

          <H>Lights</H>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"4px 0"}}>
            {[["spot","+ Spot"],["area","+ Soft box"],["point","+ Bulb"],["sun","+ Sun"]].map(([t,l])=>
              <button key={t} style={sBtn(false)} onClick={()=>{ const id=S.addLight({type:t,az:-30,el:30,dist:2}); S.select(id); bump(); }}>{l}</button>)}
          </div>
          {lights.map(l=>{ const id=l.id, sel=id===selected;
            return (
              <div key={id} style={{border:`1px solid ${sel?C.accent:C.line}`,borderRadius:8,padding:"6px 10px",margin:"6px 0"}}>
                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                  <b style={{color:C.text,textTransform:"capitalize"}}>{l.role||id}</b>
                  <select style={sSel} value={l.type} onChange={e=>{ S.updateLight(id,{type:e.target.value}); bump(); }}>{["spot","area","point","sun"].map(t=><option key={t} value={t}>{t}</option>)}</select>
                  <input type="color" value={l.color||"#ffffff"} title="Gel (RGB) — leave white to use Kelvin" onChange={e=>{ S.updateLight(id,{color:e.target.value==="#ffffff"?null:e.target.value}); bump(); }} style={{width:28,height:24,padding:0,border:`1px solid ${C.line}`,borderRadius:6,background:"none"}}/>
                  <Lab><input type="checkbox" checked={!!l.shadow?.on} onChange={e=>{ S.updateLight(id,{shadow:{on:e.target.checked}}); bump(); }}/> Shadow</Lab>
                  <button style={{...sBtn(false),padding:"3px 8px"}} onClick={()=>S.select(id)}>Select</button>
                  <button style={{...sBtn(false),padding:"3px 8px"}} onClick={()=>{ S.removeLight(id); bump(); }}>✕</button>
                </div>
                <Control label="Intensity" min={0} max={3} step={0.01} value={lightG(id,"intensity")} onChange={lightU(id,"intensity")}/>
                <Control label="Kelvin" min={2000} max={10000} step={100} value={S.getLight(id).kelvin||5600} onChange={lightU(id,"kelvin")}/>
                <Control label="Azimuth" min={-180} max={180} value={lightG(id,"az")} onChange={lightU(id,"az")}/>
                <Control label="Elevation" min={-80} max={89} value={lightG(id,"el")} onChange={lightU(id,"el")}/>
                <Control label="Distance" min={0.3} max={8} step={0.05} value={lightG(id,"dist")} onChange={lightU(id,"dist")}/>
                {l.type==="spot" && <Control label="Cone" min={5} max={120} value={lightG(id,"cone")} onChange={lightU(id,"cone")}/>}
                {l.type==="spot" && <Control label="Edge softness" min={0} max={1} step={0.01} value={lightG(id,"softness")} onChange={lightU(id,"softness")}/>}
                {l.type==="area" && <Control label="Size" min={0.1} max={3} step={0.05} value={lightG(id,"size")} onChange={lightU(id,"size")}/>}
                <Control label="Shadow soft" min={0} max={1} step={0.01} value={lightG(id,"shadow.softness")} onChange={lightU(id,"shadow.softness")}/>
              </div>
            );
          })}
          <Muted>Studio view: drag a light to move it around the subject · Shift+drag = closer/further · click empty space to deselect.</Muted>

          <H>Studio</H>
          <Control label="Ambient" min={0} max={1} step={0.01} value={world.ambient} onChange={v=>{ S.setWorld({ambient:v}); bump(); }}/>
          <Control label="Exposure" min={-3} max={3} step={0.1} value={world.exposure} onChange={v=>{ S.setWorld({exposure:v}); bump(); }}/>
          <div style={{display:"flex",gap:8,alignItems:"center",margin:"4px 0"}}>
            <Lab>Backdrop <input type="color" value={world.backdrop||"#7d7f84"} onChange={e=>{ S.setWorld({backdrop:e.target.value}); bump(); }} style={{width:28,height:24,padding:0,border:`1px solid ${C.line}`,borderRadius:6,background:"none"}}/></Lab>
          </div>

          <H>Snapshots</H>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"4px 0"}}>
            <button style={sBtn(false)} onClick={takeShot}>📷 Snapshot</button>
            <button style={sBtn(false)} disabled={pickCount<2} onClick={compareShots}>Compare selected</button>
            <button style={sBtn(false)} onClick={copyState}>Copy state</button>
          </div>
          <Muted>Each snapshot carries its settings under the picture (and inside the PNG: drop a saved snapshot on the view to restore that setup).</Muted>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginTop:6}}>
            {shots.map((x,i)=>(
              <figure key={i} style={{margin:0,position:"relative"}}>
                <img src={x.url} onClick={()=>openImg(x.url,`Snapshot #${i+1}`)} style={{width:"100%",borderRadius:4,cursor:"zoom-in",display:"block"}} title="Open"/>
                <label style={{position:"absolute",left:4,top:4,background:"#000a",borderRadius:4,padding:"0 4px",fontSize:11,color:C.text}}>
                  <input type="checkbox" checked={!!x.pick} onChange={e=>setShots(s=>s.map((y,j)=>j===i?{...y,pick:e.target.checked}:y))}/> #{i+1}
                </label>
                <button onClick={()=>restoreShot(i)} title="Restore this setup" style={{position:"absolute",right:4,top:4,padding:"0 6px",...sBtn(false)}}>↺</button>
              </figure>
            ))}
          </div>
        </>}
      </aside>
    </div>
  );
}
