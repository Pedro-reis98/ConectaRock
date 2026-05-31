const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ROOM_NAMES = ['Geral', 'Backstage', 'Ao vivo'];
const HISTORY_LIMIT = 80;
const MAX_TEXT_LENGTH = 600;
const MAX_IMAGE_BYTES = 1_500_000;

const dataDir = path.join(__dirname, 'data');
const historyFile = path.join(dataDir, 'messages.json');

const users = new Map();
const histories = loadHistory();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.json({ ok: true, app: 'Conecta Rock' });
});

io.on('connection', (socket) => {
  socket.emit('server ready', { rooms: ROOM_NAMES });

  socket.on('user joined', (payload = {}) => {
    const username = cleanText(payload.username, 28) || `Roqueiro-${socket.id.slice(0, 4)}`;
    const room = normalizeRoom(payload.room);
    const user = {
      id: socket.id,
      username,
      room,
      color: colorFromName(username),
      avatar: initials(username),
    };

    users.set(socket.id, user);
    socket.data.user = user;
    socket.join(room);

    socket.emit('joined', { user, rooms: ROOM_NAMES });
    socket.emit('chat history', histories[room] || []);
    socket.emit('user joined', systemNotice(`Voce entrou na sala ${room}.`, room));
    socket.to(room).emit('user joined', systemNotice(`${username} entrou na sala.`, room));
    emitOnlineUsers();
  });

  socket.on('join room', (nextRoom) => {
    const user = socket.data.user;
    if (!user) return;

    const room = normalizeRoom(nextRoom);
    if (room === user.room) return;

    const previousRoom = user.room;
    socket.leave(previousRoom);
    socket.to(previousRoom).emit('user left', systemNotice(`${user.username} saiu da sala.`, previousRoom));

    user.room = room;
    users.set(socket.id, user);
    socket.join(room);

    socket.emit('room changed', { room });
    socket.emit('chat history', histories[room] || []);
    socket.emit('user joined', systemNotice(`Voce entrou na sala ${room}.`, room));
    socket.to(room).emit('user joined', systemNotice(`${user.username} entrou na sala.`, room));
    emitOnlineUsers();
  });

  socket.on('chat message', (payload = {}) => {
    const user = socket.data.user;
    if (!user) return;

    const text = cleanText(payload.text, MAX_TEXT_LENGTH);
    const image = normalizeImage(payload.image);
    const targetId = typeof payload.toUserId === 'string' ? payload.toUserId : '';

    if (!text && !image) return;

    const targetUser = targetId && users.get(targetId);
    const message = {
      id: crypto.randomUUID(),
      userId: user.id,
      username: user.username,
      avatar: user.avatar,
      color: user.color,
      room: user.room,
      text,
      image,
      private: Boolean(targetUser),
      toUserId: targetUser ? targetUser.id : null,
      toUsername: targetUser ? targetUser.username : null,
      createdAt: new Date().toISOString(),
    };

    if (targetUser) {
      io.to(user.id).to(targetUser.id).emit('chat message', message);
      return;
    }

    pushHistory(user.room, message);
    io.to(user.room).emit('chat message', message);
  });

  socket.on('typing', (isTyping) => {
    const user = socket.data.user;
    if (!user) return;

    socket.to(user.room).emit('typing', {
      userId: user.id,
      username: user.username,
      isTyping: Boolean(isTyping),
      room: user.room,
    });
  });

  socket.on('disconnect', () => {
    const user = socket.data.user;
    if (!user) return;

    users.delete(socket.id);
    socket.to(user.room).emit('user left', systemNotice(`${user.username} saiu do chat.`, user.room));
    emitOnlineUsers();
  });
});

server.listen(PORT, () => {
  console.log(`Conecta Rock rodando em http://localhost:${PORT}`);
});

function loadHistory() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(historyFile)) {
      const empty = Object.fromEntries(ROOM_NAMES.map((room) => [room, []]));
      fs.writeFileSync(historyFile, JSON.stringify(empty, null, 2));
      return empty;
    }

    const parsed = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    return Object.fromEntries(ROOM_NAMES.map((room) => [room, Array.isArray(parsed[room]) ? parsed[room] : []]));
  } catch (error) {
    console.warn('Nao foi possivel carregar o historico:', error.message);
    return Object.fromEntries(ROOM_NAMES.map((room) => [room, []]));
  }
}

function pushHistory(room, message) {
  histories[room] = [...(histories[room] || []), message].slice(-HISTORY_LIMIT);
  fs.writeFile(historyFile, JSON.stringify(histories, null, 2), (error) => {
    if (error) console.warn('Nao foi possivel salvar o historico:', error.message);
  });
}

function emitOnlineUsers() {
  const allUsers = [...users.values()];
  io.emit('online users', {
    total: allUsers.length,
    rooms: ROOM_NAMES.map((room) => ({
      name: room,
      count: allUsers.filter((user) => user.room === room).length,
    })),
    users: allUsers,
  });
}

function systemNotice(text, room) {
  return {
    id: crypto.randomUUID(),
    type: 'system',
    text,
    room,
    createdAt: new Date().toISOString(),
  };
}

function normalizeRoom(room) {
  return ROOM_NAMES.includes(room) ? room : ROOM_NAMES[0];
}

function cleanText(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeImage(image) {
  if (!image || typeof image.dataUrl !== 'string') return null;
  if (!/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(image.dataUrl)) return null;
  if (Buffer.byteLength(image.dataUrl, 'utf8') > MAX_IMAGE_BYTES) return null;

  return {
    dataUrl: image.dataUrl,
    name: cleanText(image.name, 80) || 'imagem',
  };
}

function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'CR';
}

function colorFromName(name) {
  const palette = ['#2f7dff', '#e85151', '#f2a93b', '#25b987', '#b26dff', '#ff6aa2'];
  const index = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0) % palette.length;
  return palette[index];
}
