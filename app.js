// URL твоего бэкенда на Railway
const API_URL = 'https://crash-game-production-6c97.up.railway.app';

const BOT_TOKEN = '8735246963:AAGjkrD0XgQODWcy5d8XV4KIMwpNwJxdA4Y';

let tg = null;
if (window.Telegram && window.Telegram.WebApp) {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
}

let ALL_GIFTS = [];

let iconsLoaded = 0;
let iconsTotal = 0;

function showImagePreloader() {
    const pl = document.getElementById('preloader');
    if (pl) {
        pl.classList.remove('hide');
        pl.querySelector('.preloader-text').textContent = 'UPGIFT';
    }
}

function hideImagePreloader() {
    const pl = document.getElementById('preloader');
    if (pl) {
        pl.classList.add('hide');
        setTimeout(() => { if (pl.parentNode) pl.remove(); }, 300);
    }
}

function updatePreloaderProgress() {
    iconsLoaded++;
    const pl = document.getElementById('preloader');
    if (pl && iconsTotal > 0) {
        const pct = Math.round((iconsLoaded / iconsTotal) * 100);
        pl.querySelector('.preloader-text').textContent = `${pct}%`;
    }
}

async function loadGiftsFromBackend() {
    try {
        const response = await fetch(`${API_URL}/api/gifts`);
        const data = await response.json();
        
        if (data.gifts && data.gifts.length > 0) {
            ALL_GIFTS = data.gifts;
            
            iconsTotal = ALL_GIFTS.length;
            iconsLoaded = 0;
            showImagePreloader();
            
            await Promise.all(ALL_GIFTS.map(gift => {
                return new Promise((resolve) => {
                    if (!gift.icon || gift.icon.startsWith('images/')) {
                        updatePreloaderProgress();
                        resolve();
                        return;
                    }
                    const img = new Image();
                    img.onload = () => { updatePreloaderProgress(); resolve(); };
                    img.onerror = () => {
                        gift.icon = 'images/gifts icons/Precious Peach.png';
                        updatePreloaderProgress();
                        resolve();
                    };
                    img.src = gift.icon;
                });
            }));
            
            hideImagePreloader();
            console.log('✅ Загружено подарков с бэка:', ALL_GIFTS.length);
        } else {
            throw new Error('Empty gifts list');
        }
    } catch (e) {
        console.warn('⚠️ Бэкенд недоступен, использую резервный список:', e.message);
        loadFallbackGifts();
        hideImagePreloader();
    }
}

async function loadUserStarGifts(userId) {
    try {
        const response = await fetch(`${API_URL}/api/user/gifts`, {
            headers: {
                'Content-Type': 'application/json',
                'telegram-init-data': tg?.initData || ''
            }
        });
        const data = await response.json();
        console.log('User gifts response:', data);
        return data;
    } catch (e) {
        console.warn('User gifts error:', e);
        return null;
    }
}

function loadFallbackGifts() {
    ALL_GIFTS = [
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
}

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
        this.sparkSystem = null; this.sellTargetGiftId = null; this.sellTargetEntryIndex = null;
        this.activeTab = 'inventory';
        this.quickCoefs = [2, 4, 8]; this.quickPercents = [35, 55, 75]; this.spinType = 'normal';
        this.shopSortOrder = 'asc'; this.buyTargetGiftId = null;
        this.stakeAmount = 0;
        this.init();
    }

    get selectedGifts() { return this.selectedGiftIds.map(id => ALL_GIFTS.find(g => g.id === id)).filter(Boolean); }
    get primaryGift() { return this.selectedGifts[0] || null; }
    get targetGift() { return ALL_GIFTS.find(g => g.id === this.targetGiftId) || null; }
    get inventoryGifts() {
        return this.inventory.map(e => ALL_GIFTS.find(g => g.id === e.giftId)).filter(Boolean);
    }

    calculateChance(totalCost, tp) { return totalCost >= tp ? 0 : (totalCost / tp) * 0.95; }
    getAllTargets() {
        const tc = this.getSelectedTotalCost();
        return ALL_GIFTS.filter(g => g.price > tc);
    }
    getSelectedTotalCost() { 
        const giftsCost = this.selectedGifts.reduce((s, g) => s + g.price, 0);
        return giftsCost + this.stakeAmount;
    }

    findTargetByFraction(fr) {
        const [n, d] = fr.split('/').map(Number), tc = n / d;
        const totalCost = this.getSelectedTotalCost();
        const cands = ALL_GIFTS.filter(g => g.price > totalCost);
        if (!cands.length) return null;
        let best = cands[0], bd = Infinity;
        for (const g of cands) { const diff = Math.abs(this.calculateChance(totalCost, g.price) - tc); if (diff < bd) { bd = diff; best = g; } }
        return best;
    }

    async init() {
        this.loadFromStorage();
        if (this.inventory.length > 0 && this.selectedGiftIds.length === 0) this.selectedGiftIds = [this.inventory[0].giftId];
        this.updateChance();
        this.sparkSystem = new SparkSystem(document.getElementById('sparkCanvas'));
        this.loadSettings(); this.renderQuickButtons(); this.setupEventListeners(); this.renderAll();
        
        // Синхронизация с бэком в фоне
        this.syncWithBackend();
    }

    async syncWithBackend() {
        if (!tg || !tg.initData) return;
        try {
            const response = await fetch(`${API_URL}/api/user`, {
                headers: {
                    'Content-Type': 'application/json',
                    'telegram-init-data': tg.initData
                }
            });
            if (response.ok) {
                const data = await response.json();
                this.balance = data.user.balance;
                this.inventory = data.inventory || [];
                if (this.inventory.length > 0 && this.selectedGiftIds.length === 0) {
                    this.selectedGiftIds = [this.inventory[0].giftId];
                }
                this.updateChance();
                this.renderAll();
                console.log('✅ Синхронизировано с бэком');
            }
        } catch (e) {
            console.warn('⚠️ Бэкенд недоступен, работаем локально');
        }
    }

    deduplicateInventory() { const s = new Set(); const u = []; for (const e of this.inventory) { if (!s.has(e.giftId)) { s.add(e.giftId); u.push(e); } } this.inventory = u; }

    updateChance() {
        const tc = this.getSelectedTotalCost();
        
        if (this.targetGift && tc > 0) {
            if (tc >= this.targetGift.price / 0.95) {
                const allTargets = ALL_GIFTS.filter(g => g.price > tc).sort((a, b) => a.price - b.price);
                if (allTargets.length > 0) {
                    this.targetGiftId = allTargets[0].id;
                    this.updateChance();
                    return;
                }
            }
        }
        
        if (this.targetGift && this.targetGift.price > tc) {
            this.currentChance = this.calculateChance(tc, this.targetGift.price);
        } else {
            this.currentChance = 0;
        }
    }

    loadFromStorage() { try { const s = localStorage.getItem('upgrade_stars_v12'); if (s) { const d = JSON.parse(s); this.balance = d.balance||1000; this.inventory = d.inventory||[]; this.history = d.history||[]; this.selectedGiftIds = d.selectedGiftIds||[]; this.targetGiftId = d.targetGiftId||null; } } catch(e){} }
    saveToStorage() { try { localStorage.setItem('upgrade_stars_v12', JSON.stringify({ balance: this.balance, inventory: this.inventory, history: this.history.slice(0,30), selectedGiftIds: this.selectedGiftIds, targetGiftId: this.targetGiftId })); } catch(e){} }
    loadSettings() { try { const s = localStorage.getItem('upgift_settings'); if (s) { const d = JSON.parse(s); this.quickCoefs = d.quickCoefs||[2,4,8]; this.quickPercents = d.quickPercents||[35,55,75]; this.soundEnabled = d.soundEnabled!==undefined?d.soundEnabled:false; this.spinType = d.spinType||'normal'; } } catch(e){} }
    saveSettings() { try { localStorage.setItem('upgift_settings', JSON.stringify({ quickCoefs: this.quickCoefs, quickPercents: this.quickPercents, soundEnabled: this.soundEnabled, spinType: this.spinType })); } catch(e){} }

    renderQuickButtons() {
        const c = document.getElementById('quickBetButtons'); if (!c) return;
        let h = '';
        for (const x of this.quickCoefs) h += `<button class="quick-bet-btn" data-fraction="1/${x}">x${x}</button>`;
        for (const p of this.quickPercents) {
            h += `<button class="quick-bet-btn" data-fraction="${p}/100">${p}%</button>`;
        }
        c.innerHTML = h;
        c.querySelectorAll('.quick-bet-btn').forEach(b => b.addEventListener('click', e => {
            if (this.isSpinning) return;
            const f = e.target.dataset.fraction, g = this.findTargetByFraction(f);
            if (g) { this.targetGiftId = g.id; this.updateChance(); this.renderAll(); this.highlightQuickButton(f); }
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
        
        let selectedTopupMethod = 'stars';
        document.getElementById('balanceContainer').addEventListener('click', () => {
            selectedTopupMethod = 'stars';
            document.getElementById('topupSelectIcon').src = 'images/deposit_stars_icon.png';
            document.getElementById('topupSelectText').textContent = 'Звезды Telegram';
            document.getElementById('topupCustomSelect').classList.remove('open');
            document.getElementById('balanceTopupOverlay').classList.add('show');
        });
        document.getElementById('closeTopupBtn').addEventListener('click', () => document.getElementById('balanceTopupOverlay').classList.remove('show'));
        
        document.getElementById('topupSelectHeader').addEventListener('click', () => {
            document.getElementById('topupCustomSelect').classList.toggle('open');
        });
        
        document.querySelectorAll('.topup-select-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                selectedTopupMethod = opt.dataset.value;
                document.getElementById('topupSelectIcon').src = opt.dataset.icon;
                document.getElementById('topupSelectText').textContent = opt.textContent.trim();
                document.getElementById('topupCustomSelect').classList.remove('open');
            });
        });
        
        document.getElementById('topupConfirmBtn').addEventListener('click', () => {
            if (selectedTopupMethod === 'stars') {
                this.balance += 500;
                this.renderAll(); this.saveToStorage();
                document.getElementById('balanceTopupOverlay').classList.remove('show');
            } else if (selectedTopupMethod === 'gifts') {
                if (tg && tg.initDataUnsafe?.user?.id) {
                    const userId = tg.initDataUnsafe.user.id;
                    document.getElementById('balanceTopupOverlay').classList.remove('show');
                    loadUserStarGifts(userId).then(data => {
                        if (data && data.ok && data.result) {
                            const gifts = data.result.gifts || data.result;
                            if (gifts && gifts.length > 0) {
                                this.showUserGiftsModal(gifts);
                            } else {
                                alert('У вас пока нет подарков для пополнения.');
                            }
                        } else {
                            alert('Не удалось загрузить список подарков.');
                        }
                    });
                } else {
                    alert('Функция доступна только в Telegram.');
                    document.getElementById('balanceTopupOverlay').classList.remove('show');
                }
            }
        });
        
        document.getElementById('balanceTopupOverlay').addEventListener('click', (e) => {
            if (!e.target.closest('#topupCustomSelect')) {
                document.getElementById('topupCustomSelect').classList.remove('open');
            }
        });
        
        document.getElementById('shopBtn').addEventListener('click', () => { 
            document.getElementById('shopOverlay').classList.add('show'); 
            document.getElementById('sortAsc').classList.add('active');
            document.getElementById('sortDesc').classList.remove('active');
            this.shopSortOrder = 'asc';
            document.getElementById('shopSearchInput').value = '';
            this.renderShop(); 
        });
        document.getElementById('closeShopBtn').addEventListener('click', () => document.getElementById('shopOverlay').classList.remove('show'));
        document.getElementById('shopSearchInput').addEventListener('input', () => this.renderShop());
        document.getElementById('sortAsc').addEventListener('click', () => {
            this.shopSortOrder = 'asc';
            document.getElementById('sortAsc').classList.add('active');
            document.getElementById('sortDesc').classList.remove('active');
            this.renderShop();
        });
        document.getElementById('sortDesc').addEventListener('click', () => {
            this.shopSortOrder = 'desc';
            document.getElementById('sortDesc').classList.add('active');
            document.getElementById('sortAsc').classList.remove('active');
            this.renderShop();
        });
        
        document.getElementById('buyModalConfirm').addEventListener('click', () => this.confirmBuy());
        document.getElementById('buyModalCancel').addEventListener('click', () => this.closeBuyModal());
        document.getElementById('buyModalOverlay').addEventListener('click', e => { if (e.target === document.getElementById('buyModalOverlay')) this.closeBuyModal(); });
        
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
        
        document.getElementById('giftListSearchInput').addEventListener('input', () => this.renderGiftList());
        
        document.getElementById('stakeSlider').addEventListener('input', (e) => {
            this.stakeAmount = parseInt(e.target.value) || 0;
            this.updateChance();
            this.renderAll();
            this.updateStakeSlider();
        });
        
        document.body.addEventListener('click', () => { if (!this.soundEnabled) this.initAudio(); }, { once: true });
    }

    showUserGiftsModal(gifts) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 50%; transform: translateX(-50%);
            width: 100%; max-width: 450px; height: 100vh;
            background: rgba(8, 9, 13, 0.95); backdrop-filter: blur(8px);
            z-index: 200; display: flex; justify-content: center; align-items: center;
        `;
        
        const card = document.createElement('div');
        card.style.cssText = `
            background: #0d111f; border-radius: 16px; padding: 20px;
            max-width: 320px; width: 90%; max-height: 70vh; overflow-y: auto;
            border: 1px solid #1e2a45;
        `;
        
        card.innerHTML = `
            <h3 style="color:#ffd700;text-align:center;margin-bottom:16px;">Ваши подарки</h3>
            <div style="display:flex;flex-direction:column;gap:8px;">
                ${gifts.map(g => `
                    <div style="display:flex;align-items:center;gap:12px;padding:10px;background:#111827;border-radius:10px;">
                        <span style="font-size:24px;">🎁</span>
                        <div style="flex:1;">
                            <div style="color:#d0daf0;font-size:14px;">${g.title || 'Подарок'}</div>
                            <div style="color:#ffd700;font-size:12px;">${g.stars || 0} ⭐</div>
                        </div>
                        <button style="background:linear-gradient(135deg,#f0883e,#f5c842,#ffd700);color:#0a0f1a;border:none;padding:8px 16px;border-radius:8px;font-weight:700;cursor:pointer;">Отправить</button>
                    </div>
                `).join('')}
            </div>
            <button style="width:100%;margin-top:12px;padding:10px;background:#111827;border:1px solid #2a3a5c;color:#a0b4e0;border-radius:10px;cursor:pointer;">Закрыть</button>
        `;
        
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target.textContent === 'Закрыть') {
                overlay.remove();
            }
        });
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
    }

    highlightQuickButton(fr) { document.querySelectorAll('.quick-bet-btn').forEach(b => b.classList.remove('active')); const btn = document.querySelector(`.quick-bet-btn[data-fraction="${fr}"]`); if(btn) btn.classList.add('active'); }
    async initAudio() { try { this.audioContext = new (window.AudioContext||window.webkitAudioContext)(); await this.audioContext.resume(); } catch(e){} }
    playBeep(f, d, ty='sine') { if (!this.audioContext||!this.soundEnabled) return; const o = this.audioContext.createOscillator(), g = this.audioContext.createGain(); o.connect(g); g.connect(this.audioContext.destination); o.frequency.value = f; o.type = ty; g.gain.setValueAtTime(0.05, this.audioContext.currentTime); g.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime+d); o.start(); o.stop(this.audioContext.currentTime+d); }

    showResultText(success, chance) {
        const wmc = document.getElementById('wheelModalChance');
        const wmcl = document.getElementById('wheelModalChanceLabel');
        const cr = document.getElementById('centerResult'), rt = document.getElementById('centerResultText'), rc = document.getElementById('centerResultChance');
        
        wmc.style.opacity = '0';
        if (wmcl) wmcl.style.opacity = '0';
        
        if (success) { 
            rt.textContent = 'УСПЕШНО'; 
            rt.style.color = '#5ff57a'; 
            rt.style.textShadow = '0 0 20px #5ff57a, 0 0 40px #3fb950'; 
            rc.textContent = `Шанс: ${(chance*100).toFixed(1)}%`; 
            rc.style.color = '#5ff57a'; 
        } else { 
            rt.textContent = 'ПРОИГРЫШ'; 
            rt.style.color = '#ff6b6b'; 
            rt.style.textShadow = '0 0 20px #ff6b6b, 0 0 40px #f85149'; 
            rc.textContent = `Шанс: ${(chance*100).toFixed(1)}%`; 
            rc.style.color = '#ff6b6b'; 
        }
        
        rt.style.animation = 'none'; 
        rt.offsetHeight; 
        rt.style.animation = 'result-pop 0.4s ease-out';
        cr.classList.add('show');
        
        const sc = document.getElementById('sparkCanvas');
        const colors = success ? ['#5ff57a','#3fb950','#a5f5b0','#ffffff','#7dff90'] : ['#ff6b6b','#f85149','#ff9999','#ffffff','#ff4444'];
        this.sparkSystem.emit(sc.width/2, sc.height/2, 40, colors);
        
        if (this.resultTimeout) clearTimeout(this.resultTimeout);
        this.resultTimeout = setTimeout(() => { 
            cr.classList.remove('show'); 
            wmc.style.opacity = '1'; 
            if (wmcl) wmcl.style.opacity = '0.7';
        }, 1800);
    }

    async startUpgrade() {
        const tc = this.getSelectedTotalCost();
        if (this.isSpinning || !this.targetGift || tc >= this.targetGift.price) return;
        if (this.stakeAmount > this.balance) return;
        if (this.selectedGifts.some(g => !this.inventory.find(e => e.giftId === g.id))) return;
        if (this.selectedGifts.length === 0 && this.stakeAmount === 0) return;
        
        // Если есть бэкенд — отправляем запрос туда
        if (tg && tg.initData) {
            try {
                const response = await fetch(`${API_URL}/api/upgrade`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'telegram-init-data': tg.initData
                    },
                    body: JSON.stringify({
                        selectedGiftIds: this.selectedGiftIds,
                        targetGiftId: this.targetGiftId,
                        stakeAmount: this.stakeAmount
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    this.balance = result.user.balance;
                    this.inventory = result.inventory || [];
                    this.selectedGiftIds = this.inventory.length > 0 ? [this.inventory[0].giftId] : [];
                    this.stakeAmount = 0;
                    this.updateChance();
                    this.saveToStorage();
                    this.renderAll();
                    
                    // Запускаем анимацию колеса
                    this.playWheelAnimation(result.success, result.displayedChance);
                    return;
                }
            } catch (e) {
                console.warn('⚠️ Бэкенд недоступен, крутим локально');
            }
        }
        
        // Локальное кручение (если бэкенд недоступен)
        this.playWheelAnimation(null, this.currentChance);
    }
    
    playWheelAnimation(serverSuccess, serverChance) {
        this.isSpinning = true;
        const btn = document.getElementById('upgradeBtn');
        btn.disabled = true; btn.classList.add('spinning'); btn.textContent = 'КРУТИМ...';
        document.querySelectorAll('.quick-bet-btn').forEach(b => b.disabled = true);
        
        document.getElementById('app').classList.add('blurred');
        document.getElementById('wheelModalChance').textContent = ((serverChance || this.currentChance) * 100).toFixed(1) + '%';
        document.getElementById('wheelModalOverlay').classList.add('show');
        
        const totalRot = this.spinType === 'fast' ? 3 + Math.floor(Math.random() * 3) : 5 + Math.floor(Math.random() * 5);
        const ta = Math.random() * Math.PI * 2;
        const totalAngle = totalRot * Math.PI * 2 + ta;
        const dur = this.spinType === 'fast' ? 2500 : 5000;
        const st = Date.now();
        const sa = this.wheelAngle;
        
        const easeSmooth = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        
        const anim = () => {
            const el = Date.now() - st;
            const p = Math.min(el / dur, 1);
            const ep = easeSmooth(p);
            
            this.wheelAngle = sa + totalAngle * ep;
            this.drawWheel();
            
            if (this.soundEnabled && p < 0.95) {
                const tickP = Math.floor(this.wheelAngle / (Math.PI / 4));
                if (tickP !== this._lastTick) {
                    this._lastTick = tickP;
                    const vol = p < 0.8 ? 0.015 : 0.015 * (1 - (p - 0.8) / 0.2);
                    this.playBeep(250 + (1 - ep) * 500, vol);
                }
            }
            
            if (p < 1) {
                this.wheelAnimationId = requestAnimationFrame(anim);
            } else {
                this._lastTick = 0;
                if (serverSuccess !== null && serverSuccess !== undefined) {
                    // Результат от сервера
                    this.wheelAngle = 0;
                    this.drawWheel();
                    if (serverSuccess) this.onUpgradeSuccess(serverChance);
                    else this.onUpgradeFail(serverChance);
                    this.finishSpin();
                } else {
                    // Локальный результат
                    this.onSpinComplete();
                }
            }
        };
        this._lastTick = 0;
        this.wheelAnimationId = requestAnimationFrame(anim);
    }
    
    finishSpin() {
        setTimeout(() => {
            document.getElementById('wheelModalOverlay').classList.remove('show');
            document.getElementById('app').classList.remove('blurred');
            this.isSpinning = false;
            const btn = document.getElementById('upgradeBtn');
            btn.classList.remove('spinning'); btn.textContent = 'Прокачать'; btn.disabled = false;
            document.querySelectorAll('.quick-bet-btn').forEach(b => b.disabled = false);
            this.renderAll();
        }, 1800);
    }

    onSpinComplete() {
        const na = ((this.wheelAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const halfArc = this.currentChance * Math.PI;
        
        const zoneCenter = Math.PI / 2;
        const zoneStart = (zoneCenter - halfArc + Math.PI * 2) % (Math.PI * 2);
        const zoneEnd = (zoneCenter + halfArc) % (Math.PI * 2);
        
        const arrowAngle = ((-Math.PI / 2 + na) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        
        let win;
        if (zoneStart <= zoneEnd) {
            win = arrowAngle >= zoneStart && arrowAngle <= zoneEnd;
        } else {
            win = arrowAngle >= zoneStart || arrowAngle <= zoneEnd;
        }
        
        const sc = this.currentChance;
        
        this.wheelAngle = 0;
        this.drawWheel();
        
        if (win) this.onUpgradeSuccess(sc);
        else this.onUpgradeFail(sc);
        
        this.finishSpin();
    }

    onUpgradeSuccess(sc) {
        if (this.stakeAmount > 0) this.balance -= this.stakeAmount;
        for (const g of this.selectedGifts) { 
            const idx = this.inventory.findIndex(e => e.giftId === g.id); 
            if(idx !== -1) this.inventory.splice(idx, 1); 
        }
        const ng = this.targetGift;
        if (!this.inventory.find(e => e.giftId === ng.id)) this.inventory.push({ giftId: ng.id, acquiredAt: Date.now() });
        
        this.selectedGiftIds = [ng.id]; 
        this.stakeAmount = 0;
        this.updateChance();
        this.history.unshift({ from: 'upgrade', to: ng.id, chance: sc, success: true, time: Date.now() });
        this.saveToStorage();
        this.showResultText(true, sc);
        this.playBeep(1500, 0.2); setTimeout(() => this.playBeep(1800, 0.15), 150);
    }

    onUpgradeFail(sc) {
        if (this.stakeAmount > 0) this.balance -= this.stakeAmount;
        for (const g of this.selectedGifts) { 
            const idx = this.inventory.findIndex(e => e.giftId === g.id); 
            if(idx !== -1) this.inventory.splice(idx, 1); 
        }
        this.selectedGiftIds = this.inventory.length > 0 ? [this.inventory[0].giftId] : [];
        this.stakeAmount = 0;
        this.updateChance();
        this.history.unshift({ from: 'upgrade', to: this.targetGift.id, chance: sc, success: false, time: Date.now() });
        this.saveToStorage();
        this.showResultText(false, sc);
        this.playBeep(200, 0.3, 'sawtooth');
    }

    toggleGiftSelection(giftId) {
        if (!this.inventory.find(e => e.giftId === giftId)) return;
        const idx = this.selectedGiftIds.indexOf(giftId);
        if (idx !== -1) this.selectedGiftIds.splice(idx, 1);
        else { if (this.selectedGiftIds.length >= 9) return; this.selectedGiftIds.push(giftId); }
        this.updateChance(); this.renderAll(); this.saveToStorage();
    }

    renderAll() {
        document.getElementById('balance').textContent = this.balance.toLocaleString();
        this.renderCurrentGiftCard(); this.renderTargetGiftCard();
        if (document.getElementById('chancePercent')) {
            document.getElementById('chancePercent').textContent = (this.currentChance*100).toFixed(1)+'%';
        }
        this.renderGiftList();
        this.updateStakeSlider();
        const ub = document.getElementById('upgradeBtn'), tc = this.getSelectedTotalCost();
        const hasSelection = this.selectedGifts.length > 0 || this.stakeAmount > 0;
        const canUpgrade = !this.isSpinning && hasSelection && this.targetGift && this.targetGift.price > tc 
            && this.stakeAmount <= this.balance
            && this.selectedGifts.every(g => this.inventory.find(e => e.giftId === g.id));
        ub.disabled = !canUpgrade;
        if (!this.isSpinning) { ub.classList.remove('spinning'); ub.textContent = 'Прокачать'; }
    }

    updateStakeSlider() {
        const slider = document.getElementById('stakeSlider');
        if (!slider) return;
        
        let maxStake = this.balance;
        
        if (this.targetGift) {
            const giftsCost = this.selectedGifts.reduce((s, g) => s + g.price, 0);
            const maxForTarget = this.targetGift.price - giftsCost - 1;
            if (maxForTarget < maxStake) maxStake = Math.max(0, maxForTarget);
        }
        
        slider.max = maxStake;
        this.stakeAmount = Math.min(this.stakeAmount, maxStake);
        slider.value = this.stakeAmount;
        
        const pct = maxStake > 0 ? (slider.value / maxStake) * 100 : 0;
        slider.style.background = `linear-gradient(to right, #f0883e 0%, #f5c842 ${pct}%, rgba(255,255,255,0.08) ${pct}%, rgba(255,255,255,0.08) 100%)`;
        
        document.querySelector('.stake-slider-label-right').textContent = 'Выбранная сумма: ' + this.stakeAmount.toLocaleString();
        document.querySelector('.stake-slider-label-left').textContent = 'Баланс: ' + this.balance.toLocaleString();
    }

    renderCurrentGiftCard() {
        const card = document.getElementById('currentGiftCard'), no = document.getElementById('currentGiftNameOutside'), po = document.getElementById('currentGiftPriceOutside');
        card.innerHTML = ''; card.className = 'gift-card current-gift';
        
        const hasGifts = this.selectedGifts.length > 0;
        const hasStake = this.stakeAmount > 0;
        
        if (hasGifts || hasStake) {
            const grid = document.createElement('div'); grid.className = 'multi-gift-grid';
            const totalItems = this.selectedGifts.length + (hasStake ? 1 : 0);
            const bs = totalItems <= 3 ? 55 : totalItems <= 6 ? 45 : 38;
            
            if (hasGifts) {
                const sg = this.selectedGifts.slice(0, 9);
                for (const g of sg) { 
                    const w = document.createElement('div'); w.className = 'multi-gift-item'; 
                    const img = document.createElement('img'); img.className = 'gift-icon'; 
                    img.src = g.icon; img.alt = g.name; img.style.maxHeight = bs + 'px'; 
                    img.onerror = function() { this.src = 'images/gifts icons/Precious Peach.png'; }; 
                    w.appendChild(img); grid.appendChild(w); 
                }
            }
            
            if (hasStake) {
                const w = document.createElement('div'); w.className = 'multi-gift-item'; 
                const img = document.createElement('img'); img.className = 'gift-icon star-stake-icon'; 
                img.src = 'images/stars.png'; img.alt = 'Stars'; img.style.maxHeight = bs + 'px';
                w.appendChild(img); grid.appendChild(w); 
            }
            
            card.appendChild(grid);
            const total = this.getSelectedTotalCost();
            const itemCount = this.selectedGifts.length + (hasStake ? 1 : 0);
            
            if (itemCount === 1) {
                if (hasGifts && this.selectedGifts.length === 1 && !hasStake) no.textContent = this.selectedGifts[0].name;
                else if (hasStake && !hasGifts) no.textContent = 'Звёзды';
                else no.textContent = 'Ставка';
            } else {
                no.textContent = 'Выбрано: ' + itemCount;
            }
            po.innerHTML = total + ' <span class="star-icon-small"></span>';
        } else {
            card.classList.add('empty-card');
            const arrows = document.createElement('div'); arrows.className = 'placeholder-arrows left-arrows';
            for (let i = 0; i < 3; i++) { const a = document.createElement('span'); a.className = 'placeholder-arrow'; a.textContent = '❱'; arrows.appendChild(a); }
            card.appendChild(arrows); no.textContent = ''; po.textContent = '';
        }
    }

    renderTargetGiftCard() {
        const card = document.getElementById('targetGiftCard'), no = document.getElementById('targetGiftNameOutside'), po = document.getElementById('targetGiftPriceOutside');
        card.innerHTML = ''; card.className = 'gift-card';
        const gift = this.targetGift;
        if (gift) { 
            card.classList.add('target-gift'); 
            const img = document.createElement('img'); img.className = 'gift-icon'; 
            img.src = gift.icon; img.alt = gift.name;
            img.onerror = function() { this.src = 'images/gifts icons/Precious Peach.png'; };
            card.appendChild(img);
            const chanceDiv = document.createElement('div');
            chanceDiv.className = 'target-chance-inside';
            chanceDiv.innerHTML = `<div class="chance-percent-inside" id="chancePercent">${(this.currentChance*100).toFixed(1)}%</div><div class="chance-label-inside">ШАНС</div>`;
            card.appendChild(chanceDiv);
            no.textContent = gift.name;
            po.innerHTML = gift.price + ' <span class="star-icon-small"></span>';
        } else { 
            card.classList.add('empty-card'); 
            const arrows = document.createElement('div'); arrows.className = 'placeholder-arrows right-arrows'; 
            for (let i=0;i<3;i++) { const a = document.createElement('span'); a.className = 'placeholder-arrow'; a.textContent = '❱'; arrows.appendChild(a); } 
            card.appendChild(arrows); no.textContent = ''; po.textContent = ''; 
        }
    }

    drawWheel() {
        const c = document.getElementById('wheelCanvas');
        if (!c) return;
        const ctx = c.getContext('2d');
        const w = c.width, h = c.height, cx = w/2, cy = h/2;
        const or = Math.min(w, h)/2 - 10, rw = 26, ir = or - rw, cr = ir - 3;
        const outerRingInner = or + 3, outerRingOuter = or + 9, arrowBaseRadius = outerRingInner + 2;
        
        ctx.clearRect(0, 0, w, h);
        const startAngle = Math.PI / 2;
        
        ctx.beginPath();
        ctx.arc(cx, cy, outerRingOuter, 0, Math.PI * 2);
        ctx.arc(cx, cy, outerRingInner, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fillStyle = '#0d111f';
        ctx.fill();
        
        if (this.currentChance > 0) {
            const halfArc = this.currentChance * Math.PI;
            const sa = startAngle - halfArc, ea = startAngle + halfArc;
            ctx.beginPath();
            ctx.arc(cx, cy, outerRingOuter, sa, ea);
            ctx.arc(cx, cy, outerRingInner, ea, sa, true);
            ctx.closePath();
            const grad = ctx.createLinearGradient(cx, cy + or, cx, cy - or);
            grad.addColorStop(0, '#f0883e'); grad.addColorStop(0.5, '#f5c842'); grad.addColorStop(1, '#3fb950');
            ctx.fillStyle = grad;
            ctx.fill();
        }
        
        ctx.beginPath();
        ctx.arc(cx, cy, or, 0, Math.PI * 2);
        ctx.arc(cx, cy, ir, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fillStyle = '#0d111f';
        ctx.fill();
        
        if (this.currentChance > 0) {
            const halfArc = this.currentChance * Math.PI;
            const sa = startAngle - halfArc, ea = startAngle + halfArc;
            ctx.beginPath();
            ctx.arc(cx, cy, or - 2, sa, ea);
            ctx.arc(cx, cy, ir + 2, ea, sa, true);
            ctx.closePath();
            const grad = ctx.createLinearGradient(cx, cy + or, cx, cy - or);
            grad.addColorStop(0, '#f0883e'); grad.addColorStop(0.5, '#f5c842'); grad.addColorStop(1, '#3fb950');
            ctx.fillStyle = grad;
            ctx.fill();
        }
        
        ctx.strokeStyle = '#2a3a5c'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, outerRingOuter, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, or, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, ir, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fillStyle = '#08090d'; ctx.fill();
        ctx.strokeStyle = '#2a3a5c'; ctx.lineWidth = 2; ctx.stroke();
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.wheelAngle);
        
        const tipRadius = ir + 2;
        const tipX = 0, tipY = -tipRadius;
        const baseX = 0, baseY = -arrowBaseRadius;
        
        ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(tipX, tipY);
        ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(-7, tipY - 12); ctx.lineTo(7, tipY - 12); ctx.closePath();
        ctx.fillStyle = '#ffd700'; ctx.fill();
        ctx.beginPath(); ctx.arc(baseX, baseY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd700'; ctx.fill();
        ctx.restore();
    }

    renderGiftList() { 
        if (this.activeTab === 'inventory') this.renderInventoryListInPanel(); 
        else if (this.activeTab === 'targets') this.renderTargetsListInPanel(); 
    }

    renderInventoryListInPanel() {
        const c = document.getElementById('giftListContent');
        const allEntries = this.inventory;
        const search = (document.getElementById('giftListSearchInput')?.value || '').toLowerCase();
        
        if (!allEntries.length) {
            c.innerHTML = '<div style="padding:20px;text-align:center;color:#6b7daa;font-size:12px;">Пусто</div>';
            return;
        }
        
        const sorted = [...allEntries].sort((a, b) => {
            if (a.giftId !== b.giftId) return a.giftId.localeCompare(b.giftId);
            return (a.acquiredAt || 0) - (b.acquiredAt || 0);
        });
        
        const filtered = sorted.filter(entry => {
            const g = ALL_GIFTS.find(x => x.id === entry.giftId);
            return g && g.name.toLowerCase().includes(search);
        });
        
        c.innerHTML = filtered.map((entry) => {
            const g = ALL_GIFTS.find(x => x.id === entry.giftId);
            if (!g) return '';
            const isSel = this.selectedGiftIds.includes(entry.giftId);
            const realIndex = sorted.indexOf(entry);
            return `<div class="gift-list-item ${isSel ? 'selected-for-upgrade' : ''}" data-entry-index="${realIndex}" data-gift-id="${entry.giftId}">
                <img src="${g.icon}" alt="${g.name}" class="gift-icon-small" onerror="this.src='images/gifts icons/Precious Peach.png'">
                <div class="gift-list-item-info">
                    <div class="gift-list-item-name">${g.name}</div>
                    <div class="gift-list-item-price">${g.price} <span class="star-icon-small"></span></div>
                </div>
                <button class="withdraw-icon-btn" data-entry-index="${realIndex}"><img src="images/withdraw_btn.png" alt="Вывести"></button>
                <button class="sell-icon-btn" data-entry-index="${realIndex}"><img src="images/sell_btn.png" alt="Продать"></button>
            </div>`;
        }).join('');
        
        c.querySelectorAll('.gift-list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.sell-icon-btn') || e.target.closest('.withdraw-icon-btn')) return;
                this.toggleGiftSelection(item.dataset.giftId);
            });
        });
        c.querySelectorAll('.sell-icon-btn').forEach(btn => btn.addEventListener('click', e => {
            e.stopPropagation();
            const entryIdx = parseInt(btn.dataset.entryIndex);
            if (!isNaN(entryIdx)) this.sellSpecificEntry(entryIdx);
        }));
        c.querySelectorAll('.withdraw-icon-btn').forEach(btn => btn.addEventListener('click', e => {
            e.stopPropagation();
            alert('Функция вывода будет доступна с интеграцией бота Telegram.');
        }));
    }

    sellSpecificEntry(entryIndex) {
        if (entryIndex < 0 || entryIndex >= this.inventory.length) return;
        const entry = this.inventory[entryIndex];
        const gift = ALL_GIFTS.find(g => g.id === entry.giftId);
        if (!gift) return;
        
        this.sellTargetEntryIndex = entryIndex;
        this.sellTargetGiftId = entry.giftId;
        
        document.getElementById('sellEmoji').innerHTML = `<img src="${gift.icon}" alt="${gift.name}" class="sell-icon" onerror="this.src='images/gifts icons/Precious Peach.png'">`;
        document.getElementById('sellName').textContent = gift.name;
        document.getElementById('sellPrice').innerHTML = gift.price + ' <span class="star-icon-small"></span>';
        document.getElementById('sellOverlay').classList.add('show');
    }

    renderTargetsListInPanel() {
        const c = document.getElementById('giftListContent'), t = this.getAllTargets();
        const search = (document.getElementById('giftListSearchInput')?.value || '').toLowerCase();
        const filtered = t.filter(g => g.name.toLowerCase().includes(search));
        
        if (!filtered.length) { c.innerHTML = '<div style="padding:20px;text-align:center;color:#6b7daa;font-size:12px;">Нет подарков</div>'; return; }
        const tc = this.getSelectedTotalCost();
        c.innerHTML = filtered.map(g => {
            const isSel = g.id === this.targetGiftId;
            const ch = tc > 0 && g.price > tc ? (tc / g.price * 0.95 * 100).toFixed(1) : '0.0';
            return `<div class="gift-list-item" data-gift-id="${g.id}" style="${isSel ? 'background:#111827;border-left:3px solid #f0883e;box-shadow:inset 0 0 15px rgba(240,136,62,0.05)' : ''}">
                <img src="${g.icon}" alt="${g.name}" class="gift-icon-small" onerror="this.src='images/gifts icons/Precious Peach.png'">
                <div class="gift-list-item-info"><div class="gift-list-item-name">${g.name} <span style="color:#6b7daa;font-size:10px;">${ch}%</span></div><div class="gift-list-item-price">${g.price} <span class="star-icon-small"></span></div></div>
            </div>`;
        }).join('');
        c.querySelectorAll('.gift-list-item').forEach(item => item.addEventListener('click', () => {
            if (this.isSpinning) return;
            const gid = item.dataset.giftId, tgt = ALL_GIFTS.find(g => g.id === gid);
            if (tgt && tgt.price > this.getSelectedTotalCost()) { this.targetGiftId = gid; this.updateChance(); this.renderAll(); this.saveToStorage(); }
        }));
    }

    openSellOverlay(giftId) {
        const gift = ALL_GIFTS.find(g => g.id === giftId);
        if (!gift || !this.inventory.find(e => e.giftId === giftId)) return;
        this.sellTargetGiftId = giftId;
        document.getElementById('sellEmoji').innerHTML = `<img src="${gift.icon}" alt="${gift.name}" class="sell-icon" onerror="this.src='images/gifts icons/Precious Peach.png'">`;
        document.getElementById('sellName').textContent = gift.name;
        document.getElementById('sellPrice').innerHTML = gift.price + ' <span class="star-icon-small"></span>';
        document.getElementById('sellOverlay').classList.add('show');
    }
    closeSellOverlay() { document.getElementById('sellOverlay').classList.remove('show'); this.sellTargetGiftId = null; this.sellTargetEntryIndex = null; }
    confirmSell() {
        let idx;
        if (this.sellTargetEntryIndex !== null) idx = this.sellTargetEntryIndex;
        else if (this.sellTargetGiftId) idx = this.inventory.findIndex(e => e.giftId === this.sellTargetGiftId);
        else return;
        
        const gift = ALL_GIFTS.find(g => g.id === this.inventory[idx]?.giftId);
        if (!gift) return;
        
        this.inventory.splice(idx, 1);
        this.balance += gift.price;
        
        const si = this.selectedGiftIds.indexOf(gift.id);
        if (si !== -1) this.selectedGiftIds.splice(si, 1);
        if (this.selectedGiftIds.length === 0 && this.inventory.length > 0) this.selectedGiftIds = [this.inventory[0].giftId];
        
        this.updateChance(); this.saveToStorage(); this.renderAll(); this.closeSellOverlay();
    }

    renderShop() {
        const c = document.getElementById('shopItems');
        const search = (document.getElementById('shopSearchInput')?.value || '').toLowerCase();
        let filtered = ALL_GIFTS.filter(g => g.name.toLowerCase().includes(search));
        
        if (this.shopSortOrder === 'asc') filtered.sort((a, b) => a.price - b.price);
        else filtered.sort((a, b) => b.price - a.price);
        
        c.innerHTML = filtered.map(g => `
            <div class="shop-item" data-gift-id="${g.id}">
                <img src="${g.icon}" alt="${g.name}" class="shop-item-icon" onerror="this.src='images/gifts icons/Precious Peach.png'">
                <div class="shop-item-name">${g.name}</div>
                <div class="shop-item-price">${g.price} <span class="star-icon-small"></span></div>
            </div>
        `).join('');
        
        c.querySelectorAll('.shop-item').forEach(item => item.addEventListener('click', () => {
            const gid = item.dataset.giftId;
            this.openBuyModal(gid);
        }));
    }

    openBuyModal(giftId) {
        const gift = ALL_GIFTS.find(g => g.id === giftId);
        if (!gift) return;
        this.buyTargetGiftId = giftId;
        document.getElementById('buyModalIcon').src = gift.icon;
        document.getElementById('buyModalIcon').onerror = function() { this.src = 'images/gifts icons/Precious Peach.png'; };
        document.getElementById('buyModalName').textContent = gift.name;
        document.getElementById('buyModalPrice').innerHTML = gift.price + ' <span class="star-icon-small"></span>';
        document.getElementById('buyModalConfirm').disabled = this.balance < gift.price;
        document.getElementById('buyModalOverlay').classList.add('show');
    }

    closeBuyModal() { document.getElementById('buyModalOverlay').classList.remove('show'); this.buyTargetGiftId = null; }

    confirmBuy() {
        if (!this.buyTargetGiftId) return;
        const g = ALL_GIFTS.find(x => x.id === this.buyTargetGiftId);
        if (g && this.balance >= g.price) {
            this.balance -= g.price;
            if (!this.inventory.find(en => en.giftId === g.id)) this.inventory.push({ giftId: g.id, acquiredAt: Date.now() });
            this.deduplicateInventory();
            if (this.selectedGifts.length === 0 && this.stakeAmount === 0 && this.inventory.length > 0) { 
                this.selectedGiftIds = [g.id]; 
                this.updateChance(); 
            }
            this.saveToStorage(); this.renderAll(); this.renderShop();
        }
        this.closeBuyModal();
    }
}

async function startApp() {
    await loadGiftsFromBackend();
    if (ALL_GIFTS.length === 0) loadFallbackGifts();
    window.game = new UpgradeGame();
}

startApp();

function setVH() { const vh = window.innerHeight * 0.01; document.documentElement.style.setProperty('--vh', `${vh}px`); }
setVH();
window.addEventListener('resize', setVH);