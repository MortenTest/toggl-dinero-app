(function () {
  const state = {
    togglClients: [],
    dineroContacts: [],
    config: {},
    selectedClientId: null,
    dateRange: { start: null, end: null },
    summaryLines: [],
    invoiceDate: null,
    currency: 'DKK',
    description: '',
    togglVerified: false,
    togglVerifiedName: null,
    dineroConnected: false,
    summaryClientName: null
  };

  const el = (id) => document.getElementById(id);
  const hide = (node) => node && node.classList.add('hidden');
  const show = (node) => node && node.classList.remove('hidden');
  const toggle = (node, visible) => (visible ? show(node) : hide(node));

  function setPeriod(period) {
    const now = new Date();
    let start, end;
    if (period === 'last-month') {
      const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(firstThisMonth.getTime() - 1);
      start = new Date(end.getFullYear(), end.getMonth(), 1);
    } else if (period === 'this-month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date();
    } else {
      return;
    }
    state.dateRange.start = start;
    state.dateRange.end = end;
    const fmt = (d) => d.toISOString().slice(0, 10);
    const dateFrom = el('date-from');
    const dateTo = el('date-to');
    if (dateFrom) dateFrom.value = fmt(start);
    if (dateTo) dateTo.value = fmt(end);
  }

  function getDateRange() {
    if (el('custom-dates') && !el('custom-dates').classList.contains('hidden')) {
      return { start: el('date-from').value, end: el('date-to').value };
    }
    const fmt = (d) => d && d.toISOString ? d.toISOString().slice(0, 10) : '';
    return { start: fmt(state.dateRange.start), end: fmt(state.dateRange.end) };
  }

  async function api(path, options = {}) {
    const res = await fetch(path, options);
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {}
    return { ok: res.ok, status: res.status, data };
  }

  function renderSetupCollapsed() {
    const count = state.config.clientMappings
      ? Object.keys(state.config.clientMappings).length
      : 0;
    el('setup-collapsed-text').textContent =
      '⚙ Setup complete — ' + count + ' clients mapped';
  }

  function setupSectionCollapsed(collapsed) {
    const collapsedDiv = el('setup-collapsed');
    const expandedDiv = el('setup-expanded');
    if (collapsed) {
      show(collapsedDiv);
      hide(expandedDiv);
      renderSetupCollapsed();
    } else {
      hide(collapsedDiv);
      show(expandedDiv);
    }
  }

  function renderMappingTable() {
    const tbody = el('mapping-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    state.togglClients.forEach((client) => {
      const tr = document.createElement('tr');
      const contactGuid =
        (state.config.clientMappings && state.config.clientMappings[client.id]) || '';
      tr.innerHTML =
        '<td></td><td class="center">→</td><td><select class="mapping-select" data-client-id="' +
        escapeHtml(String(client.id)) +
        '"><option value="">— Select contact —</option></select></td>';
      tr.querySelector('td').textContent = client.name || '';
      const select = tr.querySelector('.mapping-select');
      state.dineroContacts.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.contactGuid || '';
        opt.textContent = c.name || '(Unnamed)';
        if ((c.contactGuid || '') === contactGuid) opt.selected = true;
        select.appendChild(opt);
      });
      select.value = contactGuid || '';
      select.addEventListener('change', updateSaveButtonState);
      tbody.appendChild(tr);
    });
    updateSaveButtonState();
  }

  function updateSaveButtonState() {
    const btn = el('btn-save-setup');
    if (!btn) return;
    const selects = document.querySelectorAll('.mapping-select');
    const anyEmpty = Array.from(selects).some((s) => !s.value);
    btn.disabled = anyEmpty;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function populateSetupFromConfig() {
    const cfg = state.config;
    const acc = el('default-account');
    const curr = el('default-currency');
    if (acc && cfg.defaultAccountNumber != null)
      acc.value = String(cfg.defaultAccountNumber);
    if (curr && cfg.defaultCurrency) curr.value = cfg.defaultCurrency;
  }

  function getMappingFromForm() {
    const clientMappings = {};
    document.querySelectorAll('.mapping-select').forEach((select) => {
      const clientId = select.getAttribute('data-client-id');
      if (clientId) clientMappings[clientId] = select.value || '';
    });
    return clientMappings;
  }

  async function loadInitialData() {
    const [configRes, clientsRes, contactsRes] = await Promise.all([
      api('/api/config'),
      api('/api/toggl/clients'),
      api('/api/dinero/contacts')
    ]);

    if (configRes.ok && configRes.data) state.config = configRes.data;
    if (clientsRes.ok && Array.isArray(clientsRes.data))
      state.togglClients = clientsRes.data;
    if (contactsRes.ok && Array.isArray(contactsRes.data))
      state.dineroContacts = contactsRes.data;

    state.dineroConnected = contactsRes.ok && Array.isArray(contactsRes.data);

    const dineroStatus = el('dinero-setup-status');
    if (dineroStatus) {
      if (state.dineroConnected) {
        const orgId =
          state.config.dineroOrgId ||
          (typeof process !== 'undefined' && process.env && process.env.DINERO_ORG_ID)
            ? '—'
            : '—';
        dineroStatus.textContent =
          '✓ Dinero connected — Org ID: ' +
          (state.config.dineroOrgId || 'see .env');
        dineroStatus.className = 'connected';
      } else {
        dineroStatus.textContent =
          '✗ Not connected — check your .env credentials';
        dineroStatus.className = 'failed';
      }
    }

    setPeriod('last-month');
    populateSetupFromConfig();
    renderMappingTable();
    renderClientSelect();

    const hasMappings =
      state.config.clientMappings &&
      Object.keys(state.config.clientMappings).length > 0;
    setupSectionCollapsed(hasMappings);
  }

  function renderClientSelect() {
    const select = el('client-select');
    if (!select) return;
    select.innerHTML = '<option value="">— Select client —</option>';
    const mappings = state.config.clientMappings || {};
    state.togglClients.forEach((client) => {
      const opt = document.createElement('option');
      opt.value = client.id;
      const mapped = !!mappings[client.id];
      opt.textContent = client.name + (mapped ? '' : ' (not mapped)');
      opt.disabled = !mapped;
      select.appendChild(opt);
    });
  }

  function bindSetup() {
    el('setup-expand-link') &&
      el('setup-expand-link').addEventListener('click', (e) => {
        e.preventDefault();
        setupSectionCollapsed(false);
      });
    el('setup-collapsed') &&
      el('setup-collapsed').addEventListener('click', (e) => {
        if (!e.target.closest('a')) setupSectionCollapsed(false);
      });

    el('btn-verify-toggl') &&
      el('btn-verify-toggl').addEventListener('click', async () => {
        const btn = el('btn-verify-toggl');
        const statusEl = el('toggl-status');
        btn.disabled = true;
        btn.textContent = 'Loading…';
        statusEl.textContent = '';
        statusEl.className = '';
        const res = await api('/api/toggl/workspace');
        if (res.ok && res.data) {
          state.togglVerified = true;
          state.togglVerifiedName = res.data.name || res.data.email || 'Connected';
          statusEl.textContent = '✓ Connected as ' + state.togglVerifiedName;
          statusEl.className = 'connected';
          btn.style.display = 'none';
        } else {
          statusEl.textContent =
            'Connection failed — check your token';
          statusEl.className = 'failed';
        }
        btn.disabled = false;
        btn.textContent = 'Verify Connection';
      });

    el('btn-save-setup') &&
      el('btn-save-setup').addEventListener('click', async () => {
        const btn = el('btn-save-setup');
        const errEl = el('setup-save-error');
        hide(errEl);
        const defaultAccountNumber = parseInt(
          el('default-account').value || '1000',
          10
        );
        const defaultCurrency = el('default-currency').value || 'DKK';
        const clientMappings = getMappingFromForm();
        btn.disabled = true;
        const res = await api('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            defaultAccountNumber,
            defaultCurrency,
            clientMappings
          })
        });
        if (res.ok) {
          state.config = {
            ...state.config,
            defaultAccountNumber,
            defaultCurrency,
            clientMappings
          };
          renderClientSelect();
          setupSectionCollapsed(true);
        } else {
          errEl.textContent =
            (res.data && res.data.error) || 'Failed to save setup';
          show(errEl);
        }
        btn.disabled = false;
      });
  }

  function bindPeriodAndLoad() {
    document.querySelectorAll('.period-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const period = btn.getAttribute('data-period');
        if (period === 'custom') {
          show(el('custom-dates'));
        } else {
          hide(el('custom-dates'));
          setPeriod(period);
        }
      });
    });

    el('client-select') &&
      el('client-select').addEventListener('change', () => {
        state.selectedClientId = el('client-select').value || null;
      });

    el('btn-load-hours') &&
      el('btn-load-hours').addEventListener('click', async () => {
        const clientId = state.selectedClientId || el('client-select').value;
        if (!clientId) return;
        const { start, end } = getDateRange();
        if (!start || !end) return;
        const btn = el('btn-load-hours');
        btn.disabled = true;
        btn.classList.add('loading');
        btn.textContent = 'Loading…';
        const res = await api('/api/toggl/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, startDate: start, endDate: end })
        });
        btn.classList.remove('loading');
        btn.textContent = 'Load Hours →';
        btn.disabled = false;
        if (res.ok && res.data) {
          const client = state.togglClients.find((c) => String(c.id) === String(clientId));
          state.summaryClientName = (client && client.name) || res.data.client?.name || 'Client';
          state.summaryLines = (res.data.lines || []).map((l) => ({
            projectId: l.projectId,
            projectName: l.projectName,
            hours: l.hours,
            rate: state.config.defaultRates && state.config.defaultRates[l.projectId] != null
              ? state.config.defaultRates[l.projectId]
              : null,
            checked: true
          }));
          state.dateRange.start = start;
          state.dateRange.end = end;
          renderSection2();
          show(el('section-review'));
        }
      });
  }

  function renderSection2() {
    const title = el('review-title');
    const totalEl = el('review-total');
    const tbody = el('hours-tbody');
    if (title)
      title.textContent =
        state.summaryClientName +
        ' · ' +
        (state.dateRange.start || '') +
        ' – ' +
        (state.dateRange.end || '');
    const totalHours = state.summaryLines.reduce((s, l) => s + (l.checked ? l.hours : 0), 0);
    if (totalEl)
      totalEl.textContent =
        'Total tracked: ' + state.summaryLines.reduce((s, l) => s + l.hours, 0).toFixed(2) + 'h';
    if (!tbody) return;
    tbody.innerHTML = '';
    state.summaryLines.forEach((line, i) => {
      const tr = document.createElement('tr');
      if (!line.checked) tr.classList.add('unchecked');
      const rate = line.rate != null && line.rate !== '' ? Number(line.rate) : null;
      const subtotal =
        rate != null && line.hours != null
          ? (line.hours * rate).toFixed(2)
          : '—';
      tr.innerHTML =
        '<td><input type="checkbox" class="row-check" data-index="' +
        i +
        '" ' +
        (line.checked ? 'checked' : '') +
        '></td>' +
        '<td>' +
        escapeHtml(line.projectName || '') +
        '</td>' +
        '<td class="right mono">' +
        (line.hours != null ? Number(line.hours).toFixed(2) : '') +
        '</td>' +
        '<td class="right"><div class="rate-cell"><input type="number" class="rate-input" data-index="' +
        i +
        '" value="' +
        (rate != null ? rate : '') +
        '" placeholder="Enter rate" step="any" min="0"><span>DKK</span></div></td>' +
        '<td class="right mono subtotal-cell">' +
        subtotal +
        '</td>';
      tbody.appendChild(tr);
    });
    bindSection2Rows();
    updateReviewFooter();
    updateContinueButton();
  }

  function bindSection2Rows() {
    const tbody = el('hours-tbody');
    if (!tbody) return;
    tbody.querySelectorAll('.row-check').forEach((cb) => {
      cb.addEventListener('change', () => {
        const i = parseInt(cb.getAttribute('data-index'), 10);
        if (!isNaN(i) && state.summaryLines[i]) state.summaryLines[i].checked = cb.checked;
        const tr = cb.closest('tr');
        if (tr) tr.classList.toggle('unchecked', !cb.checked);
        updateReviewFooter();
        updateContinueButton();
      });
    });
    tbody.querySelectorAll('.rate-input').forEach((input) => {
      const updateSubtotal = () => {
        const i = parseInt(input.getAttribute('data-index'), 10);
        const line = state.summaryLines[i];
        if (!line) return;
        const rate = input.value === '' ? null : parseFloat(input.value);
        line.rate = rate;
        const subtotalCell = input.closest('tr').querySelector('.subtotal-cell');
        if (subtotalCell)
          subtotalCell.textContent =
            rate != null && line.hours != null
              ? (line.hours * rate).toFixed(2)
              : '—';
        updateReviewFooter();
        updateContinueButton();
      };
      input.addEventListener('input', updateSubtotal);
      input.addEventListener('change', updateSubtotal);
      input.addEventListener('blur', async () => {
        const i = parseInt(input.getAttribute('data-index'), 10);
        const line = state.summaryLines[i];
        if (!line || input.value === '') return;
        const rate = parseFloat(input.value);
        if (isNaN(rate)) return;
        const res = await api('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            defaultRates: { [line.projectId]: rate }
          })
        });
        if (res.ok) {
          state.config.defaultRates = state.config.defaultRates || {};
          state.config.defaultRates[line.projectId] = rate;
        }
      });
    });
  }

  function updateReviewFooter() {
    const checked = state.summaryLines.filter((l) => l.checked);
    const totalH = checked.reduce((s, l) => s + (l.hours || 0), 0);
    const totalMoney = checked.reduce(
      (s, l) => s + (l.rate != null ? (l.hours || 0) * l.rate : 0),
      0
    );
    const meta = el('review-selected');
    const totalLine = el('review-subtotal');
    if (meta) meta.textContent = `Selected: ${checked.length} projects · ${totalH.toFixed(2)}h total`;
    if (totalLine)
      totalLine.textContent = 'Subtotal excl. VAT: ' + totalMoney.toFixed(2) + ' DKK';
  }

  function updateContinueButton() {
    const btn = el('btn-continue');
    const errEl = el('review-continue-error');
    if (!btn) return;
    const checked = state.summaryLines.filter((l) => l.checked);
    const anyWithoutRate = checked.some(
      (l) => l.rate == null || l.rate === '' || isNaN(Number(l.rate))
    );
    const disabled = checked.length === 0 || anyWithoutRate;
    btn.disabled = disabled;
    hide(errEl);
  }

  el('btn-continue') &&
    el('btn-continue').addEventListener('click', () => {
      const checked = state.summaryLines.filter((l) => l.checked);
      const anyWithoutRate = checked.some(
        (l) => l.rate == null || l.rate === '' || isNaN(Number(l.rate))
      );
      if (checked.length === 0 || anyWithoutRate) {
        const errEl = el('review-continue-error');
        errEl.textContent =
          'Please check at least one project and enter a rate for all selected rows.';
        show(errEl);
        return;
      }
      state.invoiceDate = state.dateRange.end || '';
      state.currency = state.config.defaultCurrency || 'DKK';
      state.description = '';
      renderSection3();
      show(el('section-invoice'));
      el('invoice-date').value = state.invoiceDate;
      el('invoice-currency').value = state.currency;
      el('invoice-description').value = state.description;
      updateCreateInvoiceButton();
      el('section-invoice').scrollIntoView({ behavior: 'smooth' });
    });

  function renderSection3() {
    const contactGuid =
      state.config.clientMappings &&
      state.selectedClientId &&
      state.config.clientMappings[state.selectedClientId];
    const contact = state.dineroContacts.find(
      (c) => (c.contactGuid || '') === (contactGuid || '')
    );
    el('invoice-contact-display').textContent = contact ? (contact.name || '—') : '—';
    el('invoice-date').value = state.invoiceDate || '';
    el('invoice-currency').value = state.currency || 'DKK';
    el('invoice-description').value = state.description || '';

    const tbody = el('invoice-lines-tbody');
    tbody.innerHTML = '';
    let total = 0;
    state.summaryLines
      .filter((l) => l.checked && l.rate != null)
      .forEach((line) => {
        const rowTotal = (line.hours || 0) * (line.rate || 0);
        total += rowTotal;
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' +
          escapeHtml(line.projectName || '') +
          '</td>' +
          '<td class="right mono">' +
          (line.hours != null ? Number(line.hours).toFixed(2) : '') +
          '</td>' +
          '<td class="right mono">' +
          (line.rate != null ? Number(line.rate).toFixed(2) : '') +
          '</td>' +
          '<td class="right mono">' +
          rowTotal.toFixed(2) +
          '</td>';
        tbody.appendChild(tr);
      });
    el('invoice-total-cell').textContent = total.toFixed(2) + ' DKK';
  }

  function updateCreateInvoiceButton() {
    const btn = el('btn-create-invoice');
    if (btn) btn.disabled = !el('invoice-date') || !el('invoice-date').value;
  }
  el('invoice-date') &&
    el('invoice-date').addEventListener('change', () => {
      state.invoiceDate = el('invoice-date').value;
      updateCreateInvoiceButton();
    });
  el('invoice-date') &&
    el('invoice-date').addEventListener('input', updateCreateInvoiceButton);
  el('invoice-currency') &&
    el('invoice-currency').addEventListener('change', () => {
      state.currency = el('invoice-currency').value;
    });
  el('invoice-description') &&
    el('invoice-description').addEventListener('change', () => {
      state.description = el('invoice-description').value;
    });

  el('btn-create-invoice') &&
    el('btn-create-invoice').addEventListener('click', async () => {
      const invoiceDate = el('invoice-date').value;
      if (!invoiceDate) return;
      const contactGuid =
        state.config.clientMappings &&
        state.config.clientMappings[state.selectedClientId];
      if (!contactGuid) return;
      const lines = state.summaryLines
        .filter((l) => l.checked && l.rate != null)
        .map((l) => ({
          projectName: l.projectName,
          hours: l.hours,
          ratePerHour: l.rate
        }));
      const btn = el('btn-create-invoice');
      const resultEl = el('invoice-result');
      resultEl.classList.remove('success', 'error');
      hide(resultEl);
      resultEl.innerHTML = '';
      btn.disabled = true;
      btn.classList.add('loading');
      btn.textContent = 'Creating…';
      const res = await api('/api/dinero/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactGuid,
          invoiceDate,
          currency: state.currency || 'DKK',
          description: el('invoice-description').value || '',
          lines
        })
      });
      btn.classList.remove('loading');
      btn.textContent = 'Create Draft in Dinero';
      btn.disabled = false;
      if (res.ok && res.data && res.data.success) {
        resultEl.className = 'success';
        resultEl.innerHTML =
          '<p>✓ Draft invoice created in Dinero</p>' +
          '<p><a href="' +
          escapeHtml(res.data.dineroUrl || '#') +
          '" target="_blank" rel="noopener">Open in Dinero →</a></p>' +
          '<p class="hint">Review and book the invoice in Dinero to complete billing.</p>';
        show(resultEl);
        btn.style.display = 'none';
      } else {
        resultEl.className = 'error';
        resultEl.innerHTML =
          '<p>Error creating invoice: ' +
          escapeHtml((res.data && res.data.error) || 'Unknown error') +
          '</p>';
        show(resultEl);
      }
    });

  function init() {
    bindSetup();
    bindPeriodAndLoad();
    loadInitialData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
