# AVHandbook — módulos de AUDIO (briefing para empezar)

Preparado en MissionControl (9 ago 2026). **Ejecutar en la sesión de AVHandbook.**
Origen de la idea: se decidió en MissionControl que AVHandbook mantiene la "AV" precisamente porque
va a **añadir teoría de SONIDO** (por eso NO se llamó "VideoHandbook"). Este archivo es la propuesta
concreta de módulos + las reglas para que encajen con lo que ya hay.

---

## 0. Regla de oro: frontera con SoundLab (NO duplicar)
- **SoundLab** (`soundlab.cinemafilmak.com`) = **patio de juegos de la FÍSICA del sonido**: osciladores,
  ADSR, tremolo/vibrato, batidos, ruido, filtros, **muestreo/Nyquist**, estéreo/Haas. Mover parámetros y oír.
- **AVHandbook** = **teoría/referencia de AUDIO DE PRODUCCIÓN** para realización A/V: micros, niveles,
  sonido directo en set, sincronía, flujo de post, formatos de entrega. Leer/consultar + un artefacto interactivo por módulo.
- **Donde se rozan** (muestreo/bit depth, estéreo, psicoacústica): AVHandbook explica la **convención
  profesional/el porqué en producción** y **ENLAZA a SoundLab** para "jugar con la física". No se reimplementan
  los osciladores de SoundLab aquí.
- **Puentes a las apps de la suite** (esto es lo que hace único a AVHandbook): cada módulo relevante enlaza a
  **LoudnessFixR** (loudness), **QRClappeR** (timecode/iXML de claqueta) y **AudioPatchR** (enrutado). Enseñar → practicar en la herramienta propia.

## 1. Encaje técnico (recordatorios del propio AVHandbook)
- Fuente: `~/Proyectos/avhandbook/src/App.jsx` — **un solo componente** `AVHandbook` (~2100 líneas), sistema de
  **categorías + módulos** con artefactos interactivos (canvas + sliders arrastrables). Añadir audio = **una
  categoría nueva "Audio"** con sus módulos, siguiendo el patrón de las existentes (p.ej. la de Lighting/Signals).
- **GOTCHA ya conocido:** NO definir subcomponentes (p.ej. una `Row` con sliders) DENTRO del render de un módulo
  → remontan en cada cambio (parpadeo + pierden foco). **Hoistear al top level** (patrón `ExpRow`).
- **i18n (es/eu) sigue PENDIENTE** en AVHandbook — no bloquear por ello: redacta el contenido en el idioma/estilo
  actual del App.jsx y deja las cadenas preparadas para el futuro i18n. (SoundLab sí es trilingüe; AVHandbook aún no.)
- Deploy y gotchas de siempre: push→Actions→gh-pages, **mantener `public/.nojekyll`**, no commitear `dist/`.
  (Recordatorio aparte: sigue **PENDIENTE el DNS `CNAME avhandbook→ondarrupeasu.github.io`** + Enforce HTTPS, manual de Alex.)

---

## 2. Propuesta de módulos (por fases)

### FASE A — Núcleo (empezar aquí, 4 módulos)
- **A1 · La cadena de audio (flujo de señal).** mic → previo/ganancia → grabadora/mesa → post/entrega.
  *Interactivo:* diagrama por etapas; al pinchar cada etapa, qué hace y dónde se ajusta la ganancia (gain staging).
  Es el "mapa" que orienta todo lo demás.
- **A2 · Micrófonos: patrones polares.** omni / cardioide / hipercardioide / shotgun / figura-8.
  *Interactivo (módulo estrella, estilo el de iluminación por normales):* fuente de sonido **arrastrable** alrededor
  del micro → gráfico polar que muestra cuánto recoge según el ángulo; selector de patrón. Concepto de rechazo fuera de eje.
- **A3 · Niveles y medición: dBFS, headroom, clipping.** la escala digital (0 dBFS = techo), **pico vs RMS**,
  margen (headroom), qué es "recortar". *Interactivo:* vúmetro con una señal; subir ganancia hasta clipear en 0 dBFS,
  zona de headroom marcada. Aquí se explica también **por qué se graba con margen** (no pegado a 0).
- **A4 · Loudness / EBU R128.** LUFS (integrado / short-term / momentary), **LRA**, **true peak**, el objetivo
  **-23 LUFS** (broadcast) / -14 (streaming). *Interactivo:* medidor de loudness sobre un clip con línea de objetivo.
  **→ Puente directo: "esto lo automatiza tu LoudnessFixR".** (Teoría aquí; práctica en la app.)

### FASE B — Producción / set
- **B1 · Tipos de micro y colocación.** dinámico vs condensador (+phantom), **lavalier vs shotgun/boom**;
  cuándo cada uno; **efecto de proximidad**. *Interactivo:* escena con posiciones de boom/lav y un slider de
  distancia → nivel/tono resultante (proximidad, off-axis).
- **B2 · Sonido directo en set.** **room tone**, ruido de manejo, viento (**deadcat/zeppelin**), reflexiones/eco de sala,
  wild lines. *Interactivo:* toggles de problemas (viento, reflexión, hum) sobre una forma de onda + "qué hacer".
- **B3 · Sincronía y timecode.** sonido sincrónico, **48 kHz** estándar, **jam sync**, claqueta, **iXML/BWF** (metadatos
  embebidos en el WAV). *Interactivo:* línea de tiempo picture+sound con offset y punto de sync (claqueta).
  **→ Puente fuerte a QRClappeR/ClapTag** (que ya trabaja iXML/timecode de claqueta). Ángulo único de tu ecosistema.

### FASE C — Post / entrega
- **C1 · Flujo de post de audio.** diálogo/edición, **ADR**, **Foley**, ambientes, SFX, música; la mezcla en
  **D/M/E** (diálogo-música-efectos) y la **M&E** para doblaje. *Interactivo:* mezclador simplificado de stems
  (subir/bajar D/M/E) → cómo cambia la inteligibilidad del diálogo. **→ enlaza a AudioPatchR** (enrutado de buses).
- **C2 · Estéreo y surround para pantalla.** compatibilidad **mono**, LCR, 5.1, nociones de **Atmos/objetos**, **fase**
  y por qué importa. *Interactivo:* panorama con L/R/C + medidor de correlación de fase. **→ enlaza a SoundLab**
  (estéreo/Haas para la física); aquí, los formatos de ENTREGA.
- **C3 · Formatos y muestreo en producción.** por qué **48 kHz / 24 bits** en A/V (y no 44.1), **WAV/BWF/Poly WAV**,
  pull-up/down. *Interactivo:* mínimo; el grueso de la física del muestreo **vive en SoundLab (Nyquist)** → enlazar allí.

### Transversal — a COORDINAR, no duplicar
- **Conectores de audio (XLR balanceado vs no balanceado, phantom, por qué el balanceado rechaza ruido).**
  ⚠️ AVHandbook **ya tiene** un módulo "Signals" con **"XLR vs DMX"**. Decisión a tomar en la sesión: **extender ese
  módulo** con la parte de audio balanceado, o módulo propio "Audio Connectors" que **enlace** al de Signals. NO repetir.
- **Psicoacústica (equal-loudness/Fletcher-Munson, enmascaramiento).** Encaja como teoría aquí, pero la curva es
  interactiva y podría vivir en SoundLab. Decidir: módulo teórico breve en AVHandbook **enlazando** a un experimento de SoundLab.

---

## 3. Orden recomendado
Empezar por **Fase A** (A1 mapa → A2 polares, que es el artefacto más vistoso → A3 niveles → A4 loudness con puente a
LoudnessFixR). Con esos cuatro, la categoría "Audio" ya es utilizable en clase. Luego B (set) y C (post) según interese.
Antes de tocar código, **decidir lo transversal** (conectores: extender "Signals" o módulo nuevo) para no duplicar.

## 4. Créditos/licencia
Nada externo que arrastre licencias aquí (contenido y artefactos propios). Si algún experimento se comparte con
SoundLab, reusar el planteamiento propio; no hay dependencia de terceros que obligue a avisos.
