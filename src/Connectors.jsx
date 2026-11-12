import React, { useRef, useEffect, useState, useMemo } from "react";

// Connectors — what every plug on a set looks like, what it carries, how far it reaches.
// Faces are drawn as you see them looking into the cable end (jacks/RCA from the side).

const C = { accent:"#ff5a4d", panel:"#16171c", card:"#1c1d23", line:"#2a2b32", text:"#e5e7eb", muted:"#8a8a94", muted2:"#6b7280" };
const GROUPS = { video:{l:"Video",c:"#60a5fa"}, audio:{l:"Audio",c:"#f472b6"}, data:{l:"Data & control",c:"#2dd4bf"}, power:{l:"Power",c:"#facc15"} };
const panel = {background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:"14px 16px"};
const sBtn = (on,col=C.accent) => ({padding:"5px 11px",borderRadius:6,border:`1px solid ${on?col:C.line}`,background:on?col+"22":"#26262c",color:on?col:C.text,cursor:"pointer",fontSize:12.5});

/* ------------------------------------------------------------------ drawings (viewBox 0 0 100 70) */
const M="#b9c0c8", MD="#7b838d", INS="#17181c", AU="#d9a93f", HOLE="#050506", WHITE="#e9e7e1";
const pinsRow = (x0,x1,y,n,w=1.6,h=3) => Array.from({length:n},(_,i)=><rect key={`${y}-${i}`} x={x0+(x1-x0)*(n===1?0.5:i/(n-1))-w/2} y={y} width={w} height={h} fill={AU}/>);
const ring = (cx,cy,r,n,a0,a1,el) => Array.from({length:n},(_,i)=>{ const a=(a0+(a1-a0)*(n===1?0:i/(n-1)))*Math.PI/180; return el(cx+r*Math.cos(a),cy+r*Math.sin(a),i); });
const pin = (x,y,r=2.2,f=AU) => <circle cx={x} cy={y} r={r} fill={f} stroke="#000" strokeWidth=".4"/>;

const D = {
  hdmiA: <g><path d="M16 22 H84 V40 L77 48 H23 L16 40 Z" fill={M} stroke={MD}/><path d="M20 26 H80 V39 L74.5 44.5 H25.5 L20 39 Z" fill={HOLE}/>
    <rect x="25" y="31" width="50" height="6" rx="1" fill={INS}/>{pinsRow(27,73,28,10,1.5,3)}{pinsRow(29,71,37,9,1.5,3)}</g>,
  hdmiMini: <g><path d="M30 25 H70 V39 L65 45 H35 L30 39 Z" fill={M} stroke={MD}/><path d="M33 28 H67 V38 L63 42 H37 L33 38 Z" fill={HOLE}/><rect x="36" y="32" width="28" height="4" fill={INS}/>{pinsRow(37,63,30,10,1,2)}{pinsRow(38,62,36,9,1,2)}</g>,
  hdmiMicro: <g><rect x="38" y="28" width="24" height="13" rx="2.5" fill={M} stroke={MD}/><rect x="40" y="30" width="20" height="9" rx="1.5" fill={HOLE}/><rect x="41.5" y="33.5" width="17" height="2" fill={INS}/>{pinsRow(42,58,31.5,10,.8,1.6)}{pinsRow(43,57,35.7,9,.8,1.6)}</g>,
  dp: <g><path d="M16 22 H84 V48 H26 L16 40 Z" fill={M} stroke={MD}/><path d="M20 26 H80 V44 H27.5 L20 38 Z" fill={HOLE}/><rect x="27" y="32" width="48" height="6" fill={INS}/>{pinsRow(29,73,29,10,1.5,3)}{pinsRow(29,73,38,10,1.5,3)}
    <rect x="34" y="19" width="6" height="3" fill={MD}/><rect x="60" y="19" width="6" height="3" fill={MD}/></g>,
  usbc: <g><rect x="24" y="27" width="52" height="16" rx="8" fill={M} stroke={MD}/><rect x="27" y="30" width="46" height="10" rx="5" fill={HOLE}/><rect x="33" y="33.5" width="34" height="3" fill={INS}/>{pinsRow(34,66,31.4,12,1,2)}{pinsRow(34,66,36.6,12,1,2)}</g>,
  bnc: <g><circle cx="50" cy="35" r="24" fill={M} stroke={MD}/><circle cx="50" cy="35" r="19" fill={MD}/><circle cx="50" cy="35" r="16" fill={HOLE}/><circle cx="50" cy="35" r="11" fill={WHITE}/>{pin(50,35,2.4)}
    <rect x="23" y="32" width="6" height="6" fill={HOLE}/><rect x="71" y="32" width="6" height="6" fill={HOLE}/></g>,
  lc: <g>{[30,54].map(x=><g key={x}><rect x={x} y="24" width="16" height="22" rx="2" fill="#3b82c4" stroke="#1e4f80"/><circle cx={x+8} cy="37" r="4.5" fill={WHITE}/><circle cx={x+8} cy="37" r="1.2" fill="#9ad"/><rect x={x+4} y="18" width="8" height="7" rx="1" fill="#2a6aa8"/></g>)}<rect x="44" y="22" width="12" height="3" fill="#2a6aa8"/></g>,
  smpte: <g><circle cx="50" cy="35" r="26" fill={M} stroke={MD}/><circle cx="50" cy="35" r="20" fill={INS}/><rect x="47" y="9" width="6" height="5" fill={HOLE}/>
    <circle cx="42" cy="31" r="4" fill={WHITE}/><circle cx="58" cy="31" r="4" fill={WHITE}/><circle cx="42" cy="31" r="1" fill="#9ad"/><circle cx="58" cy="31" r="1" fill="#9ad"/>{pin(40,43,2)}{pin(47,46,2)}{pin(53,46,2)}{pin(60,43,2)}</g>,
  dvi: <g><path d="M10 23 H90 L86 47 H14 Z" fill={M} stroke={MD}/><path d="M14 26 H86 L83 44 H17 Z" fill={INS}/>
    {[29,34.5,40].map(y=>Array.from({length:8},(_,i)=><rect key={y+"-"+i} x={20+i*6} y={y-1.2} width="3" height="2.4" fill={HOLE}/>))}
    <rect x="70" y="33.5" width="11" height="2.2" fill={HOLE}/>{[[72,30],[79,30],[72,39.5],[79,39.5]].map(([x,y])=><rect key={x+"/"+y} x={x-1.2} y={y-1.2} width="2.4" height="2.4" fill={HOLE}/>)}</g>,
  vga: <g><path d="M20 23 H80 L75 47 H25 Z" fill={M} stroke={MD}/><path d="M24 26 H76 L72 44 H28 Z" fill={INS}/>
    {[[29.5,5,0],[35,5,2.5],[40.5,5,0]].map(([y,n,o])=>Array.from({length:n},(_,i)=><circle key={y+"-"+i} cx={33+o+i*8.5} cy={y} r="1.6" fill={AU}/>))}
    <circle cx="13" cy="35" r="4" fill={MD}/><circle cx="87" cy="35" r="4" fill={MD}/></g>,
  xlr3: <g><circle cx="50" cy="35" r="25" fill={M} stroke={MD}/><circle cx="50" cy="35" r="20" fill={INS}/><rect x="47.5" y="10" width="5" height="5" fill={MD}/>{pin(41,30,2.6)}{pin(59,30,2.6)}{pin(50,45,2.6)}</g>,
  xlr4: <g><circle cx="50" cy="35" r="25" fill={M} stroke={MD}/><circle cx="50" cy="35" r="20" fill={INS}/><rect x="47.5" y="10" width="5" height="5" fill={MD}/>{pin(41,28,2.4)}{pin(59,28,2.4)}{pin(41,43,2.4)}{pin(59,43,2.4)}</g>,
  xlr5: <g><circle cx="50" cy="35" r="25" fill={M} stroke={MD}/><circle cx="50" cy="35" r="20" fill={INS}/><rect x="47.5" y="10" width="5" height="5" fill={MD}/>{ring(50,35,11,4,150,390,(x,y,i)=><React.Fragment key={i}>{pin(x,y,2.2)}</React.Fragment>)}{pin(50,35,2.2)}</g>,
  trs: <g><rect x="6" y="28" width="34" height="14" rx="3" fill="#2a2b30"/><rect x="40" y="31" width="22" height="8" fill={M}/><rect x="62" y="31" width="3" height="8" fill="#111"/><rect x="65" y="31" width="13" height="8" fill={M}/><rect x="78" y="31" width="3" height="8" fill="#111"/><path d="M81 31 H88 Q94 35 88 39 H81 Z" fill={M}/>
    <text x="51" y="51" fontSize="5" fill="#9ca3af" textAnchor="middle">sleeve</text><text x="71.5" y="51" fontSize="5" fill="#9ca3af" textAnchor="middle">ring</text><text x="87" y="51" fontSize="5" fill="#9ca3af" textAnchor="middle">tip</text></g>,
  ts: <g><rect x="6" y="28" width="34" height="14" rx="3" fill="#2a2b30"/><rect x="40" y="31" width="38" height="8" fill={M}/><rect x="78" y="31" width="3" height="8" fill="#111"/><path d="M81 31 H88 Q94 35 88 39 H81 Z" fill={M}/>
    <text x="59" y="51" fontSize="5" fill="#9ca3af" textAnchor="middle">sleeve</text><text x="87" y="51" fontSize="5" fill="#9ca3af" textAnchor="middle">tip</text></g>,
  mini: <g><rect x="14" y="29" width="30" height="12" rx="3" fill="#2a2b30"/><rect x="44" y="32.5" width="12" height="5" fill={M}/><rect x="56" y="32.5" width="2" height="5" fill="#111"/><rect x="58" y="32.5" width="8" height="5" fill={M}/><rect x="66" y="32.5" width="2" height="5" fill="#111"/><path d="M68 32.5 H73 Q77 35 73 37.5 H68 Z" fill={M}/>
    <text x="50" y="50" fontSize="5" fill="#9ca3af" textAnchor="middle">3.5 mm</text></g>,
  rca: <g><rect x="8" y="27" width="34" height="16" rx="3" fill="#c0262d"/><rect x="42" y="25" width="26" height="20" rx="1" fill={M}/><rect x="45" y="28" width="23" height="14" fill="#7b838d"/><rect x="68" y="33" width="16" height="4" fill={M}/><path d="M84 33 H87 Q89 35 87 37 H84 Z" fill={M}/>
    <text x="55" y="53" fontSize="5" fill="#9ca3af" textAnchor="middle">shield ring</text><text x="80" y="31" fontSize="5" fill="#9ca3af" textAnchor="middle">centre pin</text></g>,
  speakon: <g><circle cx="50" cy="35" r="26" fill="#222327" stroke="#000"/><path d="M50 9 l5 6 h-10 z" fill="#3a3b40"/><circle cx="50" cy="35" r="18" fill="#0d0d10"/><circle cx="50" cy="35" r="6" fill="#2a2b30"/>
    {ring(50,35,12.5,4,45,315,(x,y,i)=><rect key={i} x={x-3.5} y={y-1.6} width="7" height="3.2" rx="1" fill={AU} transform={`rotate(${45+i*90} ${x} ${y})`}/>)}</g>,
  toslink: <g><path d="M30 26 L36 20 H64 L70 26 V50 H30 Z" fill="#202126" stroke="#000"/><path d="M36 28 L40 24 H60 L64 28 V44 H36 Z" fill="#0d0d10"/><circle cx="50" cy="35" r="5" fill="#e45"/><circle cx="50" cy="35" r="2" fill="#ffd0d0"/></g>,
  aes: null, // drawn as XLR-3 (see data)
  midi: <g><circle cx="50" cy="35" r="24" fill={M} stroke={MD}/><circle cx="50" cy="35" r="19" fill={INS}/><rect x="47.5" y="52" width="5" height="5" fill={MD}/>{ring(50,35,11,5,180,360,(x,y,i)=><React.Fragment key={i}>{pin(x,y,1.9)}</React.Fragment>)}</g>,
  rj45: <g><path d="M30 20 H70 V46 H30 Z" fill="#cfe3ec" fillOpacity=".55" stroke="#8fb3c2"/>{Array.from({length:8},(_,i)=><rect key={i} x={33.3+i*4.5} y="21" width="2" height="9" fill={AU}/>)}<path d="M40 46 H60 V52 L56 58 H44 L40 52 Z" fill="#cfe3ec" fillOpacity=".55" stroke="#8fb3c2"/></g>,
  ethercon: <g><circle cx="50" cy="35" r="27" fill={M} stroke={MD}/><circle cx="50" cy="35" r="22" fill={INS}/><path d="M33 22 H67 V44 H33 Z" fill="#cfe3ec" fillOpacity=".5" stroke="#8fb3c2"/>{Array.from({length:8},(_,i)=><rect key={i} x={35.5+i*3.9} y="23" width="1.8" height="7" fill={AU}/>)}<rect x="44" y="44" width="12" height="5" fill="#cfe3ec" fillOpacity=".5"/></g>,
  lemo: <g><circle cx="50" cy="35" r="20" fill={M} stroke={MD}/><circle cx="50" cy="35" r="15" fill={INS}/><circle cx="50" cy="12" r="2.2" fill="#e11d48"/>{ring(50,35,7,5,-90,198,(x,y,i)=><React.Fragment key={i}>{pin(x,y,1.5)}</React.Fragment>)}</g>,
  dtap: <g><path d="M30 24 H70 L66 46 H34 Z" fill="#202126" stroke="#000"/><rect x="37" y="31" width="9" height="3" fill={M}/><rect x="54" y="30" width="5" height="5" fill={M}/><text x="50" y="56" fontSize="5" fill="#9ca3af" textAnchor="middle">one blade wider: can't go in upside down</text></g>,
  schuko: <g><circle cx="50" cy="35" r="27" fill="#ececec" stroke="#999"/><circle cx="50" cy="35" r="20" fill="#dcdcdc"/><rect x="45" y="8" width="10" height="5" fill="#8a8a8a"/><rect x="45" y="57" width="10" height="5" fill="#8a8a8a"/>{pin(40.5,35,2.6,M)}{pin(59.5,35,2.6,M)}</g>,
  cee16: <g><circle cx="50" cy="35" r="27" fill="#2563eb" stroke="#1e3a8a"/><circle cx="50" cy="35" r="21" fill="#1e40af"/><rect x="46" y="8" width="8" height="6" fill="#0f1d4d"/>
    {pin(50,48,3.4,M)}{ring(50,35,13,2,210,330,(x,y,i)=><React.Fragment key={i}>{pin(x,y,2.5,M)}</React.Fragment>)}</g>,
  cee3: <g><circle cx="50" cy="35" r="27" fill="#dc2626" stroke="#7f1d1d"/><circle cx="50" cy="35" r="21" fill="#b91c1c"/><rect x="46" y="8" width="8" height="6" fill="#4c0d0d"/>
    {pin(50,48,3.4,M)}{ring(50,35,13,4,150,390,(x,y,i)=><React.Fragment key={i}>{pin(x,y,2.4,M)}</React.Fragment>)}</g>,
  powercon: <g><circle cx="50" cy="35" r="26" fill="#2b6fd6" stroke="#173c78"/><circle cx="50" cy="35" r="19" fill="#0d0d10"/><circle cx="50" cy="35" r="7" fill="#2a2b30"/><path d="M50 9 l4 5 h-8 z" fill="#173c78"/>
    {ring(50,35,12.5,3,-30,210,(x,y,i)=><rect key={i} x={x-3} y={y-1.5} width="6" height="3" rx="1" fill={M} transform={`rotate(${60+i*120} ${x} ${y})`}/>)}</g>,
  true1: <g><circle cx="50" cy="35" r="26" fill="#1c1c1f" stroke="#000"/><circle cx="50" cy="35" r="22" fill="none" stroke="#facc15" strokeWidth="3"/><circle cx="50" cy="35" r="17" fill="#0d0d10"/><circle cx="50" cy="35" r="6" fill="#2a2b30"/>
    {ring(50,35,11.5,3,-30,210,(x,y,i)=><rect key={i} x={x-3} y={y-1.5} width="6" height="3" rx="1" fill={M} transform={`rotate(${60+i*120} ${x} ${y})`}/>)}</g>,
  soca: <g><circle cx="50" cy="35" r="27" fill={M} stroke={MD}/><circle cx="50" cy="35" r="22" fill={INS}/><rect x="47" y="8" width="6" height="5" fill={MD}/>
    {ring(50,35,16,12,-90,240,(x,y,i)=><React.Fragment key={"o"+i}>{pin(x,y,1.5)}</React.Fragment>)}{ring(50,35,8.5,6,-90,210,(x,y,i)=><React.Fragment key={"i"+i}>{pin(x,y,1.5)}</React.Fragment>)}{pin(50,35,1.5)}</g>,
  iec: <g><path d="M27 26 L33 20 H67 L73 26 V50 H27 Z" fill="#1c1c1f" stroke="#000"/><path d="M31 27 L35 23.5 H65 L69 27 V47 H31 Z" fill="#26272b"/>
    <rect x="48.5" y="25.5" width="3" height="7" fill={HOLE}/><rect x="37" y="38" width="3" height="7" fill={HOLE}/><rect x="60" y="38" width="3" height="7" fill={HOLE}/></g>,
  vmount: <g><path d="M24 14 H76 L60 58 H40 Z" fill="#3a3b40" stroke="#111"/><path d="M33 20 H67 L56 50 H44 Z" fill="#2a2b30"/><rect x="45" y="44" width="10" height="9" rx="1" fill="#151518"/>{pin(47.5,48.5,1.2)}{pin(52.5,48.5,1.2)}
    <text x="50" y="66" fontSize="5" fill="#9ca3af" textAnchor="middle">V-Mount plate (Gold Mount uses 3 studs)</text></g>,
};
D.aes = D.xlr3;

/* ------------------------------------------------------------------ data
   len: [typical, max] in metres for the passive cable (guide values); far: how to go further */
const CONN = [
  {id:"hdmiA",g:"video",name:"HDMI (Type A)",carries:"Video + audio + control (CEC), digital",use:"Cameras, monitors, TVs, laptops, consumer & prosumer gear.",len:[3,10],far:"Active optical HDMI (30–100 m) or convert to SDI / HDBaseT (100 m over Cat6).",
    warn:"It doesn't lock — it pulls out with a tug. Tape it, use a cable clamp, or convert to SDI on set."},
  {id:"hdmiMini",g:"video",name:"Mini HDMI (Type C)",carries:"Same signal as HDMI",use:"DSLRs, mirrorless and small cameras.",len:[1.5,3],far:"Short adapter to full-size HDMI, then as HDMI.",warn:"Fragile port: support the cable so its weight doesn't hang on the camera socket."},
  {id:"hdmiMicro",g:"video",name:"Micro HDMI (Type D)",carries:"Same signal as HDMI",use:"Action cams, small mirrorless, tablets.",len:[1,2],far:"Adapter to full-size HDMI close to the camera.",warn:"The most fragile of all. Use a locking cage or a short right-angle pigtail."},
  {id:"bnc",g:"video",name:"SDI (BNC)",carries:"Video + embedded audio + timecode, digital, 75 Ω coax",use:"Professional & broadcast: cameras, switchers, monitors, recorders.",len:[50,100],far:"Higher bit rate = shorter: 3G ≈ 100 m, 12G ≈ 40–70 m. For more: fibre converters (kilometres).",
    warn:"Twist-lock bayonet: push and turn ¼. Use proper 75 Ω coax (not 50 Ω antenna cable)."},
  {id:"dp",g:"video",name:"DisplayPort",carries:"Video + audio, digital",use:"Computer monitors, graphics cards.",len:[2,3],far:"Active / fibre DisplayPort cables (10–50 m).",warn:"One corner is cut: it only goes in one way. The latch must be pressed to unplug."},
  {id:"usbc",g:"video",name:"USB-C / Thunderbolt",carries:"Data, video (DisplayPort alt mode), audio, power (PD up to 240 W)",use:"Laptops, SSDs, webcams, capture devices, phones.",len:[1,2],far:"Active optical USB/Thunderbolt (10–50 m).",
    warn:"Same plug, very different cables: a cheap USB-C cable may carry only charge or USB 2. Check the logo/spec."},
  {id:"lc",g:"video",name:"Fibre (LC duplex)",carries:"Any signal converted to light (SDI, Ethernet…)",use:"Long runs: stadiums, OB trucks, between buildings.",len:[300,10000],far:"Multimode ≈ 300–550 m; single-mode 10 km and more.",
    warn:"Never look into a fibre end. Keep caps on — one speck of dust on the ferrule kills the link."},
  {id:"smpte",g:"video",name:"SMPTE 304 (hybrid fibre)",carries:"Camera video + return + intercom + tally + POWER to the camera",use:"Broadcast studio and OB camera chains (camera ↔ CCU).",len:[300,2000],far:"Power limits it (~2 km); pure fibre goes further.",warn:"Expensive and precious: keep the dust caps on, clean before every connection."},
  {id:"dvi",g:"video",name:"DVI",carries:"Video, digital (DVI-D) or digital + analogue (DVI-I)",use:"Older monitors and projectors.",len:[5,15],far:"Convert to HDMI (same digital signal) or fibre.",warn:"Legacy. Same digital video as HDMI, but no audio."},
  {id:"vga",g:"video",name:"VGA (D-sub 15)",carries:"Analogue RGB video",use:"Old projectors and computers in classrooms.",len:[10,30],far:"VGA over Cat5 baluns; better, replace it.",warn:"Analogue: the longer the cable, the softer and more ghosted the picture."},

  {id:"xlr3",g:"audio",name:"XLR-3 (mic / line)",carries:"Balanced analogue audio (+48 V phantom for condenser mics)",use:"Microphones, mixers, PA, recorders.",len:[50,100],far:"Over 100 m: stage box / Dante over Ethernet, or fibre.",
    warn:"Pin 1 shield, 2 hot (+), 3 cold (−). Looks identical to 3-pin DMX: don't mix them."},
  {id:"trs",g:"audio",name:"Jack 6.35 mm TRS",carries:"Balanced mono (line) OR stereo headphones (L/R)",use:"Line outputs, patch bays, headphones, inserts.",len:[20,50],far:"Balanced line runs like XLR; headphones need an amp/extension.",warn:"Two rings (tip-ring-sleeve). The same plug can be 'balanced mono' or 'stereo' — check the device."},
  {id:"ts",g:"audio",name:"Jack 6.35 mm TS",carries:"Unbalanced mono",use:"Electric guitar, keyboards, effects pedals.",len:[3,6],far:"DI box: converts to balanced XLR so it can run 100 m.",warn:"Only one ring (tip-sleeve). Unbalanced = it picks up hum: keep it short."},
  {id:"mini",g:"audio",name:"Jack 3.5 mm (mini-jack)",carries:"Stereo / mic (TRRS = headset with mic)",use:"Phones, laptops, camera mic inputs, headphones.",len:[1,3],far:"Use an XLR adapter/preamp (e.g. on camera) for longer mic runs.",warn:"TRS vs TRRS (3 rings): a phone headset plug won't work in a camera mic input without the right adapter."},
  {id:"rca",g:"audio",name:"RCA (phono / cinch)",carries:"Unbalanced audio (also composite video, S/PDIF coax)",use:"Hi-fi, DJ gear, consumer playback.",len:[3,10],far:"Convert to balanced or digital.",warn:"Colours: red = right, white = left, yellow = composite video."},
  {id:"speakon",g:"audio",name:"speakON (NL4)",carries:"Amplifier → loudspeaker, high current",use:"PA speakers and amplifiers.",len:[20,50],far:"Thicker cable (or put the amp near the speaker): long thin cable wastes power and damping.",
    warn:"Push and twist to lock. Never use a jack-to-jack 'instrument' cable to drive a speaker."},
  {id:"toslink",g:"audio",name:"TOSLINK (optical)",carries:"Digital audio as red light (S/PDIF, up to 5.1 compressed)",use:"TVs, soundbars, consumer audio interfaces, ADAT (8 ch).",len:[5,10],far:"Glass-fibre TOSLINK or convert to coax S/PDIF.",warn:"Tight bends break the plastic fibre. Keep the caps on."},
  {id:"aes",g:"audio",name:"AES/EBU (AES3 on XLR)",carries:"2 channels of digital audio",use:"Professional digital audio links, broadcast.",len:[100,100],far:"AES-3id on 75 Ω coax (BNC): up to 1 km.",warn:"Same XLR shell as mic cable, but needs 110 Ω digital cable — mic cable works only for short runs."},
  {id:"midi",g:"audio",name:"MIDI (DIN 5)",carries:"Musical control data (notes, controllers, sync)",use:"Keyboards, synths, lighting/show control.",len:[10,15],far:"MIDI over USB / network (RTP-MIDI).",warn:"It carries no audio — only instructions. MIDI In ≠ MIDI Out."},

  {id:"rj45",g:"data",name:"RJ45 (Ethernet)",carries:"Network data: NDI, SRT, Dante, Art-Net, PoE power…",use:"Everything on IP: switches, cameras, intercom, lighting nodes.",len:[100,100],far:"Switch every 100 m, or fibre.",warn:"The plastic clip snaps off easily — use etherCON or boots on set."},
  {id:"ethercon",g:"data",name:"etherCON",carries:"Ethernet in a rugged, locking shell",use:"Touring, live events, stage boxes.",len:[100,100],far:"As Ethernet: switch or fibre.",warn:"Takes a normal RJ45 plug too — the shell is the extra."},
  {id:"xlr5",g:"data",name:"DMX512 (XLR-5)",carries:"Lighting control data, 512 channels per universe (RS-485)",use:"Lighting desks → dimmers, LEDs, moving heads.",len:[100,300],far:"DMX splitter/booster, or Art-Net / sACN over Ethernet.",
    warn:"Daisy-chain fixtures (max ~32 per line) and put a 120 Ω terminator on the last one. Many fixtures use 3-pin XLR: same data, still not audio."},
  {id:"lemo",g:"data",name:"LEMO 5-pin (timecode)",carries:"Timecode (LTC) in/out",use:"Cinema cameras, sound recorders, sync boxes.",len:[10,100],far:"LTC is an audio-like signal: it runs like line audio.",warn:"Push-pull lock: pull the outer sleeve to release — never twist. Align the red dots."},
  {id:"bncsync",g:"data",draw:"bnc",name:"Genlock / sync (BNC)",carries:"Reference signal (black burst / tri-level) to lock cameras together",use:"Multicamera studios: every camera, switcher and recorder in step.",len:[100,300],far:"Sync distribution amplifiers.",warn:"Same BNC as SDI: label your cables!"},
  {id:"xlr4",g:"power",name:"XLR-4 (12 V DC)",carries:"DC power (pin 1 −, pin 4 +)",use:"Field monitors, older cameras, recorders.",len:[2,5],far:"Battery closer to the device; low voltage drops fast.",warn:"Same shell family as XLR audio, 4 pins: power, not audio."},
  {id:"dtap",g:"power",name:"D-Tap (P-Tap)",carries:"Unregulated battery voltage (≈ 12–16.8 V)",use:"Powering accessories from V-Mount/Gold Mount batteries.",len:[1,2],far:"Keep it short; use regulated power for sensitive gear.",warn:"Old D-Tap plugs can be inserted the wrong way round on some sockets — check polarity on cheap gear."},
  {id:"vmount",g:"power",name:"V-Mount / Gold Mount",carries:"Battery → camera (14.4 V nominal)",use:"Cinema & broadcast cameras, lights, monitors.",len:[0.3,0.3],far:"—",warn:"Airlines limit lithium batteries over 100 Wh (and ban over 160 Wh) in the cabin."},

  {id:"schuko",g:"power",name:"Schuko (CEE 7/4, 230 V 16 A)",carries:"Mains power, single phase",use:"Everyday sockets in Spain & most of Europe.",len:[25,50],far:"Thicker cable: 1.5 mm² ≈ 30 m, 2.5 mm² ≈ 50 m at full 16 A (5 % voltage drop).",warn:"Earth is the metal clips at the top and bottom. Don't daisy-chain extension blocks."},
  {id:"iec",g:"power",name:"IEC C13 / C14 ('kettle')",carries:"Mains to equipment, 10 A",use:"Computers, monitors, mixers, most rack gear.",len:[2,5],far:"Use a proper extension, not chained cords.",warn:"C13 is the cable end, C14 the socket on the device. The hot C15 has a notch (for kettles)."},
  {id:"powercon",g:"power",name:"powerCON (NAC3)",carries:"Mains to equipment, 20 A, locking",use:"Lights, speakers, LED walls (blue = power in, grey = link out).",len:[25,40],far:"As mains: thicker cable or a distro closer to the load.",warn:"Locks with a twist. The original blue/grey is NOT for plugging/unplugging under load — that's TRUE1."},
  {id:"true1",g:"power",name:"powerCON TRUE1",carries:"Mains, 16 A, can be connected/disconnected live",use:"Modern lights, speakers and LED walls; link-through.",len:[25,40],far:"As mains.",warn:"Black with a yellow ring. Compatible only with TRUE1 (not with blue/grey NAC3)."},
  {id:"cee16",g:"power",name:"CEE 16/32 A single-phase (blue)",carries:"230 V mains, 16 or 32 A, weatherproof",use:"Location power, generators, camping, larger lights.",len:[50,100],far:"Thicker cable or a distro box nearer the lights.",warn:"Colour = voltage: blue 230 V, red 400 V, yellow 110 V (site tools). The big pin is earth."},
  {id:"cee3",g:"power",name:"CEE 3-phase (red, 5 pins)",carries:"400 V three-phase: L1 + L2 + L3 + N + earth",use:"Generators, dimmer racks, power distros on big shoots and events.",len:[50,125],far:"32 A on 6 mm² ≈ 125 m (5 % drop); go thicker for more.",
    warn:"Only for qualified people. A distro splits it into single-phase 230 V outlets — spread the load over the three phases."},
  {id:"soca",g:"power",name:"Socapex (19-pin)",carries:"6 separate power circuits in one cable",use:"Lighting rigs: from dimmers/distros up to the truss, then a breakout.",len:[25,50],far:"As mains, per circuit.",warn:"Heavy and multi-circuit: always use the matching breakout, label the circuits."},
];
CONN.forEach(c=>{ if(!c.draw) c.draw=c.id; });

function Face({id,size=1}){
  return <svg viewBox="0 0 100 70" style={{width:"100%",height:"auto",display:"block",maxHeight:180*size}}>{D[id]}</svg>;
}

/* ------------------------------------------------------------------ 1 · GALLERY */
function Gallery(){
  const [g,setG]=useState("all"); const [sel,setSel]=useState("bnc");
  const list=CONN.filter(c=>g==="all"||c.g===g); const c=CONN.find(x=>x.id===sel)||CONN[0]; const col=GROUPS[c.g].c;
  return (
    <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"flex-start"}}>
      <div style={{flex:"2 1 640px",minWidth:320}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
          <button style={sBtn(g==="all")} onClick={()=>setG("all")}>All ({CONN.length})</button>
          {Object.entries(GROUPS).map(([k,v])=><button key={k} style={sBtn(g===k,v.c)} onClick={()=>setG(k)}>{v.l} ({CONN.filter(x=>x.g===k).length})</button>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(104px,1fr))",gap:6}}>
          {list.map(x=>{ const on=x.id===sel, cc=GROUPS[x.g].c; return (
            <button key={x.id} onClick={()=>setSel(x.id)} style={{background:on?cc+"18":C.card,border:`1px solid ${on?cc:C.line}`,borderRadius:8,padding:"4px 5px 5px",cursor:"pointer",textAlign:"center"}}>
              <Face id={x.draw} size={0.3}/>
              <div style={{color:on?cc:C.text,fontSize:11,lineHeight:1.2,marginTop:2,height:"2.4em",overflow:"hidden"}}>{x.name}</div>
            </button>); })}
        </div>
      </div>
      <div style={{...panel,flex:"1 1 340px",minWidth:300,borderTop:`3px solid ${col}`,position:"sticky",top:12}}>
        <div style={{color:col,fontSize:11,fontFamily:"monospace",letterSpacing:".08em",textTransform:"uppercase"}}>{GROUPS[c.g].l}</div>
        <div style={{color:C.text,fontWeight:"bold",fontSize:17,margin:"2px 0 8px"}}>{c.name}</div>
        <div style={{background:"#0c0d11",borderRadius:8,padding:"8px 18px"}}><Face id={c.draw}/></div>
        <div style={{display:"grid",gridTemplateColumns:"84px 1fr",gap:"6px 10px",fontSize:12.8,color:"#c4c7cf",lineHeight:1.5,marginTop:10}}>
          <span style={{color:C.muted}}>Carries</span><span>{c.carries}</span>
          <span style={{color:C.muted}}>Used for</span><span>{c.use}</span>
          <span style={{color:C.muted}}>Length</span><span style={{fontFamily:"monospace"}}>{c.len[1]>=0.5&&c.far!=="—"?<>typ. {fmtM(c.len[0])} · max ≈ {fmtM(c.len[1])}</>:"on the device"}</span>
          {c.far!=="—" && <><span style={{color:C.muted}}>Further</span><span>{c.far}</span></>}
        </div>
        <div style={{marginTop:10,padding:"8px 10px",borderRadius:8,background:"#ff5a4d12",border:"1px solid #ff5a4d44",color:"#f3c2bd",fontSize:12.5,lineHeight:1.5}}>⚠ {c.warn}</div>
      </div>
    </div>
  );
}
const fmtM=(m)=>m>=1000?(m/1000)+" km":m+" m";

/* ------------------------------------------------------------------ 2 · LENGTHS */
function Lengths(){
  const ref=useRef(null); const [g,setG]=useState("all"); const [rt,setRt]=useState(0); const [hover,setHover]=useState(null);
  useEffect(()=>{ let id; const on=()=>{ clearTimeout(id); id=setTimeout(()=>setRt(v=>v+1),120); }; window.addEventListener("resize",on); return ()=>window.removeEventListener("resize",on); },[]);
  const rows=useMemo(()=>CONN.filter(c=>(g==="all"||c.g===g)&&c.far!=="—"&&c.id!=="ethercon"&&c.id!=="aes"&&c.id!=="hdmiMini").sort((a,b)=>a.len[1]-b.len[1]),[g]);
  const rowH=g==="all"?16:24, top=26, bottom=24;
  useEffect(()=>{
    const c=ref.current; if(!c) return; const pe=c.parentElement, cs=getComputedStyle(pe);
    const W=Math.max(320,pe.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)), Hh=top+rows.length*rowH+bottom;
    const dpr=window.devicePixelRatio||1; c.width=W*dpr; c.height=Hh*dpr; c.style.width=W+"px"; c.style.height=Hh+"px";
    const x=c.getContext("2d"); x.setTransform(dpr,0,0,dpr,0,0); x.fillStyle="#0c0d11"; x.fillRect(0,0,W,Hh);
    const L=190, R=20, lo=Math.log10(0.5), hi=Math.log10(15000), X=(m)=>L+(Math.log10(m)-lo)/(hi-lo)*(W-L-R);
    x.font="11px monospace"; x.textAlign="center";
    [1,2,5,10,20,50,100,200,500,1000,2000,10000].forEach(m=>{ x.strokeStyle=[1,10,100,1000,10000].includes(m)?"#2a2d36":"#1a1c22"; x.beginPath(); x.moveTo(X(m),top-6); x.lineTo(X(m),Hh-bottom+2); x.stroke();
      x.fillStyle=C.muted2; x.fillText(fmtM(m),X(m),Hh-8); });
    // zones
    [[0.5,5,"in the room"],[5,100,"across the set / studio"],[100,15000,"building · campus · city"]].forEach(([a,b,l])=>{ x.fillStyle="#8a8a94"; x.font="10.5px sans-serif"; x.fillText(l,(X(a)+X(b))/2,14); });
    rows.forEach((r,i)=>{ const y=top+i*rowH, col=GROUPS[r.g].c, hv=hover===i;
      if(hv){ x.fillStyle="#ffffff0c"; x.fillRect(0,y,W,rowH); }
      x.fillStyle=hv?C.text:"#c4c7cf"; x.font=`${g==="all"?11:12.5}px sans-serif`; x.textAlign="right"; x.fillText(r.name.replace(/ \(.*\)$/,""),L-10,y+rowH*0.68);
      const bh=rowH*0.55, by=y+(rowH-bh)/2;
      x.fillStyle=col+"40"; x.fillRect(X(0.5),by,X(r.len[1])-X(0.5),bh);
      x.fillStyle=col; x.fillRect(X(0.5),by,X(r.len[0])-X(0.5),bh);
      x.fillStyle=C.text; x.font="10.5px monospace"; x.textAlign="left"; x.fillText(fmtM(r.len[1]),X(r.len[1])+5,y+rowH*0.68); });
  },[rows,rowH,hover,rt]);
  const onMove=(e)=>{ const r=e.currentTarget.getBoundingClientRect(); const i=Math.floor((e.clientY-r.top-top)/rowH); setHover(i>=0&&i<rows.length?i:null); };
  const h=hover!=null?rows[hover]:null;
  return (
    <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"flex-start"}}>
      <div style={{...panel,flex:"2 1 640px",minWidth:320,padding:"10px 12px"}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
          <button style={sBtn(g==="all")} onClick={()=>setG("all")}>All</button>
          {Object.entries(GROUPS).map(([k,v])=><button key={k} style={sBtn(g===k,v.c)} onClick={()=>setG(k)}>{v.l}</button>)}
          <span style={{color:C.muted,fontSize:11.5,marginLeft:"auto",alignSelf:"center"}}>solid = typical · light = maximum (passive cable) · log scale</span>
        </div>
        <canvas ref={ref} style={{display:"block"}} onMouseMove={onMove} onMouseLeave={()=>setHover(null)}/>
      </div>
      <div style={{...panel,flex:"1 1 320px",minWidth:290}}>
        {h ? <>
          <div style={{color:GROUPS[h.g].c,fontSize:11,fontFamily:"monospace",textTransform:"uppercase"}}>{GROUPS[h.g].l}</div>
          <div style={{color:C.text,fontWeight:"bold",fontSize:15,margin:"2px 0 6px"}}>{h.name}</div>
          <div style={{maxWidth:200}}><Face id={h.draw} size={0.6}/></div>
          <div style={{fontFamily:"monospace",fontSize:13,color:C.text,margin:"6px 0"}}>typ. {fmtM(h.len[0])} · max ≈ {fmtM(h.len[1])}</div>
          <div style={{color:"#c4c7cf",fontSize:12.8,lineHeight:1.55}}><strong>To go further:</strong> {h.far}</div>
        </> : <>
          <div style={{color:C.text,fontWeight:"bold",fontSize:14,marginBottom:6}}>Why cables have a limit</div>
          <div style={{color:"#b8bcc6",fontSize:12.8,lineHeight:1.65}}>
            <strong style={{color:"#60a5fa"}}>Fast digital signals</strong> (HDMI, USB, 12G-SDI) lose their high frequencies along the cable: past the limit the receiver can't read the bits — sparkles, drop-outs, then black.<br/>
            <strong style={{color:"#f472b6"}}>Analogue audio</strong>: balanced lines (XLR) cancel the hum they pick up, so they run 100 m; unbalanced (guitar jack, RCA) don't, so keep them short.<br/>
            <strong style={{color:"#2dd4bf"}}>Networks</strong>: Ethernet is 100 m per copper run — then a switch, or fibre.<br/>
            <strong style={{color:"#facc15"}}>Power</strong>: the signal doesn't die, the <em>voltage drops</em> (a long thin cable heats up and the lamp gets less). Longer run → thicker cable. Values here: full load, ≤ 5 % drop.<br/>
            <span style={{color:C.muted}}>Hover a bar to see how to go further. Values are typical guides; real limits depend on the cable quality and the signal.</span>
          </div>
        </>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 3 · QUIZ */
const shuffle=(a)=>{ const b=[...a]; for(let i=b.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; } return b; };
function newQ(prev){
  const pool=CONN.filter(c=>c.id!=="aes"&&c.id!=="bncsync"&&c.id!==prev);
  const ans=pool[Math.floor(Math.random()*pool.length)];
  const same=shuffle(pool.filter(c=>c.id!==ans.id&&c.g===ans.g)), other=shuffle(pool.filter(c=>c.id!==ans.id&&c.g!==ans.g));
  return {ans, opts:shuffle([ans,...same.slice(0,2),...other.slice(0,1)]), picked:null};
}
function Quiz(){
  const [q,setQ]=useState(()=>newQ()); const [score,setScore]=useState([0,0]);
  const pick=(o)=>{ if(q.picked) return; setQ({...q,picked:o.id}); setScore(([a,b])=>[a+(o.id===q.ans.id?1:0),b+1]); };
  const right=q.picked===q.ans.id;
  return (
    <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"stretch"}}>
      <div style={{...panel,flex:"1 1 460px",minWidth:300,display:"flex",flexDirection:"column",alignItems:"center"}}>
        <div style={{color:C.muted,fontSize:13,alignSelf:"flex-start"}}>Which connector is this?</div>
        <div style={{width:"min(100%,440px)",background:"#0c0d11",borderRadius:10,padding:"16px 30px",margin:"10px 0"}}><Face id={q.ans.draw} size={1.6}/></div>
        <div style={{fontFamily:"monospace",color:C.text,fontSize:13}}>Score: <span style={{color:"#34d399"}}>{score[0]}</span> / {score[1]}</div>
      </div>
      <div style={{...panel,flex:"1 1 420px",minWidth:300}}>
        <div style={{display:"grid",gap:8}}>
          {q.opts.map(o=>{ const st=q.picked ? (o.id===q.ans.id?"ok":(o.id===q.picked?"bad":"")) : "";
            return <button key={o.id} onClick={()=>pick(o)} style={{textAlign:"left",padding:"10px 14px",borderRadius:8,cursor:q.picked?"default":"pointer",fontSize:14,
              border:`1px solid ${st==="ok"?"#34d399":st==="bad"?C.accent:C.line}`,background:st==="ok"?"#34d39922":st==="bad"?"#ff5a4d22":C.card,color:C.text}}>{o.name}</button>; })}
        </div>
        {q.picked && <div style={{marginTop:12,padding:"10px 12px",borderRadius:8,background:"#0f1014",border:`1px solid ${C.line}`,color:"#c4c7cf",fontSize:13,lineHeight:1.55}}>
          <strong style={{color:right?"#34d399":C.accent}}>{right?"Correct!":`It's ${q.ans.name}.`}</strong> {q.ans.carries}. {q.ans.use}
          <div style={{marginTop:6,color:"#f3c2bd"}}>⚠ {q.ans.warn}</div>
        </div>}
        <button style={{...sBtn(true),marginTop:12,padding:"8px 16px",fontSize:13.5}} onClick={()=>setQ(newQ(q.ans.id))}>{q.picked?"Next →":"Skip →"}</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ module */
const TABS=[["gallery","1 · Gallery"],["lengths","2 · How far can it go?"],["quiz","3 · Quiz"]];
export default function Connectors(){
  const [tab,setTab]=useState("gallery");
  return (
    <div>
      <div role="tablist" style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,borderBottom:`1px solid ${C.line}`,paddingBottom:10}}>
        {TABS.map(([id,l])=><button key={id} role="tab" aria-selected={tab===id} onClick={()=>setTab(id)} style={{...sBtn(tab===id),padding:"7px 14px",fontSize:13,fontWeight:tab===id?"bold":"normal"}}>{l}</button>)}
        <span style={{color:C.muted,fontSize:12,alignSelf:"center",marginLeft:8}}>{CONN.length} connectors · faces drawn as you see them looking into the cable end</span>
      </div>
      {tab==="gallery" && <Gallery/>}
      {tab==="lengths" && <Lengths/>}
      {tab==="quiz" && <Quiz/>}
    </div>
  );
}
