// Kanban Offline - sem dependências
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const LS_KEY = 'kanban_offline_state_v1';
const THEME_KEY = 'kanban_theme';

let state = loadState();
applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

const dlg = $('#dlgCard');
const inpTitle = $('#cardTitle');
const inpNotes = $('#cardNotes');
const inpColor = $('#cardColor');
const btnDeleteCard = $('#btnDeleteCard');
const btnSaveCard = $('#btnSaveCard');

let editing = { laneId: null, cardId: null };

// Service Worker para offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  });
}

// Render
function render() {
  const board = $('#board');
  board.innerHTML = '';
  state.lanes.forEach(l => {
    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.dataset.laneId = l.id;
    lane.innerHTML = `
      <div class="lane-header">
        <input class="lane-title" value="${escapeHtml(l.title)}" />
        <div class="lane-actions">
          <button class="btn small" data-action="add-card">+ Card</button>
          <button class="btn small danger" data-action="del-lane">Remover</button>
        </div>
      </div>
      <div class="dropzone">
        <div class="cards" data-cards></div>
      </div>
    `;
    const cardsEl = lane.querySelector('[data-cards]');
    l.cards.forEach(c => cardsEl.appendChild(renderCard(c, l.id)));
    board.appendChild(lane);
  });
  wireLaneEvents();
}

function renderCard(c, laneId) {
  const el = document.createElement('div');
  el.className = 'card';
  el.draggable = true;
  el.dataset.cardId = c.id;
  el.dataset.laneId = laneId;
  el.style.borderLeftColor = c.color || '#22d3ee';
  el.innerHTML = `
    <div class="card-title">${escapeHtml(c.title)}</div>
    ${c.notes ? `<div class="card-notes">${escapeHtml(c.notes)}</div>` : ''}
    <div class="card-actions">
      <button class="btn small" data-move="-1">←</button>
      <button class="btn small" data-action="edit">Editar</button>
      <button class="btn small" data-move="1">→</button>
    </div>
  `;
  // drag
  el.addEventListener('dragstart', (ev) => {
    ev.dataTransfer.setData('text/plain', JSON.stringify({ cardId: c.id, from: laneId }));
    ev.dataTransfer.effectAllowed = 'move';
  });
  return el;
}

function wireLaneEvents() {
  $$('.lane').forEach(lane => {
    const laneId = lane.dataset.laneId;
    lane.querySelector('.lane-title').addEventListener('change', (e) => {
      const v = e.target.value.trim() || 'Sem título';
      const ln = state.lanes.find(x => x.id === laneId);
      ln.title = v; save();
    });

    lane.querySelector('[data-action="add-card"]').addEventListener('click', () => openCardDialog(laneId));
    lane.querySelector('[data-action="del-lane"]').addEventListener('click', () => deleteLane(laneId));

    const dropzone = lane.querySelector('.dropzone');
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('over'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('over');
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      moveCard(data.cardId, data.from, laneId);
    });

    lane.querySelectorAll('.card').forEach(card => {
      card.querySelector('[data-action="edit"]').addEventListener('click', () => {
        const cardId = card.dataset.cardId;
        openCardDialog(laneId, cardId);
      });
      card.querySelectorAll('[data-move]').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = parseInt(btn.dataset.move, 10);
          const laneIdx = state.lanes.findIndex(x => x.id === laneId);
          const toIdx = laneIdx + dir;
          if (toIdx < 0 || toIdx >= state.lanes.length) return;
          moveCard(card.dataset.cardId, laneId, state.lanes[toIdx].id);
        });
      });
    });
  });
}

// Card dialog
function openCardDialog(laneId, cardId=null) {
  editing = { laneId, cardId };
  if (cardId) {
    const card = getCard(laneId, cardId);
    $('#dlgTitle').textContent = 'Editar cartão';
    inpTitle.value = card.title;
    inpNotes.value = card.notes || '';
    inpColor.value = card.color || '#22d3ee';
    btnDeleteCard.style.display = 'inline-block';
  } else {
    $('#dlgTitle').textContent = 'Novo cartão';
    inpTitle.value = '';
    inpNotes.value = '';
    inpColor.value = '#0ea5e9';
    btnDeleteCard.style.display = 'none';
  }
  dlg.showModal();
}

btnSaveCard.addEventListener('click', (e) => {
  e.preventDefault();
  const title = inpTitle.value.trim();
  if (!title) return;
  const notes = inpNotes.value.trim();
  const color = inpColor.value;
  if (editing.cardId) {
    const c = getCard(editing.laneId, editing.cardId);
    c.title = title; c.notes = notes; c.color = color;
  } else {
    const lane = state.lanes.find(l => l.id === editing.laneId);
    lane.cards.push({ id: uid(), title, notes, color, createdAt: Date.now() });
  }
  save();
  dlg.close();
  render();
});

btnDeleteCard.addEventListener('click', () => {
  if (!editing.cardId) return;
  const lane = state.lanes.find(l => l.id === editing.laneId);
  lane.cards = lane.cards.filter(c => c.id !== editing.cardId);
  save();
  dlg.close();
  render();
});

// Topbar actions
$('#btnTheme').addEventListener('click', () => {
  const now = (document.documentElement.classList.contains('light')) ? 'dark' : 'light';
  applyTheme(now);
  localStorage.setItem(THEME_KEY, now);
});

$('#btnAddLane').addEventListener('click', () => {
  const title = prompt('Nome da nova coluna:', 'Nova coluna');
  if (!title) return;
  state.lanes.push({ id: uid(), title: title.trim(), cards: [] });
  save(); render();
});

$('#btnExport').addEventListener('click', () => {
  const json = JSON.stringify(state, null, 2);
  download('kanban-export.json', json, 'application/json');
});

$('#fileImport').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported || !Array.isArray(imported.lanes)) throw new Error('JSON inválido');
      state = imported;
      save(); render();
    } catch (err) {
      alert('JSON inválido.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

$('#btnReset').addEventListener('click', () => {
  if (confirm('Tem certeza? Isso apagará o board salvo.')) {
    localStorage.removeItem(LS_KEY);
    state = defaultState();
    save(); render();
  }
});

// Core
function moveCard(cardId, fromLaneId, toLaneId) {
  if (fromLaneId === toLaneId) return;
  const fromLane = state.lanes.find(l => l.id === fromLaneId);
  const toLane = state.lanes.find(l => l.id === toLaneId);
  const idx = fromLane.cards.findIndex(c => c.id === cardId);
  if (idx === -1) return;
  const [card] = fromLane.cards.splice(idx, 1);
  toLane.cards.push(card);
  save(); render();
}

function deleteLane(laneId) {
  const lane = state.lanes.find(l => l.id === laneId);
  if (!lane) return;
  if (lane.cards.length) {
    if (!confirm('Coluna não está vazia. Remover mesmo assim?')) return;
  }
  state.lanes = state.lanes.filter(l => l.id !== laneId);
  save(); render();
}

function getCard(laneId, cardId) {
  const lane = state.lanes.find(l => l.id === laneId);
  return lane.cards.find(c => c.id === cardId);
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return defaultState();
}

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function defaultState() {
  return {
    lanes: [
      { id: uid(), title: 'A fazer', cards: [
        { id: uid(), title: 'Pagar contas (luz/água)', notes: 'Vencem até dia 10', color: '#ef4444', createdAt: Date.now() },
        { id: uid(), title: 'Comprar supermercado', notes: 'Arroz, frango, café, leite', color: '#22d3ee', createdAt: Date.now() }
      ]},
      { id: uid(), title: 'Em Progresso', cards: [
        { id: uid(), title: 'Curso de Docker', notes: 'Aplicar em projetos reais', color: '#f59e0b', createdAt: Date.now() }
      ]},
      { id: uid(), title: 'Concluído', cards: [
        { id: uid(), title: 'Curso de Git GitHub', notes: 'Criar projeto no GitPages', color: '#10b981', createdAt: Date.now() }
      ]}
    ]
  };
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light') root.classList.add('light');
  else root.classList.remove('light');
}

// Utils
function escapeHtml(str='') {
  return str.replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

function download(filename, content, mime='text/plain') {
  const a = document.createElement('a');
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Inicializa
render();
