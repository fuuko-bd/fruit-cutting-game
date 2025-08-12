// server.js（この内容で置き換え）

const path = require('path');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: '*' },
  transports: ['websocket','polling'],
});

// 直下のファイル群をそのまま配信（publicフォルダ不要）
app.use(express.static(__dirname));

// ヘルスチェック（Cursorのぐるぐる対策）
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// ショートURL
app.get('/projector', (_req, res) =>
  res.sendFile(path.join(__dirname, 'index.html'))
);
app.get('/controller', (_req, res) =>
  res.sendFile(path.join(__dirname, 'controller.html'))
);

// プレイヤー名管理
const names = new Map(); // socket.id => displayName

// WebSocket（Lv2: タッチパッド方式）
io.on('connection', (socket) => {
  console.log('connected:', socket.id);

  // 名前設定
  socket.on('setName', ({ name } = {}) => {
    if (typeof name === 'string' && name.trim()) {
      const clean = name.trim().slice(0, 24);
      names.set(socket.id, clean);
      io.emit('join', { id: socket.id, name: clean });
    }
  });

  // 0..1 の正規化座標を配信
  socket.on('aim', ({ x, y } = {}) => {
    if (typeof x === 'number' && typeof y === 'number') {
      io.emit('aim', { id: socket.id, x, y, name: names.get(socket.id) || '' });
    }
  });

  // 斬撃（その時点の座標）
  socket.on('slash', ({ x, y } = {}) => {
    if (typeof x === 'number' && typeof y === 'number') {
      io.emit('slash', { id: socket.id, x, y, name: names.get(socket.id) || '' });
    }
  });

  socket.on('disconnect', () => {
    io.emit('leave', { id: socket.id });
    names.delete(socket.id);
    console.log('disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 Controller: /controller  🎥 Projector: /projector  🏥 Health: /health`);
});
