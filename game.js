class FruitCuttingGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.socket = null;
        this.gameState = {
            isRunning: false,
            score: 0,
            combo: 0,
            timeLeft: 60,
            fruits: [],
            slashes: [],
            particles: [],
            cursorsByClient: {}, // {id: {x,y,ts,name,insect,score}}
            playerScores: {}, // {id: {name, score, insect, eatenEmojis:[]}}
        };
        
        // 1果物=10pt 固定
        this.pointsPerFruit = 10;
        
        this.fruitTypes = [
            { name: 'apple', emoji: '🍎', speed: 2 },
            { name: 'orange', emoji: '🍊', speed: 2.5 },
            { name: 'banana', emoji: '🍌', speed: 3 },
            { name: 'watermelon', emoji: '🍉', speed: 1.5 },
            { name: 'pineapple', emoji: '🍍', speed: 2.2 },
            { name: 'grapes', emoji: '🍇', speed: 2.8 }
        ];
        
        this.insects = ['🐞', '🐝', '🐛', '🕷️', '🦋', '🦗', '🦂', '🕸️'];
        this.controllerJoinUrl = window.location.origin + '/controller';
        
        this.init();
    }
    
    init() {
        this.setupSocket();
        this.setupEventListeners();
        this.generateQRCode();
        this.gameLoop();
    }
    
    setupSocket() {
        this.socket = io(window.location.origin, {
  transports: ['websocket', 'polling'],
  timeout: 7000,
  reconnectionAttempts: 5,
});
        this.socket.on('connect', () => console.log('Connected to server'));
        
        this.socket.on('aim', ({ id, x, y, name }) => {
            if (typeof x === 'number' && typeof y === 'number' && id) {
                if (!this.gameState.playerScores[id]) {
                    const rand = this.insects[Math.floor(Math.random() * this.insects.length)];
                    this.gameState.playerScores[id] = { name: name || '', score: 0, insect: rand, eatenEmojis: [] };
                }
                this.gameState.cursorsByClient[id] = {
                    x: x * this.canvas.width,
                    y: y * this.canvas.height,
                    ts: Date.now(),
                    name: name || '',
                    insect: this.gameState.playerScores[id].insect,
                    score: this.gameState.playerScores[id].score
                };
            }
        });
        
        this.socket.on('slash', (data) => this.handleSlash(data));
        
        this.socket.on('join', ({ id, name }) => {
            if (id) {
                const rand = this.insects[Math.floor(Math.random() * this.insects.length)];
                this.gameState.playerScores[id] = { name: name || '', score: 0, insect: rand, eatenEmojis: [] };
                const cur = this.gameState.cursorsByClient[id] || {};
                this.gameState.cursorsByClient[id] = {
                    x: cur.x || this.canvas.width / 2,
                    y: cur.y || this.canvas.height / 2,
                    ts: Date.now(),
                    name: name || '',
                    insect: rand,
                    score: 0
                };
            }
        });
        
        this.socket.on('leave', ({ id }) => {
            if (id) {
                delete this.gameState.cursorsByClient[id];
                delete this.gameState.playerScores[id];
            }
        });
    }
    
    setupEventListeners() {
        document.getElementById('startBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.togglePause();
        });
        
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetGame();
        });
        
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restartGame();
        });
    }
    
    generateQRCode() {
        const qrContainer = document.getElementById('qrCode');
        if (!qrContainer) return;
        const url = encodeURIComponent(this.controllerJoinUrl);
        const imgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${url}`;
        qrContainer.innerHTML = `
            <div style="padding: 12px; text-align: center;">
                <img src="${imgSrc}" alt="QR Code" style="max-width: 220px; height: auto;" />
                <p style="color: #fff; font-size: 0.9rem; margin-top: 8px;">スマホでQRを読み取って参加</p>
                <p style="color: #e0e0e0; font-size: 0.7rem; word-break: break-all;">${this.controllerJoinUrl}</p>
            </div>
        `;
    }
    
    startGame() {
        this.gameState.isRunning = true;
        this.gameState.score = 0;
        this.gameState.combo = 0;
        this.gameState.timeLeft = 60;
        this.gameState.fruits = [];
        this.gameState.slashes = [];
        this.gameState.particles = [];
        
        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        
        this.updateUI();
        this.startTimer();
        this.startFruitSpawning();
    }
    
    startTimer() {
        this.timer = setInterval(() => {
            if (this.gameState.isRunning && this.gameState.timeLeft > 0) {
                this.gameState.timeLeft--;
                this.updateUI();
                
                if (this.gameState.timeLeft <= 0) {
                    this.endGame();
                }
            }
        }, 1000);
    }
    
    startFruitSpawning() {
        this.fruitSpawner = setInterval(() => {
            if (this.gameState.isRunning) {
                this.spawnFruit();
            }
        }, 2000);
    }
    
    spawnFruit() {
        const fruitType = this.fruitTypes[Math.floor(Math.random() * this.fruitTypes.length)];
        const fruit = {
            x: -50,
            y: Math.random() * (this.canvas.height - 100) + 50,
            vx: fruitType.speed,
            vy: 0,
            type: fruitType,
            width: 40,
            height: 40,
            isCut: false,
            cutTime: 0
        };
        
        this.gameState.fruits.push(fruit);
        console.log('Fruit spawned:', fruitType.name, 'at', fruit.x, fruit.y);
    }
    
    togglePause() {
        this.gameState.isRunning = !this.gameState.isRunning;
        const pauseBtn = document.getElementById('pauseBtn');
        pauseBtn.textContent = this.gameState.isRunning ? '一時停止' : '再開';
        
        if (this.gameState.isRunning) {
            this.startTimer();
            this.startFruitSpawning();
        } else {
            clearInterval(this.timer);
            clearInterval(this.fruitSpawner);
        }
    }
    
    resetGame() {
        this.gameState.isRunning = false;
        this.gameState.fruits = [];
        this.gameState.slashes = [];
        this.gameState.particles = [];
        
        // タイマーと果物生成をクリア
        if (this.timer) clearInterval(this.timer);
        if (this.fruitSpawner) clearInterval(this.fruitSpawner);
        
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('pauseBtn').textContent = '一時停止';
        
        this.updateUI();
    }
    
    restartGame() {
        document.getElementById('gameOver').classList.add('hidden');
        this.startGame();
    }
    
    handleSlash(data) {
        // 座標を正規化された値から実際のキャンバス座標に変換
        let x, y;
        if (data && data.x !== undefined && data.y !== undefined) {
            x = data.x * this.canvas.width;
            y = data.y * this.canvas.height;
        } else {
            x = this.canvas.width / 2;
            y = this.canvas.height / 2;
        }
        
        const slash = {
            x: x,
            y: y,
            direction: (data && data.direction) || 'horizontal',
            time: 0,
            maxTime: 0.3
        };
        
        this.gameState.slashes.push(slash);
        this.checkSlashCollisions(slash);
        this.createSlashEffect(slash.x, slash.y);
    }
    
    checkSlashCollisions(slash) {
        this.gameState.fruits.forEach(fruit => {
            if (!fruit.isCut && this.isColliding(slash, fruit)) {
                fruit.isCut = true;
                fruit.cutTime = 0;
                
                // 斬った（むしくった）参加者を特定して得点・履歴を更新
                let updated = false;
                Object.entries(this.gameState.cursorsByClient).forEach(([id, cursor]) => {
                    if (!updated && this.isColliding(slash, cursor)) {
                        const ps = this.gameState.playerScores[id];
                        if (ps) {
                            ps.score += this.pointsPerFruit;
                            ps.eatenEmojis.push(fruit.type.emoji);
                            this.gameState.cursorsByClient[id].score = ps.score;
                        }
                        updated = true;
                    }
                });
                
                // 全体スコア・コンボ
                this.gameState.score += this.pointsPerFruit;
                this.gameState.combo++;
                if (this.gameState.combo % 5 === 0) this.gameState.score += 50;
                
                this.createCutParticles(fruit);
                this.updateUI();
            }
        });
    }
    
    isColliding(slash, target) {
        const distance = Math.sqrt(
            Math.pow(slash.x - target.x, 2) + Math.pow(slash.y - target.y, 2)
        );
        return distance < 60; // 斬る範囲
    }
    
    createCutParticles(fruit) {
        for (let i = 0; i < 15; i++) {
            const particle = {
                x: fruit.x,
                y: fruit.y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 1,
                maxLife: 1,
                color: `hsl(${Math.random() * 60 + 15}, 100%, 60%)`,
                size: Math.random() * 3 + 1
            };
            this.gameState.particles.push(particle);
        }
    }
    
    createSlashEffect(x, y) {
        // 斬るエフェクトのパーティクル
        for (let i = 0; i < 10; i++) {
            const particle = {
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1,
                maxLife: 1,
                color: `hsl(${Math.random() * 60 + 30}, 100%, 50%)`
            };
            this.gameState.particles.push(particle);
        }
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.gameState.score;
        document.getElementById('combo').textContent = this.gameState.combo;
        document.getElementById('timeLeft').textContent = this.gameState.timeLeft;
    }
    
    endGame() {
        this.gameState.isRunning = false;
        clearInterval(this.timer);
        clearInterval(this.fruitSpawner);
        
        // 参加者ランキングを整形
        const players = Object.entries(this.gameState.playerScores).map(([id, p]) => ({ id, ...p }));
        players.sort((a, b) => b.score - a.score);
        const rankingHtml = players.map(p => {
            const fruitsLine = p.eatenEmojis.join('');
            return `<div style="margin:6px 0;">${p.insect} ${p.name || '名無し'}：${p.score}ポイント：${fruitsLine}</div>`;
        }).join('');
        const container = document.getElementById('finalRanking');
        if (container) container.innerHTML = rankingHtml || '<div>参加者はいません</div>';
        
        document.getElementById('finalScore').textContent = this.gameState.score;
        document.getElementById('finalCombo').textContent = this.gameState.combo;
        document.getElementById('gameOver').classList.remove('hidden');
    }
    
    restartGame() {
        document.getElementById('gameOver').classList.add('hidden');
        this.startGame();
    }
    
    update() {
        if (!this.gameState.isRunning) return;
        
        // 果物の更新
        this.gameState.fruits.forEach((fruit, index) => {
            fruit.x += fruit.vx;
            
            if (fruit.isCut) {
                fruit.cutTime += 0.016; // 約60FPS
                fruit.y += fruit.vy;
                fruit.vy += 0.5; // 重力
            }
            
            // 画面外に出た果物を削除
            if (fruit.x > this.canvas.width + 50 || fruit.y > this.canvas.height + 50) {
                this.gameState.fruits.splice(index, 1);
            }
        });
        
        // 斬るエフェクトの更新
        this.gameState.slashes.forEach((slash, index) => {
            slash.time += 0.016;
            if (slash.time >= slash.maxTime) {
                this.gameState.slashes.splice(index, 1);
            }
        });
        
        // パーティクルの更新
        this.gameState.particles.forEach((particle, index) => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= 0.02;
            
            if (particle.life <= 0) {
                this.gameState.particles.splice(index, 1);
            }
        });
    }
    
    render() {
        // 背景をクリア
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#98FB98');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 果物の描画
        this.gameState.fruits.forEach(fruit => {
            this.ctx.save();
            
            if (fruit.isCut) {
                // 切られた果物の描画（元の種類を保持）
                this.ctx.globalAlpha = 1 - (fruit.cutTime / 0.5);
                this.ctx.font = '30px Arial';
                this.ctx.fillStyle = '#8B4513';
                // 切られた果物は2つに分かれて表示
                this.ctx.fillText(fruit.type.emoji, fruit.x - 15, fruit.y + 10);
                this.ctx.fillText(fruit.type.emoji, fruit.x + 5, fruit.y - 5);
            } else {
                // 通常の果物の描画
                this.ctx.font = '40px Arial';
                this.ctx.fillText(fruit.type.emoji, fruit.x - 20, fruit.y + 15);
            }
            
            this.ctx.restore();
        });
        
        // 斬るエフェクト
        this.gameState.slashes.forEach(slash => {
            this.ctx.save();
            this.ctx.globalAlpha = 1 - (slash.time / slash.maxTime);
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 5;
            this.ctx.beginPath();
            
            if (slash.direction === 'horizontal') {
                this.ctx.moveTo(slash.x - 50, slash.y);
                this.ctx.lineTo(slash.x + 50, slash.y);
            } else {
                this.ctx.moveTo(slash.x, slash.y - 50);
                this.ctx.lineTo(slash.x, slash.y + 50);
            }
            
            this.ctx.stroke();
            this.ctx.restore();
        });
        
        // パーティクル
        this.gameState.particles.forEach(particle => {
            this.ctx.save();
            this.ctx.globalAlpha = particle.life;
            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size || 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
        
        // 参加者カーソルの描画
        this.drawParticipantCursors();
        
        // UI
        this.drawUI();
    }
    
    drawUI() {
        // スコア表示
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, 10, 200, 80);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`スコア: ${this.gameState.score}`, 20, 35);
        this.ctx.fillText(`コンボ: ${this.gameState.combo}`, 20, 60);
        this.ctx.fillText(`時間: ${this.gameState.timeLeft}`, 20, 85);
        
        // 参加者得点表示
        this.drawPlayerScores();
    }
    
    drawPlayerScores() {
        const players = Object.values(this.gameState.playerScores);
        if (players.length === 0) return;
        
        // 得点順にソート
        players.sort((a, b) => b.score - a.score);
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(this.canvas.width - 250, 10, 240, 30 + players.length * 25);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = '18px Arial';
        this.ctx.fillText('参加者得点:', this.canvas.width - 240, 30);
        
        players.forEach((player, index) => {
            if (index < 8) { // 最大8人まで表示
                const y = 55 + index * 25;
                this.ctx.font = '16px Arial';
                this.ctx.fillText(`${player.insect} ${player.name}: ${player.score}pt`, this.canvas.width - 240, y);
            }
        });
    }
    
    drawParticipantCursors() {
        const now = Date.now();
        const STALE_MS = 5000; // 5秒で古いカーソルは消す
        const cursorCount = Object.keys(this.gameState.cursorsByClient).length;
        if (cursorCount > 0) {
            console.log(`Drawing ${cursorCount} cursors:`, this.gameState.cursorsByClient);
        }
        
        Object.entries(this.gameState.cursorsByClient).forEach(([id, c]) => {
            if (now - c.ts > STALE_MS) {
                delete this.gameState.cursorsByClient[id];
                return;
            }
            this.ctx.save();
            // 虫の絵文字
            this.ctx.font = '28px sans-serif';
            this.ctx.fillText(c.insect, c.x - 14, c.y + 10);
            
            // 名前ラベル
            if (c.name) {
                const paddingX = 6;
                const paddingY = 4;
                this.ctx.font = '16px sans-serif';
                const metrics = this.ctx.measureText(c.name);
                const width = metrics.width + paddingX * 2;
                const height = 22;
                const bx = c.x + 18;
                const by = c.y - 10 - height;
                this.ctx.fillStyle = 'rgba(0,0,0,0.55)';
                this.ctx.fillRect(bx, by, width, height);
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillText(c.name, bx + paddingX, by + height - paddingY);
            }
            
            // 得点表示
            if (c.score > 0) {
                this.ctx.font = '14px sans-serif';
                this.ctx.fillStyle = '#FFD700';
                this.ctx.fillText(`${c.score}pt`, c.x - 20, c.y + 35);
            }
            
            this.ctx.restore();
        });
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// ゲームの初期化
document.addEventListener('DOMContentLoaded', () => {
    new FruitCuttingGame();
}); 
