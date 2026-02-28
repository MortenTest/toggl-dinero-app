const path = require('path');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const togglRouter = require('./routes/toggl');
const configRouter = require('./routes/config');

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

app.use('/api/toggl', togglRouter);
app.use('/api', configRouter);

app.use((err, req, res, next) => {
  console.error('Unhandled error middleware:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

