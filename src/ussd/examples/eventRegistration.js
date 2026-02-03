
const express = require('express');
const router = express.Router();

const registrations = new Map();
const checkedIn = new Set();

router.post('/', (req, res) => {
  const { sessionId, phoneNumber, text } = req.body;

  const inputs = text ? text.split('*') : [];
  const level = inputs.length;

  let response = '';

  if (text === '') {
    response = `CON Welcome to AT-GOOGLE NIGERIA!

1. Register for Event
2. Check-in (Already Registered)
3. View My Registration
4. Event Info`;
  }

  else if (level === 1) {
    const choice = inputs[0];

    if (choice === '1') {
      // Start registration - ask for name
      response = `CON Enter your full name:`;
    }
    else if (choice === '2') {
      // Check-in flow - ask for ticket number
      response = `CON Enter your ticket number:`;
    }
    else if (choice === '3') {
      // View registration
      const registration = registrations.get(phoneNumber);
      if (registration) {
        response = `END Your Registration:

Name: ${registration.name}
Email: ${registration.email}
Ticket: ${registration.ticketNo}
Status: ${checkedIn.has(registration.ticketNo) ? 'Checked In' : 'Not Checked In'}`;
      } else {
        response = `END You are not registered yet.

Dial again and select option 1 to register.`;
      }
    }
    else if (choice === '4') {
      // Event info
      response = `END AT-GOOGLE NIGERIA

Date: March 15, 2024
Time: 9:00 AM - 5:00 PM
Venue: Go MY CODE

Contact: developerexperience@africastalking.com`;
    }
    else {
      response = `END Invalid option. Please try again.`;
    }
  }


  else if (level === 2) {
    const choice = inputs[0];

    if (choice === '1') {
      // Registration flow - got name, ask for email
      const name = inputs[1];

      if (name.trim().length < 2) {
        response = `END Invalid name. Please try again.`;
      } else {
        response = `CON Hi ${name}!

Enter your email address:`;
      }
    }
    else if (choice === '2') {
      // Check-in flow - verify ticket
      const ticketNo = inputs[1].toUpperCase();

      // Find registration by ticket number
      let found = null;
      for (const [phone, reg] of registrations) {
        if (reg.ticketNo === ticketNo) {
          found = { phone, ...reg };
          break;
        }
      }

      if (!found) {
        response = `END Ticket ${ticketNo} not found.

Please check your ticket number and try again.`;
      }
      else if (checkedIn.has(ticketNo)) {
        response = `END Already checked in!

Name: ${found.name}
Ticket: ${ticketNo}

Enjoy the event!`;
      }
      else {
        response = `CON Found: ${found.name}

Confirm check-in?
1. Yes, check me in
2. No, cancel`;
      }
    }
  }

  else if (level === 3) {
    const choice = inputs[0];

    if (choice === '1') {
      // Registration flow - got email, ask for confirmation
      const name = inputs[1];
      const email = inputs[2];

      // Simple email validation
      if (!email.includes('@') || !email.includes('.')) {
        response = `END Invalid email address.

Please try again with a valid email.`;
      } else {
        response = `CON Confirm Registration:

Name: ${name}
Email: ${email}
Phone: ${phoneNumber}

1. Confirm
2. Cancel`;
      }
    }
    else if (choice === '2') {
      // Check-in confirmation
      const ticketNo = inputs[1].toUpperCase();
      const confirm = inputs[2];

      if (confirm === '1') {
        checkedIn.add(ticketNo);
        response = `END Check-in successful!

Ticket: ${ticketNo}

Welcome to AT-GOOGLE NIGERIA!
Please proceed to the main hall.`;
      } else {
        response = `END Check-in cancelled.

Dial again when you're ready.`;
      }
    }
  }

  else if (level === 4) {
    const choice = inputs[0];

    if (choice === '1') {
      const name = inputs[1];
      const email = inputs[2];
      const confirm = inputs[3];

      if (confirm === '1') {
        // Generate ticket number
        const ticketNo = 'TC' + Date.now().toString().slice(-6);

        // Save registration
        registrations.set(phoneNumber, {
          name,
          email,
          ticketNo,
          registeredAt: new Date()
        });

        response = `END Registration Successful!

Name: ${name}
Ticket: ${ticketNo}

Save your ticket number for check-in.
See you at AT-GOOGLE NIGERIA!`;
      } else {
        response = `END Registration cancelled.

Dial again to start over.`;
      }
    }
  }

  else {
    response = `END Session error. Please try again.`;
  }

  // Send response
  res.set('Content-Type', 'text/plain');
  res.send(response);
});


router.get('/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'Event USSD is working',
    example: {
      endpoint: 'POST /ussd/event',
      body: {
        sessionId: 'unique-session-id',
        phoneNumber: '+2348012345678',
        text: ''
      }
    }
  });
});


router.get('/registrations', (req, res) => {
  const all = [];
  for (const [phone, reg] of registrations) {
    all.push({
      phone,
      ...reg,
      checkedIn: checkedIn.has(reg.ticketNo)
    });
  }
  res.json({ registrations: all });
});

module.exports = router;

