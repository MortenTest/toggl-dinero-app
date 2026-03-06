const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getDineroToken } = require('../dineroToken');

const router = express.Router();
const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');

function readConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}

function sendJsonError(res, status, message) {
  if (res.headersSent) return;
  res.setHeader('Content-Type', 'application/json');
  res.status(status).end(JSON.stringify({ error: String(message || 'Unknown error') }));
}

router.get('/contacts', (req, res) => {
  (async () => {
  try {
    const token = await getDineroToken();
    const orgId = process.env.DINERO_ORG_ID;

    if (!orgId) {
      return sendJsonError(res, 500, 'DINERO_ORG_ID is not set');
    }

    const response = await axios.get(
      `https://api.dinero.dk/v1/${orgId}/contacts`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const raw = response.data;
    let items = [];
    if (Array.isArray(raw)) {
      items = raw;
    } else if (raw && typeof raw === 'object') {
      items =
        raw.Collection ??
        raw.collection ??
        raw.contacts ??
        raw.Items ??
        raw.items ??
        [];
    }
    if (!Array.isArray(items)) items = [];

    const contacts = items.map((c) => ({
      contactGuid: c.ContactGuid ?? c.contactGuid ?? c.Guid ?? c.guid ?? c.id ?? null,
      name: c.Name ?? c.name ?? null
    }));

    if (!res.headersSent) res.json(contacts);
  } catch (err) {
    const message =
      err.response?.data?.Message ??
      err.response?.data?.message ??
      (typeof err.response?.data === 'string' ? err.response.data : null) ??
      (err && err.message);
    console.error('Error fetching Dinero contacts', err.response?.data ?? err);
    sendJsonError(res, 500, message || 'Failed to fetch Dinero contacts');
  }
  })().catch((err) => {
    console.error('Unhandled error in /contacts', err);
    sendJsonError(res, 500, err && err.message || 'Internal server error');
  });
});

router.post('/invoice', (req, res) => {
  (async () => {
    try {
      const {
        contactGuid,
        invoiceDate,
        currency,
        description,
        lines
      } = req.body || {};

      if (!contactGuid || !invoiceDate || !currency || !Array.isArray(lines) || lines.length === 0) {
        return sendJsonError(res, 400, 'contactGuid, invoiceDate, currency and non-empty lines are required');
      }

      const token = await getDineroToken();
      const orgId = process.env.DINERO_ORG_ID;
      if (!orgId) {
        return sendJsonError(res, 500, 'DINERO_ORG_ID is not set');
      }

      let config;
      try {
        config = readConfig();
      } catch (e) {
        return sendJsonError(res, 500, 'Failed to read config');
      }
      const accountNumber = config.defaultAccountNumber ?? 1000;

      const Lines = lines.map((l) => ({
        Description: l.projectName ?? '',
        Quantity: l.hours ?? 0,
        UnitNetPrice: l.ratePerHour ?? 0,
        Discount: 0,
        AccountNumber: accountNumber,
        Unit: 'Hours'
      }));

      const body = {
        ContactGuid: contactGuid,
        Date: invoiceDate,
        Currency: currency,
        Description: description ?? '',
        ProductLines: Lines
      };

      const response = await axios.post(
        `https://api.dinero.dk/v1/${orgId}/invoices`,
        body,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = response.data || {};
      const invoiceId = data.Guid ?? data.guid ?? data.Id ?? data.id ?? null;
      const dineroUrl = `https://app.dinero.dk/${orgId}`;

      if (!res.headersSent) {
        res.json({ success: true, invoiceId, dineroUrl });
      }
    } catch (err) {
      console.error('Error creating Dinero invoice:', err.message);
      console.error('Dinero response status:', err.response?.status);
      console.error(
        'Dinero response data:',
        JSON.stringify(err.response?.data, null, 2)
      );
      res.status(500).json({
        error:
          err.response?.data?.Message ||
          err.response?.data?.message ||
          err.message ||
          'Failed to create invoice'
      });
    }
  })().catch((err) => {
    console.error('Unhandled error in /invoice', err);
    sendJsonError(res, 500, err && err.message || 'Internal server error');
  });
});

module.exports = router;
