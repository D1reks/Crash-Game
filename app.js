let tg = null;
if (window.Telegram && window.Telegram.WebApp) {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
}

const ALL_GIFTS = [
    { id: 'precious_peach', name: 'Precious Peach', icon: 'images/gifts icons/Precious Peach.png', price: 50 },
    { id: 'desk_calendar', name: 'Desk Calendar', icon: 'images/gifts icons/Desk Calendar.png', price: 100 },
    { id: 'bonded_ring', name: 'Bonded Ring', icon: 'images/gifts icons/Bonded Ring.png', price: 200 },
    { id: 'durovs_cap', name: "Durov's Cap", icon: "images/gifts icons/Durov's Cap.png", price: 500 },
    { id: 'swiss_watch', name: 'Swiss Watch', icon: 'images/gifts icons/Swiss Watch.png', price: 1000 },
    { id: 'chill_flame', name: 'Chill Flame', icon: 'images/gifts icons/Chill Flame.png', price: 2500 },
    { id: 'heart_locket', name: 'Heart Locket', icon: 'images/gifts icons/Heart Locket.png', price: 5000 },
    { id: 'plush_pepe', name: 'Plush Pepe', icon: 'images/gifts icons/Plush Pepe.png', price: 10000 },
    { id: 'scared_cat', name: 'Scared Cat', icon: 'images/gifts icons/Scared Cat.png', price: 25000 },
    { id: 'witch_hat', name: 'Witch Hat', icon: 'images/gifts icons/Witch Hat.png', price: 50000 },
    { id: 'toy_bear', name: 'Toy Bear', icon: 'images/gifts icons/Toy Bear.png', price: 100000 },
    { id: 'loot_bag', name: 'Loot Bag', icon: 'images/gifts icons/Loot Bag.png', price: 250000 },
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
        this.selectedGiftIds = [];
        this.targetGiftId = null;
        this.currentChance = 0;
        this.history = [];
        this.isSpinning = false;
        this.audioContext = null;
        this.soundEnabled = false;
        this.barPosition = 0.5;
        this.barDirection = 1;
        this.barAnimationId = null;
        this.resultTimeout = null;
        this.sparkSystem = null;
        this.sellTargetGiftId = null;
        this.activeTab = 'inventory';
        
        this.quickCoefs = [2, 4, 8];
        this.quickPercents = [35, 55, 75];
        this.spinType = 'normal';
        
        this.init();
    }

    get selectedGifts() {
        return this.selectedGiftIds.map(id => ALL_GIFTS.find(g => g.id === id)).filter(Boolean);
    }

    get primaryGift() {
        return this.selectedGifts[0] || null;
    }

    get targetGift() { return ALL_GIFTS.find(g => g.id === this.targetGiftId) || null; }

    get inventoryGifts() {
        const seen = new Set();
        return this.inventory.filter(e => { if (seen.has(e.giftId)) return false; seen.add(e.giftId); return true; }).map(e => ALL_GIFTS.find(g => g.id === e.giftId)).filter(Boolean);
    }

    calculateChance(totalCost, tp) { return totalCost >= tp ? 0 : (totalCost / tp) * 0.95; }
    
    getAllTargets() {
        if (!this.primaryGift) return ALL_GIFTS;
        const totalCost = this.getSelectedTotalCost();
        return ALL_GIFTS.filter(g => g.price > totalCost);
    }

    getSelectedTotalCost() {
        return this.selectedGifts.reduce((sum, g) => sum + g.price, 0);
    }

    findTargetByFraction(fr) {
        if (!this.primaryGift) return null;
        const [n, d] = fr.split('/').map(Number);
        const tc = n / d;
        const totalCost = this.getSelectedTotalCost();
        const cands = ALL_GIFTS.filter(g => g.price > totalCost);
        if (!cands.length) return null;
        let best = cands[0], bd = Infinity;
        for (const g of cands) { const diff = Math.abs(this.calculateChance(totalCost, g.price) - tc); if (diff < bd) { bd = diff; best = g; } }
        return best;
    }

    async init() {
        const preloader = document.getElementById('preloader');
        if (preloader) {
            preloader.classList.add('hide');
            setTimeout(() => { if (preloader.parentNode) preloader.remove(); }, 300);
        }
        
        this.loadFromStorage();
        this.deduplicateInventory();
        if (this.inventory.length > 0 && this.selectedGiftIds.length === 0) {
            this.selectedGiftIds = [this.inventory[0].giftId];
        }
        this.updateChance();
        this.sparkSystem = new SparkSystem(document.getElementById('sparkCanvas'));
        this.loadSettings();
        this.renderQuickButtons();
        this.setupEventListeners();
        this.renderAll();
    }

    deduplicateInventory() { const s = new Set(); const u = []; for (const e of this.inventory) { if (!s.has(e.giftId)) { s.add(e.giftId); u.push(e); } } this.inventory = u; }

    updateChance() {
        if (this.primaryGift && this.targetGift) {
            const totalCost = this.getSelectedTotalCost();
            if (this.targetGift.price > totalCost) {
                this.currentChance = this.calculateChance(totalCost, this.targetGift.price);
            } else {
                this.currentChance = 0;
            }
        } else {
            this.currentChance = 0;
        }
    }

    loadFromStorage() {
        try {
            const s = localStorage.getItem('upgrade_stars_v12');
            if (s) {
                const d = JSON.parse(s);
                this.balance = d.balance || 1000;
                this.inventory = d.inventory || [];
                this.history = d.history || [];
                this.selectedGiftIds = d.selectedGiftIds || [];
                this.targetGiftId = d.targetGiftId || null;
            }
        } catch (e) {}
    }

    saveToStorage() {
        try {
            localStorage.setItem('upgrade_stars_v12', JSON.stringify({
                balance: this.balance,
                inventory: this.inventory,
                history: this.history.slice(0, 30),
                selectedGiftIds: this.selectedGiftIds,
                targetGiftId: this.targetGiftId
            }));
        } catch (e) {}
    }

    loadSettings() {
        try {
            const s = localStorage.getItem('upgift_settings');
            if (s) {
                const d = JSON.parse(s);
                this.quickCoefs = d.quickCoefs || [2, 4, 8];
                this.quickPercents = d.quickPercents || [35, 55, 75];
                this.soundEnabled = d.soundEnabled !== undefined ? d.soundEnabled : false;
                this.spinType = d.spinType || 'normal';
            }
        } catch (e) {}
    }

    saveSettings() {
        try {
            localStorage.setItem('upgift_settings', JSON.stringify({
                quickCoefs: this.quickCoefs,
                quickPercents: this.quickPercents,
                soundEnabled: this.soundEnabled,
                spinType: this.spinType
            }));
        } catch (e) {}
    }

    renderQuickButtons() {
        const container = document.getElementById('quickBetButtons');
        if (!container) return;
        let html = '';
        for (const c of this.quickCoefs) {
            html += `<button class="quick-bet-btn" data-fraction="1/${c}">x${c}</button>`;
        }
        for (const p of this.quickPercents) {
            html += `<button class="quick-bet-btn" data-fraction="${p}/100">${p}%</button>`;
        }
        container.innerHTML = html;
        
        container.querySelectorAll('.quick-bet-btn').forEach(b => b.addEventListener('click', e => {
            if (this.isSpinning) return;
            if (!this.primaryGift) return;
            const f = e.target.dataset.fraction;
            const g = this.findTargetByFraction(f); if (g) { this.targetGiftId = g.id; this.updateChance(); this.renderAll(); this.highlightQuickButton(f); }
        }));
    }

    setupEventListeners() {
        document.getElementById('upgradeBtn').addEventListener('click', () => this.startUpgrade());
        document.getElementById('currentGiftCard').addEventListener('click', () => {
            if (this.isSpinning) return;
            if (this.selectedGiftIds.length > 0) {
                this.selectedGiftIds = [];
                this.updateChance();
                this.renderAll();
                this.saveToStorage();
            }
        });
        document.getElementById('targetGiftCard').addEventListener('click', () => {
            if (this.isSpinning) return;
            const t = this.getAllTargets();
            if (t.length === 0) return;
            if (!this.targetGift) { this.targetGiftId = t[0].id; } else { const ci = t.findIndex(g => g.id === this.targetGiftId); this.targetGiftId = t[(ci + 1) % t.length].id; }
            this.updateChance();
            this.renderAll();
            this.saveToStorage();
        });
        document.getElementById('balanceContainer').addEventListener('click', () => document.getElementById('balanceTopupOverlay').classList.add('show'));
        document.getElementById('closeTopupBtn').addEventListener('click', () => document.getElementById('balanceTopupOverlay').classList.remove('show'));
        document.getElementById('topupGifts').addEventListener('click', () => { alert('Функция пополнения подарками Telegram будет доступна с интеграцией бота.'); document.getElementById('balanceTopupOverlay').classList.remove('show'); });
        document.getElementById('topupStars').addEventListener('click', () => { this.balance += 500; this.renderAll(); this.saveToStorage(); document.getElementById('balanceTopupOverlay').classList.remove('show'); if (tg) tg.HapticFeedback.notificationOccurred('success'); });
        document.getElementById('shopBtn').addEventListener('click', () => { document.getElementById('shopOverlay').classList.add('show'); this.renderShop(); });
        document.getElementById('closeShopBtn').addEventListener('click', () => document.getElementById('shopOverlay').classList.remove('show'));
        document.getElementById('sellConfirmBtn').addEventListener('click', () => this.confirmSell());
        document.getElementById('sellCancelBtn').addEventListener('click', () => this.closeSellOverlay());
        document.getElementById('sellOverlay').addEventListener('click', e => { if (e.target === document.getElementById('sellOverlay')) this.closeSellOverlay(); });
        
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        document.getElementById('settingsSaveBtn').addEventListener('click', () => this.saveSettingsFromUI());
        document.getElementById('settingsOverlay').addEventListener('click', e => { if (e.target === document.getElementById('settingsOverlay')) document.getElementById('settingsOverlay').classList.remove('show'); });
        
        document.getElementById('tabInventory').addEventListener('click', () => {
            this.activeTab = 'inventory';
            document.getElementById('tabInventory').classList.add('active');
            document.getElementById('tabTargets').classList.remove('active');
            this.renderGiftList();
        });
        
        document.getElementById('tabTargets').addEventListener('click', () => {
            this.activeTab = 'targets';
            document.getElementById('tabTargets').classList.add('active');
            document.getElementById('tabInventory').classList.remove('active');
            this.renderGiftList();
        });
        
        document.body.addEventListener('click', () => { if (!this.soundEnabled) this.initAudio(); }, { once: true });
    }

    openSettings() {
        document.getElementById('settingCoef1').value = this.quickCoefs[0] || 2;
        document.getElementById('settingCoef2').value = this.quickCoefs[1] || 4;
        document.getElementById('settingCoef3').value = this.quickCoefs[2] || 8;
        document.getElementById('settingPerc1').value = this.quickPercents[0] || 35;
        document.getElementById('settingPerc2').value = this.quickPercents[1] || 55;
        document.getElementById('settingPerc3').value = this.quickPercents[2] || 75;
        
        document.getElementById('soundOn').checked = this.soundEnabled;
        document.getElementById('soundOff').checked = !this.soundEnabled;
        document.getElementById('spinNormal').checked = this.spinType === 'normal';
        document.getElementById('spinFast').checked = this.spinType === 'fast';
        
        document.getElementById('settingsOverlay').classList.add('show');
    }

    saveSettingsFromUI() {
        this.quickCoefs = [
            parseInt(document.getElementById('settingCoef1').value) || 2,
            parseInt(document.getElementById('settingCoef2').value) || 4,
            parseInt(document.getElementById('settingCoef3').value) || 8
        ];
        this.quickPercents = [
            parseInt(document.getElementById('settingPerc1').value) || 35,
            parseInt(document.getElementById('settingPerc2').value) || 55,
            parseInt(document.getElementById('settingPerc3').value) || 75
        ];
        this.soundEnabled = document.getElementById('soundOn').checked;
        this.spinType = document.querySelector('input[name="spinType"]:checked')?.value || 'normal';
        
        this.saveSettings();
        this.renderQuickButtons();
        this.updateChance();
        this.renderAll();
        document.getElementById('settingsOverlay').classList.remove('show');
        if (tg) tg.HapticFeedback.notificationOccurred('success');
    }

    highlightQuickButton(fr) { document.querySelectorAll('.quick-bet-btn').forEach(b => b.classList.remove('active')); const btn = document.querySelector(`.quick-bet-btn[data-fraction="${fr}"]`); if (btn) btn.classList.add('active'); }

    async initAudio() { try { this.audioContext = new (window.AudioContext || window.webkitAudioContext)(); await this.audioContext.resume(); } catch (e) {} }
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
        this.sparkSystem.emit(cx, cy, 40, colors);
        if (this.resultTimeout) clearTimeout(this.resultTimeout);
        this.resultTimeout = setTimeout(() => {
            centerResult.classList.remove('show');
            chanceDisplay.classList.remove('hidden-temp');
        }, 2000);
    }

    startUpgrade() {
        const totalCost = this.getSelectedTotalCost();
        if (this.isSpinning || !this.primaryGift || !this.targetGift || totalCost >= this.targetGift.price) return;
        if (this.selectedGifts.some(g => !this.inventory.find(e => e.giftId === g.id))) return;
        
        this.isSpinning = true;
        const btn = document.getElementById('upgradeBtn');
        btn.disabled = true;
        btn.classList.add('spinning');
        btn.textContent = 'КРУТИМ...';
        this.setSpinningState(true);
        if (tg) tg.HapticFeedback.impactOccurred('heavy');
        
        this.barPosition = 0;
        this.barDirection = 1;
        
        const dur = this.spinType === 'fast' ? 2500 : 4500;
        const st = Date.now();
        const bounces = this.spinType === 'fast' ? 6 : 10;
        let bounceCount = 0;
        
        const anim = () => {
            const el = Date.now() - st;
            const p = Math.min(el / dur, 1);
            
            const freq = bounces * Math.PI;
            const decay = Math.exp(-p * 4);
            const rawPos = Math.abs(Math.sin(p * freq)) * decay;
            
            this.barPosition = rawPos;
            this.drawBar();
            
            if (this.soundEnabled && p < 0.9) {
                const newBounce = Math.floor(p * bounces * 2);
                if (newBounce > bounceCount) {
                    bounceCount = newBounce;
                    this.playBeep(300 + rawPos * 600, 0.015);
                }
            }
            
            if (p < 1) {
                this.barAnimationId = requestAnimationFrame(anim);
            } else {
                this.onBarComplete();
            }
        };
        this.barAnimationId = requestAnimationFrame(anim);
    }

    onBarComplete() {
        this.isSpinning = false;
        const btn = document.getElementById('upgradeBtn');
        btn.classList.remove('spinning');
        btn.textContent = 'Прокачать';
        btn.disabled = false;
        this.setSpinningState(false);
        
        const finalPos = this.barPosition;
        const sc = this.currentChance;
        const winStart = 0.5 - sc / 2;
        const winEnd = 0.5 + sc / 2;
        const win = finalPos >= winStart && finalPos <= winEnd;
        
        this.barPosition = 0.5;
        this.drawBar();
        
        if (win) this.onUpgradeSuccess(sc);
        else this.onUpgradeFail(sc);
    }

    setSpinningState(spinning) {
        document.querySelectorAll('.quick-bet-btn').forEach(b => { b.disabled = spinning; });
        document.getElementById('currentGiftCard').classList.toggle('spinning-disabled', spinning);
        document.getElementById('targetGiftCard').classList.toggle('spinning-disabled', spinning);
        document.getElementById('giftListContent').style.pointerEvents = spinning ? 'none' : 'auto';
        document.getElementById('giftListContent').style.opacity = spinning ? '0.6' : '1';
        document.getElementById('barCanvas').style.pointerEvents = spinning ? 'none' : 'auto';
    }

    onUpgradeSuccess(sc) {
        const ng = this.targetGift;
        for (const g of this.selectedGifts) {
            const idx = this.inventory.findIndex(e => e.giftId === g.id);
            if (idx !== -1) this.inventory.splice(idx, 1);
        }
        if (!this.inventory.find(e => e.giftId === ng.id)) this.inventory.push({ giftId: ng.id, acquiredAt: Date.now() });
        this.selectedGiftIds = [ng.id];
        this.updateChance();
        this.history.unshift({ from: this.selectedGifts.map(g => g.id).join(','), to: ng.id, chance: sc, success: true, time: Date.now() });
        this.saveToStorage();
        this.renderAll();
        this.showResultText(true, sc);
        if (tg) tg.HapticFeedback.notificationOccurred('success');
        this.playBeep(1500, 0.2);
        setTimeout(() => this.playBeep(1800, 0.15), 150);
    }

    onUpgradeFail(sc) {
        const tgf = this.targetGift;
        for (const g of this.selectedGifts) {
            const idx = this.inventory.findIndex(e => e.giftId === g.id);
            if (idx !== -1) this.inventory.splice(idx, 1);
        }
        if (!this.inventory.length) {
            this.selectedGiftIds = [];
        } else {
            this.selectedGiftIds = [this.inventory[0].giftId];
        }
        this.updateChance();
        this.history.unshift({ from: this.selectedGifts.map(g => g.id).join(','), to: tgf.id, chance: sc, success: false, time: Date.now() });
        this.saveToStorage();
        this.renderAll();
        this.showResultText(false, sc);
        if (tg) tg.HapticFeedback.notificationOccurred('error');
        this.playBeep(200, 0.3, 'sawtooth');
    }

    toggleGiftSelection(giftId) {
        if (!this.inventory.find(e => e.giftId === giftId)) return;
        const idx = this.selectedGiftIds.indexOf(giftId);
        if (idx !== -1) {
            this.selectedGiftIds.splice(idx, 1);
        } else {
            if (this.selectedGiftIds.length >= 9) return;
            this.selectedGiftIds.push(giftId);
        }
        this.updateChance();
        this.renderAll();
        this.saveToStorage();
    }

    renderAll() {
        document.getElementById('balance').textContent = this.balance.toLocaleString();
        this.renderCurrentGiftCard();
        this.renderGiftCard('targetGiftCard', this.targetGift, false);
        const cp = (this.currentChance * 100).toFixed(1);
        document.getElementById('chancePercent').textContent = cp + '%';
        this.drawBar();
        this.renderGiftList();
        const ub = document.getElementById('upgradeBtn');
        const totalCost = this.getSelectedTotalCost();
        const canUpgrade = !this.isSpinning && this.primaryGift && this.targetGift && this.targetGift.price > totalCost && this.selectedGifts.every(g => this.inventory.find(e => e.giftId === g.id));
        ub.disabled = !canUpgrade;
        if (!this.isSpinning) { ub.classList.remove('spinning'); ub.textContent = 'Прокачать'; }
        if (this.isSpinning) { this.setSpinningState(true); ub.disabled = true; }
    }

    renderCurrentGiftCard() {
        const card = document.getElementById('currentGiftCard');
        const nameOutside = document.getElementById('currentGiftNameOutside');
        const priceOutside = document.getElementById('currentGiftPriceOutside');
        card.innerHTML = '';
        card.className = 'gift-card current-gift';

        if (this.selectedGifts.length > 0) {
            const grid = document.createElement('div');
            grid.className = 'multi-gift-grid';
            
            const maxPerRow = 3;
            const maxRows = 3;
            const maxItems = maxPerRow * maxRows;
            const showGifts = this.selectedGifts.slice(0, maxItems);
            
            const totalInGrid = showGifts.length;
            const baseSize = totalInGrid <= 3 ? 50 : totalInGrid <= 6 ? 40 : 30;
            
            for (const g of showGifts) {
                const wrapper = document.createElement('div');
                wrapper.className = 'multi-gift-item';
                const img = document.createElement('img');
                img.className = 'gift-icon';
                img.src = g.icon;
                img.alt = g.name;
                img.style.maxHeight = baseSize + 'px';
                wrapper.appendChild(img);
                grid.appendChild(wrapper);
            }
            
            card.appendChild(grid);
            
            if (this.selectedGifts.length === 1) {
                nameOutside.textContent = this.selectedGifts[0].name;
                priceOutside.innerHTML = this.selectedGifts[0].price + ' <span class="star-icon-small"></span>';
            } else {
                nameOutside.textContent = `Выбрано: ${this.selectedGifts.length}`;
                const totalCost = this.getSelectedTotalCost();
                priceOutside.innerHTML = totalCost + ' <span class="star-icon-small"></span>';
            }
        } else {
            card.classList.add('empty-card');
            const arrows = document.createElement('div');
            arrows.className = 'placeholder-arrows left-arrows';
            for (let i = 0; i < 3; i++) {
                const arrow = document.createElement('span');
                arrow.className = 'placeholder-arrow';
                arrow.textContent = '❱';
                arrows.appendChild(arrow);
            }
            card.appendChild(arrows);
            nameOutside.textContent = '';
            priceOutside.textContent = '';
        }
    }

    renderGiftCard(cardId, gift, isCurrent) {
        const card = document.getElementById(cardId);
        const nameOutside = document.getElementById(isCurrent ? 'currentGiftNameOutside' : 'targetGiftNameOutside');
        const priceOutside = document.getElementById(isCurrent ? 'currentGiftPriceOutside' : 'targetGiftPriceOutside');
        
        if (isCurrent) return;

        card.innerHTML = '';
        card.className = 'gift-card';

        if (gift) {
            card.classList.add('target-gift');
            const img = document.createElement('img');
            img.className = 'gift-icon';
            img.src = gift.icon;
            img.alt = gift.name;
            card.appendChild(img);
            nameOutside.textContent = gift.name;
            priceOutside.innerHTML = gift.price + ' <span class="star-icon-small"></span>';
        } else {
            card.classList.add('empty-card');
            const arrows = document.createElement('div');
            arrows.className = 'placeholder-arrows right-arrows';
            for (let i = 0; i < 3; i++) {
                const arrow = document.createElement('span');
                arrow.className = 'placeholder-arrow';
                arrow.textContent = '❱';
                arrows.appendChild(arrow);
            }
            card.appendChild(arrows);
            nameOutside.textContent = '';
            priceOutside.textContent = '';
        }
    }

    drawBar() {
        const c = document.getElementById('barCanvas');
        const ctx = c.getContext('2d');
        const w = c.width, h = c.height;
        
        ctx.clearRect(0, 0, w, h);
        
        const pad = 16;
        const barX = pad;
        const barY = (h - 32) / 2;
        const barW = w - pad * 2;
        const barH = 32;
        const radius = 10;
        
        // Фон полоски
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, radius);
        ctx.fillStyle = '#0d111f';
        ctx.fill();
        ctx.strokeStyle = '#2a3a5c';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(100,140,255,0.3)';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Заполненная зона от центра
        if (this.currentChance > 0) {
            const centerX = barX + barW / 2;
            const halfFill = (barW / 2) * this.currentChance;
            const fillX1 = centerX - halfFill;
            const fillX2 = centerX + halfFill;
            
            ctx.beginPath();
            ctx.roundRect(fillX1, barY, fillX2 - fillX1, barH, radius);
            const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
            grad.addColorStop(0, '#f0883e');
            grad.addColorStop(0.5, '#f5c842');
            grad.addColorStop(1, '#ffd700');
            ctx.fillStyle = grad;
            ctx.shadowColor = 'rgba(240,136,62,0.4)';
            ctx.shadowBlur = 16;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        
        // Обводка поверх заливки
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, radius);
        ctx.strokeStyle = '#2a3a5c';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Двухсторонняя стрелка
        const arrowX = barX + this.barPosition * barW;
        const arrowY = barY + barH / 2;
        const arrowSize = 14;
        
        ctx.save();
        
        // Левое остриё
        ctx.beginPath();
        ctx.moveTo(arrowX - arrowSize, arrowY);
        ctx.lineTo(arrowX - 3, arrowY - arrowSize * 0.7);
        ctx.lineTo(arrowX - 3, arrowY - 4);
        ctx.lineTo(arrowX + 3, arrowY - 4);
        ctx.lineTo(arrowX + 3, arrowY - arrowSize * 0.7);
        ctx.closePath();
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 14;
        ctx.fill();
        
        // Правое остриё
        ctx.beginPath();
        ctx.moveTo(arrowX + arrowSize, arrowY);
        ctx.lineTo(arrowX + 3, arrowY - arrowSize * 0.7);
        ctx.lineTo(arrowX + 3, arrowY - 4);
        ctx.lineTo(arrowX - 3, arrowY - 4);
        ctx.lineTo(arrowX - 3, arrowY - arrowSize * 0.7);
        ctx.closePath();
        ctx.fill();
        
        // Нижнее левое остриё
        ctx.beginPath();
        ctx.moveTo(arrowX - arrowSize, arrowY);
        ctx.lineTo(arrowX - 3, arrowY + arrowSize * 0.7);
        ctx.lineTo(arrowX - 3, arrowY + 4);
        ctx.lineTo(arrowX + 3, arrowY + 4);
        ctx.lineTo(arrowX + 3, arrowY + arrowSize * 0.7);
        ctx.closePath();
        ctx.fill();
        
        // Нижнее правое остриё
        ctx.beginPath();
        ctx.moveTo(arrowX + arrowSize, arrowY);
        ctx.lineTo(arrowX + 3, arrowY + arrowSize * 0.7);
        ctx.lineTo(arrowX + 3, arrowY + 4);
        ctx.lineTo(arrowX - 3, arrowY + 4);
        ctx.lineTo(arrowX - 3, arrowY + arrowSize * 0.7);
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0;
        
        // Центральный круг
        ctx.beginPath();
        ctx.arc(arrowX, arrowY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0f1a';
        ctx.fill();
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
        
        // Блик
        const glossGrad = ctx.createLinearGradient(0, barY, 0, barY + barH);
        glossGrad.addColorStop(0, 'rgba(255,255,255,0.04)');
        glossGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
        glossGrad.addColorStop(1, 'rgba(255,255,255,0.03)');
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, radius);
        ctx.fillStyle = glossGrad;
        ctx.fill();
    }

    renderGiftList() {
        if (this.activeTab === 'inventory') {
            this.renderInventoryListInPanel();
        } else {
            this.renderTargetsListInPanel();
        }
    }

    renderInventoryListInPanel() {
        const c = document.getElementById('giftListContent');
        const ig = this.inventoryGifts;
        if (!ig.length) { c.innerHTML = '<div style="padding:20px;text-align:center;color:#6b7daa;font-size:12px;">Пусто</div>'; return; }
        c.innerHTML = ig.map(g => {
            const isSelected = this.selectedGiftIds.includes(g.id);
            return `
            <div class="gift-list-item ${isSelected ? 'selected-for-upgrade' : ''}" data-gift-id="${g.id}">
                <div class="select-checkbox ${isSelected ? 'checked' : ''}" data-action="toggle" data-gift-id="${g.id}"></div>
                <img src="${g.icon}" alt="${g.name}" class="gift-icon-small">
                <div class="gift-list-item-info"><div class="gift-list-item-name">${g.name}</div><div class="gift-list-item-price">${g.price} <span class="star-icon-small"></span></div></div>
                <button class="sell-icon-btn" data-gift-id="${g.id}">Sell</button>
            </div>`;
        }).join('');
        
        c.querySelectorAll('.select-checkbox').forEach(cb => {
            cb.addEventListener('click', e => {
                e.stopPropagation();
                const gid = cb.dataset.giftId;
                this.toggleGiftSelection(gid);
            });
        });
        
        c.querySelectorAll('.sell-icon-btn').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); const gid = btn.dataset.giftId; this.openSellOverlay(gid); });
        });
    }

    renderTargetsListInPanel() {
        const c = document.getElementById('giftListContent');
        const t = this.getAllTargets();
        if (!t.length) { c.innerHTML = '<div style="padding:20px;text-align:center;color:#6b7daa;font-size:12px;">Нет подарков</div>'; return; }
        const totalCost = this.getSelectedTotalCost();
        c.innerHTML = t.map(g => {
            const isSelected = g.id === this.targetGiftId;
            const chance = totalCost > 0 && g.price > totalCost ? (totalCost / g.price * 0.95 * 100).toFixed(1) : '0.0';
            return `
            <div class="gift-list-item" data-gift-id="${g.id}" style="${isSelected?'background:#111827;border-left:3px solid #f0883e;box-shadow:inset 0 0 15px rgba(240,136,62,0.05);':''}">
                <img src="${g.icon}" alt="${g.name}" class="gift-icon-small">
                <div class="gift-list-item-info"><div class="gift-list-item-name">${g.name} <span style="color:#6b7daa;font-size:10px;">${chance}%</span></div><div class="gift-list-item-price">${g.price} <span class="star-icon-small"></span></div></div>
            </div>`;
        }).join('');
        
        c.querySelectorAll('.gift-list-item').forEach(item => {
            item.addEventListener('click', () => {
                if (this.isSpinning) return;
                const gid = item.dataset.giftId;
                const tgt = ALL_GIFTS.find(g => g.id === gid);
                if (tgt && (!this.primaryGift || tgt.price > this.getSelectedTotalCost())) {
                    this.targetGiftId = gid;
                    this.updateChance();
                    this.renderAll();
                    this.saveToStorage();
                }
            });
        });
    }

    openSellOverlay(giftId) {
        const gift = ALL_GIFTS.find(g => g.id === giftId);
        if (!gift || !this.inventory.find(e => e.giftId === giftId)) return;
        this.sellTargetGiftId = giftId;
        document.getElementById('sellEmoji').innerHTML = `<img src="${gift.icon}" alt="${gift.name}" class="sell-icon">`;
        document.getElementById('sellName').textContent = gift.name;
        document.getElementById('sellPrice').innerHTML = gift.price + ' <span class="star-icon-small"></span>';
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
        
        const selIdx = this.selectedGiftIds.indexOf(this.sellTargetGiftId);
        if (selIdx !== -1) this.selectedGiftIds.splice(selIdx, 1);
        
        if (this.selectedGiftIds.length === 0 && this.inventory.length > 0) {
            this.selectedGiftIds = [this.inventory[0].giftId];
        }
        this.updateChance();
        this.saveToStorage();
        this.renderAll();
        this.closeSellOverlay();
        if (tg) tg.HapticFeedback.notificationOccurred('success');
    }

    renderShop() {
        const c = document.getElementById('shopItems');
        c.innerHTML = ALL_GIFTS.map(g => `
            <div class="shop-item">
                <img src="${g.icon}" alt="${g.name}" class="shop-item-icon">
                <div class="shop-item-info"><h3>${g.name}</h3><p>Подарок для апгрейда</p></div>
                <div style="text-align:right;"><div class="shop-item-price">${g.price} <span class="star-icon-small"></span></div>
                <button class="buy-btn" data-gift-id="${g.id}" ${this.balance<g.price?'disabled':''}>Купить</button></div>
            </div>`).join('');
        c.querySelectorAll('.buy-btn').forEach(b => b.addEventListener('click', e => { const gid = e.target.dataset.giftId; const g = ALL_GIFTS.find(x => x.id === gid); if (g && this.balance >= g.price) { this.balance -= g.price; if (!this.inventory.find(en => en.giftId === g.id)) this.inventory.push({ giftId: g.id, acquiredAt: Date.now() }); this.deduplicateInventory(); if (!this.primaryGift) { this.selectedGiftIds = [g.id]; this.updateChance(); } this.saveToStorage(); this.renderAll(); this.renderShop(); if (tg) tg.HapticFeedback.notificationOccurred('success'); } }));
    }
}

const game = new UpgradeGame();

function setVH() { const vh = window.innerHeight * 0.01; document.documentElement.style.setProperty('--vh', `${vh}px`); }
setVH();
window.addEventListener('resize', setVH);