require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// База данных — один файл, только у тебя
const db = new Database('upgift.db');

// Включаем WAL-режим для быстрой работы
db.pragma('journal_mode = WAL');

// Создаём таблицы
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        telegram_id INTEGER PRIMARY KEY,
        balance INTEGER DEFAULT 1000,
        created_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER REFERENCES users(telegram_id),
        gift_id TEXT NOT NULL,
        acquired_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER,
        from_gifts TEXT,
        to_gift TEXT,
        displayed_chance REAL,
        real_chance REAL,
        total_cost INTEGER,
        success INTEGER,
        casino_bank_before INTEGER,
        casino_bank_after INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS casino_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        bank INTEGER DEFAULT 10000,
        owner_earnings INTEGER DEFAULT 0,
        total_upgrades INTEGER DEFAULT 0
    );
`);

// Вставляем начальное состояние казино если пусто
const casinoExists = db.prepare('SELECT id FROM casino_state WHERE id = 1').get();
if (!casinoExists) {
    db.prepare('INSERT INTO casino_state (id, bank) VALUES (1, 10000)').run();
}

const BOT_TOKEN = process.env.BOT_TOKEN;

// Проверка Telegram initData
function validateTelegramData(initData) {
    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');
        
        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
        
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
        const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        
        return calculatedHash === hash;
    } catch (e) {
        return false;
    }
}

function authMiddleware(req, res, next) {
    const initData = req.headers['x-telegram-init-data'] || req.headers['telegram-init-data'];
    
    if (!initData) {
        return res.status(401).json({ error: 'No init data' });
    }
    
    if (!validateTelegramData(initData)) {
        return res.status(401).json({ error: 'Invalid init data' });
    }
    
    const params = new URLSearchParams(initData);
    const user = JSON.parse(params.get('user'));
    req.telegramId = user.id;
    next();
}

// Цены подарков
let GIFT_PRICES = {};

async function loadGiftPrices() {
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/payments.getStarGifts`);
        const data = await response.json();
        
        if (data.ok && data.result?.gifts) {
            for (const gift of data.result.gifts) {
                GIFT_PRICES[String(gift.id)] = {
                    name: gift.title || ('Подарок #' + gift.id),
                    price: Number(gift.stars) || 0
                };
            }
            console.log('✅ Загружено подарков:', Object.keys(GIFT_PRICES).length);
        }
    } catch (e) {
        console.warn('⚠️ Не удалось загрузить подарки, использую заглушки');
        GIFT_PRICES = {
            'precious_peach': { name: 'Precious Peach', price: 50 },
            'desk_calendar': { name: 'Desk Calendar', price: 100 },
            'durovs_cap': { name: "Durov's Cap", price: 500 },
            'swiss_watch': { name: 'Swiss Watch', price: 1000 },
            'plush_pepe': { name: 'Plush Pepe', price: 10000 },
            'loot_bag': { name: 'Loot Bag', price: 250000 },
        };
    }
}

// Состояние пользователя
app.get('/api/user', authMiddleware, (req, res) => {
    const { telegramId } = req;
    
    let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
    if (!user) {
        db.prepare('INSERT INTO users (telegram_id, balance) VALUES (?, 1000)').run(telegramId);
        user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
    }
    
    const inventory = db.prepare('SELECT * FROM inventory WHERE telegram_id = ? ORDER BY acquired_at').all(telegramId);
    
    res.json({ user, inventory, giftPrices: GIFT_PRICES });
});

// Апгрейд
app.post('/api/upgrade', authMiddleware, (req, res) => {
    const { telegramId } = req;
    const { selectedGiftIds, targetGiftId, stakeAmount = 0 } = req.body;
    
    const targetPrice = GIFT_PRICES[targetGiftId]?.price;
    if (!targetPrice) return res.status(400).json({ error: 'Invalid target gift' });
    
    let giftsCost = 0;
    for (const gid of selectedGiftIds) {
        const price = GIFT_PRICES[gid]?.price;
        if (!price) return res.status(400).json({ error: `Invalid gift: ${gid}` });
        giftsCost += price;
    }
    
    const totalCost = giftsCost + stakeAmount;
    if (totalCost >= targetPrice) return res.status(400).json({ error: 'Cost >= target' });
    
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (stakeAmount > user.balance) return res.status(400).json({ error: 'Insufficient balance' });
    
    for (const gid of selectedGiftIds) {
        const item = db.prepare('SELECT id FROM inventory WHERE telegram_id = ? AND gift_id = ? LIMIT 1').get(telegramId, gid);
        if (!item) return res.status(400).json({ error: `Gift ${gid} not in inventory` });
    }
    
    const casino = db.prepare('SELECT * FROM casino_state WHERE id = 1').get();
    let bank = casino.bank;
    const bankBefore = bank;
    
    const displayedChance = (totalCost / targetPrice) * 0.95;
    let realChance = displayedChance;
    
    if (targetPrice <= 250) realChance *= 0.95;
    else if (targetPrice <= 1000) realChance *= 0.75;
    else if (targetPrice <= 10000) realChance *= 0.55;
    else realChance *= 0.40;
    
    if (bank < targetPrice * 5) {
        realChance *= Math.max(0.05, bank / (targetPrice * 5));
    }
    
    const win = Math.random() < realChance;
    
    const transaction = db.transaction(() => {
        for (const gid of selectedGiftIds) {
            db.prepare('DELETE FROM inventory WHERE id = (SELECT id FROM inventory WHERE telegram_id = ? AND gift_id = ? LIMIT 1)').run(telegramId, gid);
        }
        
        if (stakeAmount > 0) {
            db.prepare('UPDATE users SET balance = balance - ? WHERE telegram_id = ?').run(stakeAmount, telegramId);
        }
        
        if (win) {
            db.prepare('INSERT INTO inventory (telegram_id, gift_id) VALUES (?, ?)').run(telegramId, targetGiftId);
            bank -= targetPrice;
        } else {
            let bankShare, ownerShare;
            if (bank < 10000) { bankShare = 0.9; ownerShare = 0.1; }
            else if (bank < 50000) { bankShare = 0.7; ownerShare = 0.3; }
            else if (bank < 100000) { bankShare = 0.5; ownerShare = 0.5; }
            else { bankShare = 0.3; ownerShare = 0.7; }
            
            bank += Math.floor(totalCost * bankShare);
            const ownerEarnings = Math.floor(totalCost * ownerShare);
            db.prepare('UPDATE casino_state SET owner_earnings = owner_earnings + ?').run(ownerEarnings);
        }
        
        db.prepare('UPDATE casino_state SET bank = ?, total_upgrades = total_upgrades + 1').run(bank);
        
        db.prepare('INSERT INTO history (telegram_id, from_gifts, to_gift, displayed_chance, real_chance, total_cost, success, casino_bank_before, casino_bank_after) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
            telegramId, JSON.stringify(selectedGiftIds), targetGiftId, displayedChance, realChance, totalCost, win ? 1 : 0, bankBefore, bank
        );
    });
    
    transaction();
    
    const updatedUser = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
    const updatedInventory = db.prepare('SELECT * FROM inventory WHERE telegram_id = ? ORDER BY acquired_at').all(telegramId);
    
    res.json({ success: win, displayedChance, user: updatedUser, inventory: updatedInventory });
});

// Купить
app.post('/api/shop/buy', authMiddleware, (req, res) => {
    const { telegramId } = req;
    const { giftId } = req.body;
    
    const gift = GIFT_PRICES[giftId];
    if (!gift) return res.status(400).json({ error: 'Invalid gift' });
    
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.balance < gift.price) return res.status(400).json({ error: 'Insufficient balance' });
    
    db.prepare('UPDATE users SET balance = balance - ? WHERE telegram_id = ?').run(gift.price, telegramId);
    db.prepare('INSERT INTO inventory (telegram_id, gift_id) VALUES (?, ?)').run(telegramId, giftId);
    
    const updatedUser = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
    const updatedInventory = db.prepare('SELECT * FROM inventory WHERE telegram_id = ? ORDER BY acquired_at').all(telegramId);
    
    res.json({ user: updatedUser, inventory: updatedInventory });
});

// Продать
app.post('/api/shop/sell', authMiddleware, (req, res) => {
    const { telegramId } = req;
    const { giftId, entryIndex } = req.body;
    
    const gift = GIFT_PRICES[giftId];
    if (!gift) return res.status(400).json({ error: 'Invalid gift' });
    
    if (entryIndex !== undefined) {
        const items = db.prepare('SELECT id FROM inventory WHERE telegram_id = ? AND gift_id = ? ORDER BY acquired_at').all(telegramId, giftId);
        if (entryIndex >= items.length) return res.status(400).json({ error: 'Invalid index' });
        db.prepare('DELETE FROM inventory WHERE id = ?').run(items[entryIndex].id);
    } else {
        db.prepare('DELETE FROM inventory WHERE id = (SELECT id FROM inventory WHERE telegram_id = ? AND gift_id = ? LIMIT 1)').run(telegramId, giftId);
    }
    
    db.prepare('UPDATE users SET balance = balance + ? WHERE telegram_id = ?').run(gift.price, telegramId);
    
    const updatedUser = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
    const updatedInventory = db.prepare('SELECT * FROM inventory WHERE telegram_id = ? ORDER BY acquired_at').all(telegramId);
    
    res.json({ user: updatedUser, inventory: updatedInventory });
});

const PORT = process.env.PORT || 3000;

loadGiftPrices().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 UPGIFT Backend running on port ${PORT}`);
        console.log('📁 Database: upgift.db (локально, только у тебя)');
    });
});