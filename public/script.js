const socket = io();

const state = {
  me: null,
  room: 'Geral',
  users: [],
  selectedTarget: '',
  image: null,
  soundEnabled: true,
  typingTimers: new Map(),
  typingNames: new Map(),
};

const PICK_SVG = `
  <svg viewBox="0 0 100 110" aria-hidden="true">
    <path class="pick-shape" d="M50 7C27 8 9 25 8 47c-1 26 19 48 42 56 23-8 43-30 42-56C91 25 73 8 50 7Z" />
    <path class="bolt-shape" d="M58 18 34 58h17l-9 35 26-45H51l7-30Z" />
  </svg>
`;

const ROOM_SUBTITLES = {
  Geral: 'Converse sobre tudo',
  Backstage: 'Bastidores e papo rock',
  'Ao vivo': 'Cobertura e shows',
};

const ROOM_BADGE_COUNTS = {
  Geral: 12,
  Backstage: 4,
  'Ao vivo': 7,
};

const DEMO_USERS = [
  { id: 'demo-rafa', username: 'RafaRock', room: 'Geral', status: 'online', demo: true },
  { id: 'demo-lari', username: 'LariRock', room: 'Geral', status: 'digitando...', demo: true },
  { id: 'demo-drum', username: 'DrumMachine', room: 'Geral', status: 'online', demo: true },
  { id: 'demo-guga', username: 'GugaGuitar', room: 'Geral', status: 'online', demo: true },
  { id: 'demo-carol', username: 'CarolVocal', room: 'Geral', status: 'ausente', demo: true },
  { id: 'demo-beto', username: 'BetoBass', room: 'Geral', status: 'offline', demo: true },
  { id: 'demo-leo', username: 'LeoSolo', room: 'Geral', status: 'offline', demo: true },
];

const els = {
  loginModal: document.querySelector('#loginModal'),
  loginForm: document.querySelector('#loginForm'),
  usernameInput: document.querySelector('#usernameInput'),
  roomSelect: document.querySelector('#roomSelect'),
  currentAvatar: document.querySelector('#currentAvatar'),
  currentUsername: document.querySelector('#currentUsername'),
  connectionStatus: document.querySelector('#connectionStatus'),
  roomTitle: document.querySelector('#roomTitle'),
  roomSubtitle: document.querySelector('#roomSubtitle'),
  roomMeta: document.querySelector('#roomMeta'),
  messages: document.querySelector('#messages'),
  messageForm: document.querySelector('#messageForm'),
  messageInput: document.querySelector('#messageInput'),
  targetSelect: document.querySelector('#targetSelect'),
  usersList: document.querySelector('#usersList'),
  onlineTotal: document.querySelector('#onlineTotal'),
  typingLine: document.querySelector('#typingLine'),
  emojiToggle: document.querySelector('#emojiToggle'),
  emojiTray: document.querySelector('#emojiTray'),
  imageInput: document.querySelector('#imageInput'),
  imagePreview: document.querySelector('#imagePreview'),
  previewImage: document.querySelector('#previewImage'),
  clearImage: document.querySelector('#clearImage'),
  sendToRoom: document.querySelector('#sendToRoom'),
  themeToggle: document.querySelector('#themeToggle'),
  soundToggle: document.querySelector('#soundToggle'),
  roomSearch: document.querySelector('#roomSearch'),
  userSearch: document.querySelector('#userSearch'),
  logoutButton: document.querySelector('#logoutButton'),
};

const savedTheme = localStorage.getItem('conecta-rock-theme') || 'dark';
document.documentElement.dataset.theme = savedTheme;
els.usernameInput.value = localStorage.getItem('conecta-rock-name') || 'PedroDoRock';

socket.on('connect', () => {
  els.connectionStatus.textContent = state.me ? 'online' : 'conectado';
  if (state.me) {
    socket.emit('user joined', { username: state.me.username, room: state.room });
  }
});

socket.on('disconnect', () => {
  els.connectionStatus.textContent = 'reconectando';
});

socket.on('server ready', ({ rooms }) => {
  if (!Array.isArray(rooms)) return;
  els.roomSelect.innerHTML = rooms.map((room) => `<option>${room}</option>`).join('');
});

socket.on('joined', ({ user, rooms }) => {
  state.me = user;
  state.room = user.room;
  state.selectedTarget = '';
  localStorage.setItem('conecta-rock-name', user.username);
  els.loginModal.classList.add('is-hidden');
  syncProfile();
  syncRooms(rooms);
  setTarget('');
});

socket.on('room changed', ({ room }) => {
  state.room = room;
  state.selectedTarget = '';
  syncProfile();
  setTarget('');
});

socket.on('chat history', (messages) => {
  els.messages.replaceChildren();
  if (Array.isArray(messages)) messages.forEach(renderMessage);
  scrollToBottom();
});

socket.on('chat message', (message) => {
  renderMessage(message);
  scrollToBottom();
  if (state.me && message.userId !== state.me.id) playNotification();
});

socket.on('user joined', (notice) => {
  renderSystem(notice);
  scrollToBottom();
});

socket.on('user left', (notice) => {
  renderSystem(notice);
  scrollToBottom();
});

socket.on('online users', (payload) => {
  state.users = Array.isArray(payload.users) ? payload.users : [];
  renderRoomCounts(payload.rooms || []);
  renderUsers();
  renderTargetOptions();
  updateOnlineMeta(payload.total || 0);
});

socket.on('typing', ({ userId, username, isTyping, room }) => {
  if (room !== state.room || !userId || (state.me && userId === state.me.id)) return;

  clearTimeout(state.typingTimers.get(userId));
  if (!isTyping) {
    state.typingNames.delete(userId);
    updateTypingLine();
    return;
  }

  state.typingNames.set(userId, username);
  state.typingTimers.set(userId, setTimeout(() => {
    state.typingNames.delete(userId);
    updateTypingLine();
  }, 1700));
  updateTypingLine();
});

els.loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const username = els.usernameInput.value.trim();
  if (!username) return;

  state.room = els.roomSelect.value;
  socket.emit('user joined', { username, room: state.room });
});

document.querySelectorAll('.room-button').forEach((button) => {
  button.addEventListener('click', () => {
    if (!state.me) return;
    socket.emit('join room', button.dataset.room);
  });
});

els.messageForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = els.messageInput.value.trim();
  if (!text && !state.image) return;

  socket.emit('chat message', {
    text,
    image: state.image,
    toUserId: state.selectedTarget,
  });

  els.messageInput.value = '';
  autoSizeTextarea();
  clearImage();
  sendTyping(false);
});

els.messageInput.addEventListener('input', () => {
  autoSizeTextarea();
  sendTyping(Boolean(els.messageInput.value.trim()));
});

els.messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    els.messageForm.requestSubmit();
  }
});

els.emojiToggle.addEventListener('click', () => {
  els.emojiTray.hidden = !els.emojiTray.hidden;
});

els.emojiTray.addEventListener('click', (event) => {
  if (event.target.tagName !== 'BUTTON') return;
  insertAtCursor(els.messageInput, event.target.textContent);
  els.messageInput.focus();
  autoSizeTextarea();
  sendTyping(true);
});

els.imageInput.addEventListener('change', async () => {
  const file = els.imageInput.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return;
  if (file.size > 1_200_000) {
    alert('Imagem muito grande. Use uma imagem de ate 1,2 MB.');
    els.imageInput.value = '';
    return;
  }

  const dataUrl = await readFileAsDataUrl(file);
  state.image = { dataUrl, name: file.name };
  els.previewImage.src = dataUrl;
  els.imagePreview.hidden = false;
});

els.clearImage.addEventListener('click', clearImage);

els.targetSelect.addEventListener('change', () => {
  setTarget(els.targetSelect.value);
});

els.sendToRoom.addEventListener('click', () => {
  setTarget('');
});

els.themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('conecta-rock-theme', next);
});

els.soundToggle.addEventListener('click', () => {
  state.soundEnabled = !state.soundEnabled;
  els.soundToggle.classList.toggle('is-muted', !state.soundEnabled);
});

els.roomSearch?.addEventListener('input', filterRooms);
els.userSearch?.addEventListener('input', renderUsers);
els.logoutButton?.addEventListener('click', () => {
  window.location.reload();
});

function renderMessage(message) {
  if (message.type === 'system') {
    renderSystem(message);
    return;
  }

  const isMine = state.me && (message.userId === state.me.id || message.username === state.me.username);
  const item = document.createElement('li');
  item.className = `message${isMine ? ' mine' : ''}`;

  const avatar = createPickLogo(message.username);

  const bubble = document.createElement('article');
  bubble.className = 'bubble';

  const meta = document.createElement('div');
  meta.className = 'meta';

  const name = document.createElement('span');
  name.textContent = isMine ? 'Voce' : message.username;
  if (!isMine && message.color) name.style.color = message.color;
  meta.append(name);

  if (message.private) {
    const tag = document.createElement('span');
    tag.className = 'private-tag';
    tag.textContent = message.toUserId === state.me?.id ? 'privado para voce' : `privado para ${message.toUsername}`;
    meta.append(tag);
  }

  const time = document.createElement('time');
  time.dateTime = message.createdAt;
  time.textContent = formatTime(message.createdAt);
  meta.append(time);

  bubble.append(meta);

  if (message.text) {
    const text = document.createElement('div');
    text.className = 'message-text';
    text.textContent = message.text;
    bubble.append(text);
  }

  if (message.image?.dataUrl) {
    const image = document.createElement('img');
    image.className = 'message-image';
    image.src = message.image.dataUrl;
    image.alt = message.image.name || 'Imagem enviada';
    bubble.append(image);
  }

  item.append(avatar, bubble);
  els.messages.append(item);
}

function renderSystem(notice) {
  const item = document.createElement('li');
  item.className = 'message system';

  const pill = document.createElement('span');
  pill.className = 'system-pill';
  pill.textContent = `${notice.text} ${formatTime(notice.createdAt)}`;
  item.append(pill);
  els.messages.append(item);
}

function renderUsers() {
  els.usersList.replaceChildren();

  const search = (els.userSearch?.value || '').trim().toLowerCase();
  buildDisplayUsers()
    .filter((user) => user.room === state.room)
    .filter((user) => !search || user.username.toLowerCase().includes(search))
    .forEach((user) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `user-button${state.selectedTarget === user.id ? ' is-selected' : ''}`;
      button.dataset.status = user.status || 'online';
      button.disabled = Boolean((state.me && user.id === state.me.id) || user.demo);

      const avatar = createPickLogo(user.username);

      const body = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = state.me && user.id === state.me.id ? `${user.username} (voce)` : user.username;
      const room = document.createElement('small');
      room.textContent = user.status || user.room;
      body.append(name, room);

      button.append(avatar, body);
      if (!user.demo) button.addEventListener('click', () => setTarget(user.id));
      item.append(button);
      els.usersList.append(item);
    });
}

function renderTargetOptions() {
  const current = state.selectedTarget;
  els.targetSelect.replaceChildren(new Option('Todos da sala', ''));

  state.users
    .filter((user) => state.me && user.id !== state.me.id && user.room === state.room)
    .forEach((user) => {
      els.targetSelect.append(new Option(`Privado: ${user.username}`, user.id));
    });

  if (state.users.some((user) => user.id === current)) {
    els.targetSelect.value = current;
  } else {
    setTarget('');
  }
}

function renderRoomCounts(rooms) {
  rooms.forEach((room) => {
    const id = `roomCount-${room.name}`;
    const counter = document.getElementById(id);
    if (counter) counter.textContent = Math.max(room.count, ROOM_BADGE_COUNTS[room.name] || 0);
  });
}

function updateOnlineMeta(total) {
  const currentRoomTotal = state.users.filter((user) => user.room === state.room).length;
  const roomMetaNumber = els.roomMeta.querySelector('span');
  if (roomMetaNumber) roomMetaNumber.textContent = currentRoomTotal;
  els.onlineTotal.textContent = `${total} usuarios online`;
}

function setTarget(userId) {
  state.selectedTarget = userId || '';
  els.targetSelect.value = state.selectedTarget;
  els.sendToRoom.classList.toggle('is-selected', !state.selectedTarget);
  renderUsers();
}

function syncProfile() {
  if (!state.me) return;
  els.currentUsername.textContent = state.me.username;
  els.currentAvatar.innerHTML = PICK_SVG;
  els.currentAvatar.setAttribute('aria-label', state.me.username);
  els.connectionStatus.textContent = 'online';
  els.roomTitle.textContent = state.room;
  els.roomSubtitle.textContent = ROOM_SUBTITLES[state.room] || 'Converse sobre tudo';

  document.querySelectorAll('.room-button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.room === state.room);
  });
}

function syncRooms(rooms = []) {
  document.querySelectorAll('.room-button').forEach((button) => {
    button.hidden = rooms.length > 0 && !rooms.includes(button.dataset.room);
  });
  syncProfile();
}

let typingTimeout = null;
function sendTyping(isTyping) {
  socket.emit('typing', isTyping);
  clearTimeout(typingTimeout);
  if (isTyping) {
    typingTimeout = setTimeout(() => socket.emit('typing', false), 1200);
  }
}

function updateTypingLine() {
  const names = [...state.typingNames.values()];
  els.typingLine.textContent = names.length ? `${names.join(', ')} digitando...` : '';
}

function buildDisplayUsers() {
  const actualNames = new Set(state.users.map((user) => user.username.toLowerCase()));
  const demos = DEMO_USERS.filter((user) => !actualNames.has(user.username.toLowerCase()));
  return [...state.users.map((user) => ({ ...user, status: 'online' })), ...demos];
}

function createPickLogo(label) {
  const avatar = document.createElement('span');
  avatar.className = 'pick-logo avatar';
  avatar.innerHTML = PICK_SVG;
  avatar.setAttribute('aria-label', label || 'Conecta Rock');
  return avatar;
}

function filterRooms() {
  const search = (els.roomSearch?.value || '').trim().toLowerCase();
  document.querySelectorAll('.room-button').forEach((button) => {
    button.hidden = search && !button.textContent.toLowerCase().includes(search);
  });
}

function insertAtCursor(input, value) {
  const start = input.selectionStart;
  const end = input.selectionEnd;
  input.value = `${input.value.slice(0, start)}${value}${input.value.slice(end)}`;
  input.selectionStart = input.selectionEnd = start + value.length;
}

function autoSizeTextarea() {
  els.messageInput.style.height = 'auto';
  els.messageInput.style.height = `${Math.min(140, els.messageInput.scrollHeight)}px`;
  els.messageInput.style.overflowY = els.messageInput.scrollHeight > 140 ? 'auto' : 'hidden';
}

function clearImage() {
  state.image = null;
  els.imageInput.value = '';
  els.previewImage.removeAttribute('src');
  els.imagePreview.hidden = true;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function scrollToBottom() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

function formatTime(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function playNotification() {
  if (!state.soundEnabled) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = 660;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.17);
}
