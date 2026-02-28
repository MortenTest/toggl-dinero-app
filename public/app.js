function setDefaultDateRange() {
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');

  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfPreviousMonth = new Date(firstOfThisMonth.getTime() - 1);

  const firstOfPreviousMonth = new Date(
    lastOfPreviousMonth.getFullYear(),
    lastOfPreviousMonth.getMonth(),
    1
  );

  const toIsoDate = (d) => d.toISOString().slice(0, 10);

  startInput.value = toIsoDate(firstOfPreviousMonth);
  endInput.value = toIsoDate(lastOfPreviousMonth);
}

async function connectToToggl() {
  const output = document.getElementById('workspace-info');
  output.textContent = 'Connecting...';

  try {
    const res = await fetch('/api/toggl/workspace');
    const data = await res.json();

    if (!res.ok) {
      output.textContent = `Error: ${data.error || 'Unknown error'}`;
      return;
    }

    output.textContent = JSON.stringify(data, null, 2);

    await loadClients();
  } catch (err) {
    console.error(err);
    output.textContent = 'Error connecting to Toggl.';
  }
}

async function loadClients() {
  const select = document.getElementById('client-select');

  select.innerHTML = '<option value="">Loading…</option>';

  try {
    const res = await fetch('/api/toggl/clients');
    const data = await res.json();

    if (!res.ok) {
      select.innerHTML = `<option value="">Error: ${
        data.error || 'Failed to load clients'
      }</option>`;
      return;
    }

    select.innerHTML = '<option value="">-- Select client --</option>';

    data.forEach((client) => {
      const opt = document.createElement('option');
      opt.value = client.id;
      opt.textContent = client.name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    select.innerHTML = '<option value="">Error loading clients</option>';
  }
}

function renderSummaryTable(lines) {
  const tbody = document.querySelector('#summary-table tbody');
  tbody.innerHTML = '';

  if (!Array.isArray(lines) || lines.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2;
    td.textContent = 'No data.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  lines.forEach((line) => {
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    const hoursTd = document.createElement('td');

    nameTd.textContent = line.projectName || '(Unnamed project)';
    hoursTd.textContent =
      typeof line.hours === 'number' ? line.hours.toFixed(2) : line.hours;

    tr.appendChild(nameTd);
    tr.appendChild(hoursTd);
    tbody.appendChild(tr);
  });
}

async function loadHours() {
  const clientSelect = document.getElementById('client-select');
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');
  const rawOutput = document.getElementById('summary-raw');

  const clientId = clientSelect.value;
  const startDate = startInput.value;
  const endDate = endInput.value;

  if (!clientId) {
    alert('Please select a client.');
    return;
  }

  if (!startDate || !endDate) {
    alert('Please choose a start and end date.');
    return;
  }

  rawOutput.textContent = 'Loading...';

  try {
    const res = await fetch('/api/toggl/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ clientId, startDate, endDate })
    });

    const data = await res.json();

    if (!res.ok) {
      rawOutput.textContent = `Error: ${data.error || 'Unknown error'}`;
      renderSummaryTable([]);
      return;
    }

    rawOutput.textContent = JSON.stringify(data, null, 2);
    renderSummaryTable(data.lines || []);
  } catch (err) {
    console.error(err);
    rawOutput.textContent = 'Error loading summary.';
    renderSummaryTable([]);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setDefaultDateRange();

  document
    .getElementById('connect-btn')
    .addEventListener('click', connectToToggl);

  document
    .getElementById('load-clients-btn')
    .addEventListener('click', loadClients);

  document
    .getElementById('load-hours-btn')
    .addEventListener('click', loadHours);
});

