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
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.life = life; this.maxLife = life; this.color = color; this.size = size;
        this.gravity = 0.04; this.friction = 0.98;
    }
    update() { this.vx *= this.friction; this.vy *= this.friction; this.vy += this.gravity; this.x += this.vx; this.y += this.vy; this.life--; this.size *= 0.985; }
    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = this.size * 3;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    get dead() { return this.life <= 0; }
}

class SparkSystem {
    constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.particles = []; this.animId = null; }
    emit(x, y, count, colors) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2, speed = 0.8 + Math.random() * 4;
            const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed - 2;
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
        for (const p of this.particles) { p.update(); p.draw(this.ctx); }
        if (this.particles.length > 0) this.animId = requestAnimationFrame(() => this.animate());
        else this.animId = null;
    }
    clear() { this.particles = []; if (this.animId) { cancelAnimationFrame(this.animId); this.animId = null; } this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
}

class UpgradeGame {
    constructor() {
        this.balance = 1000; this.inventory = []; this.selectedGiftIds = []; this.targetGiftId = null;
        this.currentChance = 0; this.history = []; this.isSpinning = false;
        this.audioContext = null; this.soundEnabled = false;
        this.wheelAngle = 0; this.wheelAnimationId = null; this.resultTimeout = null;
        this.sparkSystem = null; this.sellTargetGiftId = null; this.activeTab = 'inventory';
        this.quickCoefs = [2, 4, 8]; this.quickPercents = [35, 55, 75]; this.spinType = 'normal';
        this.init();
    }

    get selectedGifts() { return this.selectedGiftIds.map(id => ALL_GIFTS.find(g => g.id === id)).filter(Boolean); }
    get primaryGift() { return this.selectedGifts[0] || null; }
    get targetGift() { return ALL_GIFTS.find(g => g.id === this.targetGiftId) || null; }
    get inventoryGifts() {
        const seen = new Set();
        return this.inventory.filter(e => { if (seen.has(e.giftId)) return false; seen.add(e.giftId); return true; }).map(e => ALL_GIFTS.find(g => g.id === e.giftId)).filter(Boolean);
    }

    calculateChance(totalCost, tp) { return totalCost >= tp ? 0 : (totalCost / tp) * 0.95; }
    getAllTargets() {
        if (!this.primaryGift) return ALL_GIFTS;
        const tc = this.getSelectedTotalCost();
        return ALL_GIFTS.filter(g => g.price > tc);
    }
    getSelectedTotalCost() { return this.selectedGifts.reduce((s, g) => s + g.price, 0); }

    findTargetByFraction(fr) {
        if (!this.primaryGift) return null;
        const [n, d] = fr.split('/').map(Number), tc = n / d;
        const totalCost = this.getSelectedTotalCost();
        const cands = ALL_GIFTS.filter(g => g.price > totalCost);
        if (!cands.length) return null;
        let best = cands[0], bd = Infinity;
        for (const g of cands) { const diff = Math.abs(this.calculateChance(totalCost, g.price) - tc); if (diff < bd) { bd = diff; best = g; } }
        return best;
    }

    async init() {
        const pl = document.getElementById('preloader');
        if (pl) { pl.classList.add('hide'); setTimeout(() => { if (pl.parentNode) pl.remove(); }, 300); }
        this.loadFromStorage(); this.deduplicateInventory();
        if (this.inventory.length > 0 && this.selectedGiftIds.length === 0) this.selectedGiftIds = [this.inventory[0].giftId];
        this.updateChance();
        this.sparkSystem = new SparkSystem(document.getElementById('sparkCanvas'));
        this.loadSettings(); this.renderQuickButtons(); this.setupEventListeners(); this.renderAll();
    }

    deduplicateInventory() { const s = new Set(); const u = []; for (const e of this.inventory) { if (!s.has(e.giftId)) { s.add(e.giftId); u.push(e); } } this.inventory = u; }

    updateChance() {
        if (this.primaryGift && this.targetGift && this.targetGift.price > this.getSelectedTotalCost()) {
            this.currentChance = this.calculateChance(this.getSelectedTotalCost(), this.targetGift.price);
        } else { this.currentChance = 0; }
    }

    loadFromStorage() { try { const s = localStorage.getItem('upgrade_stars_v12'); if (s) { const d = JSON.parse(s); this.balance = d.balance||1000; this.inventory = d.inventory||[]; this.history = d.history||[]; this.selectedGiftIds = d.selectedGiftIds||[]; this.targetGiftId = d.targetGiftId||null; } } catch(e){} }
    saveToStorage() { try { localStorage.setItem('upgrade_stars_v12', JSON.stringify({ balance: this.balance, inventory: this.inventory, history: this.history.slice(0,30), selectedGiftIds: this.selectedGiftIds, targetGiftId: this.targetGiftId })); } catch(e){} }
    loadSettings() { try { const s = localStorage.getItem('upgift_settings'); if (s) { const d = JSON.parse(s); this.quickCoefs = d.quickCoefs||[2,4,8]; this.quickPercents = d.quickPercents||[35,55,75]; this.soundEnabled = d.soundEnabled!==undefined?d.soundEnabled:false; this.spinType = d.spinType||'normal'; } } catch(e){} }
    saveSettings() { try { localStorage.setItem('upgift_settings', JSON.stringify({ quickCoefs: this.quickCoefs, quickPercents: this.quickPercents, soundEnabled: this.soundEnabled, spinType: this.spinType })); } catch(e){} }

    renderQuickButtons() {
        const c = document.getElementById('quickBetButtons'); if (!c) return;
        let h = '';
        for (const x of this.quickCoefs) h += `<button class="quick-bet-btn" data-fraction="1/${x}">x${x}</button>`;
        for (const p of this.quickPercents) h += `<button class="quick-bet-btn" data-fraction="${p}/100">${p}%</button>`;
        c.innerHTML = h;
        c.querySelectorAll('.quick-bet-btn').forEach(b => b.addEventListener('click', e => {
            if (this.isSpinning||!this.primaryGift) return;
            const f = e.target.dataset.fraction, g = this.findTargetByFraction(f);
            if (g) { this.targetGiftId = g.id; this.updateChance(); this.renderAll(); this.highlightQuickButton(f); }
        }));
    }

    setupEventListeners() {
        document.getElementById('upgradeBtn').addEventListener('click', () => this.startUpgrade());
        document.getElementById('currentGiftCard').addEventListener('click', () => { if (this.isSpinning) return; if (this.selectedGiftIds.length > 0) { this.selectedGiftIds = []; this.updateChance(); this.renderAll(); this.saveToStorage(); } });
        document.getElementById('targetGiftCard').addEventListener('click', () => {
            if (this.isSpinning) return;
            const t = this.getAllTargets(); if (!t.length) return;
            if (!this.targetGift) this.targetGiftId = t[0].id;
            else { const ci = t.findIndex(g => g.id === this.targetGiftId); this.targetGiftId = t[(ci+1)%t.length].id; }
            this.updateChance(); this.renderAll(); this.saveToStorage();
        });
        document.getElementById('balanceContainer').addEventListener('click', () => document.getElementById('balanceTopupOverlay').classList.add('show'));
        document.getElementById('closeTopupBtn').addEventListener('click', () => document.getElementById('balanceTopupOverlay').classList.remove('show'));
        document.getElementById('topupGifts').addEventListener('click', () => { alert('Функция пополнения подарками Telegram будет доступна с интеграцией бота.'); document.getElementById('balanceTopupOverlay').classList.remove('show'); });
        document.getElementById('topupStars').addEventListener('click', () => { this.balance += 500; this.renderAll(); this.saveToStorage(); document.getElementById('balanceTopupOverlay').classList.remove('show'); if(tg) tg.HapticFeedback.notificationOccurred('success'); });
        document.getElementById('shopBtn').addEventListener('click', () => { document.getElementById('shopOverlay').classList.add('show'); this.renderShop(); });
        document.getElementById('closeShopBtn').addEventListener('click', () => document.getElementById('shopOverlay').classList.remove('show'));
        document.getElementById('sellConfirmBtn').addEventListener('click', () => this.confirmSell());
        document.getElementById('sellCancelBtn').addEventListener('click', () => this.closeSellOverlay());
        document.getElementById('sellOverlay').addEventListener('click', e => { if (e.target === document.getElementById('sellOverlay')) this.closeSellOverlay(); });
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        document.getElementById('settingsSaveBtn').addEventListener('click', () => this.saveSettingsFromUI());
        document.getElementById('settingsOverlay').addEventListener('click', e => { if (e.target === document.getElementById('settingsOverlay')) document.getElementById('settingsOverlay').classList.remove('show'); });
        document.getElementById('tabInventory').addEventListener('click', () => { this.activeTab='inventory'; document.getElementById('tabInventory').classList.add('active'); document.getElementById('tabTargets').classList.remove('active'); this.renderGiftList(); });
        document.getElementById('tabTargets').addEventListener('click', () => { this.activeTab='targets'; document.getElementById('tabTargets').classList.add('active'); document.getElementById('tabInventory').classList.remove('active'); this.renderGiftList(); });
        document.body.addEventListener('click', () => { if (!this.soundEnabled) this.initAudio(); }, { once: true });
    }

    openSettings() {
        document.getElementById('settingCoef1').value = this.quickCoefs[0]||2;
        document.getElementById('settingCoef2').value = this.quickCoefs[1]||4;
        document.getElementById('settingCoef3').value = this.quickCoefs[2]||8;
        document.getElementById('settingPerc1').value = this.quickPercents[0]||35;
        document.getElementById('settingPerc2').value = this.quickPercents[1]||55;
        document.getElementById('settingPerc3').value = this.quickPercents[2]||75;
        document.getElementById('soundOn').checked = this.soundEnabled;
        document.getElementById('soundOff').checked = !this.soundEnabled;
        document.getElementById('spinNormal').checked = this.spinType==='normal';
        document.getElementById('spinFast').checked = this.spinType==='fast';
        document.getElementById('settingsOverlay').classList.add('show');
    }

    saveSettingsFromUI() {
        this.quickCoefs = [parseInt(document.getElementById('settingCoef1').value)||2, parseInt(document.getElementById('settingCoef2').value)||4, parseInt(document.getElementById('settingCoef3').value)||8];
        this.quickPercents = [parseInt(document.getElementById('settingPerc1').value)||35, parseInt(document.getElementById('settingPerc2').value)||55, parseInt(document.getElementById('settingPerc3').value)||75];
        this.soundEnabled = document.getElementById('soundOn').checked;
        this.spinType = document.querySelector('input[name="spinType"]:checked')?.value||'normal';
        this.saveSettings(); this.renderQuickButtons(); this.updateChance(); this.renderAll();
        document.getElementById('settingsOverlay').classList.remove('show');
        if(tg) tg.HapticFeedback.notificationOccurred('success');
    }

    highlightQuickButton(fr) { document.querySelectorAll('.quick-bet-btn').forEach(b => b.classList.remove('active')); const btn = document.querySelector(`.quick-bet-btn[data-fraction="${fr}"]`); if(btn) btn.classList.add('active'); }
    async initAudio() { try { this.audioContext = new (window.AudioContext||window.webkitAudioContext)(); await this.audioContext.resume(); } catch(e){} }
    playBeep(f, d, ty='sine') { if (!this.audioContext||!this.soundEnabled) return; const o = this.audioContext.createOscillator(), g = this.audioContext.createGain(); o.connect(g); g.connect(this.audioContext.destination); o.frequency.value = f; o.type = ty; g.gain.setValueAtTime(0.05, this.audioContext.currentTime); g.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime+d); o.start(); o.stop(this.audioContext.currentTime+d); }

    showResultText(success, chance) {
    const wmc = document.getElementById('wheelModalChance');
    const cr = document.getElementById('centerResult'), rt = document.getElementById('centerResultText'), rc = document.getElementById('centerResultChance');
    
    // Скрываем шанс
    wmc.style.opacity = '0';
    
    if (success) { rt.textContent = 'УСПЕХ!'; rt.style.color = '#5ff57a'; rt.style.textShadow = '0 0 20px #5ff57a, 0 0 40px #3fb950'; rc.textContent = `Шанс: ${(chance*100).toFixed(1)}%`; rc.style.color = '#5ff57a'; }
    else { rt.textContent = 'ПРОВАЛ!'; rt.style.color = '#ff6b6b'; rt.style.textShadow = '0 0 20px #ff6b6b, 0 0 40px #f85149'; rc.textContent = `Шанс: ${(chance*100).toFixed(1)}%`; rc.style.color = '#ff6b6b'; }
    rt.style.animation = 'none'; rt.offsetHeight; rt.style.animation = 'result-pop 0.4s ease-out';
    cr.classList.add('show');
    
    const sc = document.getElementById('sparkCanvas');
    const colors = success ? ['#5ff57a','#3fb950','#a5f5b0','#ffffff','#7dff90'] : ['#ff6b6b','#f85149','#ff9999','#ffffff','#ff4444'];
    this.sparkSystem.emit(sc.width/2, sc.height/2, 40, colors);
    
    if (this.resultTimeout) clearTimeout(this.resultTimeout);
    this.resultTimeout = setTimeout(() => {
        cr.classList.remove('show');
        wmc.style.opacity = '1'; // Показываем шанс обратно
    }, 1800);
}

    startUpgrade() {
        const tc = this.getSelectedTotalCost();
        if (this.isSpinning || !this.primaryGift || !this.targetGift || tc >= this.targetGift.price) return;
        if (this.selectedGifts.some(g => !this.inventory.find(e => e.giftId === g.id))) return;
        
        this.isSpinning = true;
        const btn = document.getElementById('upgradeBtn');
        btn.disabled = true; btn.classList.add('spinning'); btn.textContent = 'КРУТИМ...';
        document.querySelectorAll('.quick-bet-btn').forEach(b => b.disabled = true);
        
        if(tg) tg.HapticFeedback.impactOccurred('heavy');
        
        document.getElementById('app').classList.add('blurred');
        document.getElementById('wheelModalChance').textContent = (this.currentChance * 100).toFixed(1) + '%';
        document.getElementById('wheelModalOverlay').classList.add('show');
        
        const totalRot = this.spinType==='fast' ? 3+Math.floor(Math.random()*3) : 5+Math.floor(Math.random()*5);
        const ta = Math.random()*Math.PI*2, totalAngle = totalRot*Math.PI*2+ta;
        const dur = this.spinType==='fast'?2000:4000, st = Date.now(), sa = this.wheelAngle;
        const ease = t => 1 - Math.pow(1-t, 3);
        
        const anim = () => {
            const el = Date.now()-st, p = Math.min(el/dur, 1), ep = ease(p);
            this.wheelAngle = sa + totalAngle*ep;
            this.drawWheel();
            if (this.soundEnabled && p < 0.9 && Math.floor(p*40)%2===0) this.playBeep(200+(1-ep)*800, 0.01);
            if (p < 1) this.wheelAnimationId = requestAnimationFrame(anim);
            else this.onSpinComplete();
        };
        this.wheelAnimationId = requestAnimationFrame(anim);
    }

    onSpinComplete() {
        const na = ((this.wheelAngle%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
        const se = this.currentChance*Math.PI*2, win = na <= se, sc = this.currentChance;
        this.wheelAngle = 0;
        this.drawWheel();
        
        if (win) this.onUpgradeSuccess(sc);
        else this.onUpgradeFail(sc);
        
        setTimeout(() => {
            document.getElementById('wheelModalOverlay').classList.remove('show');
            document.getElementById('app').classList.remove('blurred');
            this.isSpinning = false;
            const btn = document.getElementById('upgradeBtn');
            btn.classList.remove('spinning'); btn.textContent = 'Прокачать'; btn.disabled = false;
            document.querySelectorAll('.quick-bet-btn').forEach(b => b.disabled = false);
            document.getElementById('currentGiftCard').classList.remove('spinning-disabled');
            document.getElementById('targetGiftCard').classList.remove('spinning-disabled');
            document.getElementById('giftListContent').style.pointerEvents = 'auto';
            document.getElementById('giftListContent').style.opacity = '1';
            this.renderAll();
        }, 1800);
    }

    onUpgradeSuccess(sc) {
        const ng = this.targetGift;
        for (const g of this.selectedGifts) { const idx = this.inventory.findIndex(e => e.giftId===g.id); if(idx!==-1) this.inventory.splice(idx,1); }
        if (!this.inventory.find(e => e.giftId===ng.id)) this.inventory.push({ giftId: ng.id, acquiredAt: Date.now() });
        this.selectedGiftIds = [ng.id]; this.updateChance();
        this.history.unshift({ from: 'upgrade', to: ng.id, chance: sc, success: true, time: Date.now() });
        this.saveToStorage();
        this.showResultText(true, sc);
        if(tg) tg.HapticFeedback.notificationOccurred('success');
        this.playBeep(1500, 0.2); setTimeout(() => this.playBeep(1800, 0.15), 150);
    }

    onUpgradeFail(sc) {
        for (const g of this.selectedGifts) { const idx = this.inventory.findIndex(e => e.giftId===g.id); if(idx!==-1) this.inventory.splice(idx,1); }
        this.selectedGiftIds = this.inventory.length>0 ? [this.inventory[0].giftId] : [];
        this.updateChance();
        this.history.unshift({ from: 'upgrade', to: this.targetGift.id, chance: sc, success: false, time: Date.now() });
        this.saveToStorage();
        this.showResultText(false, sc);
        if(tg) tg.HapticFeedback.notificationOccurred('error');
        this.playBeep(200, 0.3, 'sawtooth');
    }

    toggleGiftSelection(giftId) {
        if (!this.inventory.find(e => e.giftId===giftId)) return;
        const idx = this.selectedGiftIds.indexOf(giftId);
        if (idx!==-1) this.selectedGiftIds.splice(idx,1);
        else { if (this.selectedGiftIds.length >= 9) return; this.selectedGiftIds.push(giftId); }
        this.updateChance(); this.renderAll(); this.saveToStorage();
    }

    renderAll() {
        document.getElementById('balance').textContent = this.balance.toLocaleString();
        this.renderCurrentGiftCard(); this.renderGiftCard('targetGiftCard', this.targetGift, false);
        document.getElementById('chancePercent').textContent = (this.currentChance*100).toFixed(1)+'%';
        this.renderGiftList();
        const ub = document.getElementById('upgradeBtn'), tc = this.getSelectedTotalCost();
        const canUpgrade = !this.isSpinning && this.primaryGift && this.targetGift && this.targetGift.price > tc && this.selectedGifts.every(g => this.inventory.find(e => e.giftId===g.id));
        ub.disabled = !canUpgrade;
        if (!this.isSpinning) { ub.classList.remove('spinning'); ub.textContent = 'Прокачать'; }
    }

    renderCurrentGiftCard() {
        const card = document.getElementById('currentGiftCard'), no = document.getElementById('currentGiftNameOutside'), po = document.getElementById('currentGiftPriceOutside');
        card.innerHTML = ''; card.className = 'gift-card current-gift';
        if (this.selectedGifts.length > 0) {
            const grid = document.createElement('div'); grid.className = 'multi-gift-grid';
            const sg = this.selectedGifts.slice(0,9);
            const bs = sg.length<=3?55:sg.length<=6?45:38;
            for (const g of sg) { const w = document.createElement('div'); w.className = 'multi-gift-item'; const img = document.createElement('img'); img.className = 'gift-icon'; img.src = g.icon; img.alt = g.name; img.style.maxHeight = bs+'px'; w.appendChild(img); grid.appendChild(w); }
            card.appendChild(grid);
            if (this.selectedGifts.length===1) { no.textContent = this.selectedGifts[0].name; po.innerHTML = this.selectedGifts[0].price+' <span class="star-icon-small"></span>'; }
            else { no.textContent = 'Выбрано: '+this.selectedGifts.length; po.innerHTML = this.getSelectedTotalCost()+' <span class="star-icon-small"></span>'; }
        } else {
            card.classList.add('empty-card');
            const arrows = document.createElement('div'); arrows.className = 'placeholder-arrows left-arrows';
            for (let i=0;i<3;i++) { const a = document.createElement('span'); a.className = 'placeholder-arrow'; a.textContent = '❱'; arrows.appendChild(a); }
            card.appendChild(arrows); no.textContent = ''; po.textContent = '';
        }
    }

    renderGiftCard(cardId, gift, isCurrent) {
    if (isCurrent) return;
    const card = document.getElementById(cardId);
    
    // Сохраняем блок шанса если он есть
    const existingChance = card.querySelector('.target-chance-inside');
    
    card.innerHTML = '';
    card.className = 'gift-card';
    
    if (gift) { 
        card.classList.add('target-gift'); 
        const img = document.createElement('img'); 
        img.className = 'gift-icon'; 
        img.src = gift.icon; 
        img.alt = gift.name; 
        card.appendChild(img);
        
        // Восстанавливаем или создаём блок шанса
        if (existingChance) {
            card.appendChild(existingChance);
        } else {
            const chanceDiv = document.createElement('div');
            chanceDiv.className = 'target-chance-inside';
            chanceDiv.id = 'chanceDisplayInline';
            chanceDiv.innerHTML = `
                <div class="chance-percent-inside" id="chancePercent">0%</div>
                <div class="chance-label-inside">ШАНС</div>
            `;
            card.appendChild(chanceDiv);
        }
    } else { 
        card.classList.add('empty-card'); 
        const arrows = document.createElement('div'); 
        arrows.className = 'placeholder-arrows right-arrows'; 
        for (let i=0;i<3;i++) { 
            const a = document.createElement('span'); 
            a.className = 'placeholder-arrow'; 
            a.textContent = '❱'; 
            arrows.appendChild(a); 
        } 
        card.appendChild(arrows); 
    }
    
    document.getElementById('targetGiftNameOutside').textContent = gift ? gift.name : '';
    document.getElementById('targetGiftPriceOutside').innerHTML = gift ? gift.price + ' <span class="star-icon-small"></span>' : '';
}

    drawWheel() {
        const c = document.getElementById('wheelCanvas'), ctx = c.getContext('2d'), w = c.width, h = c.height, cx = w/2, cy = h/2;
        const or = Math.min(w, h)/2-12, rw = 22, ir = or-rw, cr = ir-4;
        const outerRingInner = or+3, outerRingOuter = or+8, arrowBaseRadius = outerRingInner+2;
        ctx.clearRect(0,0,w,h);
        if (this.currentChance > 0) {
            const sa = -Math.PI/2, ea = -Math.PI/2+this.currentChance*Math.PI*2;
            ctx.beginPath(); ctx.arc(cx, cy, outerRingOuter, sa, ea); ctx.arc(cx, cy, outerRingInner, ea, sa, true); ctx.closePath();
            const grad = ctx.createLinearGradient(cx-or, cy-or, cx+or, cy+or);
            grad.addColorStop(0, '#f0883e'); grad.addColorStop(0.5, '#f5c842'); grad.addColorStop(1, '#ffd700');
            ctx.fillStyle = grad; ctx.fill(); ctx.shadowColor = 'rgba(240,136,62,0.5)'; ctx.shadowBlur = 18; ctx.fill(); ctx.shadowBlur = 0;
        }
        ctx.beginPath(); ctx.arc(cx, cy, outerRingOuter, 0, Math.PI*2); ctx.arc(cx, cy, outerRingInner, 0, Math.PI*2, true); ctx.closePath();
        ctx.fillStyle = '#0d111f'; ctx.fill(); ctx.strokeStyle = '#2a3a5c'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, or, 0, Math.PI*2); ctx.arc(cx, cy, ir, 0, Math.PI*2, true); ctx.closePath();
        ctx.fillStyle = '#0d111f'; ctx.fill(); ctx.strokeStyle = '#2a3a5c'; ctx.lineWidth = 2; ctx.stroke();
        ctx.shadowColor = 'rgba(100,140,255,0.3)'; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
        if (this.currentChance > 0) {
            const sa = -Math.PI/2, ea = -Math.PI/2+this.currentChance*Math.PI*2;
            ctx.beginPath(); ctx.arc(cx, cy, or-2, sa, ea); ctx.arc(cx, cy, ir+2, ea, sa, true); ctx.closePath();
            const grad = ctx.createLinearGradient(cx-or, cy-or, cx+or, cy+or);
            grad.addColorStop(0, '#f0883e'); grad.addColorStop(0.5, '#f5c842'); grad.addColorStop(1, '#ffd700');
            ctx.fillStyle = grad; ctx.fill(); ctx.shadowColor = 'rgba(240,136,62,0.5)'; ctx.shadowBlur = 18; ctx.fill(); ctx.shadowBlur = 0;
        }
        ctx.beginPath(); ctx.arc(cx, cy, ir, 0, Math.PI*2); ctx.strokeStyle = '#2a3a5c'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(100,140,255,0.2)'; ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(cx, cy, or, 0, Math.PI*2); ctx.strokeStyle = '#2a3a5c'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(100,140,255,0.2)'; ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(cx, cy, outerRingOuter, 0, Math.PI*2); ctx.strokeStyle = '#2a3a5c'; ctx.lineWidth = 1.5; ctx.shadowColor = 'rgba(100,140,255,0.2)'; ctx.shadowBlur = 5; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI*2); ctx.fillStyle = '#08090d'; ctx.fill(); ctx.strokeStyle = '#2a3a5c'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, cr-3, 0, Math.PI*2); ctx.strokeStyle = '#1a2540'; ctx.lineWidth = 1; ctx.stroke();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.wheelAngle);
        const tipRadius = ir+2, tipX = 0, tipY = -tipRadius, baseX = 0, baseY = -arrowBaseRadius;
        ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(tipX, tipY); ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(-6, tipY-10); ctx.lineTo(6, tipY-10); ctx.closePath(); ctx.fillStyle = '#ffd700'; ctx.fill(); ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(baseX, baseY, 3.5, 0, Math.PI*2); ctx.fillStyle = '#ffd700'; ctx.fill(); ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
        ctx.restore();
        const rg = ctx.createRadialGradient(cx-or*0.2, cy-or*0.2, or*0.03, cx, cy, or);
        rg.addColorStop(0, 'rgba(255,255,255,0.05)'); rg.addColorStop(0.5, 'rgba(255,255,255,0.01)'); rg.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.beginPath(); ctx.arc(cx, cy, or, 0, Math.PI*2); ctx.arc(cx, cy, ir, 0, Math.PI*2, true); ctx.closePath(); ctx.fillStyle = rg; ctx.fill();
    }

    renderGiftList() { if (this.activeTab==='inventory') this.renderInventoryListInPanel(); else this.renderTargetsListInPanel(); }

    renderInventoryListInPanel() {
        const c = document.getElementById('giftListContent'), ig = this.inventoryGifts;
        if (!ig.length) { c.innerHTML = '<div style="padding:20px;text-align:center;color:#6b7daa;font-size:12px;">Пусто</div>'; return; }
        c.innerHTML = ig.map(g => {
            const isSel = this.selectedGiftIds.includes(g.id);
            return `<div class="gift-list-item ${isSel?'selected-for-upgrade':''}" data-gift-id="${g.id}">
                <img src="${g.icon}" alt="${g.name}" class="gift-icon-small">
                <div class="gift-list-item-info"><div class="gift-list-item-name">${g.name}</div><div class="gift-list-item-price">${g.price} <span class="star-icon-small"></span></div></div>
                <button class="sell-icon-btn" data-gift-id="${g.id}">Продать</button>
            </div>`;
        }).join('');
        c.querySelectorAll('.gift-list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.sell-icon-btn')) return;
                this.toggleGiftSelection(item.dataset.giftId);
            });
        });
        c.querySelectorAll('.sell-icon-btn').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); this.openSellOverlay(btn.dataset.giftId); }));
    }

    renderTargetsListInPanel() {
        const c = document.getElementById('giftListContent'), t = this.getAllTargets();
        if (!t.length) { c.innerHTML = '<div style="padding:20px;text-align:center;color:#6b7daa;font-size:12px;">Нет подарков</div>'; return; }
        const tc = this.getSelectedTotalCost();
        c.innerHTML = t.map(g => {
            const isSel = g.id===this.targetGiftId;
            const ch = tc>0&&g.price>tc ? (tc/g.price*0.95*100).toFixed(1) : '0.0';
            return `<div class="gift-list-item" data-gift-id="${g.id}" style="${isSel?'background:#111827;border-left:3px solid #f0883e;box-shadow:inset 0 0 15px rgba(240,136,62,0.05)':''}">
                <img src="${g.icon}" alt="${g.name}" class="gift-icon-small">
                <div class="gift-list-item-info"><div class="gift-list-item-name">${g.name} <span style="color:#6b7daa;font-size:10px;">${ch}%</span></div><div class="gift-list-item-price">${g.price} <span class="star-icon-small"></span></div></div>
            </div>`;
        }).join('');
        c.querySelectorAll('.gift-list-item').forEach(item => item.addEventListener('click', () => {
            if (this.isSpinning) return;
            const gid = item.dataset.giftId, tgt = ALL_GIFTS.find(g => g.id===gid);
            if (tgt && (!this.primaryGift || tgt.price > this.getSelectedTotalCost())) { this.targetGiftId = gid; this.updateChance(); this.renderAll(); this.saveToStorage(); }
        }));
    }

    openSellOverlay(giftId) {
        const gift = ALL_GIFTS.find(g => g.id===giftId);
        if (!gift || !this.inventory.find(e => e.giftId===giftId)) return;
        this.sellTargetGiftId = giftId;
        document.getElementById('sellEmoji').innerHTML = `<img src="${gift.icon}" alt="${gift.name}" class="sell-icon">`;
        document.getElementById('sellName').textContent = gift.name;
        document.getElementById('sellPrice').innerHTML = gift.price+' <span class="star-icon-small"></span>';
        document.getElementById('sellOverlay').classList.add('show');
    }
    closeSellOverlay() { document.getElementById('sellOverlay').classList.remove('show'); this.sellTargetGiftId = null; }
    confirmSell() {
        if (!this.sellTargetGiftId) return;
        const gift = ALL_GIFTS.find(g => g.id===this.sellTargetGiftId);
        if (!gift) return;
        const idx = this.inventory.findIndex(e => e.giftId===this.sellTargetGiftId);
        if (idx===-1) return;
        this.inventory.splice(idx,1); this.balance += gift.price;
        const si = this.selectedGiftIds.indexOf(this.sellTargetGiftId);
        if (si!==-1) this.selectedGiftIds.splice(si,1);
        if (this.selectedGiftIds.length===0 && this.inventory.length>0) this.selectedGiftIds = [this.inventory[0].giftId];
        this.updateChance(); this.saveToStorage(); this.renderAll(); this.closeSellOverlay();
        if(tg) tg.HapticFeedback.notificationOccurred('success');
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
        c.querySelectorAll('.buy-btn').forEach(b => b.addEventListener('click', e => {
            const gid = e.target.dataset.giftId, g = ALL_GIFTS.find(x => x.id===gid);
            if (g && this.balance >= g.price) { this.balance -= g.price; if (!this.inventory.find(en => en.giftId===g.id)) this.inventory.push({ giftId: g.id, acquiredAt: Date.now() }); this.deduplicateInventory(); if (!this.primaryGift) { this.selectedGiftIds = [g.id]; this.updateChance(); } this.saveToStorage(); this.renderAll(); this.renderShop(); if(tg) tg.HapticFeedback.notificationOccurred('success'); }
        }));
    }
}

const game = new UpgradeGame();
function setVH() { const vh = window.innerHeight * 0.01; document.documentElement.style.setProperty('--vh', `${vh}px`); }
setVH();
window.addEventListener('resize', setVH);