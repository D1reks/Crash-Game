let tg = null;
if (window.Telegram && window.Telegram.WebApp) {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
}

const ALL_GIFTS = [
    { id: 'rose', name: 'Роза', emoji: '🌹', price: 50 },
    { id: 'cake', name: 'Торт', emoji: '🎂', price: 100 },
    { id: 'ring', name: 'Кольцо', emoji: '💍', price: 200 },
    { id: 'crown', name: 'Корона', emoji: '👑', price: 500 },
    { id: 'diamond', name: 'Алмаз', emoji: '💎', price: 1000 },
    { id: 'rocket', name: 'Ракета', emoji: '🚀', price: 2500 },
    { id: 'star_gift', name: 'Звездный дар', emoji: '🌟', price: 5000 },
    { id: 'unicorn', name: 'Единорог', emoji: '🦄', price: 10000 },
    { id: 'dragon', name: 'Дракон', emoji: '🐉', price: 25000 },
    { id: 'phoenix', name: 'Феникс', emoji: '🔥', price: 50000 },
    { id: 'galaxy', name: 'Галактика', emoji: '🌌', price: 100000 },
    { id: 'infinity', name: 'Бесконечность', emoji: '♾️', price: 250000 },
];

class SparkParticle {
    constructor(x, y, vx, vy, life, color, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.size = size;
        this.gravity = 0.04;
        this.friction = 0.98;
    }
    update() {
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        this.size *= 0.985;
    }
    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.size * 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    get dead() { return this.life <= 0; }
}

class SparkSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.animId = null;
    }
    emit(x, y, count, colors) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.8 + Math.random() * 4;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed - 2;
            const life = 40 + Math.floor(Math.random() * 50);
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = 1.2 + Math.random() * 1.8;
            this.particles.push(new SparkParticle(x, y, vx, vy, life, color, size));
        }
        if (!this.animId) this.animate();
    }
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.particles = this.particles.filter(p => !p.dead);
        for (const p of this.particles) {
            p.update();
            p.draw(this.ctx);
        }
        if (this.particles.length > 0) {
            this.animId = requestAnimationFrame(() => this.animate());
        } else {
            this.animId = null;
        }
    }
    clear() {
        this.particles = [];
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

class UpgradeGame {
    constructor() {
        this.balance = 1000;
        this.inventory = [];
        this.currentGiftId = null;
        this.targetGiftId = null;
        this.currentChance = 0;
        this.history = [];
        this.isSpinning = false;
        this.audioContext = null;
        this.soundEnabled = false;
        this.wheelAngle = 0;
        this.wheelAnimationId = null;
        this.resultTimeout = null;
        this.sparkSystem = null;
        this.sellTargetGiftId = null;
        this.init();
    }

    get currentGift() { return ALL_GIFTS.find(g => g.id === this.currentGiftId) || null; }
    get targetGift() { return ALL_GIFTS.find(g => g.id === this.targetGiftId) || null; }
    get inventoryGifts() {
        const seen = new Set();
        return this.inventory.filter(e => { if (seen.has(e.giftId)) return false; seen.add(e.giftId); return true; }).map(e => ALL_GIFTS.find(g => g.id === e.giftId)).filter(Boolean);
    }

    calculateChance(cp, tp) { return cp >= tp ? 0 : (cp / tp) * 0.95; }
    getPotentialTargets() { return this.currentGift ? ALL_GIFTS.filter(g => g.price > this.currentGift.price) : []; }

    findTargetByFraction(fr) {
        if (!this.currentGift) return null;
        const [n, d] = fr.split('/').map(Number);
        const tc = n / d;
        const cPrice = this.currentGift.price;
        const cands = ALL_GIFTS.filter(g => g.price > cPrice);
        if (!cands.length) return null;
        let best = cands[0], bd = Infinity;
        for (const g of cands) { const diff = Math.abs(this.calculateChance(cPrice, g.price) - tc); if (diff < bd) { bd = diff; best = g; } }
        return best;
    }

    async init() {
        this.loadFromStorage();
        this.deduplicateInventory();
        if (this.inventory.length > 0 && !this.inventory.find(e => e.giftId === this.currentGiftId)) {
            this.currentGiftId = this.inventory[0].giftId;
        }
        this.autoSelectTarget();
        this.sparkSystem = new SparkSystem(document.getElementById('sparkCanvas'));
        this.setupEventListeners();
        this.renderAll();
    }

    deduplicateInventory() { const s = new Set(); const u = []; for (const e of this.inventory) { if (!s.has(e.giftId)) { s.add(e.giftId); u.push(e); } } this.inventory = u; }

    autoSelectTarget() {
        const t = this.getPotentialTargets();
        if (t.length > 0 && !t.find(x => x.id === this.targetGiftId)) {
            this.targetGiftId = t[0].id;
        } else if (t.length === 0) {
            this.targetGiftId = null;
        }
        this.updateChance();
    }

    updateChance() {
        if (this.currentGift && this.targetGift) {
            this.currentChance = this.calculateChance(this.currentGift.price, this.targetGift.price);
        } else {
            this.currentChance = 0;
        }
    }

    loadFromStorage() { try { const s = localStorage.getItem('upgrade_stars_v9'); if (s) { const d = JSON.parse(s); this.balance = d.balance || 1000; this.inventory = d.inventory || []; this.history = d.history || []; this.currentGiftId = d.currentGiftId || null; this.targetGiftId = d.targetGiftId || null; } } catch (e) {} }
    saveToStorage() { try { localStorage.setItem('upgrade_stars_v9', JSON.stringify({ balance: this.balance, inventory: this.inventory, history: this.history.slice(0, 30), currentGiftId: this.currentGiftId, targetGiftId: this.targetGiftId })); } catch (e) {} }

    setupEventListeners() {
        document.getElementById('upgradeBtn').addEventListener('click', () => this.startUpgrade());
        document.querySelectorAll('.quick-bet-btn').forEach(b => b.addEventListener('click', e => {
            if (!this.currentGift) return;
            const f = e.target.dataset.fraction;
            const g = this.findTargetByFraction(f); if (g) { this.targetGiftId = g.id; this.updateChance(); this.renderAll(); this.highlightQuickButton(f); }
        }));
        document.getElementById('currentGiftCard').addEventListener('click', () => {
            const ig = this.inventoryGifts; if (ig.length === 0) return;
            if (!this.currentGift) { this.currentGiftId = ig[0].id; } else { const ci = ig.findIndex(g => g.id === this.currentGiftId); this.currentGiftId = ig[(ci + 1) % ig.length].id; }
            this.autoSelectTarget();
            this.updateChance();
            this.renderAll();
            this.saveToStorage();
        });
        document.getElementById('targetGiftCard').addEventListener('click', () => {
            const t = this.getPotentialTargets(); if (t.length === 0) return;
            if (!this.targetGift) { this.targetGiftId = t[0].id; } else { const ci = t.findIndex(g => g.id === this.targetGiftId); this.targetGiftId = t[(ci + 1) % t.length].id; }
            this.updateChance();
            this.renderAll();
            this.saveToStorage();
        });
        document.getElementById('balanceContainer').addEventListener('click', () => document.getElementById('balanceTopupOverlay').classList.add('show'));
        document.getElementById('closeTopupBtn').addEventListener('click', () => document.getElementById('balanceTopupOverlay').classList.remove('show'));
        document.getElementById('topupGifts').addEventListener('click', () => { alert('🔜 Функция пополнения подарками Telegram будет доступна с интеграцией бота.'); document.getElementById('balanceTopupOverlay').classList.remove('show'); });
        document.getElementById('topupStars').addEventListener('click', () => { this.balance += 500; this.renderAll(); this.saveToStorage(); document.getElementById('balanceTopupOverlay').classList.remove('show'); if (tg) tg.HapticFeedback.notificationOccurred('success'); });
        document.getElementById('shopBtn').addEventListener('click', () => { document.getElementById('shopOverlay').classList.add('show'); this.renderShop(); });
        document.getElementById('closeShopBtn').addEventListener('click', () => document.getElementById('shopOverlay').classList.remove('show'));
        document.getElementById('inventoryList').addEventListener('click', e => { const it = e.target.closest('.gift-list-item'); if (!it) return; const gid = it.dataset.giftId; if (gid && this.inventory.find(en => en.giftId === gid)) { this.currentGiftId = gid; this.autoSelectTarget(); this.updateChance(); this.renderAll(); this.saveToStorage(); } });
        document.getElementById('targetsList').addEventListener('click', e => { const it = e.target.closest('.gift-list-item'); if (!it) return; const gid = it.dataset.giftId; const tgt = ALL_GIFTS.find(g => g.id === gid); if (tgt && this.currentGift && tgt.price > this.currentGift.price) { this.targetGiftId = gid; this.updateChance(); this.renderAll(); this.saveToStorage(); } });
        document.getElementById('sellConfirmBtn').addEventListener('click', () => this.confirmSell());
        document.getElementById('sellCancelBtn').addEventListener('click', () => this.closeSellOverlay());
        document.getElementById('sellOverlay').addEventListener('click', e => { if (e.target === document.getElementById('sellOverlay')) this.closeSellOverlay(); });
        document.body.addEventListener('click', () => { if (!this.soundEnabled) this.initAudio(); }, { once: true });
    }

    openSellOverlay(giftId) {
        const gift = ALL_GIFTS.find(g => g.id === giftId);
        if (!gift || !this.inventory.find(e => e.giftId === giftId)) return;
        this.sellTargetGiftId = giftId;
        document.getElementById('sellEmoji').textContent = gift.emoji;
        document.getElementById('sellName').textContent = gift.name;
        document.getElementById('sellPrice').textContent = gift.price + ' ⭐';
        document.getElementById('sellOverlay').classList.add('show');
    }

    closeSellOverlay() {
        document.getElementById('sellOverlay').classList.remove('show');
        this.sellTargetGiftId = null;
    }

    confirmSell() {
        if (!this.sellTargetGiftId) return;
        const gift = ALL_GIFTS.find(g => g.id === this.sellTargetGiftId);
        if (!gift) return;
        const idx = this.inventory.findIndex(e => e.giftId === this.sellTargetGiftId);
        if (idx === -1) return;
        this.inventory.splice(idx, 1);
        this.balance += gift.price;
        if (this.currentGiftId === this.sellTargetGiftId) {
            this.currentGiftId = this.inventory.length > 0 ? this.inventory[0].giftId : null;
            this.autoSelectTarget();
            this.updateChance();
        }
        this.saveToStorage();
        this.renderAll();
        this.closeSellOverlay();
        if (tg) tg.HapticFeedback.notificationOccurred('success');
    }

    highlightQuickButton(fr) { document.querySelectorAll('.quick-bet-btn').forEach(b => b.classList.remove('active')); const btn = document.querySelector(`.quick-bet-btn[data-fraction="${fr}"]`); if (btn) btn.classList.add('active'); }

    async initAudio() { try { this.audioContext = new (window.AudioContext || window.webkitAudioContext)(); await this.audioContext.resume(); this.soundEnabled = true; } catch (e) {} }
    playBeep(f, d, ty = 'sine') { if (!this.audioContext || !this.soundEnabled) return; const o = this.audioContext.createOscillator(); const g = this.audioContext.createGain(); o.connect(g); g.connect(this.audioContext.destination); o.frequency.value = f; o.type = ty; g.gain.setValueAtTime(0.05, this.audioContext.currentTime); g.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + d); o.start(); o.stop(this.audioContext.currentTime + d); }

    showResultText(success, chance) {
        const chanceDisplay = document.getElementById('chanceDisplay');
        const centerResult = document.getElementById('centerResult');
        const resultText = document.getElementById('centerResultText');
        const resultChance = document.getElementById('centerResultChance');
        chanceDisplay.classList.add('hidden-temp');
        if (success) {
            resultText.textContent = 'УСПЕХ!';
            resultText.style.color = '#5ff57a';
            resultText.style.textShadow = '0 0 20px #5ff57a, 0 0 40px #3fb950';
            resultChance.textContent = `Шанс: ${(chance*100).toFixed(1)}%`;
            resultChance.style.color = '#5ff57a';
        } else {
            resultText.textContent = 'ПРОВАЛ!';
            resultText.style.color = '#ff6b6b';
            resultText.style.textShadow = '0 0 20px #ff6b6b, 0 0 40px #f85149';
            resultChance.textContent = `Шанс: ${(chance*100).toFixed(1)}%`;
            resultChance.style.color = '#ff6b6b';
        }
        resultText.style.animation = 'none';
        resultText.offsetHeight;
        resultText.style.animation = 'result-pop 0.4s ease-out';
        centerResult.classList.add('show');
        const sc = document.getElementById('sparkCanvas');
        const cx = sc.width / 2;
        const cy = sc.height / 2;
        const colors = success ? ['#5ff57a', '#3fb950', '#a5f5b0', '#ffffff', '#7dff90'] : ['#ff6b6b', '#f85149', '#ff9999', '#ffffff', '#ff4444'];
        this.sparkSystem.emit(cx, cy, 50, colors);
        if (this.resultTimeout) clearTimeout(this.resultTimeout);
        this.resultTimeout = setTimeout(() => {
            centerResult.classList.remove('show');
            chanceDisplay.classList.remove('hidden-temp');
        }, 2000);
    }

    startUpgrade() {
        if (this.isSpinning || !this.currentGift || !this.targetGift || !this.inventory.find(e => e.giftId === this.currentGiftId) || this.currentGift.price >= this.targetGift.price) return;
        this.isSpinning = true;
        const btn = document.getElementById('upgradeBtn');
        btn.disabled = true;
        btn.classList.add('spinning');
        btn.textContent = 'КРУТИМ...';
        if (tg) tg.HapticFeedback.impactOccurred('heavy');
        const totalRot = 5 + Math.floor(Math.random() * 5);
        const ta = Math.random() * Math.PI * 2;
        const totalAngle = totalRot * Math.PI * 2 + ta;
        const dur = 4000, st = Date.now(), sa = this.wheelAngle;
        const ease = t => 1 - Math.pow(1 - t, 3);
        const anim = () => { const el = Date.now() - st, p = Math.min(el / dur, 1), ep = ease(p); this.wheelAngle = sa + totalAngle * ep; this.drawWheel(); if (this.soundEnabled && p < 0.9 && Math.floor(p * 40) % 2 === 0) this.playBeep(200 + (1 - ep) * 800, 0.01); if (p < 1) this.wheelAnimationId = requestAnimationFrame(anim); else this.onSpinComplete(); };
        this.wheelAnimationId = requestAnimationFrame(anim);
    }

    onSpinComplete() { this.isSpinning = false; const btn = document.getElementById('upgradeBtn'); btn.classList.remove('spinning'); btn.textContent = 'UPGRADE'; btn.disabled = false; const na = ((this.wheelAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); const se = this.currentChance * Math.PI * 2; const win = na <= se; const sc = this.currentChance; if (win) this.onUpgradeSuccess(sc); else this.onUpgradeFail(sc); }

    onUpgradeSuccess(sc) { const og = this.currentGift, ng = this.targetGift; const idx = this.inventory.findIndex(e => e.giftId === og.id); if (idx !== -1) this.inventory.splice(idx, 1); if (!this.inventory.find(e => e.giftId === ng.id)) this.inventory.push({ giftId: ng.id, acquiredAt: Date.now() }); this.currentGiftId = ng.id; this.autoSelectTarget(); this.updateChance(); this.history.unshift({ from: og.id, to: ng.id, chance: sc, success: true, time: Date.now() }); this.saveToStorage(); this.renderAll(); this.showResultText(true, sc); if (tg) tg.HapticFeedback.notificationOccurred('success'); this.playBeep(1500, 0.2); setTimeout(() => this.playBeep(1800, 0.15), 150); }

    onUpgradeFail(sc) { const og = this.currentGift, tgf = this.targetGift; const idx = this.inventory.findIndex(e => e.giftId === og.id); if (idx !== -1) this.inventory.splice(idx, 1); if (!this.inventory.length) { this.currentGiftId = null; this.targetGiftId = null; } else { this.currentGiftId = this.inventory[0].giftId; this.autoSelectTarget(); } this.updateChance(); this.history.unshift({ from: og.id, to: tgf.id, chance: sc, success: false, time: Date.now() }); this.saveToStorage(); this.renderAll(); this.showResultText(false, sc); if (tg) tg.HapticFeedback.notificationOccurred('error'); this.playBeep(200, 0.3, 'sawtooth'); }

    renderAll() {
        document.getElementById('balance').textContent = this.balance.toLocaleString();
        this.renderGiftCard('currentGiftCard', this.currentGift, true);
        this.renderGiftCard('targetGiftCard', this.targetGift, false);
        const cp = (this.currentChance * 100).toFixed(1);
        document.getElementById('chancePercent').textContent = cp + '%';
        this.drawWheel();
        this.renderInventoryList();
        this.renderTargetsList();
        const ub = document.getElementById('upgradeBtn');
        const canUpgrade = !this.isSpinning && this.currentGift && this.targetGift && this.inventory.find(e => e.giftId === this.currentGiftId) && this.currentGift.price < this.targetGift.price;
        ub.disabled = !canUpgrade;
        if (!this.isSpinning) { ub.classList.remove('spinning'); ub.textContent = 'UPGRADE'; }
    }

    renderGiftCard(cardId, gift, isCurrent) {
        const card = document.getElementById(cardId);
        card.innerHTML = '';
        card.className = 'gift-card';

        if (gift) {
            if (isCurrent) card.classList.add('current-gift');
            else card.classList.add('target-gift');
            const emoji = document.createElement('div');
            emoji.className = 'gift-emoji';
            emoji.textContent = gift.emoji;
            const name = document.createElement('div');
            name.className = 'gift-name';
            name.textContent = gift.name;
            const price = document.createElement('div');
            price.className = 'gift-price';
            price.textContent = gift.price + ' ⭐';
            card.appendChild(emoji);
            card.appendChild(name);
            card.appendChild(price);
        } else {
            card.classList.add('empty-card');
            const arrows = document.createElement('div');
            arrows.className = 'placeholder-arrows';
            for (let i = 0; i < 3; i++) {
                const arrow = document.createElement('span');
                arrow.className = 'placeholder-arrow';
                arrow.textContent = isCurrent ? '❱' : '❰';
                arrows.appendChild(arrow);
            }
            card.appendChild(arrows);
        }
    }

    drawWheel() {
        const c = document.getElementById('wheelCanvas');
        const ctx = c.getContext('2d');
        const w = c.width, h = c.height, cx = w / 2, cy = h / 2;
        const or = Math.min(w, h) / 2 - 10, rw = 24, ir = or - rw, cr = ir - 5;
        ctx.clearRect(0, 0, w, h);
        ctx.beginPath();
        ctx.arc(cx, cy, or, 0, Math.PI * 2);
        ctx.arc(cx, cy, ir, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fillStyle = '#111827';
        ctx.fill();
        ctx.strokeStyle = '#2a3a5c';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowColor = 'rgba(100,140,255,0.3)';
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;
        if (this.currentChance > 0) {
            const sa = -Math.PI / 2, ea = -Math.PI / 2 + this.currentChance * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, or - 2, sa, ea);
            ctx.arc(cx, cy, ir + 2, ea, sa, true);
            ctx.closePath();
            const grad = ctx.createLinearGradient(cx - or, cy - or, cx + or, cy + or);
            grad.addColorStop(0, '#f0883e');
            grad.addColorStop(0.5, '#f5c842');
            grad.addColorStop(1, '#ffd700');
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.shadowColor = 'rgba(240,136,62,0.5)';
            ctx.shadowBlur = 20;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.arc(cx, cy, ir, 0, Math.PI * 2);
        ctx.strokeStyle = '#2a3a5c';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(100,140,255,0.2)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(cx, cy, or, 0, Math.PI * 2);
        ctx.strokeStyle = '#2a3a5c';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(100,140,255,0.2)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fillStyle = '#080c14';
        ctx.fill();
        ctx.strokeStyle = '#2a3a5c';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, cr - 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#1a2540';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.wheelAngle);
        const abr = ir + rw * 0.55, atr = or + 10;
        const abx = 0, aby = -abr, atx = 0, aty = -atr;
        // Arrow pointing inward — flip: tip at inner radius, base at outer
        const tipRadius = ir + 2;
        const baseRadius = or + 10;
        const tipX = 0, tipY = -tipRadius;
        const baseX = 0, baseY = -baseRadius;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(tipX, tipY);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Arrow head at tip (inner side)
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(-8, tipY - 12);
        ctx.lineTo(8, tipY - 12);
        ctx.closePath();
        ctx.fillStyle = '#ffd700';
        ctx.fill();
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;
        // White dot at tip
        ctx.beginPath();
        ctx.arc(tipX, tipY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;
        // Base dot
        ctx.beginPath();
        ctx.arc(baseX, baseY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd700';
        ctx.fill();
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
        const rg = ctx.createRadialGradient(cx - or * 0.2, cy - or * 0.2, or * 0.04, cx, cy, or);
        rg.addColorStop(0, 'rgba(255,255,255,0.05)');
        rg.addColorStop(0.5, 'rgba(255,255,255,0.01)');
        rg.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.beginPath();
        ctx.arc(cx, cy, or, 0, Math.PI * 2);
        ctx.arc(cx, cy, ir, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fillStyle = rg;
        ctx.fill();
    }

    renderInventoryList() {
        const c = document.getElementById('inventoryList');
        const ig = this.inventoryGifts;
        if (!ig.length) { c.innerHTML = '<div style="padding:20px;text-align:center;color:#6b7daa;font-size:12px;">Пусто</div>'; return; }
        c.innerHTML = ig.map(g => `
            <div class="gift-list-item" data-gift-id="${g.id}" style="${g.id===this.currentGiftId?'background:#111827;border-left:3px solid #ffd700;box-shadow:inset 0 0 15px rgba(255,215,0,0.05);':''}">
                <span class="gift-emoji-small">${g.emoji}</span>
                <div class="gift-list-item-info"><div class="gift-list-item-name">${g.name}</div><div class="gift-list-item-price">${g.price} ⭐</div></div>
                <button class="sell-icon-btn" data-gift-id="${g.id}">Sell</button>
            </div>`).join('');
        c.querySelectorAll('.sell-icon-btn').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); const gid = btn.dataset.giftId; this.openSellOverlay(gid); });
        });
    }

    renderTargetsList() {
        const c = document.getElementById('targetsList');
        const t = this.getPotentialTargets();
        if (!t.length) { c.innerHTML = '<div style="padding:20px;text-align:center;color:#6b7daa;font-size:12px;">Нет целей</div>'; return; }
        c.innerHTML = t.map(g => `
            <div class="gift-list-item" data-gift-id="${g.id}" style="${g.id===this.targetGiftId?'background:#111827;border-left:3px solid #f0883e;box-shadow:inset 0 0 15px rgba(240,136,62,0.05);':''}">
                <span class="gift-emoji-small">${g.emoji}</span>
                <div class="gift-list-item-info"><div class="gift-list-item-name">${g.name}</div><div class="gift-list-item-price">${g.price} ⭐</div></div>
            </div>`).join('');
    }

    renderShop() {
        const c = document.getElementById('shopItems');
        c.innerHTML = ALL_GIFTS.map(g => `
            <div class="shop-item">
                <span class="shop-item-emoji">${g.emoji}</span>
                <div class="shop-item-info"><h3>${g.name}</h3><p>Подарок для апгрейда</p></div>
                <div style="text-align:right;"><div class="shop-item-price">${g.price} ⭐</div>
                <button class="buy-btn" data-gift-id="${g.id}" ${this.balance<g.price?'disabled':''}>Купить</button></div>
            </div>`).join('');
        c.querySelectorAll('.buy-btn').forEach(b => b.addEventListener('click', e => { const gid = e.target.dataset.giftId; const g = ALL_GIFTS.find(x => x.id === gid); if (g && this.balance >= g.price) { this.balance -= g.price; if (!this.inventory.find(en => en.giftId === g.id)) this.inventory.push({ giftId: g.id, acquiredAt: Date.now() }); this.deduplicateInventory(); if (!this.currentGift) { this.currentGiftId = g.id; this.autoSelectTarget(); this.updateChance(); } this.saveToStorage(); this.renderAll(); this.renderShop(); if (tg) tg.HapticFeedback.notificationOccurred('success'); } }));
    }
}

const game = new UpgradeGame();

function setVH() { const vh = window.innerHeight * 0.01; document.documentElement.style.setProperty('--vh', `${vh}px`); }
setVH();
window.addEventListener('resize', setVH);