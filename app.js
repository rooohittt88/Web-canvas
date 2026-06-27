

'use strict';

const splash        = document.getElementById('splash');
const app           = document.getElementById('app');
const mainCanvas    = document.getElementById('mainCanvas');
const overlayCanvas = document.getElementById('overlayCanvas');
const canvasWrapper = document.getElementById('canvasWrapper');
const textInput     = document.getElementById('textInput');
const coordsDisplay = document.getElementById('coordsDisplay');
const zoomRange     = document.getElementById('zoomRange');
const zoomVal       = document.getElementById('zoomVal');
const zoomStatus    = document.getElementById('zoomStatus');
const toolNameEl    = document.getElementById('toolName');
const canvasSizeEl  = document.getElementById('canvasSize');
const historyStatus = document.getElementById('historyStatus');
const toast         = document.getElementById('toast');

const ctx  = mainCanvas.getContext('2d');
const octx = overlayCanvas.getContext('2d');

/* ---------- State ---------- */
const state = {
  tool:       'pen',
  brushType:  'round',
  strokeColor:'#000000',
  fillColor:  '#ffffff',
  fillMode:   'none',      // 'none' | 'fill' | 'both'
  size:       10,
  hardness:   80,
  spacing:    5,
  angle:      0,
  opacity:    100,
  zoom:       1,
  bold:       false,
  italic:     false,
  underline:  false,
  fontSize:   24,
  fontFamily: 'Arial',
  drawing:    false,
  lastX:      0,
  lastY:      0,
  startX:     0,
  startY:     0,
  history:    [],
  histIdx:    -1,
  layers:     1,
  activeLayer:0,
  selection:  null,
  textPos:    { x:0, y:0 },
  imageData:  null,         // snapshot before shape-preview
};


splash.addEventListener('animationend', () => {
  splash.style.display = 'none';
  app.classList.remove('hidden');
  initCanvas(800, 600);
  buildPalette();
  buildGradients();
  saveHistory();
});


function initCanvas(w, h) {
  mainCanvas.width    = w;
  mainCanvas.height   = h;
  overlayCanvas.width = w;
  overlayCanvas.height = h;
  canvasWrapper.style.width  = w + 'px';
  canvasWrapper.style.height = h + 'px';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  canvasSizeEl.textContent = `Canvas: ${w} × ${h}`;
}

const PALETTE_COLORS = [
  '#000000','#1a1a2e','#16213e','#0f3460','#533483','#e94560',
  '#ffffff','#f5f5f5','#e0e0e0','#9e9e9e','#616161','#212121',
  '#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3',
  '#03a9f4','#00bcd4','#009688','#4caf50','#8bc34a','#cddc39',
  '#ffeb3b','#ffc107','#ff9800','#ff5722','#795548','#607d8b',
  '#b71c1c','#880e4f','#4a148c','#1a237e','#0d47a1','#01579b',
  '#006064','#1b5e20','#33691e','#f57f17','#e65100','#bf360c',
  '#fce4ec','#e8eaf6','#e3f2fd','#e8f5e9','#fff8e1','#fbe9e7',
  '#ff6584','#6c63ff','#43e97b','#fa709a','#fee140','#30cfd0',
];

function buildPalette() {
  const pal = document.getElementById('palette');
  PALETTE_COLORS.forEach(c => {
    const d = document.createElement('div');
    d.className = 'palette-color';
    d.style.background = c;
    d.title = c;
    d.addEventListener('click', e => {
      if (e.shiftKey) { setFillColor(c); } else { setStrokeColor(c); }
    });
    d.addEventListener('contextmenu', e => { e.preventDefault(); setFillColor(c); });
    pal.appendChild(d);
  });
}

const GRADIENTS = [
  ['#f953c6','#b91d73'],
  ['#43e97b','#38f9d7'],
  ['#4facfe','#00f2fe'],
  ['#fa709a','#fee140'],
  ['#a18cd1','#fbc2eb'],
  ['#fccb90','#d57eeb'],
  ['#667eea','#764ba2'],
  ['#f093fb','#f5576c'],
];

function buildGradients() {
  const gl = document.getElementById('gradientList');
  GRADIENTS.forEach(([c1, c2]) => {
    const d = document.createElement('div');
    d.className = 'gradient-swatch';
    d.style.background = `linear-gradient(90deg, ${c1}, ${c2})`;
    d.title = `Gradient ${c1} → ${c2}`;
    d.addEventListener('click', () => {
      setStrokeColor(c1);
      showToast(`Gradient picked: ${c1} → ${c2}`);
    });
    gl.appendChild(d);
  });
}

function setStrokeColor(c) {
  state.strokeColor = c;
  document.getElementById('strokeColorPicker').value = c;
  document.getElementById('fgColorSwatch').style.background = c;
}

function setFillColor(c) {
  state.fillColor = c;
  document.getElementById('fillColorPicker').value = c;
  document.getElementById('bgColorSwatch').style.background = c;
}

document.getElementById('strokeColorPicker').addEventListener('input', e => setStrokeColor(e.target.value));
document.getElementById('fillColorPicker').addEventListener('input', e => setFillColor(e.target.value));
document.getElementById('fgColorSwatch').addEventListener('click', () => document.getElementById('strokeColorPicker').click());
document.getElementById('bgColorSwatch').addEventListener('click', () => document.getElementById('fillColorPicker').click());

document.getElementById('swapColors').addEventListener('click', () => {
  const tmp = state.strokeColor;
  setStrokeColor(state.fillColor);
  setFillColor(tmp);
});

/* ---------- Tool Selection ---------- */
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;
    updateCursor();
    toolNameEl.textContent = 'Tool: ' + capitalize(state.tool);
    // Show/hide text panel
    document.getElementById('textPanel').style.display = state.tool === 'text' ? 'block' : 'none';
    // Hide text input when switching away
    if (state.tool !== 'text') commitText();
  });
});

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function updateCursor() {
  const cursors = {
    eraser: 'cell', eyedropper: 'crosshair', fill: 'copy',
    text: 'text', move: 'move', select: 'default',
  };
  overlayCanvas.style.cursor = cursors[state.tool] || 'crosshair';
}

/* ---------- Brush Options ---------- */
document.querySelectorAll('.brush-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.brush-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.brushType = btn.dataset.brush;
  });
});

const brushSizeInput  = document.getElementById('brushSize');
const hardnessInput   = document.getElementById('hardness');
const spacingInput    = document.getElementById('spacing');
const angleInput      = document.getElementById('brushAngle');
const opacityInput    = document.getElementById('opacityRange');

brushSizeInput.addEventListener('input', e => {
  state.size = +e.target.value;
  document.getElementById('sizeVal').textContent = state.size + 'px';
});

hardnessInput.addEventListener('input', e => {
  state.hardness = +e.target.value;
  document.getElementById('hardnessVal').textContent = state.hardness + '%';
});

spacingInput.addEventListener('input', e => {
  state.spacing = +e.target.value;
  document.getElementById('spacingVal').textContent = state.spacing + '%';
});

angleInput.addEventListener('input', e => {
  state.angle = +e.target.value;
  document.getElementById('angleVal').textContent = state.angle + '°';
});

opacityInput.addEventListener('input', e => {
  state.opacity = +e.target.value;
  document.getElementById('opacityVal').textContent = state.opacity + '%';
});

/* Fill mode */
document.querySelectorAll('input[name="fillMode"]').forEach(r => {
  r.addEventListener('change', () => { state.fillMode = r.value; });
});

/* ---------- Text Options ---------- */
document.getElementById('fontFamily').addEventListener('change', e => {
  state.fontFamily = e.target.value;
  textInput.style.fontFamily = state.fontFamily;
});

document.getElementById('fontSize').addEventListener('input', e => {
  state.fontSize = +e.target.value;
  document.getElementById('fontSizeVal').textContent = state.fontSize + 'px';
  textInput.style.fontSize = state.fontSize + 'px';
});

['boldBtn','italicBtn','underlineBtn'].forEach(id => {
  document.getElementById(id).addEventListener('click', function() {
    this.classList.toggle('active');
    if (id === 'boldBtn')      { state.bold      = !state.bold;      textInput.style.fontWeight    = state.bold      ? 'bold'   : 'normal'; }
    if (id === 'italicBtn')    { state.italic    = !state.italic;    textInput.style.fontStyle     = state.italic    ? 'italic' : 'normal'; }
    if (id === 'underlineBtn') { state.underline = !state.underline; textInput.style.textDecoration= state.underline ? 'underline' : 'none'; }
  });
});

/* ---------- Zoom ---------- */
zoomRange.addEventListener('input', e => {
  state.zoom = +e.target.value / 100;
  applyZoom();
});

function applyZoom() {
  canvasWrapper.style.transform = `scale(${state.zoom})`;
  const pct = Math.round(state.zoom * 100) + '%';
  zoomVal.textContent = pct;
  zoomStatus.textContent = 'Zoom: ' + pct;
}

// Mouse wheel zoom
document.getElementById('canvasArea').addEventListener('wheel', e => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    let z = state.zoom + (e.deltaY < 0 ? 0.1 : -0.1);
    z = Math.min(4, Math.max(0.1, z));
    state.zoom = z;
    zoomRange.value = Math.round(z * 100);
    applyZoom();
  }
}, { passive: false });

/* ---------- Coordinates ---------- */
function getCanvasPos(e) {
  const rect = overlayCanvas.getBoundingClientRect();
  return {
    x: Math.round((e.clientX - rect.left) / state.zoom),
    y: Math.round((e.clientY - rect.top)  / state.zoom),
  };
}

overlayCanvas.addEventListener('mousemove', e => {
  const p = getCanvasPos(e);
  coordsDisplay.textContent = `x:${p.x} y:${p.y}`;
  if (state.drawing) onMouseMove(e, p);
});

/* ---------- Drawing Events ---------- */
overlayCanvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  const p = getCanvasPos(e);
  onMouseDown(e, p);
});

overlayCanvas.addEventListener('mouseup', e => {
  const p = getCanvasPos(e);
  onMouseUp(e, p);
});

overlayCanvas.addEventListener('mouseleave', e => {
  if (state.drawing) {
    const p = getCanvasPos(e);
    onMouseUp(e, p);
  }
});

// Touch support
overlayCanvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const p = getTouchPos(e);
  onMouseDown({ button: 0 }, p);
}, { passive: false });

overlayCanvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const p = getTouchPos(e);
  if (state.drawing) onMouseMove({}, p);
}, { passive: false });

overlayCanvas.addEventListener('touchend', e => {
  e.preventDefault();
  onMouseUp({}, state);
});

function getTouchPos(e) {
  const rect = overlayCanvas.getBoundingClientRect();
  const t = e.touches[0] || e.changedTouches[0];
  return {
    x: Math.round((t.clientX - rect.left) / state.zoom),
    y: Math.round((t.clientY - rect.top)  / state.zoom),
  };
}

/* ---------- Core Drawing Logic ---------- */
function onMouseDown(e, p) {
  state.drawing = true;
  state.startX  = p.x;
  state.startY  = p.y;
  state.lastX   = p.x;
  state.lastY   = p.y;

  ctx.globalAlpha = state.opacity / 100;

  switch (state.tool) {
    case 'eyedropper': pickColor(p); state.drawing = false; break;
    case 'fill':       floodFill(p.x, p.y, state.strokeColor); state.drawing = false; saveHistory(); break;
    case 'text':       placeTextInput(p); state.drawing = false; break;
    default:
      // Save snapshot for shape previews
      if (['line','rect','circle','triangle','arrow','star'].includes(state.tool)) {
        state.imageData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
      }
      applyStroke(p.x, p.y, p.x, p.y);
  }
}

function onMouseMove(e, p) {
  if (!state.drawing) return;

  if (['line','rect','circle','triangle','arrow','star'].includes(state.tool)) {
    // Restore and redraw preview
    ctx.putImageData(state.imageData, 0, 0);
    drawShape(state.startX, state.startY, p.x, p.y, false);
  } else {
    applyStroke(state.lastX, state.lastY, p.x, p.y);
    state.lastX = p.x;
    state.lastY = p.y;
  }
}

function onMouseUp(e, p) {
  if (!state.drawing) return;
  state.drawing = false;

  if (['line','rect','circle','triangle','arrow','star'].includes(state.tool)) {
    if (state.imageData) ctx.putImageData(state.imageData, 0, 0);
    drawShape(state.startX, state.startY, p.x || state.lastX, p.y || state.lastY, true);
    state.imageData = null;
  }

  ctx.globalAlpha = 1;
  saveHistory();
}

/* ---------- Stroke Application ---------- */
function applyStroke(x1, y1, x2, y2) {
  ctx.globalAlpha = state.opacity / 100;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  switch (state.tool) {
    case 'pen':      drawPen(x1, y1, x2, y2);      break;
    case 'pencil':   drawPencil(x1, y1, x2, y2);   break;
    case 'brush':    drawBrush(x1, y1, x2, y2);    break;
    case 'airbrush': drawAirbrush(x2, y2);          break;
    case 'eraser':   drawEraser(x1, y1, x2, y2);   break;
  }
}

function drawPen(x1, y1, x2, y2) {
  ctx.strokeStyle = state.strokeColor;
  ctx.lineWidth   = state.size;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawPencil(x1, y1, x2, y2) {
  ctx.strokeStyle = state.strokeColor;
  ctx.lineWidth   = Math.max(1, state.size * 0.4);
  ctx.globalAlpha = (state.opacity / 100) * 0.7;
  // Add slight noise for pencil texture
  const steps = Math.max(1, Math.hypot(x2-x1, y2-y1));
  for (let i = 0; i < steps; i++) {
    const t  = i / steps;
    const nx = x1 + (x2-x1)*t + (Math.random()-0.5)*1.5;
    const ny = y1 + (y2-y1)*t + (Math.random()-0.5)*1.5;
    ctx.beginPath();
    ctx.arc(nx, ny, ctx.lineWidth/2, 0, Math.PI*2);
    ctx.fillStyle = state.strokeColor;
    ctx.fill();
  }
}

function drawBrush(x1, y1, x2, y2) {
  const r = state.size / 2;
  const h = state.hardness / 100;
  const grad = ctx.createRadialGradient(x2, y2, 0, x2, y2, r);
  grad.addColorStop(0, hexToRgba(state.strokeColor, state.opacity/100));
  grad.addColorStop(h, hexToRgba(state.strokeColor, (state.opacity/100)*0.6));
  grad.addColorStop(1, hexToRgba(state.strokeColor, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x2, y2, r, 0, Math.PI*2);
  ctx.fill();

  // Also connect the line for smooth strokes
  if (state.brushType === 'square') {
    ctx.strokeStyle = state.strokeColor;
    ctx.lineWidth   = state.size;
    ctx.lineCap     = 'square';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.lineCap = 'round';
  } else if (state.brushType === 'flat') {
    ctx.save();
    ctx.translate(x2, y2);
    ctx.rotate(state.angle * Math.PI / 180);
    ctx.fillStyle = hexToRgba(state.strokeColor, state.opacity/100);
    ctx.fillRect(-state.size/2, -state.size*0.15, state.size, state.size*0.3);
    ctx.restore();
  } else if (state.brushType === 'texture') {
    for (let i = 0; i < 8; i++) {
      const ox = (Math.random()-0.5)*state.size*0.8;
      const oy = (Math.random()-0.5)*state.size*0.8;
      ctx.fillStyle = hexToRgba(state.strokeColor, (state.opacity/100)*0.4);
      ctx.beginPath();
      ctx.arc(x2+ox, y2+oy, Math.random()*3+1, 0, Math.PI*2);
      ctx.fill();
    }
  } else if (state.brushType === 'splatter') {
    for (let i = 0; i < 16; i++) {
      const r2  = Math.random() * state.size * 1.5;
      const ang = Math.random() * Math.PI * 2;
      const ox  = Math.cos(ang)*r2;
      const oy  = Math.sin(ang)*r2;
      ctx.fillStyle = hexToRgba(state.strokeColor, (state.opacity/100)*Math.random()*0.6);
      ctx.beginPath();
      ctx.arc(x2+ox, y2+oy, Math.random()*2.5+0.5, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

function drawAirbrush(x, y) {
  const r = state.size * 1.5;
  for (let i = 0; i < 40; i++) {
    const ang  = Math.random() * Math.PI * 2;
    const dist = Math.random() * r;
    const px   = x + Math.cos(ang) * dist;
    const py   = y + Math.sin(ang) * dist;
    ctx.fillStyle = hexToRgba(state.strokeColor, (state.opacity/100) * 0.04);
    ctx.beginPath();
    ctx.arc(px, py, Math.random() * 1.5 + 0.5, 0, Math.PI*2);
    ctx.fill();
  }
}

function drawEraser(x1, y1, x2, y2) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.strokeStyle = 'rgba(0,0,0,1)';
  ctx.lineWidth   = state.size;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/* ---------- Shapes ---------- */
function drawShape(x1, y1, x2, y2, commit) {
  ctx.globalAlpha = state.opacity / 100;
  ctx.strokeStyle = state.strokeColor;
  ctx.fillStyle   = state.fillColor;
  ctx.lineWidth   = state.size;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  ctx.beginPath();

  switch (state.tool) {
    case 'line':
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      break;

    case 'rect': {
      const w = x2 - x1, h = y2 - y1;
      if (state.fillMode === 'fill' || state.fillMode === 'both') ctx.fillRect(x1, y1, w, h);
      if (state.fillMode !== 'fill') ctx.strokeRect(x1, y1, w, h);
      break;
    }

    case 'circle': {
      const rx = (x2 - x1) / 2, ry = (y2 - y1) / 2;
      const cx = x1 + rx, cy = y1 + ry;
      ctx.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI*2);
      if (state.fillMode === 'fill' || state.fillMode === 'both') ctx.fill();
      if (state.fillMode !== 'fill') ctx.stroke();
      break;
    }

    case 'triangle': {
      const mx = (x1 + x2) / 2;
      ctx.moveTo(mx, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x1, y2);
      ctx.closePath();
      if (state.fillMode === 'fill' || state.fillMode === 'both') ctx.fill();
      if (state.fillMode !== 'fill') ctx.stroke();
      break;
    }

    case 'arrow': {
      const headLen = Math.max(15, state.size * 2);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(ang - Math.PI/6), y2 - headLen * Math.sin(ang - Math.PI/6));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(ang + Math.PI/6), y2 - headLen * Math.sin(ang + Math.PI/6));
      ctx.stroke();
      break;
    }

    case 'star': {
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      const outerR = Math.min(Math.abs(x2-x1), Math.abs(y2-y1)) / 2;
      const innerR = outerR * 0.4;
      const spikes = 5;
      for (let i = 0; i < spikes * 2; i++) {
        const r   = i % 2 === 0 ? outerR : innerR;
        const ang = (Math.PI / spikes) * i - Math.PI / 2;
        const px  = cx + Math.cos(ang) * r;
        const py  = cy + Math.sin(ang) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (state.fillMode === 'fill' || state.fillMode === 'both') ctx.fill();
      if (state.fillMode !== 'fill') ctx.stroke();
      break;
    }
  }

  ctx.globalAlpha = 1;
}

/* ---------- Flood Fill ---------- */
function floodFill(startX, startY, color) {
  const imgData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
  const data    = imgData.data;
  const W       = mainCanvas.width;
  const H       = mainCanvas.height;

  const toIdx = (x, y) => (y * W + x) * 4;
  const targetIdx = toIdx(startX, startY);
  const targetR = data[targetIdx], targetG = data[targetIdx+1];
  const targetB = data[targetIdx+2], targetA = data[targetIdx+3];

  const fillRgb = hexToRgb(color);
  if (!fillRgb) return;

  if (targetR === fillRgb.r && targetG === fillRgb.g && targetB === fillRgb.b) return;

  const stack = [[startX, startY]];
  const visited = new Uint8Array(W * H);

  function match(i) {
    return Math.abs(data[i]-targetR) < 30 &&
           Math.abs(data[i+1]-targetG) < 30 &&
           Math.abs(data[i+2]-targetB) < 30 &&
           Math.abs(data[i+3]-targetA) < 30;
  }

  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const vidx = y * W + x;
    if (visited[vidx]) continue;
    const i = vidx * 4;
    if (!match(i)) continue;
    visited[vidx] = 1;
    data[i]   = fillRgb.r;
    data[i+1] = fillRgb.g;
    data[i+2] = fillRgb.b;
    data[i+3] = 255;
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }

  ctx.putImageData(imgData, 0, 0);
}

/* ---------- Eyedropper ---------- */
function pickColor(p) {
  const pixel = ctx.getImageData(p.x, p.y, 1, 1).data;
  const hex   = rgbToHex(pixel[0], pixel[1], pixel[2]);
  setStrokeColor(hex);
  showToast('Color picked: ' + hex);
}

/* ---------- Text Tool ---------- */
function placeTextInput(p) {
  state.textPos = { x: p.x, y: p.y };
  textInput.style.display    = 'block';
  textInput.style.left       = p.x + 'px';
  textInput.style.top        = p.y + 'px';
  textInput.style.fontFamily = state.fontFamily;
  textInput.style.fontSize   = state.fontSize + 'px';
  textInput.style.color      = state.strokeColor;
  textInput.style.fontWeight = state.bold      ? 'bold'      : 'normal';
  textInput.style.fontStyle  = state.italic    ? 'italic'    : 'normal';
  textInput.style.textDecoration = state.underline ? 'underline' : 'none';
  textInput.value = '';
  textInput.focus();
}

textInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') { textInput.style.display = 'none'; textInput.value = ''; }
  if (e.key === 'Enter' && e.ctrlKey) commitText();
});

function commitText() {
  if (textInput.style.display === 'none') return;
  const txt = textInput.value.trim();
  if (txt) {
    ctx.save();
    ctx.globalAlpha = state.opacity / 100;
    ctx.fillStyle   = state.strokeColor;
    let font = '';
    if (state.bold)   font += 'bold ';
    if (state.italic) font += 'italic ';
    font += `${state.fontSize}px ${state.fontFamily}`;
    ctx.font = font;
    ctx.textBaseline = 'top';
    const lines = txt.split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, state.textPos.x, state.textPos.y + i * state.fontSize * 1.2);
    });
    if (state.underline) {
      lines.forEach((line, i) => {
        const w = ctx.measureText(line).width;
        const y = state.textPos.y + (i+1) * state.fontSize * 1.2 - 2;
        ctx.strokeStyle = state.strokeColor;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(state.textPos.x, y);
        ctx.lineTo(state.textPos.x + w, y);
        ctx.stroke();
      });
    }
    ctx.restore();
    saveHistory();
  }
  textInput.style.display = 'none';
  textInput.value = '';
}

overlayCanvas.addEventListener('click', e => {
  if (state.tool === 'text' && textInput.style.display === 'block') {
    commitText();
  }
});

/* ---------- Filters ---------- */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    applyFilter(btn.dataset.filter);
    showToast('Filter applied: ' + btn.dataset.filter);
    saveHistory();
  });
});

function applyFilter(f) {
  const imgData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
  const d = imgData.data;

  if (f === 'grayscale') {
    for (let i = 0; i < d.length; i += 4) {
      const v = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
      d[i] = d[i+1] = d[i+2] = v;
    }
  } else if (f === 'invert') {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255-d[i]; d[i+1] = 255-d[i+1]; d[i+2] = 255-d[i+2];
    }
  } else if (f === 'sepia') {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      d[i]   = Math.min(255, r*0.393 + g*0.769 + b*0.189);
      d[i+1] = Math.min(255, r*0.349 + g*0.686 + b*0.168);
      d[i+2] = Math.min(255, r*0.272 + g*0.534 + b*0.131);
    }
  } else if (f === 'blur') {
    applyConvolution(imgData, [1,2,1, 2,4,2, 1,2,1], 16);
  } else if (f === 'sharpen') {
    applyConvolution(imgData, [0,-1,0, -1,5,-1, 0,-1,0], 1);
  } else if (f === 'emboss') {
    applyConvolution(imgData, [-2,-1,0, -1,1,1, 0,1,2], 1);
  } else if (f === 'brightness+') {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255,d[i]+30); d[i+1] = Math.min(255,d[i+1]+30); d[i+2] = Math.min(255,d[i+2]+30);
    }
  } else if (f === 'brightness-') {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.max(0,d[i]-30); d[i+1] = Math.max(0,d[i+1]-30); d[i+2] = Math.max(0,d[i+2]-30);
    }
  }

  if (!['blur','sharpen','emboss'].includes(f)) ctx.putImageData(imgData, 0, 0);
}

function applyConvolution(imgData, kernel, divisor) {
  const src  = new Uint8ClampedArray(imgData.data);
  const d    = imgData.data;
  const W    = imgData.width;
  const H    = imgData.height;

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y+ky)*W + (x+kx))*4 + c;
            sum += src[idx] * kernel[(ky+1)*3 + (kx+1)];
          }
        }
        d[(y*W+x)*4+c] = Math.min(255, Math.max(0, sum / divisor));
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/* ---------- History ---------- */
function saveHistory() {
  // Truncate redo stack
  state.history = state.history.slice(0, state.histIdx + 1);
  const snap = mainCanvas.toDataURL();
  state.history.push(snap);
  if (state.history.length > 50) state.history.shift();
  state.histIdx = state.history.length - 1;
  updateHistoryStatus();
}

function undo() {
  if (state.histIdx <= 0) { showToast('Nothing to undo'); return; }
  state.histIdx--;
  restoreSnapshot(state.history[state.histIdx]);
  updateHistoryStatus();
}

function redo() {
  if (state.histIdx >= state.history.length - 1) { showToast('Nothing to redo'); return; }
  state.histIdx++;
  restoreSnapshot(state.history[state.histIdx]);
  updateHistoryStatus();
}

function restoreSnapshot(dataURL) {
  const img = new Image();
  img.onload = () => { ctx.drawImage(img, 0, 0); };
  img.src = dataURL;
}

function updateHistoryStatus() {
  historyStatus.textContent = `History: ${state.histIdx} / ${state.history.length - 1}`;
}

document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);

/* ---------- Clear ---------- */
document.getElementById('clearBtn').addEventListener('click', () => {
  if (!confirm('Clear the canvas?')) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
  saveHistory();
  showToast('Canvas cleared');
});

/* ---------- New ---------- */
document.getElementById('newBtn').addEventListener('click', () => {
  if (!confirm('Start a new canvas? Unsaved work will be lost.')) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
  state.history = [];
  state.histIdx = -1;
  saveHistory();
  showToast('New canvas created');
});

/* ---------- Save ---------- */
document.getElementById('saveBtn').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'drawing-canvas-' + Date.now() + '.png';
  link.href = mainCanvas.toDataURL('image/png');
  link.click();
  showToast('Image saved!');
});

/* ---------- Open ---------- */
document.getElementById('openBtn').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      initCanvas(img.width, img.height);
      ctx.drawImage(img, 0, 0);
      saveHistory();
      showToast('Image opened!');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

/* ---------- Canvas Size ---------- */
const sizeSelect      = document.getElementById('canvasSizeSelect');
const customSizeModal = document.getElementById('customSizeModal');

sizeSelect.addEventListener('change', e => {
  if (e.target.value === 'custom') {
    customSizeModal.classList.remove('hidden');
    return;
  }
  const [w, h] = e.target.value.split('x').map(Number);
  resizeCanvas(w, h);
});

document.getElementById('applySize').addEventListener('click', () => {
  const w = +document.getElementById('customW').value;
  const h = +document.getElementById('customH').value;
  resizeCanvas(w, h);
  customSizeModal.classList.add('hidden');
});

document.getElementById('cancelSize').addEventListener('click', () => {
  sizeSelect.value = '800x600';
  customSizeModal.classList.add('hidden');
});

function resizeCanvas(w, h) {
  const snap = mainCanvas.toDataURL();
  initCanvas(w, h);
  const img = new Image();
  img.onload = () => { ctx.drawImage(img, 0, 0); saveHistory(); };
  img.src = snap;
  showToast(`Canvas resized to ${w} × ${h}`);
}

/* ---------- Layers (UI) ---------- */
let layerCount = 1;

document.getElementById('addLayerBtn').addEventListener('click', () => {
  layerCount++;
  const list = document.getElementById('layerList');
  const item = document.createElement('div');
  item.className = 'layer-item';
  item.dataset.layer = layerCount - 1;
  item.innerHTML = `<span class="layer-vis">👁</span><span class="layer-name">Layer ${layerCount}</span><span class="layer-del" title="Delete">✕</span>`;
  list.prepend(item);
  activateLayer(item);
  showToast(`Layer ${layerCount} added`);
});

document.getElementById('layerList').addEventListener('click', e => {
  const item = e.target.closest('.layer-item');
  if (!item) return;
  if (e.target.classList.contains('layer-del')) {
    if (document.querySelectorAll('.layer-item').length === 1) {
      showToast('Cannot delete the only layer');
      return;
    }
    item.remove();
    const first = document.querySelector('.layer-item');
    if (first) activateLayer(first);
    return;
  }
  activateLayer(item);
});

function activateLayer(item) {
  document.querySelectorAll('.layer-item').forEach(i => i.classList.remove('active'));
  item.classList.add('active');
}

/* ---------- Keyboard Shortcuts ---------- */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

  const shortcuts = {
    'p': 'pen', 'n': 'pencil', 'b': 'brush', 'a': 'airbrush',
    'e': 'eraser', 'f': 'fill', 'i': 'eyedropper', 't': 'text',
    'l': 'line', 'r': 'rect', 'c': 'circle', 's': 'select', 'm': 'move',
  };

  if (!e.ctrlKey && !e.metaKey) {
    const tool = shortcuts[e.key.toLowerCase()];
    if (tool) {
      const btn = document.querySelector(`[data-tool="${tool}"]`);
      if (btn) btn.click();
      return;
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); document.getElementById('saveBtn').click(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); document.getElementById('newBtn').click(); }

  // Zoom shortcuts
  if ((e.ctrlKey || e.metaKey) && e.key === '=') {
    e.preventDefault();
    state.zoom = Math.min(4, state.zoom + 0.25);
    zoomRange.value = Math.round(state.zoom * 100);
    applyZoom();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '-') {
    e.preventDefault();
    state.zoom = Math.max(0.1, state.zoom - 0.25);
    zoomRange.value = Math.round(state.zoom * 100);
    applyZoom();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '0') {
    e.preventDefault();
    state.zoom = 1;
    zoomRange.value = 100;
    applyZoom();
  }

  // Brush size
  if (e.key === '[') { brushSizeInput.value = Math.max(1, state.size - 2); brushSizeInput.dispatchEvent(new Event('input')); }
  if (e.key === ']') { brushSizeInput.value = Math.min(100, state.size + 2); brushSizeInput.dispatchEvent(new Event('input')); }
});

/* ---------- Helpers ---------- */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return { r, g, b };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2,'0')).join('');
}

/* ---------- Toast ---------- */
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

/* ---------- Drag to open ---------- */
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => { initCanvas(img.width, img.height); ctx.drawImage(img, 0, 0); saveHistory(); showToast('Image dropped!'); };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});
