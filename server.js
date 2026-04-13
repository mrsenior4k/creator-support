// server.js
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

// ---------- Data storage ----------
let events = []; // simple in-memory log (replace with DB in production)
let userProgress = {};
let creatorStats = {};

try {
  const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
  userProgress = data.userProgress || {};
  creatorStats = data.creatorStats || {};
} catch (err) {
  console.log("No data file found, starting fresh");
}

// ---------- Helpers ----------
function hashFingerprint(fingerprintString) {
  return crypto.createHash('sha256').update(fingerprintString).digest('hex');
}

function getToday() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// ---------- Config ----------
const MAX_SUPPORTS_PER_DAY = 3;
const COOLDOWN_MS = 30_000; // 30 seconds
const REWARD_PER_SUPPORT = 0.05;

// ---------- Event endpoint ----------
app.post('/event', (req, res) => {
  const { type, creator, fingerprint } = req.body;
  if (!type || !creator || !fingerprint) return res.json({ success: false, message: 'Missing data' });

  const fpHash = hashFingerprint(fingerprint);
  const today = getToday();

  // init user if first time
  if (!userProgress[fpHash]) userProgress[fpHash] = {};
  if (!userProgress[fpHash][today]) userProgress[fpHash][today] = { dailyCount: 0, lastComplete: 0 };

  const userData = userProgress[fpHash][today];
  const now = Date.now();

  // ---------- Anti-bot / self-support ----------
  if (fpHash === hashFingerprint(creator)) {
    return res.json({ success: false, message: "Cannot support yourself" });
  }

  // ---------- Cooldown ----------
  if (now - userData.lastComplete < COOLDOWN_MS) {
    return res.json({ success: false, wait: Math.ceil((COOLDOWN_MS - (now - userData.lastComplete))/1000) });
  }

  // ---------- Daily cap ----------
if (userData.dailyCount >= MAX_SUPPORTS_PER_DAY) {
  const nowDate = new Date();

  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0); // next midnight

  const waitSeconds = Math.floor((tomorrow - nowDate) / 1000);

  return res.json({
    success: false,
    message: "Daily limit reached",
    wait: waitSeconds
  });
}

  if (type === 'ad_start') {
    return res.json({ success: true }); // frontend can start ad/progress
  }

  if (type === 'ad_complete') {
    // update user
    userData.dailyCount++;
    userData.lastComplete = now;

    // update creator
    if (!creatorStats[creator]) creatorStats[creator] = { supports: 0, earnings: 0 };
    creatorStats[creator].supports++;
    creatorStats[creator].earnings += REWARD_PER_SUPPORT;

    // log event
    events.push({ timestamp: now, creator, fingerprint: fpHash });

    fs.writeFileSync('data.json', JSON.stringify({
  userProgress,
  creatorStats
}, null, 2));

    return res.json({ success: true, supports: creatorStats[creator].supports, earnings: creatorStats[creator].earnings.toFixed(2) });
  }

  return res.json({ success: false, message: 'Unknown event type' });
});

// ---------- Count endpoint ----------
app.get('/count/:creator', (req, res) => {
  const creator = req.params.creator;
  if (!creatorStats[creator]) creatorStats[creator] = { supports: 0, earnings: 0 };
  res.json({ count: creatorStats[creator].supports, earnings: creatorStats[creator].earnings });
});

// ---------- Start server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
