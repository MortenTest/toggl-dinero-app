const axios = require('axios');

let cachedToken = null;
let cachedExpiry = 0;

const BUFFER_SECONDS = 60;

async function getDineroToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedExpiry > now + BUFFER_SECONDS) {
    return cachedToken;
  }

  const clientId = process.env.DINERO_CLIENT_ID;
  const clientSecret = process.env.DINERO_CLIENT_SECRET;
  const apiKey = process.env.DINERO_API_KEY;

  if (!clientId || !clientSecret || !apiKey) {
    throw new Error('DINERO_CLIENT_ID, DINERO_CLIENT_SECRET and DINERO_API_KEY must be set');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('scope', 'read write');
  params.append('username', apiKey);
  params.append('password', apiKey);

  const response = await axios.post(
    'https://authz.dinero.dk/dineroapi/oauth/token',
    params.toString(),
    {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  ).catch((err) => {
    const message =
      err.response?.data?.error_description ||
      err.response?.data?.error ||
      err.response?.data?.message ||
      (typeof err.response?.data === 'string' ? err.response.data : null) ||
      err.message;
    throw new Error(message || 'Failed to obtain Dinero token');
  });

  const data = response.data;
  const accessToken = data.access_token;
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;

  if (!accessToken) {
    throw new Error('No access_token in Dinero token response');
  }

  cachedToken = accessToken;
  cachedExpiry = now + expiresIn;

  return cachedToken;
}

module.exports = { getDineroToken };
