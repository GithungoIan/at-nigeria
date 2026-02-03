require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const bodyParser = require('body-parser');

const airtimeRoutes = require('./airtime/routes');
// const dataRoutes = require('./data/routes');
const ussdRoutes = require('./ussd/routes');
const voiceRoutes = require('./voice/routes');
const eventUssdRoutes = require('./ussd/examples/eventRegistration');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    body: req.body,
    query: req.query
  });
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Africa\'s Talking Workshop API',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/airtime', airtimeRoutes);
// app.use('/api/data', dataRoutes);
app.use('/ussd', ussdRoutes);
app.use('/ussd/event', eventUssdRoutes);
app.use('/voice', voiceRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📚 Workshop API Ready!`);
});

module.exports = app;