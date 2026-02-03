const { UssdStateMachine, UssdMenuBuilder, Validators } = require('./stateMachine');
const logger = require('../utils/logger');


// Mock database functions (replace with actual DB in production)
const mockDb = {
  users: new Map(),
  loans: new Map(),

  getUserByPhone: async (phoneNumber) => {
    return mockDb.users.get(phoneNumber) || null;
  },

  createUser: async (phoneNumber, data) => {
    const user = {
      phoneNumber,
      ...data,
      createdAt: new Date(),
      balance: 0,
      loanLimit: 5000
    };
    mockDb.users.set(phoneNumber, user);
    return user;
  },

  updateUser: async (phoneNumber, updates) => {
    const user = mockDb.users.get(phoneNumber);
    if (user) {
      Object.assign(user, updates);
      mockDb.users.set(phoneNumber, user);
    }
    return user;
  },

  createLoanApplication: async (phoneNumber, loanData) => {
    const loanId = `LOAN${Date.now()}`;
    const loan = {
      id: loanId,
      phoneNumber,
      ...loanData,
      status: 'pending',
      appliedAt: new Date()
    };
    mockDb.loans.set(loanId, loan);
    return loan;
  },

  getLoansByPhone: async (phoneNumber) => {
    return Array.from(mockDb.loans.values())
      .filter(loan => loan.phoneNumber === phoneNumber);
  },

  approveLoan: async (loanId) => {
    const loan = mockDb.loans.get(loanId);
    if (loan) {
      loan.status = 'approved';
      loan.approvedAt = new Date();

      // Update user balance
      const user = await mockDb.getUserByPhone(loan.phoneNumber);
      if (user) {
        user.balance += loan.amount;
        await mockDb.updateUser(loan.phoneNumber, user);
      }
    }
    return loan;
  }
};


function createLendingApp() {
  const machine = new UssdStateMachine();
  const builder = new UssdMenuBuilder(machine);

  // Set home as default state
  machine.setDefaultState('home');
  builder
    .menu('home', 'Welcome to QuickCash Loans')
    .option('1', 'Apply for Loan', 'check_eligibility')
    .option('2', 'Check Balance', 'check_balance')
    .option('3', 'Loan History', 'loan_history')
    .option('4', 'Repay Loan', 'repay_menu')
    .option('5', 'Help', 'help')
    .done();

  // Check Eligibility - determines if user can apply
  builder.dynamic('check_eligibility', async (session, phoneNumber) => {
    const user = await mockDb.getUserByPhone(phoneNumber);

    if (!user) {
      // Not registered - redirect to registration
      session.currentState = 'register_prompt';
      return 'CON You are not registered.\n\n1. Register Now\n2. Back to Menu';
    }

    // Check for active loans
    const activeLoans = (await mockDb.getLoansByPhone(phoneNumber))
      .filter(loan => loan.status === 'active' || loan.status === 'pending');

    if (activeLoans.length > 0) {
      return 'END You have an active loan. Please repay before applying for a new one.';
    }

    // Eligible - proceed to loan amount
    session.data.loanLimit = user.loanLimit;
    session.currentState = 'loan_amount';

    return `CON You are eligible for up to NGN ${user.loanLimit}.\n\nEnter loan amount:`;
  });

  // Registration prompt menu
  builder
    .menu('register_prompt', 'You are not registered.')
    .option('1', 'Register Now', 'register_name')
    .option('2', 'Back to Menu', 'home')
    .done();


  // Step 1: Get full name
  builder.input('register_name', 'Enter your full name:', {
    validate: Validators.notEmpty,
    storeAs: 'fullName',
    handler: async (session, input, phoneNumber) => {
      // Move to next step
      session.currentState = 'register_id';
      return 'CON Enter your National ID number (NIN):';
    }
  });

  // Step 2: Get National ID
  builder.input('register_id', 'Enter your National ID number (NIN):', {
    validate: (input) => {
      // Nigerian NIN is 11 digits
      const valid = /^\d{11}$/.test(input);
      return {
        valid,
        message: 'Invalid NIN. Please enter 11 digits:',
        value: valid ? input : null
      };
    },
    storeAs: 'idNumber',
    handler: async (session, input, phoneNumber) => {
      // Create user account with stored data
      const user = await mockDb.createUser(phoneNumber, {
        fullName: session.data.fullName,
        idNumber: session.data.idNumber
      });

      logger.info('New user registered', { phoneNumber, fullName: user.fullName });

      return `END Congratulations ${user.fullName}!\n\nYou are now registered.\nYou can borrow up to NGN ${user.loanLimit}.\n\nDial again to apply for a loan.`;
    }
  });


  // Loan Amount Input
  builder.input('loan_amount', 'Enter loan amount:', {
    validate: (input, session) => {
      const amount = parseFloat(input);
      const limit = session.data.loanLimit || 5000;
      const valid = !isNaN(amount) && amount >= 100 && amount <= limit;

      return {
        valid,
        message: `Invalid amount. Enter between NGN 100 and NGN ${limit}:`,
        value: valid ? amount : null
      };
    },
    storeAs: 'loanAmount',
    handler: async (session, input, phoneNumber) => {
      session.currentState = 'loan_period';
      return 'CON Select loan period:\n\n1. 7 days (10% interest)\n2. 14 days (15% interest)\n3. 30 days (20% interest)';
    }
  });

  // Loan Period Selection
  builder.input('loan_period', 'Select loan period:\n\n1. 7 days (10%)\n2. 14 days (15%)\n3. 30 days (20%)', {
    validate: Validators.choice(['1', '2', '3']),
    handler: async (session, input, phoneNumber) => {
      const periodMap = {
        '1': { days: 7, rate: 0.10, label: '7 days' },
        '2': { days: 14, rate: 0.15, label: '14 days' },
        '3': { days: 30, rate: 0.20, label: '30 days' }
      };

      const period = periodMap[input];
      session.data.period = period;

      const amount = session.data.loanAmount;
      const interest = amount * period.rate;
      const total = amount + interest;

      session.data.interest = interest;
      session.data.totalRepayment = total;

      session.currentState = 'loan_confirm';

      return `CON Loan Summary:\nAmount: NGN ${amount.toLocaleString()}\nPeriod: ${period.label}\nInterest: NGN ${interest.toFixed(2)}\nTotal: NGN ${total.toFixed(2)}\n\n1. Confirm\n2. Cancel`;
    }
  });

  // Loan Confirmation
  builder.input('loan_confirm', 'Confirm loan?\n\n1. Confirm\n2. Cancel', {
    validate: Validators.choice(['1', '2']),
    handler: async (session, input, phoneNumber) => {
      if (input === '2') {
        return 'END Loan application cancelled.\n\nThank you for using QuickCash.';
      }

      // Create and approve loan
      const loan = await mockDb.createLoanApplication(phoneNumber, {
        amount: session.data.loanAmount,
        period: session.data.period,
        interest: session.data.interest,
        totalRepayment: session.data.totalRepayment
      });

      // Auto-approve for demo
      await mockDb.approveLoan(loan.id);

      logger.info('Loan approved', { loanId: loan.id, phoneNumber, amount: loan.amount });

      return `END Congratulations!\n\nYour loan of NGN ${loan.amount.toLocaleString()} has been approved.\n\nLoan ID: ${loan.id}\n\nFunds will be sent to your account within 5 minutes.`;
    }
  });


  // Check Balance
  builder.dynamic('check_balance', async (session, phoneNumber) => {
    const user = await mockDb.getUserByPhone(phoneNumber);

    if (!user) {
      return 'END You are not registered.\n\nDial again to register.';
    }

    const loans = await mockDb.getLoansByPhone(phoneNumber);
    const activeLoans = loans.filter(loan => loan.status === 'active');
    const totalOwed = activeLoans.reduce((sum, loan) => sum + loan.totalRepayment, 0);

    return `END Account Balance\n\nName: ${user.fullName}\nAvailable: NGN ${user.balance.toLocaleString()}\nLoan Limit: NGN ${user.loanLimit.toLocaleString()}\nAmount Owed: NGN ${totalOwed.toFixed(2)}`;
  }, { terminal: true });

  // Loan History
  builder.dynamic('loan_history', async (session, phoneNumber) => {
    const user = await mockDb.getUserByPhone(phoneNumber);

    if (!user) {
      return 'END You are not registered.\n\nDial again to register.';
    }

    const loans = await mockDb.getLoansByPhone(phoneNumber);

    if (loans.length === 0) {
      return 'END You have no loan history.';
    }

    let message = 'Your Loans:\n\n';
    loans.slice(0, 5).forEach((loan, index) => {
      message += `${index + 1}. NGN ${loan.amount.toLocaleString()} - ${loan.status}\n`;
    });

    return `END ${message}`;
  }, { terminal: true });


  // Repay Menu
  builder
    .menu('repay_menu', 'Repay Loan')
    .option('1', 'Full Repayment', 'repay_full')
    .option('2', 'Partial Repayment', 'repay_partial')
    .option('0', 'Back to Menu', 'home')
    .done();

  // Full Repayment
  builder.dynamic('repay_full', async (session, phoneNumber) => {
    const loans = await mockDb.getLoansByPhone(phoneNumber);
    const activeLoans = loans.filter(loan => loan.status === 'active');

    if (activeLoans.length === 0) {
      return 'END You have no active loans to repay.';
    }

    const loan = activeLoans[0];

    return `END To repay NGN ${loan.totalRepayment.toFixed(2)}:\n\nBank: First Bank\nAccount: 1234567890\nName: QuickCash Ltd\nRef: ${loan.id}\n\nThank you!`;
  }, { terminal: true });

  // Partial Repayment (placeholder)
  builder.dynamic('repay_partial', async (session, phoneNumber) => {
    return 'END Partial repayment is coming soon.\n\nPlease use Full Repayment for now.';
  }, { terminal: true });

  builder.end('help',
    'QuickCash Loans Help\n\n' +
    'Apply: Get loans NGN 100-5,000\n' +
    'Repay: Bank transfer to 1234567890\n' +
    'Support: 0800-QUICKCASH\n\n' +
    'Thank you for using QuickCash!');

  return machine;
}

module.exports = {
  createLendingApp,
  mockDb
};
