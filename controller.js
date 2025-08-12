class TouchpadController {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.cursorX = 0;
        this.cursorY = 0;
        this.touchpadWidth = 0;
        this.touchpadHeight = 0;
        this.lastTouchTime = 0;
        this.doubleTapDelay = 300; // ダブルタップ判定の遅延（ミリ秒）
        this.isDragging = false;
        this.displayName = '';
        
        this.init();
    }
    
    init() {
        this.setupSocket();
        this.setupNameForm();
        this.setupTouchpad();
        this.updateCursorPosition();
    }
    
    setupSocket() {
        // 同一オリジンに接続（スマホでも動作）
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.updateStatus('接続済み', 'success');
            if (this.displayName) {
                this.socket.emit('setName', { name: this.displayName });
            }
        });
        
        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.updateStatus('接続切れ', 'error');
        });
        
        this.socket.on('connect_error', () => {
            this.isConnected = false;
            this.updateStatus('接続エラー', 'error');
        });
    }

    setupNameForm() {
        const input = document.getElementById('nameInput');
        const btn = document.getElementById('saveNameBtn');
        if (!input || !btn) return;
        const saved = localStorage.getItem('displayName') || '';
        if (saved) {
            input.value = saved;
            this.displayName = saved;
        }
        const save = () => {
            const name = (input.value || '').trim().slice(0, 24);
            this.displayName = name;
            localStorage.setItem('displayName', name);
            if (this.isConnected && name) {
                this.socket.emit('setName', { name });
            }
        };
        btn.addEventListener('click', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') save();
        });
    }
    
    setupTouchpad() {
        const touchpad = document.getElementById('touchpad');
        // タッチイベント
        touchpad.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleTouchStart(e);
        });
        touchpad.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleTouchMove(e);
        });
        touchpad.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleTouchEnd(e);
            // 指を離した位置で即 slash
            this.sendSlashAtCurrent();
        });
        // マウス（テスト用）
        touchpad.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.handleMouseDown(e);
        });
        touchpad.addEventListener('mousemove', (e) => {
            e.preventDefault();
            this.handleMouseMove(e);
        });
        touchpad.addEventListener('mouseup', (e) => {
            e.preventDefault();
            this.handleMouseUp(e);
            this.sendSlashAtCurrent();
        });
        // ダブルタップでも slash
        touchpad.addEventListener('click', (e) => {
            const currentTime = Date.now();
            if (currentTime - this.lastTouchTime < this.doubleTapDelay) {
                this.sendSlashAtCurrent();
            }
            this.lastTouchTime = currentTime;
        });
        // 初期サイズ
        this.updateTouchpadSize();
        window.addEventListener('resize', () => this.updateTouchpadSize());
    }

    updateTouchpadSize() {
        const touchpad = document.getElementById('touchpad');
        this.touchpadWidth = touchpad.offsetWidth;
        this.touchpadHeight = touchpad.offsetHeight;
    }
    
    handleTouchStart(e) {
        const touch = e.touches[0];
        const rect = e.target.getBoundingClientRect();
        this.cursorX = touch.clientX - rect.left;
        this.cursorY = touch.clientY - rect.top;
        this.isDragging = true;
        this.updateCursorPosition();
        this.addTouchpadActive();
    }
    
    handleTouchMove(e) {
        if (this.isDragging) {
            const touch = e.touches[0];
            const rect = e.target.getBoundingClientRect();
            this.cursorX = touch.clientX - rect.left;
            this.cursorY = touch.clientY - rect.top;
            this.updateCursorPosition();
        }
    }
    
    handleTouchEnd(_e) {
        this.isDragging = false;
        this.removeTouchpadActive();
    }
    
    handleMouseDown(e) {
        const rect = e.target.getBoundingClientRect();
        this.cursorX = e.clientX - rect.left;
        this.cursorY = e.clientY - rect.top;
        this.isDragging = true;
        this.updateCursorPosition();
        this.addTouchpadActive();
    }
    
    handleMouseMove(e) {
        if (this.isDragging) {
            const rect = e.target.getBoundingClientRect();
            this.cursorX = e.clientX - rect.left;
            this.cursorY = e.clientY - rect.top;
            this.updateCursorPosition();
        }
    }
    
    handleMouseUp(_e) {
        this.isDragging = false;
        this.removeTouchpadActive();
    }
    
    updateCursorPosition() {
        const cursor = document.getElementById('cursor');
        const cursorXDisplay = document.getElementById('cursorX');
        const cursorYDisplay = document.getElementById('cursorY');
        
        cursor.style.left = this.cursorX + 'px';
        cursor.style.top = this.cursorY + 'px';
        cursorXDisplay.textContent = Math.round(this.cursorX);
        cursorYDisplay.textContent = Math.round(this.cursorY);
        
        if (this.isConnected && this.touchpadWidth > 0 && this.touchpadHeight > 0) {
            const normalizedX = Math.max(0, Math.min(1, this.cursorX / this.touchpadWidth));
            const normalizedY = Math.max(0, Math.min(1, this.cursorY / this.touchpadHeight));
            this.socket.emit('aim', { x: normalizedX, y: normalizedY });
        }
        
        cursor.classList.add('moving');
        setTimeout(() => cursor.classList.remove('moving'), 100);
    }

    sendSlashAtCurrent() {
        if (!this.isConnected || this.touchpadWidth === 0 || this.touchpadHeight === 0) return;
        const normalizedX = Math.max(0, Math.min(1, this.cursorX / this.touchpadWidth));
        const normalizedY = Math.max(0, Math.min(1, this.cursorY / this.touchpadHeight));
        this.socket.emit('slash', { x: normalizedX, y: normalizedY });
        this.addSlashAnimation();
    }
    
    addTouchpadActive() {
        const touchpad = document.getElementById('touchpad');
        touchpad.classList.add('active');
    }
    
    removeTouchpadActive() {
        const touchpad = document.getElementById('touchpad');
        touchpad.classList.remove('active');
    }
    
    updateStatus(message, type) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
        statusElement.className = type;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TouchpadController();
});

console.log('User Agent:', navigator.userAgent);
console.log('Touch Support:', 'ontouchstart' in window);
console.log('Max Touch Points:', navigator.maxTouchPoints); 