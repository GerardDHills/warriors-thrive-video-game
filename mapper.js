const LS_GRAPH = 'wt_board_graph_v1';

const stage = document.getElementById('stage');
const edgeSvg = document.getElementById('edgeSvg');
const exportBtn = document.getElementById('exportBtn');
const exportArea = document.getElementById('exportArea');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');

const selectedIdEl = document.getElementById('selectedId');
const kindSel = document.getElementById('kindSel');
const labelInput = document.getElementById('labelInput');
const deleteBtn = document.getElementById('deleteBtn');

const edgeFrom = document.getElementById('edgeFrom');
const edgeTo = document.getElementById('edgeTo');
const edgeCost = document.getElementById('edgeCost');
const addEdgeBtn = document.getElementById('addEdgeBtn');

const kinds = ['hallway', 'labDoor', 'lab', 'hospital', 'in', 'out', 'other'];

kinds.forEach(k => {
  const opt = document.createElement('option');
  opt.value = k;
  opt.textContent = k;
  kindSel.appendChild(opt);
});

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function defaultGraph() {
  // Start empty-ish to make mapping easier.
  return { nodes: [], edges: [] };
}

const state = {
  graph: safeParse(localStorage.getItem(LS_GRAPH)) || defaultGraph(),
  selected: null
};

function toNorm(clientX, clientY) {
  const rect = stage.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
}

function id6() {
  return Math.random().toString(16).slice(2, 8).toUpperCase();
}

function nodeById(id) {
  return state.graph.nodes.find(n => n.id === id);
}

function refreshEdgeDropdowns() {
  const opts = state.graph.nodes
    .slice()
    .sort((a,b) => (a.label || a.id).localeCompare(b.label || b.id))
    .map(n => ({ value: n.id, label: n.label ? `${n.label} (${n.id})` : n.id }));

  [edgeFrom, edgeTo].forEach(sel => {
    sel.innerHTML = '<option value="">Select…</option>';
    opts.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      sel.appendChild(opt);
    });
  });
}

function selectNode(id) {
  state.selected = id;
  const n = nodeById(id);
  selectedIdEl.textContent = id || 'None';
  if (n) {
    kindSel.value = n.kind || 'hallway';
    labelInput.value = n.label || '';
  }
  render();
}

function render() {
  // Draw nodes
  stage.innerHTML = '';

  // Draw edges (svg lines)
  edgeSvg.setAttribute('viewBox', '0 0 100 100');
  edgeSvg.innerHTML = '';
  state.graph.edges.forEach((e) => {
    const a = nodeById(e.from);
    const b = nodeById(e.to);
    if (!a || !b) return;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(a.x * 100));
    line.setAttribute('y1', String(a.y * 100));
    line.setAttribute('x2', String(b.x * 100));
    line.setAttribute('y2', String(b.y * 100));
    line.setAttribute('stroke', 'rgba(255,255,255,.18)');
    line.setAttribute('stroke-width', '2');
    edgeSvg.appendChild(line);
  });

  state.graph.nodes.forEach((n) => {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.left = `${n.x * 100}%`;
    dot.style.top = `${n.y * 100}%`;
    dot.style.width = n.id === state.selected ? '18px' : '12px';
    dot.style.height = n.id === state.selected ? '18px' : '12px';
    dot.style.border = n.id === state.selected
      ? '2px solid rgba(108,240,194,.95)'
      : '1px solid rgba(255,255,255,.22)';
    dot.style.background = 'rgba(0,0,0,.25)';
    dot.title = n.label || n.id;
    dot.addEventListener('click', (ev) => {
      ev.stopPropagation();
      selectNode(n.id);
    });
    stage.appendChild(dot);
  });

  refreshEdgeDropdowns();
}

stage.addEventListener('click', (e) => {
  const { x, y } = toNorm(e.clientX, e.clientY);
  const id = `N_${id6()}`;
  state.graph.nodes.push({ id, x, y, kind: 'hallway', label: '' });
  selectNode(id);
});

kindSel.addEventListener('change', () => {
  const n = nodeById(state.selected);
  if (!n) return;
  n.kind = kindSel.value;
  render();
});

labelInput.addEventListener('input', () => {
  const n = nodeById(state.selected);
  if (!n) return;
  n.label = labelInput.value;
  render();
});

deleteBtn.addEventListener('click', () => {
  if (!state.selected) return;
  state.graph.nodes = state.graph.nodes.filter(n => n.id !== state.selected);
  state.graph.edges = state.graph.edges.filter(e => e.from !== state.selected && e.to !== state.selected);
  state.selected = null;
  selectedIdEl.textContent = 'None';
  labelInput.value = '';
  kindSel.value = 'hallway';
  render();
});

addEdgeBtn.addEventListener('click', () => {
  const from = edgeFrom.value;
  const to = edgeTo.value;
  if (!from || !to) return;
  const cost = Math.max(0, Math.floor(Number(edgeCost.value) || 1));
  state.graph.edges.push({ from, to, cost });
  render();
});

exportBtn.addEventListener('click', () => {
  exportArea.value = JSON.stringify(state.graph, null, 2);
});

saveBtn.addEventListener('click', () => {
  const txt = exportArea.value || JSON.stringify(state.graph);
  localStorage.setItem(LS_GRAPH, txt);
  alert('Saved board graph to this device. Open index.html and play to test it.');
});

clearBtn.addEventListener('click', () => {
  localStorage.removeItem(LS_GRAPH);
  alert('Cleared saved map.');
});

// Set board background
stage.style.background = "url('assets/board.png') center/cover no-repeat";

render();
