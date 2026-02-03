const express = require('express');
const router = express.Router();
const { createLendingApp } = require('./lendingApp');
const logger = require('../utils/logger');

// Initialize the lending app state machine
const lendingApp = createLendingApp();

router.post('/', async (req, res) => {
  try {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;

    logger.info('USSD request received', {
      sessionId,
      serviceCode,
      phoneNumber,
      text
    });

    // Validate required fields
    if (!sessionId || !phoneNumber) {
      return res.status(400).send('END Invalid request');
    }

    // Process the request using state machine
    const response = await lendingApp.processRequest({
      sessionId,
      serviceCode,
      phoneNumber,
      text: text || ''
    });

    logger.info('USSD response', {
      sessionId,
      response: response.substring(0, 100) // Log first 100 chars
    });

    // Send response
    res.set('Content-Type', 'text/plain');
    res.send(response);
  } catch (error) {
    logger.error('Error processing USSD request', {
      error: error.message,
      stack: error.stack
    });

    // Send error response
    res.set('Content-Type', 'text/plain');
    res.send('END An error occurred. Please try again.');
  }
});


router.get('/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'USSD endpoint is working',
    instructions: 'POST to /ussd with sessionId, serviceCode, phoneNumber, and text'
  });
});


router.post('/simulator', async (req, res) => {
  try {
    const { phoneNumber, input } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone number is required'
      });
    }

    // Generate session ID for simulation
    const sessionId = `sim_${Date.now()}`;
    const serviceCode = '*384*1234#';

    const response = await lendingApp.processRequest({
      sessionId,
      serviceCode,
      phoneNumber,
      text: input || ''
    });

    res.json({
      status: 'success',
      sessionId,
      response,
      isEnd: response.startsWith('END'),
      isContinue: response.startsWith('CON')
    });
  } catch (error) {
    logger.error('Error in USSD simulator', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Simulator error',
      error: error.message
    });
  }
});

module.exports = router;
