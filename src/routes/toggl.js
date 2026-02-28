const express = require('express');
const axios = require('axios');
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

function getAuthHeader() {
  const token = process.env.TOGGL_API_TOKEN;
  if (!token) {
    throw new Error('TOGGL_API_TOKEN is not set');
  }
  const base64 = Buffer.from(`${token}:api_token`).toString('base64');
  return `Basic ${base64}`;
}

async function fetchMe() {
  const response = await axios.get('https://api.track.toggl.com/api/v9/me', {
    headers: {
      Authorization: getAuthHeader()
    }
  });
  return response.data;
}

function extractWorkspaceIdFromMe(me) {
  if (!me) return null;
  if (me.default_workspace_id) return me.default_workspace_id;
  if (me.default_wid) return me.default_wid;
  if (Array.isArray(me.workspaces) && me.workspaces.length > 0) {
    return me.workspaces[0].id || me.workspaces[0].wid || null;
  }
  return null;
}

async function ensureWorkspaceId() {
  const config = readConfig();

  if (config.togglWorkspaceId) {
    return { workspaceId: config.togglWorkspaceId, config };
  }

  const me = await fetchMe();
  const workspaceId = extractWorkspaceIdFromMe(me);

  if (!workspaceId) {
    throw new Error('Unable to determine Toggl workspace ID from /me response');
  }

  const updatedConfig = {
    ...config,
    togglWorkspaceId: workspaceId
  };
  writeConfig(updatedConfig);

  return { workspaceId, config: updatedConfig, me };
}

router.get('/workspace', async (req, res) => {
  try {
    const me = await fetchMe();
    const workspaceId = extractWorkspaceIdFromMe(me);

    if (!workspaceId) {
      return res
        .status(500)
        .json({ error: 'Unable to determine Toggl workspace ID.' });
    }

    const config = readConfig();
    if (!config.togglWorkspaceId || config.togglWorkspaceId !== workspaceId) {
      writeConfig({ ...config, togglWorkspaceId: workspaceId });
    }

    res.json({
      workspaceId,
      email: me.email,
      name: me.fullname || me.name || null
    });
  } catch (err) {
    console.error('Error fetching Toggl workspace', err.response?.data || err);
    res
      .status(500)
      .json({ error: 'Failed to fetch Toggl workspace information.' });
  }
});

router.get('/clients', async (req, res) => {
  try {
    const { workspaceId } = await ensureWorkspaceId();

    const response = await axios.get(
      `https://api.track.toggl.com/api/v9/workspaces/${workspaceId}/clients`,
      {
        headers: {
          Authorization: getAuthHeader()
        }
      }
    );

    const clients = (response.data || []).map((c) => ({
      id: c.id,
      name: c.name
    }));

    res.json(clients);
  } catch (err) {
    console.error('Error fetching Toggl clients', err.response?.data || err);
    res.status(500).json({ error: 'Failed to fetch Toggl clients.' });
  }
});

router.post('/summary', async (req, res) => {
  try {
    const { clientId, startDate, endDate } = req.body || {};

    if (!clientId || !startDate || !endDate) {
      return res.status(400).json({
        error: 'clientId, startDate and endDate are required.'
      });
    }

    const { workspaceId } = await ensureWorkspaceId();

    const body = {
      start_date: startDate,
      end_date: endDate,
      client_ids: [parseInt(clientId, 10)],
      grouping: 'clients',
      sub_grouping: 'projects',
      include_time_entry_ids: false
    };

    const response = await axios.post(
      `https://api.track.toggl.com/reports/api/v3/workspace/${workspaceId}/summary/time_entries`,
      body,
      {
        headers: {
          Authorization: getAuthHeader(),
          'Content-Type': 'application/json'
        }
      }
    );

    const data = response.data || {};
    const groups = data.groups || data.items || [];

    const firstGroup = Array.isArray(groups) && groups.length > 0 ? groups[0] : null;

    const clientInfo = firstGroup && firstGroup.group
      ? {
          id: firstGroup.group.id,
          name: firstGroup.group.name
        }
      : {
          id: clientId,
          name: null
        };

    const subGroups =
      (firstGroup && (firstGroup.sub_groups || firstGroup.subgroups)) || [];

    const lines = subGroups.map((sg) => {
      const projectId =
        (sg.group && (sg.group.id || sg.group.project_id)) ||
        sg.project_id ||
        sg.id;
      const projectName =
        (sg.group && (sg.group.name || sg.group.project_name)) ||
        sg.project_name ||
        sg.name;

      const seconds =
        (sg.summary && (sg.summary.seconds || sg.summary.tracked_seconds)) ||
        sg.seconds ||
        sg.tracked_seconds ||
        0;

      const hours = Math.round((seconds / 3600) * 100) / 100;

      return {
        projectId,
        projectName,
        hours
      };
    });

    res.json({
      client: clientInfo,
      lines
    });
  } catch (err) {
    console.error('Error fetching Toggl summary', err.response?.data || err);
    res.status(500).json({ error: 'Failed to fetch Toggl summary report.' });
  }
});

module.exports = router;

