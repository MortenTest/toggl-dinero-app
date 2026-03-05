#!/usr/bin/env node
/**
 * Quick test: verify Toggl API token and (optionally) workspace ID.
 * Run from project root: node scripts/test-toggl-credentials.js
 * Loads .env from project root so TOGGL_API_TOKEN and TOGGL_WORKSPACE_ID are used.
 */
const path = require('path');
const fs = require('fs');

// Load .env from project root
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const token = process.env.TOGGL_API_TOKEN;
const workspaceIdEnv = process.env.TOGGL_WORKSPACE_ID;

if (!token) {
  console.error('Missing TOGGL_API_TOKEN. Set it in .env or pass TOGGL_API_TOKEN=xxx');
  process.exit(1);
}

const axios = require('axios');
const authHeader = 'Basic ' + Buffer.from(`${token}:api_token`).toString('base64');

async function main() {
  console.log('Testing Toggl API credentials...\n');

  try {
    const res = await axios.get('https://api.track.toggl.com/api/v9/me', {
      headers: { Authorization: authHeader },
    });
    const me = res.data;
    console.log('Token is valid.');
    console.log('  Email:', me.email || '(none)');
    console.log('  Name:', me.fullname || me.name || '(none)');
    console.log('  Default workspace ID (from API):', me.default_workspace_id || me.default_wid || '(none)');

    const workspaces = me.workspaces || [];
    console.log('  Workspaces:', workspaces.length);
    workspaces.forEach((w) => {
      const id = w.id ?? w.wid;
      const name = w.name || '(unnamed)';
      const mark = workspaceIdEnv && String(id) === String(workspaceIdEnv) ? '  <-- matches TOGGL_WORKSPACE_ID' : '';
      console.log('    -', id, name, mark);
    });

    const defaultId = me.default_workspace_id ?? me.default_wid ?? (workspaces[0] && (workspaces[0].id ?? workspaces[0].wid));
    if (workspaceIdEnv) {
      const found = workspaces.some((w) => String(w.id ?? w.wid) === String(workspaceIdEnv));
      if (found) {
        console.log('\nTOGGL_WORKSPACE_ID (' + workspaceIdEnv + ') is valid and in your workspaces.');
      } else {
        console.log('\nTOGGL_WORKSPACE_ID (' + workspaceIdEnv + ') is not in your workspace list. Use one of the IDs above.');
      }
    } else {
      console.log('\nTip: Set TOGGL_WORKSPACE_ID in .env to', defaultId, 'to use your default workspace.');
    }

    console.log('\nCredentials OK. You can use this token and workspace ID in the app.');
  } catch (err) {
    if (err.response) {
      console.error('Toggl API error:', err.response.status, err.response.statusText);
      if (err.response.data) console.error('Body:', JSON.stringify(err.response.data).slice(0, 300));
    } else {
      console.error('Request failed:', err.message);
    }
    process.exit(1);
  }
}

main();
