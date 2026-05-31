const assert = require('node:assert/strict');
const { io } = require('socket.io-client');

const url = process.env.TEST_URL || 'http://127.0.0.1:3000';

async function main() {
  const pedro = createClient('PedroDoRock');
  const ana = createClient('Ana Amp');

  try {
    await Promise.all([pedro.connected, ana.connected]);
    pedro.socket.emit('user joined', { username: 'PedroDoRock', room: 'Geral' });
    ana.socket.emit('user joined', { username: 'Ana Amp', room: 'Geral' });

    await Promise.all([pedro.joined, ana.joined]);
    await waitForOnlineCount(pedro, 2);

    const receivedByPedro = waitForMessage(pedro, 'Teste automatico do Conecta Rock');
    const receivedByAna = waitForMessage(ana, 'Teste automatico do Conecta Rock');

    ana.socket.emit('chat message', {
      text: 'Teste automatico do Conecta Rock',
    });

    const [messageA, messageB] = await Promise.all([receivedByPedro, receivedByAna]);
    assert.equal(messageA.username, 'Ana Amp');
    assert.equal(messageB.username, 'Ana Amp');
    assert.equal(messageA.room, 'Geral');

    console.log('Fluxo Socket.IO validado com 2 usuarios e mensagem em tempo real.');
  } finally {
    pedro.socket.disconnect();
    ana.socket.disconnect();
  }
}

function createClient(label) {
  const socket = io(url, {
    forceNew: true,
    reconnection: false,
    transports: ['websocket'],
  });

  return {
    socket,
    connected: once(socket, 'connect', 5000, `${label} nao conectou`),
    joined: once(socket, 'joined', 5000, `${label} nao entrou no chat`),
  };
}

function waitForOnlineCount(client, minimum) {
  return waitForEvent(client.socket, 'online users', (payload) => payload.total >= minimum, 5000, 'contador online nao atualizou');
}

function waitForMessage(client, text) {
  return waitForEvent(client.socket, 'chat message', (message) => message.text === text, 5000, 'mensagem nao chegou');
}

function once(socket, event, timeoutMs, timeoutMessage) {
  return waitForEvent(socket, event, () => true, timeoutMs, timeoutMessage);
}

function waitForEvent(socket, event, predicate, timeoutMs, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    function handler(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }

    socket.on(event, handler);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
