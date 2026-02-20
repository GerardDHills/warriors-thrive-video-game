/* Warriors Thrive — static MVP
   - Pass-and-play
   - Minimal movement graph (replace via mapper export)
   - 1 crystal max per player; deliver to hospital one-by-one
*/

const CHARACTERS = [
  { id: 'theo', label: 'Theo' },
  { id: 'luciana', label: 'Luciana' },
  { id: 'malcolm', label: 'Malcolm' },
  { id: 'tasha', label: 'Tasha' },
  { id: 'krystal', label: 'Krystal' },
  { id: 'ritika', label: 'Ritika' },
  { id: 'dr_amos', label: 'Dr. Amos' },
  { id: 'dr_kim', label: 'Dr. Kim' }
];

// Minimal starter graph so it runs. Use mapper.html to build a full replica and paste JSON into localStorage.
const DEFAULT_GRAPH = {
  nodes: [
    { id: 'IN', x: 0.90, y: 0.47, kind: 'in', label: 'IN' },
    { id: 'H1', x: 0.80, y: 0.47, kind: 'hallway' },
    { id: 'H2', x: 0.70, y: 0.47, kind: 'hallway' },
    { id: 'H3', x: 0.60, y: 0.47, kind: 'hallway' },
    { id: 'H4', x: 0.50, y: 0.47, kind: 'hallway' },
    { id: 'H5', x: 0.40, y: 0.47, kind: 'hallway' },
    { id: 'OUT', x: 0.10, y: 0.47, kind: 'out', label: 'OUT' },
    { id: 'HOSPITAL', x: 0.92, y: 0.80, kind: 'hospital', label: 'Hospital' }
  ],
  edges: [
    { from: 'IN', to: 'H1', cost: 0 },
    { from: 'H1', to: 'H2', cost: 1 },
    { from: 'H2', to: 'H3', cost: 1 },
    { from: 'H3', to: 'H4', cost: 1 },
    { from: 'H4', to: 'H5', cost: 1 },
    { from: 'H5', to: 'OUT', cost: 1 },
    { from: 'H1', to: 'IN', cost: 0 },
    { from: 'H2', to: 'H1', cost: 1 },
    { from: 'H3', to: 'H2', cost: 1 },
    { from: 'H4', to: 'H3', cost: 1 },
    { from: 'H5', to: 'H4', cost: 1 },
    { from: 'OUT', to: 'H5', cost: 1 },
    { from: 'OUT', to: 'HOSPITAL', cost: 0 },
    { from: 'HOSPITAL', to: 'OUT', cost: 0 }
  ]
};

const SAMPLE_DECK = [
  {
    id: 'w1',
    question: 'In a clinical trial, which phase is primarily designed to test safety?',
    choices: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'],
    correctIndex: 0
  },
  {
    id: 'w2',
    question: 'In sickle cell disease, what can block small blood vessels and cause pain crises?',
    choices: ['Sickle-shaped red blood cells', 'Platelets only', 'Bacteria', 'Oxygen bubbles'],
    correctIndex: 0
  }
];

const LS_GRAPH = 'wt_board_graph_v1';

const $ = (id) => document.getElementById(id);

const setupCard = $('setupCard');
const gameEl = $('game');
const playerCountEl = $('playerCount');
const aiCountEl = $('aiCount');
const playerNameEl = $('playerName');
const playerCharEl = $('playerChar');
const startBtn = $('startBtn');

const boardStage = $('boardStage');
const spinnerEl = $('spinner');
const spinBtn = $('spinBtn');
const spinResultEl = $('spinResult');
const currentPlayerEl = $('currentPlayer');
const deliveredEl = $('delivered');
const targetEl = $('target');
const cureEl = $('cure');
const playersListEl = $('playersList');
const resetBtn = $('resetBtn');

const modalBackdrop = $('modalBackdrop');
const modalTitle = $('modalTitle');
const modalBody = $('modalBody');
const closeModalBtn = $('closeModalBtn');

// Populate character dropdown
for (const c of CHARACTERS) {
  const opt = document.createElement('option');
  opt.value = c.id;
  opt.textContent = c.label;
  playerCharEl.appendChild(opt);
}

playerCountEl.addEventListener('input', () => {
  const n = clampInt(playerCountEl.value, 1, 8);
  aiCountEl.textContent = `AI players: ${Math.max(0, n - 1)}`;
});

const state = {
  graph: loadGraph(),
  players: [],
  turn: 0,
  spin: null,
  teamDelivered: 0,
  cureUnlocked: false,
  pending: null,
  pan: { tx: 0, ty: 0, scale: 1 },
  dragging: false,
  dragStart: null
};

function loadGraph() {
  const raw = localStorage.getItem(LS_GRAPH);
  if (!raw) return DEFAULT_GRAPH;
  try {
    const g = JSON.parse(raw);
    if (g?.nodes && g?.edges) return g;
  } catch {}
  return DEFAULT_GRAPH;
}

function clampInt(v, min, max) {
  const n = Math.floor(Number(v) || min);
  return Math.max(min, Math.min(max, n));
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function adjacency(graph) {
  const m = new Map();
  for (const e of graph.edges) {
    if (!m.has(e.from)) m.set(e.from, []);
    m.get(e.from).push(e);
  }
  return m;
}

function reachable(graph, start, maxCost) {
  const adj = adjacency(graph);
  const dist = new Map();
  dist.set(start, 0);
  const q = [start];
  while (q.length) {
    const cur = q.shift();
    const curD = dist.get(cur);
    const edges = adj.get(cur) || [];
    for (const e of edges) {
      const nd = curD + e.cost;
      if (nd > maxCost) continue;
      const prev = dist.get(e.to);
      if (prev === undefined || nd < prev) {
        dist.set(e.to, nd);
        q.push(e.to);
      }
    }
  }
  return dist;
}

function nodeById(id) {
  return state.graph.nodes.find(n => n.id === id);
}

function occupiedSet(exceptPlayerId) {
  const s = new Set();
  for (const p of state.players) {
    if (p.id !== exceptPlayerId) s.add(p.pos);
  }
  return s;
}

function legalMoves() {
  const cur = state.players[state.turn];
  if (!cur || !state.spin) return new Set();
  const reach = reachable(state.graph, cur.pos, state.spin);
  const occ = occupiedSet(cur.id);
  const legal = new Set();
  for (const id of reach.keys()) {
    const kind = nodeById(id)?.kind;
    if (kind === 'hallway' && occ.has(id)) continue; // can't land on occupied hallway space
    legal.add(id);
  }
  return legal;
}

function startGame() {
  const n = clampInt(playerCountEl.value, 1, 8);
  const youName = (playerNameEl.value || 'You').trim();
  const youChar = playerCharEl.value;

  state.players = Array.from({ length: n }).map((_, i) => ({
    id: `P${i}_${Math.random().toString(16).slice(2)}`,
    name: i === 0 ? youName : `AI ${i}`,
    character: i === 0 ? youChar : CHARACTERS[i % CHARACTERS.length].id,
    isHuman: i === 0,
    pos: 'IN',
    crystalHeld: false,
    delivered: 0,
    abilityUsesLeft: 2
  }));

  state.turn = 0;
  state.spin = null;
  state.teamDelivered = 0;
  state.cureUnlocked = false;
  state.pending = null;

  setupCard.hidden = true;
  gameEl.hidden = false;
  render();
}

function resetAll() {
  state.graph = loadGraph();
  setupCard.hidden = false;
  gameEl.hidden = true;
  spinResultEl.textContent = '—';
  spinnerEl.style.transform = 'rotate(0deg)';
  state.pan = { tx: 0, ty: 0, scale: 1 };
  applyTransform();
}

function applyTransform() {
  const { tx, ty, scale } = state.pan;
  boardStage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  boardStage.style.transformOrigin = 'center center';
}

function spin() {
  if (state.pending) return;
  state.spin = randInt(1, 8);
  spinResultEl.textContent = String(state.spin);

  // animate spinner (pure visual)
  const segment = 360 / 8;
  const base = 360 * randInt(3, 5);
  const rot = base + (8 - state.spin) * segment + segment / 2;
  spinnerEl.style.transition = 'transform 800ms cubic-bezier(.1,.8,.1,1)';
  spinnerEl.style.transform = `rotate(${rot}deg)`;

  render();
}

function endTurn() {
  state.spin = null;
  spinResultEl.textContent = '—';
  state.turn = (state.turn + 1) % state.players.length;
  render();
}

function moveTo(nodeId) {
  const cur = state.players[state.turn];
  const legal = legalMoves();
  if (!state.spin || !legal.has(nodeId)) return;

  cur.pos = nodeId;

  const kind = nodeById(nodeId)?.kind;
  if (kind === 'hospital' && cur.crystalHeld) {
    cur.crystalHeld = false;
    cur.delivered += 1;
    state.teamDelivered += 1;
    const target = 3 * state.players.length;
    if (state.teamDelivered >= target) state.cureUnlocked = true;
  }

  // MVP: warrior card triggers on H3
  if (nodeId === 'H3') {
    const card = SAMPLE_DECK[randInt(0, SAMPLE_DECK.length - 1)];
    state.pending = { type: 'warrior', card, forPlayerId: cur.id };
    openCardModal(card);
    state.spin = null;
    spinResultEl.textContent = '—';
    render();
    return;
  }

  endTurn();
}

function openCardModal(card) {
  modalTitle.textContent = 'Warrior Card';
  modalBody.innerHTML = '';

  const q = document.createElement('div');
  q.className = 'muted';
  q.style.fontSize = '16px';
  q.style.color = 'var(--text)';
  q.textContent = card.question;
  modalBody.appendChild(q);

  card.choices.forEach((choice, idx) => {
    const div = document.createElement('div');
    div.className = 'choice';
    div.innerHTML = `<div class="choiceKey">${String.fromCharCode(65 + idx)}</div><div>${choice}</div>`;
    div.addEventListener('click', () => answerCard(idx));
    modalBody.appendChild(div);
  });

  const note = document.createElement('div');
  note.className = 'tiny muted';
  note.style.marginTop = '12px';
  note.textContent = 'Correct answer grants a Health Crystal only if you are not already holding one.';
  modalBody.appendChild(note);

  closeModalBtn.hidden = true; // force answer
  modalBackdrop.hidden = false;
}

function answerCard(choiceIndex) {
  if (!state.pending) return;
  const { card, forPlayerId } = state.pending;
  const isCorrect = choiceIndex === card.correctIndex;
  const pl = state.players.find(p => p.id === forPlayerId);

  if (pl && isCorrect && !pl.crystalHeld) {
    pl.crystalHeld = true;
  }

  state.pending = null;
  modalBackdrop.hidden = true;
  closeModalBtn.hidden = false;
  endTurn();
}

function render() {
  const cur = state.players[state.turn];
  currentPlayerEl.textContent = cur?.name || '—';
  deliveredEl.textContent = String(state.teamDelivered);
  targetEl.textContent = String(3 * state.players.length);
  cureEl.textContent = state.cureUnlocked ? 'YES' : 'NO';
  cureEl.style.color = state.cureUnlocked ? 'var(--accent)' : 'var(--muted)';

  // Players list
  playersListEl.innerHTML = '';
  state.players.forEach((p, idx) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <div class="itemTop">
        <div><b>${p.name}</b> <span class="pill" style="margin:0 0 0 8px">${p.character}</span></div>
        <div class="pill" style="margin:0">Crystal: ${p.crystalHeld ? '✅' : '—'}</div>
      </div>
      <div class="muted" style="margin-top:8px">Delivered: ${p.delivered}</div>
    `;
    playersListEl.appendChild(item);
  });

  // Board
  boardStage.innerHTML = '';
  applyTransform();

  const legal = legalMoves();

  // Dots
  for (const n of state.graph.nodes) {
    const dot = document.createElement('div');
    dot.className = 'dot' + (legal.has(n.id) && state.spin ? ' legal' : '');
    dot.style.left = `${n.x * 100}%`;
    dot.style.top = `${n.y * 100}%`;
    dot.title = n.label || n.id;
    if (legal.has(n.id) && state.spin) {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        moveTo(n.id);
      });
    }
    boardStage.appendChild(dot);
  }

  // Tokens
  state.players.forEach((p, idx) => {
    const node = nodeById(p.pos);
    if (!node) return;
    const token = document.createElement('div');
    token.className = 'token' + (p.id === cur?.id ? ' current' : '');
    // slight offset so multiple tokens don't fully overlap
    const ox = idx % 2 === 0 ? -14 : 14;
    const oy = idx % 2 === 0 ? -14 : 14;
    token.style.left = `calc(${node.x * 100}% + ${ox}px)`;
    token.style.top = `calc(${node.y * 100}% + ${oy}px)`;
    token.textContent = p.isHuman ? 'Y' : 'A';
    token.title = p.name;
    boardStage.appendChild(token);
  });
}

// Pan/zoom
boardStage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.08 : 0.08;
  state.pan.scale = Math.max(0.7, Math.min(2.5, state.pan.scale + delta));
  applyTransform();
});

boardStage.addEventListener('pointerdown', (e) => {
  state.dragging = true;
  boardStage.setPointerCapture(e.pointerId);
  state.dragStart = { x: e.clientX, y: e.clientY, tx: state.pan.tx, ty: state.pan.ty };
  boardStage.style.cursor = 'grabbing';
});

boardStage.addEventListener('pointermove', (e) => {
  if (!state.dragging || !state.dragStart) return;
  const dx = e.clientX - state.dragStart.x;
  const dy = e.clientY - state.dragStart.y;
  state.pan.tx = state.dragStart.tx + dx;
  state.pan.ty = state.dragStart.ty + dy;
  applyTransform();
});

boardStage.addEventListener('pointerup', () => {
  state.dragging = false;
  state.dragStart = null;
  boardStage.style.cursor = 'grab';
});

boardStage.addEventListener('pointercancel', () => {
  state.dragging = false;
  state.dragStart = null;
  boardStage.style.cursor = 'grab';
});

// Buttons
startBtn.addEventListener('click', startGame);
spinBtn.addEventListener('click', spin);
resetBtn.addEventListener('click', resetAll);
closeModalBtn.addEventListener('click', () => { /* not used in MVP */ });

// Initialize
aiCountEl.textContent = `AI players: ${Math.max(0, clampInt(playerCountEl.value, 1, 8) - 1)}`;
resetAll();
