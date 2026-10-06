// Lighting Studio — a self-contained three.js portrait / film-set lighting sandbox.
//
//   import { createLightingStudio } from './lighting-studio.js';
//   const studio = await createLightingStudio(container, { subject: 'bust', preset: 'three-point' });
//
// Framework-agnostic: no UI of its own (the host draws the controls and calls this API), no global
// state between instances, everything it needs is bundled (CC0 models in ./assets). `three` is a peer
// dependency imported by bare specifier ('three', 'three/addons/...').
//
// Conventions: metres, degrees. The subject stands at the origin facing +Z (towards the default
// camera). Angles around it: azimuth 0 = in front (camera side), +90 = camera's right, 180 = behind;
// elevation 0 = level, +90 = straight above.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const asset = (name) => new URL(`./assets/${name}.glb`, import.meta.url).href;

/** Subjects bundled with the module. `target` = the point lights and camera aim at (m). */
const SUBJECTS = {
  bust: { name: 'Marble bust', target: [0, 1.25, 0], view: { az: 0, el: 3, dist: 3.2, focal: 85 }, credit: 'Marble Bust 01 — Poly Haven (CC0)' },
  'living-room': { name: 'Film set: living room', target: [0, 0.75, -0.95], view: { az: 12, el: 8, dist: 4.6, focal: 35 },
    credit: 'Sofa, armchair, coffee table, side table, oil lamp, shelves, frame, plant, vase, nightstand — Poly Haven (CC0); rug texture: Floral Jacquard, Poly Haven (CC0)' },
};

// Classic lighting schemes. `turn` = the subject turned (deg, + = towards camera right), `world` = studio
// settings the scheme needs (dark / white background). Names and descriptions in Spanish and English.
const KEY_SOFT = { type: 'area', size: 0.8, shadow: { on: true, softness: 0.6 } };
const KEY_HARD = { type: 'spot', cone: 40, softness: 0.4, shadow: { on: true, softness: 0.15 } };
const FILL = { role: 'fill', type: 'area', size: 1, shadow: { on: false } };
const DEFAULT_WORLD = { ambient: 0.06, backdrop: '#7d7f84' };
const PRESETS = {
  'three-point': { es: ['Tres puntos', 'Principal suave a 45°, relleno débil al otro lado y contraluz que separa del fondo.'],
    en: ['Three-point', 'Soft key at 45°, weak fill on the other side, back light separating from the background.'],
    lights: [{ role: 'key', ...KEY_SOFT, az: 45, el: 30, dist: 1.8, intensity: 1 },
      { ...FILL, az: -50, el: 10, dist: 2.2, intensity: 0.3 },
      { role: 'back', type: 'spot', az: 155, el: 40, dist: 2, intensity: 0.9, cone: 30, softness: 0.3, shadow: { on: true, softness: 0.1 } }] },
  rembrandt: { es: ['Rembrandt', 'Principal alta y lateral: la sombra de la nariz se une a la de la mejilla y deja un triángulo de luz bajo el ojo.'],
    en: ['Rembrandt', 'High side key: the nose shadow meets the cheek shadow, leaving a triangle of light under the far eye.'],
    lights: [{ role: 'key', ...KEY_HARD, az: 50, el: 42, dist: 2, intensity: 1.1 }, { ...FILL, az: -40, el: 5, dist: 2.5, intensity: 0.12 }] },
  loop: { es: ['Loop', 'Principal algo ladeada y alta: la sombra de la nariz forma un pequeño lazo hacia la mejilla. El retrato «de diario».'],
    en: ['Loop', 'Key slightly off-axis and high: the nose shadow makes a small loop towards the cheek. The everyday portrait.'],
    lights: [{ role: 'key', ...KEY_SOFT, az: 30, el: 25, dist: 1.8, intensity: 1 }, { ...FILL, az: -45, el: 5, dist: 2.4, intensity: 0.25 }] },
  butterfly: { es: ['Mariposa (Paramount)', 'Principal de frente y por encima de la cámara: sombra en forma de mariposa bajo la nariz. Glamour clásico de Hollywood.'],
    en: ['Butterfly (Paramount)', 'Key straight in front, above the camera: butterfly-shaped shadow under the nose. Classic Hollywood glamour.'],
    lights: [{ role: 'key', ...KEY_HARD, az: 0, el: 45, dist: 1.8, intensity: 1.1 }] },
  clamshell: { es: ['Clamshell (concha)', 'Mariposa suave con un relleno desde abajo (reflector): sombras muy abiertas, piel uniforme. Belleza y moda.'],
    en: ['Clamshell', 'Soft butterfly plus a fill from below (reflector): very open shadows, even skin. Beauty and fashion.'],
    lights: [{ role: 'key', ...KEY_SOFT, az: 0, el: 40, dist: 1.5, intensity: 1 }, { ...FILL, az: 0, el: -25, dist: 1.2, intensity: 0.35, size: 0.7 }] },
  split: { es: ['Split (partida)', 'Luz a 90°: exactamente media cara iluminada y media en sombra. Dramática, misteriosa.'],
    en: ['Split', 'A light at 90°: exactly half the face lit, half in shadow. Dramatic, mysterious.'],
    lights: [{ role: 'key', ...KEY_HARD, az: 90, el: 5, dist: 1.8, intensity: 1.1 }] },
  broad: { es: ['Broad (amplia)', 'Cara girada; la principal ilumina el lado que mira a cámara. Ensancha el rostro.'],
    en: ['Broad', 'Face turned; the key lights the side facing the camera. Widens the face.'],
    turn: 30, lights: [{ role: 'key', ...KEY_SOFT, az: 60, el: 30, dist: 1.8, intensity: 1 }, { ...FILL, az: -30, el: 5, dist: 2.4, intensity: 0.2 }] },
  short: { es: ['Short (corta)', 'Cara girada; la principal ilumina el lado más alejado de cámara. Estiliza y da volumen.'],
    en: ['Short', 'Face turned; the key lights the side away from the camera. Slims the face, adds depth.'],
    turn: -30, lights: [{ role: 'key', ...KEY_SOFT, az: 60, el: 30, dist: 1.8, intensity: 1 }, { ...FILL, az: -40, el: 5, dist: 2.4, intensity: 0.15 }] },
  rim: { es: ['Recorte (rim)', 'Dos contraluces a los lados por detrás: solo se dibuja el contorno. Separa del fondo oscuro.'],
    en: ['Rim', 'Two back lights from behind on each side: only the outline is drawn. Separates from a dark background.'],
    lights: [{ role: 'rim', type: 'spot', az: 135, el: 20, dist: 1.8, intensity: 1.2, cone: 30, softness: 0.3, shadow: { on: false } },
      { role: 'rim', type: 'spot', az: -135, el: 20, dist: 1.8, intensity: 1.2, cone: 30, softness: 0.3, shadow: { on: false } }],
    world: { ambient: 0, backdrop: '#2a2b2e' } },
  'low-key': { es: ['Clave baja', 'Una sola luz dura y lateral, sin relleno y fondo oscuro: claroscuro, mucho contraste.'],
    en: ['Low key', 'One hard side light, no fill, dark background: chiaroscuro, high contrast.'],
    lights: [{ role: 'key', ...KEY_HARD, az: 70, el: 35, dist: 1.8, intensity: 1.1, cone: 30 }],
    world: { ambient: 0, backdrop: '#1d1d20' } },
  'high-key': { es: ['Clave alta', 'Luz suave y abundante, relleno fuerte y fondo blanco iluminado: casi sin sombras.'],
    en: ['High key', 'Soft, plentiful light, strong fill and a lit white background: hardly any shadows.'],
    lights: [{ role: 'key', ...KEY_SOFT, az: 25, el: 25, dist: 1.6, intensity: 1, size: 1.2 }, { ...FILL, az: -35, el: 10, dist: 1.8, intensity: 0.6, size: 1.2 },
      { role: 'background', type: 'area', az: 0, el: 20, dist: 1.6, target: [0, 1.4, -3.4], intensity: 1.6, size: 2, shadow: { on: false } }],
    world: { ambient: 0.25, backdrop: '#f2f2f2' } },
  window: { es: ['Luz de ventana', 'Una fuente grande y suave desde un lado a la altura de la cara, como una ventana: caída de luz muy gradual.'],
    en: ['Window light', 'One large soft source from the side at face height, like a window: very gradual fall-off.'],
    lights: [{ role: 'key', type: 'area', az: 80, el: 10, dist: 1.5, intensity: 1, size: 1.6, shadow: { on: true, softness: 0.9 } }] },
  under: { es: ['Contrapicado (de terror)', 'Luz desde abajo: las sombras suben, efecto antinatural y siniestro.'],
    en: ['Under light (horror)', 'Light from below: shadows go upwards, an unnatural, sinister look.'],
    lights: [{ role: 'key', ...KEY_HARD, az: 10, el: -40, dist: 1.5, intensity: 1 }],
    world: { ambient: 0.02, backdrop: '#3a3b3f' } },
  silhouette: { es: ['Silueta', 'Solo se ilumina el fondo; el sujeto queda como una forma oscura recortada.'],
    en: ['Silhouette', 'Only the background is lit; the subject stays a dark shape against it.'],
    lights: [{ role: 'background', type: 'spot', az: 0, el: 25, dist: 1.8, target: [0, 1.4, -3.4], intensity: 1.6, cone: 90, softness: 0.9, shadow: { on: false } }],
    world: { ambient: 0.02 } },
};

const DEFAULT_LIGHT = { type: 'spot', role: '', kelvin: 5600, color: null, intensity: 1, az: 45, el: 30, dist: 2,
  cone: 40, softness: 0.4, size: 0.8, shadow: { on: true, softness: 0.3 } };
// Physical scale: intensity 1 at 2 m ≈ a well exposed key (E = I/d² ≈ 3). Moving a light away darkens
// it by the inverse-square law, on purpose.
const CANDELA = 12, SUN_LUX = 3;

/** Colour temperature (K) → RGB (Tanner Helland's fit). */
function kelvinColor(k) {
  const t = k / 100;
  const r = t <= 66 ? 255 : 329.7 * (t - 60) ** -0.1332;
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * (t - 60) ** -0.0755;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  const c = (x) => Math.min(255, Math.max(0, x)) / 255;
  return new THREE.Color().setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
}

let rectAreaReady = false;

export async function createLightingStudio(container, opts = {}) {
  if (!rectAreaReady) { RectAreaLightUniformsLib.init(); rectAreaReady = true; }
  const listeners = new Map();
  // Render on demand: nothing is drawn unless something changed (keeps sliders and the page responsive).
  let frames = 2, shadowsDirty = true, meterDirty = true, notify = true;
  const invalidate = (shadows = false) => { frames = 2; notify = true; if (shadows) { shadowsDirty = true; meterDirty = true; } };
  const emit = (name, detail) => { invalidate(name === 'change'); (listeners.get(name) || []).forEach((cb) => { try { cb(detail); } catch (e) { console.error(e); } }); };

  // ---- renderer / scene ------------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;   // blurrable: hard → soft shadows per light
  renderer.shadowMap.autoUpdate = false;           // shadow maps are redrawn only when lights/subject change
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;position:absolute;touch-action:none';
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.style.overflow = 'hidden';
  container.appendChild(canvas);
  // the camera monitor (picture in picture) and the framing guides: plain 2D overlays
  const pip = document.createElement('canvas');
  pip.style.cssText = 'position:absolute;right:10px;bottom:10px;border:1px solid rgba(255,255,255,.35);border-radius:4px;cursor:pointer;background:#000;box-shadow:0 2px 12px rgba(0,0,0,.5)';
  pip.title = 'Click to swap views';
  const pipCtx = pip.getContext('2d');
  const guides = document.createElement('div');
  guides.style.cssText = 'position:absolute;pointer-events:none;box-sizing:border-box;border:1px solid rgba(255,255,255,.25)';
  guides.innerHTML = '<svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 3 3" style="position:absolute;inset:0"><path d="M1 0V3M2 0V3M0 1H3M0 2H3" stroke="rgba(255,255,255,.28)" stroke-width="0.008" vector-effect="non-scaling-stroke" fill="none"/></svg>';
  // The monitor floats in the corner of the view, or lives in a host element (opts.monitorElement, e.g. at the
  // top of a side panel — then it is as wide as that element).
  const monitorHost = opts.monitorElement || null;
  if (monitorHost) { pip.style.cssText = 'display:block;width:100%;border-radius:6px;cursor:pointer;background:#000'; monitorHost.append(pip); container.append(guides); }
  else container.append(guides, pip);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.background || '#0c0c0e');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  const world = { ambient: 0.06, exposure: 0, backdrop: opts.backdrop || '#7d7f84' };
  scene.environmentIntensity = world.ambient;

  // Two cameras: `camera` = the PHOTO camera (focal, sensor, aspect, DoF — what the picture looks like) and
  // `studioCam` = a free look around the studio (to place lights). The main view shows one of them and the
  // monitor (picture in picture) the other.
  const camera = new THREE.PerspectiveCamera(30, 1.5, 0.05, 200);
  camera.filmGauge = 36;                       // full frame by default
  camera.setFocalLength(85);
  const studioCam = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
  const targets = { camera: new THREE.Vector3(), studio: new THREE.Vector3() };
  let view = opts.view === 'camera' ? 'camera' : 'studio', photoAspect = 3 / 2, showGuides = true, showMonitor = true;
  const viewCam = () => (view === 'camera' ? camera : studioCam);
  const controls = new OrbitControls(view === 'camera' ? camera : studioCam, canvas);
  controls.target = targets[view];
  controls.enableDamping = true; controls.dampingFactor = 0.12;
  controls.zoomToCursor = true;
  controls.minDistance = 0.3; controls.maxDistance = 25;
  controls.maxPolarAngle = Math.PI * 0.95;
  // Blender-style mouse (as in SetFrameR): middle = orbit, Shift+middle = pan, right = pan, wheel = zoom to
  // the cursor; left orbits too (laptops) — except on a light handle, where it drags the light.
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN };
  canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });   // no autoscroll

  // Keyboard (while the pointer is over the view): W A S D = walk, Q / E = down / up, Shift = slow,
  // Alt = fast; 1 / 3 = front / right view (Ctrl = back / left), Home = frame the subject.
  const keys = new Set();
  let hover = false;
  container.addEventListener('pointerenter', () => { hover = true; });
  container.addEventListener('pointerleave', () => { hover = false; keys.clear(); });
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
  function onKeyDown(e) {
    if (!hover || typing(e) || e.metaKey) return;
    const k = e.code;
    if (/^Key[WASDQE]$/.test(k)) { keys.add(k); e.preventDefault(); invalidate(); return; }
    if (k === 'ShiftLeft' || k === 'ShiftRight' || k === 'AltLeft' || k === 'AltRight') return;
    const az = { Digit1: 0, Numpad1: 0, Digit3: 90, Numpad3: 90 }[k];
    if (az !== undefined || k === 'Home') {
      e.preventDefault();
      const cam = viewCam(), t = targets[view], d = Math.max(1.5, cam.position.distanceTo(t));
      if (k === 'Home') { t.copy(subjectTarget); cam.position.sub(t).setLength(view === 'camera' ? d : Math.max(d, 4)).add(t); }
      else cam.position.copy(sph(az + (e.ctrlKey ? 180 : 0), 8, d, t));
      cam.lookAt(t); controls.update(); camDirty = true; invalidate();
    }
  }
  const onKeyUp = (e) => keys.delete(e.code);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  const flyClock = new THREE.Clock();
  function fly() {
    const dt = Math.min(flyClock.getDelta(), 0.1);
    if (!keys.size) return;
    const cam = viewCam(), t = targets[view];
    const fwd = t.clone().sub(cam.position); fwd.y = 0;
    if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, -1);
    fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x), mv = new THREE.Vector3();
    if (keys.has('KeyW')) mv.add(fwd); if (keys.has('KeyS')) mv.sub(fwd);
    if (keys.has('KeyD')) mv.add(right); if (keys.has('KeyA')) mv.sub(right);
    if (keys.has('KeyE')) mv.y += 1; if (keys.has('KeyQ')) mv.y -= 1;
    if (!mv.lengthSq()) return;
    const speed = 1.6 * (keys.shift ? 0.25 : 1) * (keys.alt ? 3 : 1);
    mv.normalize().multiplyScalar(speed * dt);
    cam.position.add(mv); t.add(mv);
    camDirty = true; invalidate();
  }
  const onMods = (e) => { keys.shift = e.shiftKey; keys.alt = e.altKey; };
  window.addEventListener('keydown', onMods); window.addEventListener('keyup', onMods);

  const overlay = new THREE.Group();            // light handles: drawn after the post chain, sharp
  scene.add(overlay);
  const content = new THREE.Group();            // studio + subject (everything that is "real")
  scene.add(content);

  // ---- studio: an infinity cove (floor curving up into the back wall) ----------------------------
  const backdropMat = new THREE.MeshStandardMaterial({ color: world.backdrop, roughness: 0.95 });
  const cove = new THREE.Mesh(coveGeometry(), backdropMat);
  cove.receiveShadow = true;
  content.add(cove);

  // ---- subjects ----------------------------------------------------------------------------------
  const loader = new GLTFLoader();
  const subjects = { ...SUBJECTS };          // + 'custom' when the user imports a model
  let customGroup = null;
  const loaded = new Map();
  const loadGlb = (name) => loaded.get(name) || (loaded.set(name, loader.loadAsync(asset(name)).then((g) => g.scene)), loaded.get(name));
  const subjectRoot = new THREE.Group();
  content.add(subjectRoot);
  let subjectId = null, subjectTarget = new THREE.Vector3(0, 1.3, 0);
  const plaster = new THREE.MeshStandardMaterial({ color: '#b9b6b0', roughness: 0.85 });

  async function buildSubject(id) {
    const g = new THREE.Group();
    if (id === 'bust') {
      g.add(pedestal(0.87));
      const bust = (await loadGlb('marble_bust_01')).clone();
      bust.position.y = 0.87;
      g.add(bust);
    } else if (id === 'living-room') {
      // a corner of a film set: a painted flat behind, rug, sofa, armchair, practical lamp…
      const names = ['Sofa_01', 'ArmChair_01', 'CoffeeTable_01', 'side_table_01', 'vintage_oil_lamp', 'wooden_display_shelves_01',
        'hanging_picture_frame_02', 'potted_plant_04', 'ClassicNightstand_01', 'ceramic_vase_01'];
      const m = Object.fromEntries(names.map((n, i) => [n, null]));
      (await Promise.all(names.map(loadGlb))).forEach((o, i) => { m[names[i]] = o; });
      /** Put a copy standing on height y, centred on (x, z) after turning it by rotY. */
      const place = (o, x, z, rotY = 0, y = 0) => {
        const c = o.clone(); c.rotation.y = rotY; c.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(c), ctr = box.getCenter(new THREE.Vector3());
        c.position.set(x - ctr.x, y - box.min.y, z - ctr.z);
        g.add(c); return c;
      };
      const wallMat = new THREE.MeshStandardMaterial({ color: '#5d6b62', roughness: 0.9 });
      const wall = new THREE.Mesh(new THREE.BoxGeometry(9, 2.9, 0.08), wallMat);
      wall.position.set(0, 1.45, -1.55); g.add(wall);
      const skirting = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.1), new THREE.MeshStandardMaterial({ color: '#e8e2d6', roughness: 0.6 }));
      skirting.position.set(0, 0.06, -1.5); g.add(skirting);
      const floor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.02, 5), new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.55 }));
      floor.position.set(0, 0.01, 0.95); g.add(floor);
      const rugTex = await new THREE.TextureLoader().loadAsync(new URL('./assets/rug_diff.jpg', import.meta.url).href);
      rugTex.colorSpace = THREE.SRGBColorSpace; rugTex.wrapS = rugTex.wrapT = THREE.RepeatWrapping; rugTex.repeat.set(2.5, 1.7);
      const rug = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.012, 1.8), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.95 }));
      rug.position.set(0, 0.026, -0.2); g.add(rug);
      place(m.Sofa_01, 0, -1.05, 0, 0.032);
      place(m.ArmChair_01, 1.45, -0.25, -1.0, 0.032);
      place(m.CoffeeTable_01, 0, 0.05, 0, 0.032).scale.setScalar(0.8);
      place(m.side_table_01, -1.2, -1.15, 0);
      place(m.vintage_oil_lamp, -1.2, -1.15, 0.3, 0.548);
      place(m.wooden_display_shelves_01, 2.15, -1.3, -Math.PI / 2);
      place(m.potted_plant_04, 2.15, -1.3, 0, 1.17);
      place(m.ClassicNightstand_01, -2.0, -1.25, 0);
      place(m.ceramic_vase_01, -2.0, -1.25, 0.4, 0.7);
      const frame = m.hanging_picture_frame_02.clone(); frame.position.set(0, 1.65, -1.51); g.add(frame);
      // the frame comes empty: paint a little dusk landscape for it (generated, no asset)
      const pc = Object.assign(document.createElement('canvas'), { width: 512, height: 320 }), x = pc.getContext('2d');
      const sky = x.createLinearGradient(0, 0, 0, 320); sky.addColorStop(0, '#2c3e64'); sky.addColorStop(0.55, '#d98c5f'); sky.addColorStop(1, '#3b2f2a');
      x.fillStyle = sky; x.fillRect(0, 0, 512, 320);
      x.fillStyle = '#f3d27a'; x.beginPath(); x.arc(330, 175, 22, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#2a2622'; x.beginPath(); x.moveTo(0, 230); x.quadraticCurveTo(140, 150, 260, 215); x.quadraticCurveTo(380, 260, 512, 190); x.lineTo(512, 320); x.lineTo(0, 320); x.fill();
      const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace;
      const painting = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.42), new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.8 }));
      painting.position.set(0, 1.65 - 0.028, -1.51 + 0.018); g.add(painting);
    } else if (id === 'custom' && customGroup) {
      g.add(customGroup.clone());
    } else throw new Error(`Unknown subject "${id}"`);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  function pedestal(h) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, h, 48), plaster);
    m.position.y = h / 2;
    return m;
  }

  let turn = 0;
  /** Turn the subject left/right (deg, + = towards camera right): broad / short lighting. */
  function setTurn(deg) {
    turn = +deg || 0;
    invalidate(true);
    subjectRoot.rotation.y = THREE.MathUtils.degToRad(turn);
    subjectRoot.updateMatrixWorld(true);
    focusCache.key = '';
    emit('change', { what: 'turn', turn });
  }
  /**
   * Bring your own model: a .glb, or a .gltf with its .bin and textures (pass all the files, or a URL).
   * Units are guessed (m / cm / mm) from its size; small objects go on the pedestal, big ones on the floor.
   * → the subject info; it becomes subject 'custom'.
   */
  async function importModel(input, { name } = {}) {
    let url, blobs = [];
    const manager = new THREE.LoadingManager();
    if (typeof input === 'string') url = input;
    else {
      const files = [...(input?.length !== undefined ? input : [input])];
      const main = files.find((f) => /\.(glb|gltf)$/i.test(f.name));
      if (!main) throw new Error('Choose a .glb or .gltf file (with its .bin and textures for .gltf)');
      const map = new Map(files.map((f) => { const u = URL.createObjectURL(f); blobs.push(u); return [f.name, u]; }));
      // relative resources of a .gltf are looked up by file name among the files given
      manager.setURLModifier((u) => (u.startsWith('blob:') && [...map.values()].includes(u) ? u : map.get(decodeURIComponent(u.split('/').pop().split('?')[0])) || u));
      url = map.get(main.name);
      name ||= main.name.replace(/\.(glb|gltf)$/i, '');
    }
    let gltf;
    try { gltf = await new GLTFLoader(manager).loadAsync(url); } finally { blobs.forEach((u) => URL.revokeObjectURL(u)); }
    const root = gltf.scene;
    root.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } if (o.isLight) o.visible = false; });
    let box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
    if (size.length() === 0) throw new Error('The model is empty');
    const big = Math.max(size.x, size.y, size.z);
    const unit = big > 400 ? 0.001 : big > 40 ? 0.01 : 1;   // mm / cm / m
    root.scale.multiplyScalar(unit);
    box = new THREE.Box3().setFromObject(root); size = box.getSize(new THREE.Vector3());
    const ctr = box.getCenter(new THREE.Vector3());
    const g = new THREE.Group();
    // small things (a cup, a head) on the pedestal, at about eye height; furniture, figures and sets on the floor
    const onPedestal = size.y < 0.9 && Math.max(size.x, size.z) < 0.9;
    const base = onPedestal ? 0.87 : 0;
    if (onPedestal) g.add(pedestal(base));
    root.position.set(-ctr.x * 1, base - box.min.y, -ctr.z);
    g.add(root);
    customGroup = g;
    const target = [0, base + size.y * (onPedestal ? 0.6 : 0.5), 0];
    // frame it: fit the larger of height / width with the current focal length
    const fovV = THREE.MathUtils.degToRad(camera.fov), fovH = 2 * Math.atan(Math.tan(fovV / 2) * photoAspect);
    const dist = Math.max(0.6, 1.25 * Math.max(size.y / 2 / Math.tan(fovV / 2), Math.max(size.x, size.z) / 2 / Math.tan(fovH / 2)) + size.z / 2);
    subjects.custom = { name: name || 'Imported model', target, view: { az: 0, el: 5, dist, focal: camera.getFocalLength() },
      credit: `Imported (${unit === 1 ? 'm' : unit === 0.01 ? 'cm → m' : 'mm → m'}; ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m)` };
    await loadSubject('custom');
    return { id: 'custom', ...subjects.custom, size: size.toArray(), unit };
  }

  async function loadSubject(id) {
    if (!subjects[id]) throw new Error(`Unknown subject "${id}" — see listSubjects()`);
    const g = await buildSubject(id);
    subjectRoot.clear();
    subjectRoot.add(g);
    subjectRoot.updateMatrixWorld(true);   // raycasts (auto focus) may run before the next frame
    subjectId = id;
    const prev = subjectTarget.clone();
    subjectTarget.fromArray(subjects[id].target);
    const d = subjectTarget.clone().sub(prev);
    const v = subjects[id].view;
    if (v && !opts.keepCamera) {           // each subject has a natural shot
      targets.camera.copy(subjectTarget);
      camera.position.copy(sph(v.az, v.el, v.dist, subjectTarget));
      if (v.focal) camera.setFocalLength(v.focal);
      targets.studio.copy(subjectTarget);
      studioCam.position.copy(sph(v.az + 30, v.el + 20, v.dist * 1.8, subjectTarget));
    } else {                               // keep the view of the subject: move by the change of aim point
      camera.position.add(d); targets.camera.add(d); studioCam.position.add(d); targets.studio.add(d);
    }
    camera.lookAt(targets.camera); studioCam.lookAt(targets.studio); controls.update(); camDirty = true;
    for (const L of lights.values()) if (!L.spec.target) { L.aim.add(d); L.pos.add(d); applyLight(L); }
    emit('change', { what: 'subject', subject: id });
  }

  // ---- lights ------------------------------------------------------------------------------------
  const lights = new Map();     // id -> { spec, pos: Vector3, aim: Vector3, obj, extra, handle }
  let nextId = 1, selected = null;

  function lightColor(spec) { return spec.color ? new THREE.Color(spec.color) : kelvinColor(spec.kelvin || 5600); }
  function sph(az, el, dist, center) {
    const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
    return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(dist).add(center);
  }
  function angles(L) {
    const v = L.pos.clone().sub(L.aim), dist = v.length() || 1e-6;
    return { az: THREE.MathUtils.radToDeg(Math.atan2(v.x, v.z)), el: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(v.y / dist, -1, 1))), dist };
  }

  function buildLightObject(L) {
    const s = L.spec;
    disposeLightObject(L);
    let obj, extra = null;
    if (s.type === 'spot') {
      obj = new THREE.SpotLight(0xffffff, 1, 0, 1, 0, 2);
    } else if (s.type === 'point') {
      obj = new THREE.PointLight(0xffffff, 1, 0, 2);
    } else if (s.type === 'sun') {
      obj = new THREE.DirectionalLight(0xffffff, 1);
    } else if (s.type === 'area') {
      obj = new THREE.RectAreaLight(0xffffff, 1, 1, 1);
      // RectAreaLight casts no shadow in three.js: a soft spot at the same place carries part of the
      // energy and the (blurred) shadow.
      extra = new THREE.SpotLight(0xffffff, 1, 0, Math.PI / 3, 1, 2);
    } else throw new Error(`Unknown light type "${s.type}"`);
    for (const o of [obj, extra]) {
      if (!o) continue;
      content.add(o);
      if (o.target) content.add(o.target);
    }
    L.obj = obj; L.extra = extra;
    L.handle = makeHandle(L);
    overlay.add(L.handle);
  }
  function disposeLightObject(L) {
    for (const o of [L.obj, L.extra]) {
      if (!o) continue;
      content.remove(o); if (o.target) content.remove(o.target);
      o.shadow?.map?.dispose(); o.dispose?.();
    }
    if (L.handle) { overlay.remove(L.handle); L.handle.traverse(disposeNode); }
    L.obj = L.extra = L.handle = null;
  }

  function applyLight(L) {
    invalidate(true);
    const s = L.spec, color = lightColor(s);
    const shadowOn = !!s.shadow?.on, soft = THREE.MathUtils.clamp(s.shadow?.softness ?? 0.3, 0, 1);
    const setShadow = (o, sizeFactor = 1) => {
      o.castShadow = shadowOn;
      if (!shadowOn) return;
      // VSM blur, in shadow-map texels: hard → soft (a soft light also gets a coarser map: wider blur)
      const res = soft > 0.35 ? 512 : 1024;
      if (o.shadow.mapSize.x !== res) { o.shadow.map?.dispose(); o.shadow.map = null; o.shadow.mapSize.set(res, res); }
      o.shadow.radius = 1 + Math.min(1, soft * sizeFactor) ** 1.3 * 40;
      o.shadow.blurSamples = 8 + Math.round(Math.min(1, soft * sizeFactor) * 17);
      o.shadow.bias = -0.003;              // VSM: too small → banding rings on the backdrop
      o.shadow.normalBias = 0.02;
    };
    const o = L.obj;
    o.color.copy(color);
    o.position.copy(L.pos);
    if (s.type === 'spot') {
      o.intensity = s.intensity * CANDELA;
      o.angle = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(s.cone ?? 40, 2, 170) / 2);
      o.penumbra = THREE.MathUtils.clamp(s.softness ?? 0.4, 0, 1);
      o.target.position.copy(L.aim);
      o.shadow.camera.near = 0.1; o.shadow.camera.far = 30;
      setShadow(o);
    } else if (s.type === 'point') {
      o.intensity = s.intensity * CANDELA;
      o.shadow.camera.near = 0.05; o.shadow.camera.far = 30;
      setShadow(o);
    } else if (s.type === 'sun') {
      o.intensity = s.intensity * SUN_LUX;
      o.target.position.copy(L.aim);
      const c = o.shadow.camera;
      c.left = c.bottom = -2.5; c.right = c.top = 2.5; c.near = 0.1; c.far = 40;
      c.updateProjectionMatrix();
      setShadow(o);
    } else if (s.type === 'area') {
      const size = THREE.MathUtils.clamp(s.size ?? 0.8, 0.1, 4), area = size * size;
      const share = shadowOn ? 0.5 : 0;   // with shadow: half the light from a soft spot that casts it
      o.width = o.height = size;
      o.intensity = (s.intensity * CANDELA * (1 - share)) / area;
      o.lookAt(L.aim);
      const e = L.extra;
      e.color.copy(color); e.position.copy(L.pos); e.target.position.copy(L.aim);
      e.intensity = s.intensity * CANDELA * share;
      e.angle = Math.PI / 3; e.penumbra = 1;
      e.visible = shadowOn;
      e.shadow.camera.near = 0.1; e.shadow.camera.far = 30;
      setShadow(e, 0.6 + size / 2);       // bigger box → softer shadow
    }
    updateHandle(L, color);
  }

  // handles: what you see and drag in the viewport
  function makeHandle(L) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    let body;
    if (L.spec.type === 'area') body = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false, transparent: true, opacity: 0.85 }));
    else if (L.spec.type === 'spot') { body = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 24, 1, true), mat); body.geometry.rotateX(-Math.PI / 2); body.material.side = THREE.DoubleSide; }
    else if (L.spec.type === 'sun') body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), mat);
    else body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 12), mat);
    body.userData.lightId = L.spec.id;
    g.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 8, 48), new THREE.MeshBasicMaterial({ color: 0xff5a4d, toneMapped: false }));
    ring.visible = false; ring.name = 'ring';
    g.add(ring);
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
    const line = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.05, gapSize: 0.04, transparent: true, opacity: 0.6 }));
    line.name = 'line'; line.visible = false;
    g.add(line);
    g.userData = { body, ring, line };
    return g;
  }
  function updateHandle(L, color) {
    const h = L.handle, { body, ring, line } = h.userData;
    h.position.copy(L.pos);
    h.lookAt(L.aim);                     // +Z of the group towards the target
    body.material.color.copy(color);
    if (L.spec.type === 'area') { const s = THREE.MathUtils.clamp(L.spec.size ?? 0.8, 0.1, 4); body.scale.set(s, s, 1); }
    ring.visible = selected === L.spec.id;
    const dist = L.pos.distanceTo(L.aim);
    line.visible = ring.visible;
    line.scale.set(1, 1, dist);
    line.computeLineDistances();
  }

  function normalizeSpec(spec, id) {
    const s = { ...DEFAULT_LIGHT, ...spec, id, shadow: { ...DEFAULT_LIGHT.shadow, ...(spec.shadow || {}) } };
    if (s.color) s.kelvin = null;
    return s;
  }
  function addLight(spec = {}) {
    const id = spec.id || `light${nextId++}`;
    const s = normalizeSpec(spec, id);
    const aim = s.target ? new THREE.Vector3().fromArray(s.target) : subjectTarget.clone();
    const pos = s.position ? new THREE.Vector3().fromArray(s.position) : sph(s.az, s.el, s.dist, aim);
    const L = { spec: s, aim, pos };
    lights.set(id, L);
    buildLightObject(L);
    applyLight(L);
    emit('change', { what: 'light', id });
    return id;
  }
  function updateLight(id, patch) {
    const L = lights.get(id);
    if (!L) throw new Error(`No light "${id}"`);
    const typeChanged = patch.type && patch.type !== L.spec.type;
    if (patch.shadow) patch = { ...patch, shadow: { ...L.spec.shadow, ...patch.shadow } };
    if ('color' in patch && patch.color) patch = { ...patch, kelvin: null };
    if ('kelvin' in patch && patch.kelvin) patch = { ...patch, color: null };
    Object.assign(L.spec, patch);
    if (patch.target !== undefined) L.aim = patch.target ? new THREE.Vector3().fromArray(patch.target) : subjectTarget.clone();
    if (patch.position) L.pos.fromArray(patch.position);
    else if ('az' in patch || 'el' in patch || 'dist' in patch || patch.target !== undefined) {
      const a = angles(L);
      L.pos.copy(sph(patch.az ?? a.az, patch.el ?? a.el, patch.dist ?? a.dist, L.aim));
    }
    if (typeChanged) buildLightObject(L);
    applyLight(L);
    emit('change', { what: 'light', id });
  }
  function removeLight(id) {
    const L = lights.get(id);
    if (!L) return;
    disposeLightObject(L);
    lights.delete(id);
    if (selected === id) select(null);
    emit('change', { what: 'light', id, removed: true });
  }
  function lightInfo(L) {
    const a = angles(L), s = L.spec;
    return { ...structuredClone({ ...s, shadow: { ...s.shadow } }), az: a.az, el: a.el, dist: a.dist,
      position: L.pos.toArray(), target: s.target || null, aim: L.aim.toArray(),
      // illuminance at the aim point (what a light meter there would read, relative units)
      illuminance: s.type === 'sun' ? s.intensity * SUN_LUX : (s.intensity * CANDELA) / (a.dist * a.dist) };
  }
  const listLights = () => [...lights.values()].map(lightInfo);
  function clearLights() { for (const id of [...lights.keys()]) removeLight(id); }

  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) throw new Error(`Unknown preset "${name}" — see listPresets()`);
    clearLights();
    setTurn(p.turn || 0);
    setWorld({ ...DEFAULT_WORLD, ...(p.world || {}) });
    p.lights.forEach((spec) => addLight(spec));
    emit('change', { what: 'preset', preset: name });
  }
  const lang = opts.lang === 'es' ? 'es' : 'en';   // English by default (the app's language); 'es' available
  const presetInfo = (id) => ({ id, name: PRESETS[id][lang][0], description: PRESETS[id][lang][1] });

  function select(id) {
    selected = id && lights.has(id) ? id : null;
    for (const L of lights.values()) updateHandle(L, lightColor(L.spec));
    emit('select', selected ? lightInfo(lights.get(selected)) : null);
  }

  // ---- camera ------------------------------------------------------------------------------------
  const dof = { on: false, fstop: 2.8, focus: 'subject', focusDist: 3, point: null };
  // The exposure triangle. Reference (0 EV offset) = ISO 400 · 1/50 s · f/2.8: the presets are lit for it.
  // The iris also drives the depth of field; ISO the grain.
  const expo = { iso: 400, shutter: 1 / 50, wb: 5600 };
  // White balance: camera gains = 1 / (colour of a light at the camera's kelvin) → a light at the same
  // kelvin as the camera comes out neutral; warmer lights go orange, cooler ones blue.
  const wbGain = new THREE.Vector3(1, 1, 1);
  function updateWB() {
    const c = kelvinColor(expo.wb);       // linear RGB
    wbGain.set(1 / Math.max(c.r, 1e-3), 1 / Math.max(c.g, 1e-3), 1 / Math.max(c.b, 1e-3));
    // keep the overall brightness: a white surface under a light at the camera's kelvin stays as bright
    const lum = 0.2126 * c.r * wbGain.x + 0.7152 * c.g * wbGain.y + 0.0722 * c.b * wbGain.z;
    wbGain.multiplyScalar((0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / lum);
  }
  updateWB();
  const wbActive = () => Math.abs(wbGain.x - 1) > 0.01 || Math.abs(wbGain.y - 1) > 0.01 || Math.abs(wbGain.z - 1) > 0.01;
  const REF = { iso: 400, shutter: 1 / 50, fstop: 2.8 };
  const cameraStops = () => Math.log2((expo.shutter / REF.shutter) * (expo.iso / REF.iso) * (REF.fstop / Math.max(0.5, dof.fstop)) ** 2);
  function setCamera(c = {}) {
    if (c.sensorMm) camera.filmGauge = c.sensorMm;
    if (c.focalMm) camera.setFocalLength(c.focalMm);
    else if (c.fov) { camera.fov = c.fov; camera.updateProjectionMatrix(); }
    if ('azimuth' in c || 'elevation' in c || 'distance' in c) {
      const cur = getCamera();
      camera.position.copy(sph(c.azimuth ?? cur.azimuth, c.elevation ?? cur.elevation, c.distance ?? cur.distance, targets.camera));
    }
    if (c.target) targets.camera.fromArray(c.target);
    if (c.aspect) setAspect(c.aspect);
    if (c.iso) expo.iso = THREE.MathUtils.clamp(+c.iso, 25, 102400);
    if (c.shutter) expo.shutter = THREE.MathUtils.clamp(+c.shutter, 1 / 16000, 30);
    if (c.fstop) dof.fstop = +c.fstop;
    if (c.wb) { expo.wb = THREE.MathUtils.clamp(+c.wb, 2000, 12000); updateWB(); }
    if (c.dof) {
      Object.assign(dof, c.dof);
      if (c.dof.focusDist != null && c.dof.focus === undefined) { dof.focus = 'manual'; dof.point = null; }
    }
    camera.lookAt(targets.camera);
    controls.update();
    camDirty = true; meterDirty = true; invalidate();
  }
  function getCamera() {
    const v = camera.position.clone().sub(targets.camera), distance = v.length();
    const fovH = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    const r = dofRange();
    return {
      azimuth: THREE.MathUtils.radToDeg(Math.atan2(v.x, v.z)), elevation: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(v.y / distance, -1, 1))),
      distance, target: targets.camera.toArray(), position: camera.position.toArray(),
      focalMm: camera.getFocalLength(), sensorMm: camera.filmGauge, fovV: camera.fov, fovH, aspect: photoAspect,
      dof: { on: dof.on, fstop: dof.fstop, focus: dof.focus, focusDist: r.focus, near: r.near, far: r.far },
      fstop: dof.fstop, iso: expo.iso, shutter: expo.shutter, wb: expo.wb,
      ev100: Math.log2(dof.fstop ** 2 / expo.shutter) - Math.log2(expo.iso / 100),   // the camera's exposure value
      meter: readMeter(),                    // light meter: stops over (+) / under (−) a correct exposure
    };
  }
  /** Focus on a light, the subject, a world point {x,y,z} / [x,y,z], or a distance in metres. */
  function focusOn(what) {
    if (what === 'subject') { dof.focus = 'subject'; dof.point = null; }
    else if (typeof what === 'number') { dof.focus = 'manual'; dof.focusDist = what; dof.point = null; }
    else if (typeof what === 'string') {
      const L = lights.get(what);
      if (!L) throw new Error(`No light "${what}"`);
      dof.focus = 'point'; dof.point = L.pos.clone();
    } else if (what) { dof.focus = 'point'; dof.point = Array.isArray(what) ? new THREE.Vector3().fromArray(what) : new THREE.Vector3(what.x, what.y, what.z); }
    camDirty = true; invalidate();
  }
  // 'subject' focuses on the subject's SURFACE facing the camera (the face, the nearest fruit), not on
  // its centre: at 85 mm f/1.8 the depth of field is a few centimetres.
  const focusRay = new THREE.Raycaster(), focusCache = { key: '', point: new THREE.Vector3() };
  function subjectFocusPoint() {
    const key = `${subjectId}|${camera.position.toArray().map((v) => v.toFixed(3))}`;
    if (key !== focusCache.key) {
      focusCache.key = key;
      focusRay.set(camera.position, subjectTarget.clone().sub(camera.position).normalize());
      const hit = focusRay.intersectObject(subjectRoot, true).find((h) => h.object.isMesh);
      focusCache.point.copy(hit ? hit.point : subjectTarget);
    }
    return focusCache.point;
  }
  function focusDistance() {
    if (dof.focus === 'manual') return dof.focusDist;
    const p = dof.focus === 'point' && dof.point ? dof.point : subjectFocusPoint();
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    return Math.max(0.1, p.clone().sub(camera.position).dot(fwd));
  }
  /** Acceptably sharp range [near, far] (m), circle of confusion = sensor width / 1500. */
  function dofRange() {
    const S = focusDistance() * 1000, f = camera.getFocalLength(), N = Math.max(0.5, dof.fstop), c = camera.filmGauge / 1500;
    const H = f * f / (N * c) + f;
    return { focus: S / 1000, near: S * (H - f) / (H + S - 2 * f) / 1000, far: S < H ? S * (H - f) / (H - S) / 1000 : Infinity };
  }

  // ---- post chain: depth of field (physical CoC), overlay drawn sharp on top ------------------------
  const depthRT = new THREE.WebGLRenderTarget(1, 1, { depthTexture: new THREE.DepthTexture(1, 1, THREE.FloatType) });
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  const depthCopy = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { tDepth: { value: depthRT.depthTexture } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D tDepth; varying vec2 vUv; void main() { gl_FragDepth = texture2D(tDepth, vUv).x; }',
    colorWrite: false, depthWrite: true, depthTest: true, depthFunc: THREE.AlwaysDepth,
  }));
  const N_SAMPLES = 160;
  const dofUniforms = () => ({ tDiffuse: { value: null }, tDepth: { value: depthRT.depthTexture }, texel: { value: new THREE.Vector2() },
    near: { value: 0.1 }, far: { value: 100 }, focus: { value: 3 }, cocScale: { value: 0 }, maxR: { value: 1 } });
  const DOF_COMMON = `
    #include <packing>
    uniform sampler2D tDiffuse, tDepth; uniform vec2 texel;
    uniform float near, far, focus, cocScale, maxR;
    varying vec2 vUv;
    float depthAt(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }
    float coc(float z) { return min(maxR, cocScale * abs(z - focus) / max(z, 1e-3)); }`;
  const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const dofPass = new ShaderPass({ uniforms: dofUniforms(), vertexShader: VERT, fragmentShader: `${DOF_COMMON}
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      float z0 = depthAt(vUv), r0 = coc(z0);
      float tot = 1.0, spacing = maxR / sqrt(float(${N_SAMPLES}));
      float rot = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
      for (int i = 0; i < ${N_SAMPLES}; i++) {
        float r = maxR * sqrt((float(i) + 0.5) / float(${N_SAMPLES}));
        float a = float(i) * 2.39996323 + rot;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * r * texel;
        float z = depthAt(uv), rs = coc(z);
        if (z > z0) rs = min(rs, r0 * 2.0);
        float m = smoothstep(r - spacing, r + spacing, rs);
        col += mix(col / tot, texture2D(tDiffuse, uv), m);
        tot += 1.0;
      }
      gl_FragColor = col / tot;
    }` });
  const smoothPass = new ShaderPass({ uniforms: dofUniforms(), vertexShader: VERT, fragmentShader: `${DOF_COMMON}
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float rad = min(coc(depthAt(vUv)), 1.5 * maxR / sqrt(float(${N_SAMPLES})));
      if (rad < 0.75) { gl_FragColor = c; return; }
      vec4 acc = c; float tot = 1.0;
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 0.5235988;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * rad * (mod(float(i), 2.0) < 0.5 ? 1.0 : 0.5) * texel;
        if (coc(depthAt(uv)) < rad * 0.5) continue;
        acc += texture2D(tDiffuse, uv); tot += 1.0;
      }
      gl_FragColor = acc / tot;
    }` });
  // ShaderPass CLONES its uniforms — a cloned DepthTexture is an empty texture: point at the real one
  for (const p of [dofPass, smoothPass]) p.uniforms.tDepth.value = depthRT.depthTexture;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera, null, new THREE.Color(0, 0, 0), 0));
  composer.addPass(dofPass);
  composer.addPass(smoothPass);
  const out = new OutputPass(), outRender = out.render.bind(out);
  // laid over the plain background colour (premultiplied), so the background is never tone mapped
  Object.assign(out.material, { transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  out.render = (r, ...rest) => { const ac = r.autoClear; r.autoClear = false; outRender(r, ...rest); r.autoClear = ac; };
  composer.addPass(out);
  const bgScene = new THREE.Scene();
  // Sensor noise at high ISO: luminance + a little colour noise, stronger in the shadows.
  // Zero-mean: drawn twice, once ADDING the positive half of the noise and once SUBTRACTING the negative
  // half, so the picture's average brightness doesn't change (a grey overlay would lift the blacks).
  const grainMat = (sign) => new THREE.ShaderMaterial({
    uniforms: { amount: { value: 0 }, seed: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform float amount, seed; varying vec2 vUv;
      float h(vec2 p) { return fract(sin(dot(p + seed, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() { vec2 p = floor(gl_FragCoord.xy);
        vec3 n = vec3(h(p) - 0.5) + 0.3 * (vec3(h(p + 1.3), h(p + 2.7), h(p + 4.1)) - 0.5);
        gl_FragColor = vec4(max(${sign} * n, 0.0) * amount, 1.0); }`,
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendEquation: sign > 0 ? THREE.AddEquation : THREE.ReverseSubtractEquation,
  });
  const grainUp = new FullScreenQuad(grainMat(1)), grainDown = new FullScreenQuad(grainMat(-1));
  const grainAmount = () => THREE.MathUtils.clamp(Math.log2(expo.iso / 400) * 0.08, 0, 0.45);
  const _size = new THREE.Vector2();

  // Camera body + frustum, seen in the studio view so you know where the photo is taken from.
  const camGizmo = new THREE.Group();
  {
    const m = new THREE.MeshBasicMaterial({ color: 0x3a3a40, toneMapped: false });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.12), m); body.position.z = 0.06; camGizmo.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.08, 20), m); lens.rotation.x = Math.PI / 2; lens.position.z = -0.03; camGizmo.add(lens);
    const fr = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd34d, toneMapped: false, transparent: true, opacity: 0.8 }));
    fr.name = 'frustum'; camGizmo.add(fr);
  }
  overlay.add(camGizmo);
  function updateCamGizmo() {
    camGizmo.position.copy(camera.position); camGizmo.quaternion.copy(camera.quaternion);
    const d = Math.min(1.2, camera.position.distanceTo(targets.camera) * 0.6);
    const hy = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d, hx = hy * photoAspect;
    const c = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]], pts = [];
    for (const [x, y] of c) pts.push(0, 0, 0, x, y, -d);
    for (let i = 0; i < 4; i++) { const [x1, y1] = c[i], [x2, y2] = c[(i + 1) % 4]; pts.push(x1, y1, -d, x2, y2, -d); }
    camGizmo.getObjectByName('frustum').geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  }

  /** Draw `cam` into the current viewport. DoF only for the photo camera; handles only in the studio view. */
  function draw(cam = viewCam(), { handles = cam === studioCam, dofOk = true, width = 0 } = {}) {
    const size = renderer.getDrawingBufferSize(_size);
    if (shadowsDirty) { renderer.shadowMap.needsUpdate = true; shadowsDirty = false; }
    overlay.visible = handles;
    camGizmo.visible = handles;
    const photo = cam === camera;
    // the photo gets the camera's exposure; the studio view a fixed "work light" exposure
    renderer.toneMappingExposure = 2 ** (world.exposure + (photo ? cameraStops() : 0));
    let dofOn = false, maxR = 0, cocScale = 0, S = 0;
    if (photo && dofOk && dof.on) {
      S = focusDistance();
      const f = camera.getFocalLength(), N = Math.max(0.5, dof.fstop);
      cocScale = 0.5 * (f * f / N) / Math.max(1e-3, 1000 * S - f) / camera.filmGauge * size.x;
      maxR = Math.min(0.045 * size.x, 2.5 * cocScale);
      dofOn = maxR >= 0.5;
    }
    // White balance is applied to the LIGHTS for the photo (same result as camera gains on their light), so
    // the neutral ambient fill doesn't turn blue/orange with them.
    const wb = photo && wbActive(), saved = [];
    if (wb) for (const L of lights.values()) for (const o of [L.obj, L.extra]) if (o) { saved.push([o, o.color.clone()]); o.color.multiply(new THREE.Color(wbGain.x, wbGain.y, wbGain.z)); }
    try { renderContent(cam, photo, dofOn, S, cocScale, maxR, size); } finally { for (const [o, c] of saved) o.color.copy(c); }
    if (photo) {
      const g = grainAmount();
      if (g > 0.002) {
        const seed = Math.random() * 100, ac = renderer.autoClear;
        renderer.autoClear = false;
        for (const q of [grainUp, grainDown]) { q.material.uniforms.amount.value = g; q.material.uniforms.seed.value = seed; q.render(renderer); }
        renderer.autoClear = ac;
      }
    }
  }
  function renderContent(cam, photo, dofOn, S, cocScale, maxR, size) {
    if (!dofOn) {
      renderer.render(scene, cam);
    } else {
      dofPass.enabled = smoothPass.enabled = dofOn;
      const bg = scene.background;
      if (dofOn) {
        for (const u of [dofPass.uniforms, smoothPass.uniforms]) {
          u.focus.value = S; u.cocScale.value = cocScale; u.near.value = camera.near; u.far.value = camera.far; u.maxR.value = maxR;
          u.texel.value.set(1 / size.x, 1 / size.y);
        }
        if (depthRT.width !== size.x || depthRT.height !== size.y) depthRT.setSize(size.x, size.y);
        // 1. depth of the content
        overlay.visible = false;
        scene.background = null; scene.overrideMaterial = depthOnly;
        renderer.setRenderTarget(depthRT); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null);
        scene.overrideMaterial = null;
      }
      // 2. background colour straight to the screen, then the processed content over it
      overlay.visible = false;
      bgScene.background = bg; renderer.render(bgScene, camera);
      scene.background = null;
      composer.render();
      scene.background = bg;
    }
  }

  // ---- sizing / loop ---------------------------------------------------------------------------------
  // Studio view: the canvas fills the container. Camera view: letterboxed to the photo's aspect ratio.
  function resize() {
    const W = Math.max(1, container.clientWidth), H = Math.max(1, container.clientHeight);
    let w = W, h = H;
    if (view === 'camera') { w = Math.min(W, H * photoAspect); h = w / photoAspect; }
    w = Math.floor(w); h = Math.floor(h);
    Object.assign(canvas.style, { width: w + 'px', height: h + 'px', left: (W - w) / 2 + 'px', top: (H - h) / 2 + 'px' });
    Object.assign(guides.style, { width: w + 'px', height: h + 'px', left: (W - w) / 2 + 'px', top: (H - h) / 2 + 'px', display: view === 'camera' && showGuides ? 'block' : 'none' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
    camera.aspect = photoAspect; camera.updateProjectionMatrix();
    // the studio view takes the shape of wherever it is shown: the main area, or the whole monitor box when swapped
    const hostW = monitorHost?.clientWidth || 0, hostHt = monitorHost?.clientHeight || 0;
    studioCam.aspect = view === 'camera' && monitorHost && hostHt > 40 ? hostW / hostHt : W / H;
    studioCam.updateProjectionMatrix();
    // monitor: a quarter of the width, the other view's aspect
    const other = view === 'camera' ? studioCam.aspect : photoAspect;
    const hostH = monitorHost?.clientHeight || 0;
    const pw = monitorHost ? Math.max(60, Math.floor(hostH > 40 ? Math.min(monitorHost.clientWidth, hostH * other) : monitorHost.clientWidth)) : Math.round(Math.max(160, W * 0.26));
    pip.style.width = pw + 'px'; pip.style.height = Math.round(pw / other) + 'px';
    pip.width = Math.round(pw * renderer.getPixelRatio()); pip.height = Math.round(pip.width / other);
    pip.style.display = showMonitor ? 'block' : 'none';
    camDirty = true; invalidate();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  if (monitorHost) ro.observe(monitorHost);

  function setView(v) {
    v = v === 'camera' ? 'camera' : 'studio';
    if (v === view) return;
    view = v;
    controls.object = viewCam();
    controls.target = targets[view];
    controls.update();
    resize();
    emit('view', { view });
  }
  function setAspect(a) {
    const n = typeof a === 'string' ? a.split(':').reduce((x, y) => +x / +y) : +a;
    if (!(n > 0.2 && n < 5)) return;
    photoAspect = n;
    resize();
  }
  pip.addEventListener('click', () => setView(view === 'camera' ? 'studio' : 'camera'));

  let camDirty = true, lastFocusKey = '';
  let meterScene = 0;
  function readMeter() {
    if (meterDirty) updateMeter();         // a 160-px render, only after something changed
    return meterScene + world.exposure + cameraStops() - Math.log2(0.18);
  }
  /** Centre-weighted light meter of the photo, in stops relative to a correct exposure (18 % grey). */
  function updateMeter() {
    const l = renderLuma(camera), w = LUMA_W, h = l.length / w;
    let sum = 0, wsum = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x / w - 0.5) * 2, dy = (y / h - 0.5) * 2, wt = Math.exp(-(dx * dx + dy * dy) * 1.5);
      sum += Math.log2(Math.max(1e-5, l[y * w + x])) * wt; wsum += wt;
    }
    meterScene = sum / wsum;               // scene brightness, independent of the camera settings
    meterDirty = false;
  }
  controls.addEventListener('change', () => { camDirty = true; invalidate(); });
  renderer.setAnimationLoop(() => {
    fly();
    controls.update();                    // damping keeps emitting 'change' while it settles
    if (frames <= 0) return;
    frames--;
    if (view === 'camera') camera.lookAt(targets.camera);
    // handles keep a constant on-screen size in the studio view
    const k = Math.tan(THREE.MathUtils.degToRad(studioCam.fov / 2)) * 0.35;
    for (const L of lights.values()) {
      const sc = studioCam.position.distanceTo(L.pos) * k, u = L.handle.userData;
      u.ring.scale.setScalar(Math.max(sc, L.spec.type === 'area' ? (L.spec.size ?? 0.8) * 0.75 / 0.11 : 0));
      if (L.spec.type !== 'area') u.body.scale.setScalar(sc);
    }
    updateCamGizmo();
    // 1. the monitor: the OTHER view, small, drawn into the corner of the canvas and copied out
    //    (same WebGL context — no second renderer), then 2. the main view over the whole canvas.
    if (showMonitor) {
      const other = view === 'camera' ? studioCam : camera;
      const pw = Math.min(pip.width, canvas.width), ph = Math.min(pip.height, canvas.height);
      renderer.setViewport(0, 0, pw / renderer.getPixelRatio(), ph / renderer.getPixelRatio());
      renderer.setScissor(0, 0, pw / renderer.getPixelRatio(), ph / renderer.getPixelRatio()); renderer.setScissorTest(true);
      draw(other, { dofOk: false, width: pw });
      renderer.setScissorTest(false);
      pipCtx.drawImage(canvas, 0, canvas.height - ph, pw, ph, 0, 0, pip.width, pip.height);
      renderer.setViewport(0, 0, canvas.width / renderer.getPixelRatio(), canvas.height / renderer.getPixelRatio());
    }
    draw();
    if (camDirty || notify) {
      if (camDirty && view === 'camera') meterDirty = true;   // the photo camera moved: new metering
      notify = false; camDirty = false;
      const c = getCamera(), key = [c.azimuth.toFixed(1), c.elevation.toFixed(1), c.distance.toFixed(2), c.focalMm.toFixed(1), c.dof.focusDist.toFixed(2), view,
        c.meter.toFixed(2), c.iso, c.shutter, c.fstop, c.wb, c.dof.on, c.sensorMm].join('|');
      if (key !== lastFocusKey) { lastFocusKey = key; emit('camera', c); }   // (the key includes the meter and the settings)
    }
  });

  // ---- picking and dragging lights in the viewport -----------------------------------------------------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let drag = null, pickFocus = false, downAt = null;
  function setRay(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, viewCam());
  }
  function handleUnder(e) {
    if (view !== 'studio') return null;    // lights are placed in the studio view
    setRay(e);
    const bodies = [...lights.values()].map((L) => L.handle.userData.body);
    const hit = ray.intersectObjects(bodies, false)[0];
    return hit ? hit.object.userData.lightId : null;
  }
  function onDown(e) {
    downAt = [e.clientX, e.clientY];
    if (e.button !== 0) return;
    const id = handleUnder(e);
    if (!id) return;
    e.preventDefault(); e.stopImmediatePropagation();
    controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
    select(id);
    const L = lights.get(id);
    drag = { id, radius: L.pos.distanceTo(L.aim), y: e.clientY };
  }
  let moveQueued = false;
  function onMove(e) {
    if (!drag) { canvas.style.cursor = handleUnder(e) ? 'grab' : (pickFocus ? 'crosshair' : ''); return; }
    const L = lights.get(drag.id);
    if (!L) return;
    if (e.shiftKey) {                       // Shift: closer / further, same direction
      drag.radius = THREE.MathUtils.clamp(drag.radius * Math.exp((e.clientY - drag.y) * 0.006), 0.3, 20);
      drag.y = e.clientY;
      L.pos.sub(L.aim).setLength(drag.radius).add(L.aim);
    } else {                                // drag over a sphere around the target: azimuth / elevation
      drag.y = e.clientY;
      setRay(e);
      const sphere = new THREE.Sphere(L.aim, drag.radius), p = new THREE.Vector3();
      if (ray.ray.intersectSphere(sphere, p)) {
        // the near side of the sphere is the natural one, unless the light is behind the subject
        const behind = L.pos.clone().sub(L.aim).dot(viewCam().position.clone().sub(L.aim)) < 0;
        if (behind) {
          const far = new THREE.Vector3(); const t = ray.ray.origin.clone().sub(L.aim);
          // second intersection: reflect along the ray
          const b = t.dot(ray.ray.direction), c = t.lengthSq() - drag.radius * drag.radius, disc = b * b - c;
          if (disc >= 0) { far.copy(ray.ray.origin).addScaledVector(ray.ray.direction, -b + Math.sqrt(disc)); p.copy(far); }
        }
        L.pos.copy(p);
      } else {
        ray.ray.closestPointToPoint(L.aim, p);
        L.pos.copy(p.sub(L.aim).setLength(drag.radius).add(L.aim));
      }
    }
    applyLight(L);
    if (!moveQueued) { moveQueued = true; requestAnimationFrame(() => { moveQueued = false; if (lights.has(drag?.id ?? L.spec.id)) emit('lightmove', lightInfo(L)); }); }
  }
  function onUp(e) {
    const moved = downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4;
    if (drag) {
      const id = drag.id; drag = null; controls.enabled = true;
      canvas.releasePointerCapture?.(e.pointerId);
      emit('change', { what: 'light', id });
      return;
    }
    if (moved || e.button !== 0) return;
    setRay(e);
    if (pickFocus) {
      const hit = ray.intersectObject(content, true).find((h) => h.object.isMesh);
      if (hit) { focusOn(hit.point); pickFocus = false; canvas.style.cursor = ''; emit('focuspick', { point: hit.point.toArray(), distance: focusDistance() }); emit('change', { what: 'focus' }); }
      return;
    }
    if (selected) select(null);             // click on empty space = deselect
  }
  canvas.addEventListener('pointerdown', onDown, { capture: true });
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);

  // ---- world -----------------------------------------------------------------------------------------
  function setWorld(patch = {}) {
    Object.assign(world, patch);
    scene.environmentIntensity = world.ambient;
    backdropMat.color.set(world.backdrop);
    meterDirty = true;
    emit('change', { what: 'world' });
  }

  // ---- challenge: "here is a reference — recreate it" ------------------------------------------------
  // The reference is rendered with OUR subject from a known lighting state, so we can (1) compare the
  // pictures and (2) compare the lights themselves and say, in words, what to change.
  let challenge = null;
  const LUMA_W = 160;
  /** Small linear-luminance render of the current scene from `cam` (no handles, no DoF). */
  function renderLuma(cam) {
    const w = LUMA_W, h = Math.max(1, Math.round(w / cam.aspect));
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType });
    const ov = overlay.visible;
    overlay.visible = false;
    content.updateMatrixWorld(true);
    renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
    overlay.visible = ov;
    const px = new Float32Array(w * h * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
    rt.dispose();
    const l = new Float32Array(w * h);
    for (let i = 0; i < l.length; i++) l[i] = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
    return l;
  }
  /** 0–100: how alike two luminance maps look (log scale ≈ how the eye compares light and shadow). */
  function lumaScore(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i++) d += Math.abs(Math.log1p(20 * a[i]) - Math.log1p(20 * b[i]));
    d /= a.length;
    return Math.round(100 * Math.exp(-4 * d));
  }
  const T = {
    es: {
      missingKey: 'Falta la luz principal: la referencia tiene una luz clara que domina.',
      left: (n) => `Mueve ${n} hacia la izquierda (vista desde cámara).`, right: (n) => `Mueve ${n} hacia la derecha (vista desde cámara).`,
      behind: (n) => `${n} tiene que ir más hacia detrás del sujeto.`, front: (n) => `${n} tiene que ir más hacia delante (hacia la cámara).`,
      higher: (n) => `Sube ${n}.`, lower: (n) => `Baja ${n}.`,
      softer: (n) => `${n} debería ser más suave (fuente más grande o sombra más difusa).`, harder: (n) => `${n} debería ser más dura (sombras más definidas).`,
      warmer: (n) => `${n} debería ser más cálida (menos kelvin).`, cooler: (n) => `${n} debería ser más fría (más kelvin).`,
      stronger: (n) => `${n} necesita más intensidad.`, weaker: (n) => `${n} tiene demasiada intensidad.`,
      ratioHigh: (r, c) => `El relleno es demasiado débil: contraste ${c}:1, la referencia es ${r}:1.`,
      ratioLow: (r, c) => `El relleno es demasiado fuerte: contraste ${c}:1, la referencia es ${r}:1.`,
      missing: (role) => `Falta una luz ${role}.`, extra: (n) => `${n} sobra: la referencia no la tiene.`,
      turn: (d) => `Gira el sujeto ${d > 0 ? 'hacia la derecha' : 'hacia la izquierda'} (unos ${Math.abs(Math.round(d))}°).`,
      background: (b) => (b ? 'El fondo debería estar más iluminado.' : 'El fondo debería estar más oscuro.'),
      done: '¡Conseguido! La iluminación coincide con la referencia.',
      roles: { key: 'principal', fill: 'de relleno', back: 'de contra', rim: 'de recorte', background: 'de fondo' },
      the: (r) => `la luz ${r}`, light: 'la luz',
    },
    en: {
      missingKey: 'The key light is missing: the reference has one clearly dominant light.',
      left: (n) => `Move ${n} to the left (seen from the camera).`, right: (n) => `Move ${n} to the right (seen from the camera).`,
      behind: (n) => `${n} should go further behind the subject.`, front: (n) => `${n} should come further round to the front.`,
      higher: (n) => `Raise ${n}.`, lower: (n) => `Lower ${n}.`,
      softer: (n) => `${n} should be softer (bigger source or more diffused shadow).`, harder: (n) => `${n} should be harder (crisper shadows).`,
      warmer: (n) => `${n} should be warmer (fewer kelvin).`, cooler: (n) => `${n} should be cooler (more kelvin).`,
      stronger: (n) => `${n} needs more intensity.`, weaker: (n) => `${n} is too strong.`,
      ratioHigh: (r, c) => `The fill is too weak: contrast ${c}:1, the reference is ${r}:1.`,
      ratioLow: (r, c) => `The fill is too strong: contrast ${c}:1, the reference is ${r}:1.`,
      missing: (role) => `A ${role} light is missing.`, extra: (n) => `${n} is not needed: the reference doesn't have it.`,
      turn: (d) => `Turn the subject to the ${d > 0 ? 'right' : 'left'} (about ${Math.abs(Math.round(d))}°).`,
      background: (b) => (b ? 'The background should be brighter.' : 'The background should be darker.'),
      done: 'Done! The lighting matches the reference.',
      roles: { key: 'key', fill: 'fill', back: 'back', rim: 'rim', background: 'background' },
      the: (r) => `the ${r} light`, light: 'the light',
    },
  }[lang];
  const wrap = (d) => ((d + 540) % 360) - 180;
  const softnessOf = (l) => (l.type === 'area' ? Math.min(1, 0.45 + (l.size ?? 0.8) * 0.3) : l.type === 'sun' ? (l.shadow?.on ? l.shadow.softness * 0.5 : 0.2) : (l.shadow?.on ? l.shadow.softness : 0.3));
  /** Pair reference lights with the student's: same role first, then nearest direction. */
  function pairLights(ref, cur) {
    const free = [...cur], match = new Map();
    const sameAim = (a, b) => new THREE.Vector3().fromArray(a.aim).distanceTo(new THREE.Vector3().fromArray(b.aim)) < 0.6;
    const dirDist = (a, b) => Math.hypot(wrap(a.az - b.az), a.el - b.el);
    for (const r of ref) {                 // 1. same role (and aimed at the same thing)
      const i = r.role ? free.findIndex((c) => c.role === r.role && sameAim(c, r)) : -1;
      if (i >= 0) match.set(r, free.splice(i, 1)[0]);
    }
    for (const r of ref) {                 // 2. the rest: nearest direction around the same target
      if (match.has(r)) continue;
      let best = -1;
      free.forEach((c, j) => { if (sameAim(c, r) && dirDist(c, r) < 70 && (best < 0 || dirDist(c, r) < dirDist(free[best], r))) best = j; });
      match.set(r, best >= 0 ? free.splice(best, 1)[0] : null);
    }
    return { pairs: ref.map((r) => [r, match.get(r)]), extra: free };
  }
  function lightHints(ref, cur) {
    const hints = [];
    const name = (l) => (l.role && T.roles[l.role] ? T.the(T.roles[l.role]) : T.light);
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const byIll = (a) => [...a].sort((x, y) => y.illuminance - x.illuminance);
    const keyFirst = (a) => { const s = byIll(a), k = s.findIndex((l) => l.role === 'key'); if (k > 0) s.unshift(s.splice(k, 1)[0]); return s; };
    const R = keyFirst(ref), C = keyFirst(cur);
    const { pairs, extra } = pairLights(R, C);
    pairs.forEach(([r, c], idx) => {
      if (!c) { hints.push({ code: 'missing', text: idx === 0 && r.role === 'key' ? T.missingKey : T.missing(T.roles[r.role] || r.role || '…') }); return; }
      const n = name(r), out = [];
      const daz = wrap(c.az - r.az);
      // in front of the subject +az is camera-right; behind it, the same left/right still reads from the camera
      if (Math.abs(daz) > 15) {
        if (Math.abs(r.az) > 120 || Math.abs(c.az) > 120) out.push(Math.abs(c.az) < Math.abs(r.az) ? T.behind(n) : T.front(n));
        else out.push(daz > 0 ? T.left(n) : T.right(n));
      }
      if (c.el - r.el > 12) out.push(T.lower(n)); else if (r.el - c.el > 12) out.push(T.higher(n));
      const ds = softnessOf(c) - softnessOf(r);
      if (ds > 0.3) out.push(T.harder(n)); else if (ds < -0.3) out.push(T.softer(n));
      if (!r.color && !c.color && Math.abs((c.kelvin || 5600) - (r.kelvin || 5600)) > 800) out.push((c.kelvin || 5600) > (r.kelvin || 5600) ? T.warmer(n) : T.cooler(n));
      const ir = Math.log2(Math.max(1e-3, c.illuminance) / Math.max(1e-3, r.illuminance));
      if (r.role !== 'fill' && Math.abs(ir) > 0.7 && (idx === 0 || Math.abs(ir) > 1.2)) out.push(ir > 0 ? T.weaker(n) : T.stronger(n));   // fill: see the ratio
      out.forEach((text) => hints.push({ code: 'light', text: cap(text), id: c.id }));
    });
    // contrast ratio key : fill (the light "ratio" photographers talk about)
    const rf = pairs.find(([r]) => r.role === 'fill'), key = pairs[0];
    if (key?.[1] && rf?.[1] && rf[0].role === 'fill') {
      const rr = (key[0].illuminance + rf[0].illuminance) / Math.max(1e-3, rf[0].illuminance);
      const cr = (key[1].illuminance + rf[1].illuminance) / Math.max(1e-3, rf[1].illuminance);
      const f = (x) => (x >= 10 ? Math.round(x) : Math.round(x * 2) / 2);
      if (Math.log2(cr / rr) > 0.6) hints.push({ code: 'ratio', text: T.ratioHigh(f(rr), f(cr)) });
      else if (Math.log2(cr / rr) < -0.6) hints.push({ code: 'ratio', text: T.ratioLow(f(rr), f(cr)) });
    }
    extra.filter((c) => c.illuminance > 0.1 * (C[0]?.illuminance || 1)).forEach((c) => hints.push({ code: 'extra', text: cap(T.extra(name(c))), id: c.id }));
    return hints;
  }

  /**
   * Start a challenge: render the reference from a preset (or a saved state) with the CURRENT subject and
   * camera, then reset the scene to a starting point for the student.
   * → { id, name, description, reference: Blob (PNG) }
   */
  async function startChallenge(presetOrState, { start = 'neutral' } = {}) {
    const own = getState();
    const isPreset = typeof presetOrState === 'string';
    if (isPreset) applyPreset(presetOrState);
    else await setState({ ...presetOrState, camera: undefined, subject: presetOrState.subject || subjectId });
    const refCam = camera.clone();
    const target = { lights: listLights(), turn, world: { ...world }, luma: null };
    target.luma = renderLuma(refCam);
    const reference = await snapshot();
    // the student starts from one plain light in front (or keeps what they had)
    if (start === 'keep') await setState({ ...own, camera: undefined });
    else {
      clearLights(); setTurn(0); setWorld({ ...DEFAULT_WORLD });
      addLight({ role: 'key', type: 'spot', az: 0, el: 15, dist: 2, intensity: 0.8, cone: 50, softness: 0.4, shadow: { on: true, softness: 0.3 } });
    }
    challenge = { ...target, refCam, id: isPreset ? presetOrState : 'custom', reference };
    emit('change', { what: 'challenge' });
    return { ...(isPreset ? presetInfo(presetOrState) : { id: 'custom', name: '', description: '' }), reference };
  }
  /**
   * How close is the student? Compares the picture from the reference camera and the lights themselves.
   * → { score 0–100, done, hints: [{ code, text, id? }] }
   */
  function checkChallenge() {
    if (!challenge) throw new Error('No challenge running — startChallenge() first');
    const score = lumaScore(renderLuma(challenge.refCam), challenge.luma);
    const hints = lightHints(challenge.lights, listLights());
    const dturn = wrap(challenge.turn - turn);
    if (Math.abs(dturn) > 10) hints.unshift({ code: 'turn', text: T.turn(dturn) });
    if (Math.abs(challenge.world.ambient - world.ambient) > 0.1 || challenge.world.backdrop !== world.backdrop) {
      const lum = (hex) => new THREE.Color(hex).getHSL({}).l;
      const want = lum(challenge.world.backdrop) + challenge.world.ambient, have = lum(world.backdrop) + world.ambient;
      if (Math.abs(want - have) > 0.15) hints.push({ code: 'background', text: T.background(want > have) });
    }
    const done = score >= 88 && hints.length <= 1;
    const res = { score, done, hints: done ? [{ code: 'done', text: T.done }] : hints };
    emit('challenge', res);
    return res;
  }
  /** Reveal the solution (applies the reference lighting). */
  async function solveChallenge() {
    if (!challenge) return;
    clearLights(); setTurn(challenge.turn); setWorld(challenge.world);
    challenge.lights.forEach((l) => addLight({ ...l, id: undefined }));
  }
  function endChallenge() { challenge = null; emit('change', { what: 'challenge' }); }

  /** The settings that made the picture, as plain text lines (for the snapshot card or the host's UI). */
  function snapshotInfo() {
    const c = getCamera(), f1 = (x) => (Math.round(x * 10) / 10).toString(), tt = (t) => (t >= 1 ? `${t}"` : `1/${Math.round(1 / t)}`);
    const sensor = { 36: 'FF', 24.89: 'S35', 23.5: 'APS-C', 17.3: 'MFT' }[c.sensorMm] || `${c.sensorMm} mm`;
    const camera = `${f1(c.focalMm)} mm · ${sensor} · f/${f1(c.fstop)} · ${tt(c.shutter)} · ISO ${c.iso} · WB ${c.wb} K` +
      ` · ${f1(c.distance)} m · ${(Math.round(photoAspect * 100) / 100)}:1` + (c.dof.on ? ` · focus ${f1(c.dof.focusDist)} m (${f1(c.dof.near)}–${c.dof.far === Infinity ? '∞' : f1(c.dof.far)})` : ' · DoF off') +
      ` · meter ${c.meter >= 0 ? '+' : ''}${f1(c.meter)} EV`;
    const ls = listLights().map((l) => {
      const role = l.role || l.id, kind = { spot: 'spot', area: 'soft box', point: 'bulb', sun: 'sun' }[l.type] || l.type;
      return `${role}: ${kind}${l.type === 'area' ? ` ${f1(l.size)} m` : ''}${l.type === 'spot' ? ` ${Math.round(l.cone)}°` : ''} · ${l.color ? `gel ${l.color}` : `${l.kelvin} K`} · ` +
        `int ${f1(l.intensity)} · az ${Math.round(l.az)}° el ${Math.round(l.el)}° · ${f1(l.dist)} m · shadow ${l.shadow.on ? (l.shadow.softness < 0.3 ? 'hard' : l.shadow.softness < 0.65 ? 'medium' : 'soft') : 'off'}`;
    });
    const studio = `${subjects[subjectId]?.name || subjectId}${turn ? ` · turned ${Math.round(turn)}°` : ''} · ambient ${f1(world.ambient)} · exposure ${world.exposure >= 0 ? '+' : ''}${f1(world.exposure)} EV · backdrop ${world.backdrop}`;
    return { camera, lights: ls, studio, date: new Date().toLocaleString() };
  }
  /**
   * The photo as a PNG Blob — the photo camera with its aspect and DoF, never the handles.
   * `info: true` adds a card under the picture with the camera, lights and studio settings, so snapshots
   * can be compared. The full state is always embedded in the PNG (readable with readSnapshot()).
   */
  async function snapshot({ info = false, title = '', width = 0 } = {}) {
    const was = view;
    if (was !== 'camera') { view = 'camera'; resize(); }
    if (width) {                                         // a fixed output size (e.g. 1920 → 1920×1080 at 16:9)
      const h = Math.round(width / photoAspect);
      renderer.setPixelRatio(1); renderer.setSize(width, h, false);
      composer.setPixelRatio(1); composer.setSize(width, h);
    }
    content.updateMatrixWorld(true);
    camera.lookAt(targets.camera);
    draw(camera, { handles: false });
    let out = canvas;
    if (info) {
      const w = canvas.width, h = canvas.height, k = w / 1000, inf = snapshotInfo();
      const lines = [['CAMERA', inf.camera], ...inf.lights.map((l, i) => [i ? '' : 'LIGHTS', l]), ['STUDIO', inf.studio]];
      const lh = Math.round(19 * k), pad = Math.round(14 * k), cardH = pad * 2 + lh * (lines.length + (title ? 1 : 0)) + Math.round(6 * k);
      out = document.createElement('canvas'); out.width = w; out.height = h + cardH;
      const x = out.getContext('2d');
      x.drawImage(canvas, 0, 0);                          // same task as the render: the buffer is still valid
      x.fillStyle = '#141417'; x.fillRect(0, h, w, cardH);
      x.textBaseline = 'top';
      let y = h + pad;
      if (title) { x.font = `600 ${Math.round(14 * k)}px -apple-system, "Segoe UI", sans-serif`; x.fillStyle = '#ff5a4d'; x.fillText(title, pad, y); y += lh; }
      for (const [label, text] of lines) {
        x.font = `600 ${Math.round(10.5 * k)}px -apple-system, "Segoe UI", sans-serif`; x.fillStyle = '#8a8a94'; x.fillText(label, pad, y + 2 * k);
        x.font = `${Math.round(12.5 * k)}px -apple-system, "Segoe UI", sans-serif`; x.fillStyle = '#e6e6ea'; x.fillText(text, pad + 70 * k, y, w - pad * 2 - 70 * k);
        y += lh;
      }
      x.font = `${Math.round(10 * k)}px -apple-system, "Segoe UI", sans-serif`; x.fillStyle = '#5c5c66'; x.textAlign = 'right'; x.fillText(inf.date, w - pad, h + pad);
    }
    const blob = await new Promise((res) => out.toBlob(res, 'image/png'));
    if (was !== 'camera') view = was;
    if (width || was !== 'camera') resize();
    invalidate();
    return withPngText(blob, 'lightstudio', JSON.stringify(getState()));
  }

  // ---- state -------------------------------------------------------------------------------------------
  function getState() {
    const c = getCamera();
    return {
      version: 1, subject: subjectId, turn,
      lights: listLights().map(({ id, type, role, kelvin, color, intensity, cone, softness, size, shadow, position, target }) =>
        ({ id, type, role, kelvin, color, intensity, cone, softness, size, shadow, position, target })),
      camera: { position: c.position, target: c.target, focalMm: c.focalMm, sensorMm: c.sensorMm, aspect: photoAspect,
        dof: { on: dof.on, fstop: dof.fstop, focus: dof.focus, focusDist: dof.focusDist, point: dof.point?.toArray() || null },
        iso: expo.iso, shutter: expo.shutter, wb: expo.wb },
      world: { ...world },
    };
  }
  async function setState(st) {
    if (st.subject && st.subject !== subjectId && subjects[st.subject]) await loadSubject(st.subject);   // an imported model can't come back by itself
    if (st.turn != null) setTurn(st.turn);
    if (st.lights) { clearLights(); st.lights.forEach((l) => addLight(l)); }
    if (st.camera) {
      const c = st.camera;
      if (c.position) camera.position.fromArray(c.position);
      if (c.target) targets.camera.fromArray(c.target);
      setCamera({ focalMm: c.focalMm, sensorMm: c.sensorMm, aspect: c.aspect, iso: c.iso, shutter: c.shutter, wb: c.wb });
      if (c.dof) { Object.assign(dof, c.dof); dof.point = c.dof.point ? new THREE.Vector3().fromArray(c.dof.point) : null; }
      controls.update();
    }
    if (st.world) setWorld(st.world);
    emit('change', { what: 'state' });
  }

  // ---- dispose -----------------------------------------------------------------------------------------
  function disposeNode(o) {
    o.geometry?.dispose();
    for (const m of [].concat(o.material || [])) { for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose(); }
  }
  function dispose() {
    renderer.setAnimationLoop(null);
    ro.disconnect();
    canvas.removeEventListener('pointerdown', onDown, { capture: true });
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('keydown', onMods); window.removeEventListener('keyup', onMods);
    controls.dispose();
    for (const L of lights.values()) disposeLightObject(L);
    lights.clear();
    scene.traverse(disposeNode);
    loaded.clear();
    envTex.dispose(); pmrem.dispose(); depthRT.dispose(); composer.dispose?.();
    renderer.dispose(); renderer.forceContextLoss();
    canvas.remove(); pip.remove(); guides.remove();
    listeners.clear();
  }

  // ---- start -------------------------------------------------------------------------------------------
  resize();
  camera.position.copy(sph(0, 5, 3.2, subjectTarget));
  targets.camera.copy(subjectTarget); camera.lookAt(targets.camera);
  studioCam.position.copy(sph(35, 25, 6, subjectTarget));
  targets.studio.copy(subjectTarget).setY(1);
  controls.update();
  if (opts.state) await setState(opts.state);
  else {
    await loadSubject(opts.subject || 'bust');
    applyPreset(opts.preset || 'three-point');
  }

  return {
    // subjects
    loadSubject, setTurn, getTurn: () => turn, listSubjects: () => Object.entries(subjects).map(([id, s]) => ({ id, name: s.name, credit: s.credit })),
    // lights
    addLight, updateLight, removeLight, listLights, getLight: (id) => (lights.has(id) ? lightInfo(lights.get(id)) : null),
    clearLights, applyPreset, listPresets: () => Object.keys(PRESETS).map(presetInfo), select, getSelected: () => selected,
    // camera / lens
    setCamera, getCamera, focusOn, dofRange,
    // views: 'studio' (free look, place lights) / 'camera' (the photo, framed); the monitor shows the other
    setView, getView: () => view, setAspect, setGuides: (on) => { showGuides = !!on; resize(); }, setMonitor: (on) => { showMonitor = !!on; resize(); },
    pickFocus: (on = true) => { pickFocus = on; canvas.style.cursor = on ? 'crosshair' : ''; },
    // world
    setWorld, getWorld: () => ({ ...world }),
    // state
    getState, setState,
    // events: 'select' | 'lightmove' | 'camera' | 'change' | 'focuspick' | 'challenge' → returns an unsubscribe function
    on(name, cb) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(cb); return () => { const a = listeners.get(name); if (a) a.splice(a.indexOf(cb), 1); }; },
    resize, dispose,
    snapshot, snapshotInfo, readSnapshot,
    // your own models (optional — everything else works without downloading anything)
    importModel,
    // challenge: recreate a reference
    startChallenge, checkChallenge, solveChallenge, endChallenge, getChallenge: () => (challenge ? { id: challenge.id, reference: challenge.reference } : null),
    three: { THREE, renderer, scene, camera, controls, _post: { dofPass, smoothPass, depthRT, composer } },   // escape hatch (advanced use)
  };
}

/** Infinity cove: floor that curves up into the back wall. Profile in (z, y), extruded along X. */
function coveGeometry({ width = 9, depthFront = 4, wallZ = -3.4, radius = 1.2, height = 4.5 } = {}) {
  const prof = [[depthFront, 0], [wallZ + radius, 0]];
  for (let i = 1; i <= 16; i++) {
    const a = (i / 16) * Math.PI / 2;
    prof.push([wallZ + radius - Math.sin(a) * radius, radius - Math.cos(a) * radius]);
  }
  prof.push([wallZ, height]);
  const pos = [], idx = [];
  for (const [z, y] of prof) pos.push(-width / 2, y, z, width / 2, y, z);
  for (let i = 0; i < prof.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---- PNG text chunks: the snapshot carries the full state (drop it back in to restore the setup) ---------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
/** Insert a tEXt chunk (key, latin-1 safe text — the JSON is URI-encoded) before IEND. */
async function withPngText(blob, key, text) {
  const png = new Uint8Array(await blob.arrayBuffer());
  const data = new TextEncoder().encode(`${key}\0${encodeURIComponent(text)}`);
  const chunk = new Uint8Array(12 + data.length), dv = new DataView(chunk.buffer);
  dv.setUint32(0, data.length);
  chunk.set([0x74, 0x45, 0x58, 0x74], 4);          // 'tEXt'
  chunk.set(data, 8);
  dv.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  const iend = png.length - 12;                     // IEND is always the last 12 bytes
  return new Blob([png.subarray(0, iend), chunk, png.subarray(iend)], { type: 'image/png' });
}
/** The setup stored in a snapshot PNG (File/Blob) → state for setState(), or null. */
export async function readSnapshot(file) {
  const b = new Uint8Array(await file.arrayBuffer()), dv = new DataView(b.buffer);
  for (let i = 8; i + 8 <= b.length;) {
    const len = dv.getUint32(i), type = String.fromCharCode(...b.subarray(i + 4, i + 8));
    if (type === 'tEXt') {
      const s = new TextDecoder('latin1').decode(b.subarray(i + 8, i + 8 + len)), z = s.indexOf('\0');
      if (s.slice(0, z) === 'lightstudio') return JSON.parse(decodeURIComponent(s.slice(z + 1)));
    }
    i += 12 + len;
  }
  return null;
}
