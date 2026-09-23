const STATUS_LABEL = { todo: 'To do', progress: 'In progress', done: 'Done' };
const PRIORITY_LABEL = { high: 'High', medium: 'Normal', low: 'Low' };
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const EMPTY_TEXT = {
  todo: 'No requests yet. Click "New request" to add one.',
  progress: 'Nothing in progress yet.',
  done: 'No requests completed yet.',
};
const ACTIONS = {
  todo: [['Start working', 'progress']],
  progress: [['Back to to do', 'todo'], ['Mark done', 'done']],
  done: [['Reopen', 'progress']],
};
const KEY_STORAGE = 'papan-request:key';
const NAME_STORAGE = 'papan-request:name';
const REFRESH_MS = 30000;

const store = {
  get(k) { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

let tickets = [];
let editingId = null;
let accessKey = store.get(KEY_STORAGE);

const $ = (sel) => document.querySelector(sel);
const ticketDialog = $('#ticketDialog');
const ticketForm = $('#ticketForm');
const loginDialog = $('#loginDialog');
const loginForm = $('#loginForm');
const f = ticketForm.elements;
const formError = $('#formError');
const btnSave = $('#btnSave');
const toast = $('#toast');

/* ---------- Helper ---------- */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(ymd) {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function todayYmd() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

let toastTimer;
function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), isError ? 5000 : 2500);
}

async function api(method, query = '', body) {
  const res = await fetch(`/api/tickets${query}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-app-key': accessKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    openLogin();
    const err = new Error(data.error || 'Wrong or missing access code.');
    err.unauthorized = true;
    throw err;
  }
  if (!res.ok) throw new Error(data.error || `Server error (${res.status}).`);
  return data;
}

/* ---------- Render ---------- */
function sortFor(status) {
  if (status === 'done') {
    return (a, b) => (b.done_at || '').localeCompare(a.done_at || '') || b.id - a.id;
  }
  return (a, b) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (a.deadline || '9999').localeCompare(b.deadline || '9999') ||
    a.id - b.id;
}

function render() {
  for (const status of Object.keys(STATUS_LABEL)) {
    const list = tickets.filter((t) => t.status === status).sort(sortFor(status));
    const zone = document.querySelector(`.dropzone[data-status="${status}"]`);
    zone.replaceChildren(...(list.length ? list.map(ticketCard) : [el('p', 'empty', EMPTY_TEXT[status])]));
    document.querySelector(`[data-count="${status}"]`).textContent = list.length;
  }
}

function ticketCard(t) {
  const wrap = el('article', 'ticket-wrap');
  wrap.draggable = true;
  wrap.dataset.id = t.id;
  wrap.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', String(t.id));
    e.dataTransfer.effectAllowed = 'move';
    wrap.classList.add('dragging');
  });
  wrap.addEventListener('dragend', () => wrap.classList.remove('dragging'));

  const ticket = el('div', 'ticket');

  const stub = el('div', 'ticket-stub');
  stub.append(el('span', 'ticket-no', `#${t.id}`), el('span', `prio prio-${t.priority}`, PRIORITY_LABEL[t.priority]));

  const body = el('div', 'ticket-body');
  const title = el('button', 'ticket-title', t.title);
  title.type = 'button';
  title.title = 'View details';
  title.addEventListener('click', () => openEdit(t.id));
  body.append(title);

  if (t.description) body.append(el('p', 'ticket-desc', t.description));

  const meta = el('p', 'ticket-meta');
  meta.append(el('span', '', `From ${t.requested_by}`));
  if (t.status === 'done' && t.done_at) {
    meta.append(el('span', '', `Done ${formatDate(t.done_at)}`));
  } else if (t.deadline) {
    const late = t.deadline < todayYmd();
    meta.append(el('span', late ? 'overdue' : '', `${late ? 'Overdue' : 'Deadline'} ${formatDate(t.deadline)}`));
  }
  body.append(meta);

  const actions = el('div', 'ticket-actions');
  for (const [label, to] of ACTIONS[t.status]) {
    const btn = el('button', 'btn btn-small', label);
    btn.type = 'button';
    btn.addEventListener('click', () => moveTicket(t.id, to));
    actions.append(btn);
  }
  body.append(actions);

  ticket.append(stub, body);
  wrap.append(ticket);
  return wrap;
}

/* ---------- Data ---------- */
async function loadTickets({ silent = false } = {}) {
  try {
    const data = await api('GET');
    tickets = data.tickets;
    render();
  } catch (err) {
    if (!silent && !err.unauthorized) showToast(err.message, true);
  }
}

async function moveTicket(id, status) {
  const t = tickets.find((x) => x.id === id);
  if (!t || t.status === status) return;
  const previous = t.status;
  t.status = status;
  render();
  try {
    const { ticket } = await api('PATCH', `?id=${id}`, { status });
    Object.assign(t, ticket);
    render();
    showToast(`#${id} moved to ${STATUS_LABEL[status]}.`);
  } catch (err) {
    t.status = previous;
    render();
    if (!err.unauthorized) showToast(err.message, true);
  }
}

/* ---------- Drag & drop ---------- */
document.querySelectorAll('.dropzone').forEach((zone) => {
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('over');
  });
  zone.addEventListener('dragleave', (e) => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('over');
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('over');
    const id = Number(e.dataTransfer.getData('text/plain'));
    if (id) moveTicket(id, zone.dataset.status);
  });
});

/* ---------- Request form ---------- */
function openCreate() {
  editingId = null;
  ticketForm.reset();
  f.requested_by.value = store.get(NAME_STORAGE) || 'Boss';
  ticketDialog.classList.remove('editing');
  $('#dialogTitle').textContent = 'New request';
  btnSave.textContent = 'Submit request';
  formError.textContent = '';
  ticketDialog.showModal();
  f.title.focus();
}

function openEdit(id) {
  const t = tickets.find((x) => x.id === id);
  if (!t) return;
  editingId = id;
  f.title.value = t.title;
  f.description.value = t.description || '';
  f.priority.value = t.priority;
  f.deadline.value = t.deadline ? t.deadline.slice(0, 10) : '';
  f.requested_by.value = t.requested_by;
  f.status.value = t.status;
  ticketDialog.classList.add('editing');
  $('#dialogTitle').textContent = `Request #${id}`;
  btnSave.textContent = 'Save changes';
  formError.textContent = '';
  ticketDialog.showModal();
}

ticketForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: f.title.value.trim(),
    description: f.description.value.trim(),
    priority: f.priority.value,
    deadline: f.deadline.value || null,
    requested_by: f.requested_by.value.trim() || 'Boss',
  };
  if (!payload.title) {
    formError.textContent = 'Request title is required.';
    f.title.focus();
    return;
  }
  if (editingId) payload.status = f.status.value;

  btnSave.disabled = true;
  formError.textContent = '';
  try {
    if (editingId) {
      const { ticket } = await api('PATCH', `?id=${editingId}`, payload);
      tickets = tickets.map((t) => (t.id === ticket.id ? ticket : t));
      showToast(`Changes to #${ticket.id} saved.`);
    } else {
      const { ticket } = await api('POST', '', payload);
      tickets.push(ticket);
      store.set(NAME_STORAGE, payload.requested_by);
      showToast(`Request #${ticket.id} submitted.`);
    }
    ticketDialog.close();
    render();
  } catch (err) {
    formError.textContent = err.message;
  } finally {
    btnSave.disabled = false;
  }
});

$('#btnDelete').addEventListener('click', async () => {
  if (!editingId || !confirm(`Delete request #${editingId}? This action cannot be undone.`)) return;
  try {
    await api('DELETE', `?id=${editingId}`);
    tickets = tickets.filter((t) => t.id !== editingId);
    showToast(`Request #${editingId} deleted.`);
    ticketDialog.close();
    render();
  } catch (err) {
    formError.textContent = err.message;
  }
});

$('#btnNew').addEventListener('click', openCreate);
$('#btnCancel').addEventListener('click', () => ticketDialog.close());

/* ---------- Access code ---------- */
function openLogin() {
  if (ticketDialog.open) ticketDialog.close();
  if (!loginDialog.open) loginDialog.showModal();
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  accessKey = loginForm.elements.key.value;
  store.set(KEY_STORAGE, accessKey);
  loginForm.reset();
  loginDialog.close();
  toast.classList.remove('show');
  loadTickets();
});

/* ---------- Start ---------- */
render();
loadTickets();

// Check for new requests periodically (skipped while tab is hidden, a form is open, or a drag is in progress)
setInterval(() => {
  if (document.hidden || ticketDialog.open || loginDialog.open || document.querySelector('.dragging')) return;
  loadTickets({ silent: true });
}, REFRESH_MS);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !loginDialog.open) loadTickets({ silent: true });
});
