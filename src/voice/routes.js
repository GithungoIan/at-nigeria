const express = require('express');
const router = express.Router();
const voiceService = require('./service');
const logger = require('../utils/logger');

router.post('/', (req, res) => {
  try {
    const callData = req.body;

    logger.info('Voice callback received', { callData });

    const { sessionId, isActive, direction } = callData;

    // Handle incoming call
    if (direction === 'Inbound' && isActive === '1') {
      const response = voiceService.generateSupportIvr();
      return res.json(response);
    }

    // Handle call status updates
    voiceService.processCallStatus(callData);

    // Default response
    res.json({
      actions: [
        {
          say: { text: 'Thank you for calling. Goodbye.' }
        }
      ]
    });
  } catch (error) {
    logger.error('Error in voice callback', { error: error.message });
    res.json({
      actions: [
        {
          say: { text: 'An error occurred. Please try again later.' }
        }
      ]
    });
  }
});

router.post('/make-call', async (req, res) => {
  try {
    const { to, from } = req.body;

    if (!to || !from) {
      return res.status(400).json({
        status: 'error',
        message: 'Both "to" and "from" phone numbers are required'
      });
    }

    const result = await voiceService.makeCall(to, from);

    res.status(200).json({
      status: 'success',
      message: 'Call initiated',
      data: result.data
    });
  } catch (error) {
    logger.error('Error making call', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to make call',
      error: error.message
    });
  }
});

router.post('/support-menu', (req, res) => {
  try {
    const { dtmfDigits } = req.body;

    logger.info('Support menu selection', { dtmfDigits });

    const menuOptions = {
      '1': {
        response: {
          actions: [
            {
              say: { text: 'Connecting you to technical support.' },
              dial: {
                phoneNumbers: ['+2348000000001'],
                record: true,
                sequential: true
              }
            }
          ]
        }
      },
      '2': {
        response: {
          actions: [
            {
              say: { text: 'Connecting you to billing department.' },
              dial: {
                phoneNumbers: ['+2348000000002'],
                record: true,
                sequential: true
              }
            }
          ]
        }
      },
      '3': {
        response: {
          actions: [
            {
              say: { text: 'For general inquiries, please visit our website or send us an email.' }
            }
          ]
        }
      },
      '0': {
        response: voiceService.enqueueCall('support')
      }
    };

    const response = voiceService.handleDtmfInput(dtmfDigits, menuOptions);
    res.json(response);
  } catch (error) {
    logger.error('Error handling support menu', { error: error.message });
    res.json({
      actions: [
        {
          say: { text: 'An error occurred. Please try again.' }
        }
      ]
    });
  }
});


router.post('/otp-verification', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone number is required'
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // In production: Store OTP in Redis with expiration
    // await redis.setex(`otp:voice:${phoneNumber}`, 600, otp);

    // Make call with OTP
    const result = await voiceService.makeCall(
      phoneNumber,
      process.env.VOICE_PHONE_NUMBER
    );

    // Store OTP for callback
    // When the call connects, the /voice endpoint will be hit
    // and we can retrieve the OTP to play

    res.status(200).json({
      status: 'success',
      message: 'OTP call initiated',
      otp: otp, // Only for demo - never return in production!
      data: result.data
    });
  } catch (error) {
    logger.error('Error sending OTP call', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to send OTP call',
      error: error.message
    });
  }
});


router.post('/callback-request', (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone number is required'
      });
    }

    // In production: Queue the callback request
    // await queueCallbackRequest(phoneNumber);

    logger.info('Callback requested', { phoneNumber });

    res.status(200).json({
      status: 'success',
      message: 'Callback request received. We will call you shortly.'
    });
  } catch (error) {
    logger.error('Error processing callback request', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to process callback request',
      error: error.message
    });
  }
});


router.post('/recording-complete', (req, res) => {
  try {
    const { recordingUrl, durationInSeconds, sessionId } = req.body;

    logger.info('Recording completed', {
      sessionId,
      recordingUrl,
      duration: durationInSeconds
    });

    // In production: Store recording URL in database
    // await saveRecording(sessionId, recordingUrl, durationInSeconds);

    res.json({
      actions: [
        {
          say: { text: 'Thank you for your message. We will get back to you soon.' }
        }
      ]
    });
  } catch (error) {
    logger.error('Error processing recording', { error: error.message });
    res.json({
      actions: [
        {
          say: { text: 'Recording saved. Thank you.' }
        }
      ]
    });
  }
});


router.post('/leave-message', (req, res) => {
  try {
    const response = voiceService.generateRecordingPrompt(
      'Please leave your message after the beep. Press hash when done.',
      60 // 60 seconds max
    );

    res.json(response);
  } catch (error) {
    logger.error('Error in leave message', { error: error.message });
    res.json({
      actions: [
        {
          say: { text: 'Unable to record message at this time.' }
        }
      ]
    });
  }
});


router.get('/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'Voice endpoint is working',
    endpoints: [
      'POST /voice - Main callback',
      'POST /voice/make-call - Make outbound call',
      'POST /voice/support-menu - Handle IVR menu',
      'POST /voice/otp-verification - Send OTP via call',
      'POST /voice/callback-request - Request callback',
      'POST /voice/recording-complete - Handle recording',
      'POST /voice/leave-message - Voice mail'
    ]
  });
});

module.exports = router;
