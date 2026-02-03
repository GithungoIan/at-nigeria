const logger = require('../utils/logger');

class UssdStateMachine {
  constructor() {
    this.states = new Map();
    this.sessionStore = new Map(); // In production, use Redis
    this.defaultState = 'home';
    this.sessionTimeout = 120000; // 2 minutes
  }


  addState(name, config) {
    this.states.set(name, {
      name,
      ...config
    });
    return this;
  }


  setDefaultState(stateName) {
    this.defaultState = stateName;
    return this;
  }

  async processRequest(request) {
    const { sessionId, serviceCode, phoneNumber, text } = request;

    try {
      // Get or create session
      let session = this.getSession(sessionId);
      if (!session) {
        session = this.createSession(sessionId, phoneNumber);
      }

      // Parse user input - split by * to get all inputs in sequence
      const inputs = text ? text.split('*') : [];
      const latestInput = inputs.length > 0 ? inputs[inputs.length - 1] : '';

      logger.info('Processing USSD', {
        sessionId,
        currentState: session.currentState,
        inputs,
        latestInput,
        inputCount: session.inputCount
      });

      // First request (no input) - show default state
      if (inputs.length === 0) {
        session.currentState = this.defaultState;
        session.inputCount = 0;
        const state = this.states.get(this.defaultState);
        const result = await this.executeState(state, session, '', phoneNumber);
        this.updateSession(sessionId, session);
        return result;
      }

      // Get current state
      const currentState = this.states.get(session.currentState);
      if (!currentState) {
        throw new Error(`State '${session.currentState}' not found`);
      }

      // Check if this is a new input we haven't processed yet
      if (inputs.length > session.inputCount) {
        session.inputCount = inputs.length;

        // Execute state with the latest input
        const result = await this.executeState(currentState, session, latestInput, phoneNumber);
        this.updateSession(sessionId, session);
        return result;
      }

      // Same input count - just re-render current state
      const result = await this.executeState(currentState, session, '', phoneNumber);
      this.updateSession(sessionId, session);
      return result;

    } catch (error) {
      logger.error('Error processing USSD request', {
        error: error.message,
        stack: error.stack,
        sessionId
      });
      return 'END An error occurred. Please try again.';
    }
  }

  async executeState(state, session, input, phoneNumber) {
    logger.info('Executing state', {
      stateName: state.name,
      input,
      hasHandler: !!state.handler,
      hasOptions: !!state.options,
      hasDynamicContent: !!state.dynamicContent
    });

    // If state has options and user provided input, check for menu navigation
    if (state.options && input) {
      const option = state.options[input];
      if (option && option.nextState) {
        // Navigate to next state
        session.currentState = option.nextState;
        const nextState = this.states.get(option.nextState);
        if (nextState) {
          return await this.executeState(nextState, session, '', phoneNumber);
        }
      }
    }

    // If state has validation and user provided input
    if (state.validate && input) {
      const validationResult = state.validate(input, session);
      if (!validationResult.valid) {
        // Return error message and prompt again
        const prompt = state.prompt || state.message || '';
        return `CON ${validationResult.message}\n\n${prompt}`;
      }

      // Store validated data
      if (state.storeAs) {
        session.data[state.storeAs] = validationResult.value !== undefined ? validationResult.value : input;
        logger.info('Stored data', { key: state.storeAs, value: session.data[state.storeAs] });
      }
    } else if (state.storeAs && input) {
      // Store without validation
      session.data[state.storeAs] = input;
    }

    // If state has custom handler, execute it
    if (state.handler && input) {
      const handlerResult = await state.handler(session, input, phoneNumber);
      if (handlerResult) {
        return handlerResult;
      }
    }

    // If state has dynamic content generator
    if (state.dynamicContent) {
      const dynamicResult = await state.dynamicContent(session, phoneNumber);
      // Dynamic content returns the full response including CON/END prefix
      if (dynamicResult.startsWith('CON') || dynamicResult.startsWith('END')) {
        return dynamicResult;
      }
      return state.terminal ? `END ${dynamicResult}` : `CON ${dynamicResult}`;
    }

    // Build response message
    let message = state.message || state.prompt || '';

    // Add options menu if available
    if (state.options) {
      const optionsText = this.buildOptionsMenu(state.options);
      if (message) {
        message += '\n\n' + optionsText;
      } else {
        message = optionsText;
      }
    }

    // Format response
    const prefix = state.terminal ? 'END' : 'CON';
    return `${prefix} ${message}`;
  }

  buildOptionsMenu(options) {
    return Object.entries(options)
      .map(([key, option]) => `${key}. ${option.label}`)
      .join('\n');
  }


  createSession(sessionId, phoneNumber) {
    const session = {
      id: sessionId,
      phoneNumber,
      currentState: this.defaultState,
      inputCount: 0,
      data: {},
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    this.sessionStore.set(sessionId, session);

    // Auto-cleanup after timeout
    setTimeout(() => {
      this.sessionStore.delete(sessionId);
    }, this.sessionTimeout);

    return session;
  }

  getSession(sessionId) {
    return this.sessionStore.get(sessionId);
  }

  updateSession(sessionId, session) {
    session.lastActivity = Date.now();
    this.sessionStore.set(sessionId, session);
  }

  clearSession(sessionId) {
    this.sessionStore.delete(sessionId);
  }
}

class UssdMenuBuilder {
  constructor(stateMachine) {
    this.stateMachine = stateMachine;
  }

  menu(name, message) {
    const options = {};

    const builder = {
      option: (key, label, nextState) => {
        options[key] = { label, nextState };
        return builder;
      },
      done: () => {
        this.stateMachine.addState(name, {
          message,
          options
        });
        return this;
      }
    };

    return builder;
  }


  input(name, prompt, config = {}) {
    this.stateMachine.addState(name, {
      prompt,
      message: prompt,
      validate: config.validate,
      storeAs: config.storeAs,
      handler: config.handler,
      nextState: config.nextState
    });
    return this;
  }

  end(name, message) {
    this.stateMachine.addState(name, {
      message,
      terminal: true
    });
    return this;
  }

  dynamic(name, contentGenerator, config = {}) {
    this.stateMachine.addState(name, {
      dynamicContent: contentGenerator,
      terminal: config.terminal || false,
      options: config.options
    });
    return this;
  }

  build() {
    return this.stateMachine;
  }
}


const Validators = {
  phoneNumber: (input) => {
    const pattern = /^(\+?234[789]\d{9}|0[789]\d{9}|\+?254[17]\d{8}|0[17]\d{8}|\+\d{10,15})$/;
    const valid = pattern.test(input);
    return {
      valid,
      message: valid ? '' : 'Invalid phone number. Try again (e.g., +2348012345678 or 08012345678):',
      value: valid ? input : null
    };
  },

  amount: (input) => {
    const amount = parseFloat(input);
    const valid = !isNaN(amount) && amount > 0;
    return {
      valid,
      message: valid ? '' : 'Invalid amount. Enter a valid number:',
      value: valid ? amount : null
    };
  },

  pin: (length = 4) => (input) => {
    const valid = /^\d+$/.test(input) && input.length === length;
    return {
      valid,
      message: valid ? '' : `Invalid PIN. Enter ${length} digits:`,
      value: valid ? input : null
    };
  },

  choice: (validChoices) => (input) => {
    const valid = validChoices.includes(input);
    return {
      valid,
      message: valid ? '' : `Invalid choice. Select from ${validChoices.join(', ')}:`,
      value: valid ? input : null
    };
  },

  notEmpty: (input) => {
    const valid = input && input.trim().length > 0;
    return {
      valid,
      message: valid ? '' : 'This field is required. Try again:',
      value: valid ? input.trim() : null
    };
  }
};

module.exports = {
  UssdStateMachine,
  UssdMenuBuilder,
  Validators
};
