const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');

function readConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

router.get('/config', async (req, res) => {
  try {
    const config = readConfig();
    res.json(config);
  } catch (err) {
    console.error('Error reading config.json', err);
    res.status(500).json({ error: 'Failed to read configuration.' });
  }
});

router.post('/config', async (req, res) => {
  try {
    const updates = req.body || {};
    const current = readConfig();

    const merged = {
      ...current,
      ...updates,
      clientMappings: {
        ...(current.clientMappings || {}),
        ...(updates.clientMappings || {})
      },
      defaultRates: {
        ...(current.defaultRates || {}),
        ...(updates.defaultRates || {})
      }
    };

    writeConfig(merged);
    res.json({ success: true });
  } catch (err) {
    console.error('Error writing config.json', err);
    res.status(500).json({ error: 'Failed to update configuration.' });
  }
});

module.exports = router;

