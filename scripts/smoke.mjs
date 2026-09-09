import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const url = process.env.SMOKE_URL || 'http://localhost:3000';
const states = new Map();
const clients = [];
function command(socket, event, ...args) {
  return new Promise((resolve, reject) => {
    socket.timeout(8000).emit(event, ...args, (error, reply) => {
      if (error) reject(error);
      else if (!reply.ok) reject(new Error(reply.error));
      else resolve(reply);
    });
  });
}
async function connect() {
  const socket = io(url, { autoConnect: false, forceNew: true, reconnection: false });
  clients.push(socket);
  socket.on('room:update', state => states.set(socket, state));
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
    socket.connect();
  });
  return socket;
}
try {
  const health = await fetch(`${url}/api/health`);
  assert.equal(health.status, 200);
  const page = await fetch(url);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Where Are We/);
  const a = await connect(), b = await connect();
  const created = await command(a, 'room:create', { name: 'Smoke A' });
  await command(b, 'room:join', { name: 'Smoke B', code: created.session.code });
  await command(a, 'room:settings', { rounds: 3, seconds: 30, difficulty: 'normal', category: 'world' });
  await command(a, 'player:ready', { ready: true });
  await command(b, 'player:ready', { ready: true });
  await command(a, 'game:start');
  for (let round = 1; round <= 3; round++) {
    const state = states.get(a);
    assert.equal(state.phase, 'playing');
    const image = await fetch(`${url}${state.image}`);
    assert.equal(image.status, 200);
    assert.match(image.headers.get('content-type'), /^image\/(jpeg|png)$/);
    const bytes = Buffer.from(await image.arrayBuffer());
    assert.ok(bytes.length > 1000);
    assert.equal(bytes.includes(Buffer.from('Exif\0\0')), false);
    assert.equal(states.get(a).results.length, round - 1);
    await command(a, 'guess:submit', { lat: 13.7, lng: 100.5, round });
    await command(b, 'guess:submit', { lat: 48.8, lng: 2.3, round });
    // Wait for the host's reveal instead of relying on cross-client packet timing.
    for (let n = 0; n < 100 && states.get(a).phase !== 'reveal'; n++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(states.get(a).phase, 'reveal');
    await command(a, 'round:next');
  }
  for (let n = 0; n < 100 && states.get(a).persisted !== true; n++) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(states.get(a).phase, 'finished');
  assert.equal(states.get(a).persisted, true);
  assert.equal(states.get(a).results.length, 3);
  console.log(`PASS: ${url} · HTTP + 2 players + 3 rounds + private images + SQLite persistence`);
  await command(a, 'room:leave');
  await command(b, 'room:leave');
} finally {
  clients.forEach(socket => socket.disconnect());
}
