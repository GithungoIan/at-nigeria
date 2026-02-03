# Africa's Talking Nigeria Workshop API

A Node.js API for integrating with Africa's Talking services including SMS, USSD, Voice, and Airtime for Nigerian applications.

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Service](#running-the-service)
- [API Endpoints](#api-endpoints)
- [USSD](#ussd)
- [Voice](#voice)
- [Testing](#testing)
- [Project Structure](#project-structure)

## Requirements

### System Requirements

- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher
- **Africa's Talking Account** - [Sign up here](https://account.africastalking.com/auth/register)


## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd at-nigeria
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create environment file**

   ```bash
   cp .env.example .env
   ```

4. **Configure your environment variables** (see [Configuration](#configuration))

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Africa's Talking API Credentials (Required)
AT_API_KEY=your_api_key_here
AT_USERNAME=your_username_here

# Application Configuration
PORT=3000
APP_URL=http://localhost:3000

# Voice Configuration (Required for voice features)
VOICE_PHONE_NUMBER=+234xxxxxxxxxx
```

### Getting Your API Credentials

1. Log in to your [Africa's Talking Dashboard](https://account.africastalking.com)
2. Go to **Settings** > **API Key**
3. Generate or copy your API key
4. Your username is displayed at the top of the dashboard (use `sandbox` for testing)

## Running the Service

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

### Verify the Service

```bash
curl http://localhost:3000
```

Expected response:

```json
{
  "status": "success",
  "message": "Africa's Talking Workshop API",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## API Endpoints

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API health check |

### Airtime

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/airtime/send` | Send airtime to a phone number |
| POST | `/api/airtime/send-bulk` | Send airtime to multiple numbers |

### USSD

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ussd` | Main USSD callback (Lending App) |
| GET | `/ussd/test` | Test USSD endpoint |
| POST | `/ussd/simulator` | USSD flow simulator |
| POST | `/ussd/event` | Event Registration USSD (Simple Example) |
| GET | `/ussd/event/test` | Test event USSD |
| GET | `/ussd/event/registrations` | View event registrations |

### Voice

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/voice` | Main voice callback |
| POST | `/voice/make-call` | Initiate outbound call |
| POST | `/voice/support-menu` | Handle IVR menu selections |
| POST | `/voice/otp-verification` | Send OTP via voice call |
| POST | `/voice/callback-request` | Request a callback |
| POST | `/voice/recording-complete` | Handle completed recordings |
| POST | `/voice/leave-message` | Voice mail flow |
| GET | `/voice/test` | Test voice endpoint |

## USSD

### How USSD Works

USSD (Unstructured Supplementary Service Data) is a protocol used by mobile phones to communicate with service provider computers. Key concepts:

- **Session-based**: Each USSD session has a unique `sessionId`
- **Text accumulates**: User inputs are joined by `*` (e.g., `1*John*email@test.com`)
- **Response prefix**: `CON` continues the session, `END` terminates it

### USSD Flows

#### 1. QuickCash Lending App (`/ussd`)

A full-featured micro-lending application with:
- User registration (Name + NIN)
- Loan application (amount, period, confirmation)
- Balance checking
- Loan history
- Repayment instructions

#### 2. Event Registration (`/ussd/event`)

A simple example using if/else statements:
- Event registration (name, email)
- Check-in with ticket number
- View registration status
- Event information

### Testing USSD Locally

```bash
# Initial menu
curl -X POST http://localhost:3000/ussd/event \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test1","phoneNumber":"+2348012345678","text":""}'

# Select option 1 (Register)
curl -X POST http://localhost:3000/ussd/event \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test1","phoneNumber":"+2348012345678","text":"1"}'

# Enter name
curl -X POST http://localhost:3000/ussd/event \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test1","phoneNumber":"+2348012345678","text":"1*John Doe"}'
```

### Using the USSD Simulator

```bash
curl -X POST http://localhost:3000/ussd/simulator \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+2348012345678","input":""}'
```

## Voice

### Voice Features

- **Outbound Calls**: Make calls programmatically
- **IVR (Interactive Voice Response)**: Menu-driven voice interactions
- **Text-to-Speech**: Convert text to voice
- **Call Recording**: Record calls for quality/training
- **Call Queuing**: Put callers in queue for agents
- **DTMF Input**: Handle keypad input during calls

### Voice Callback Setup

Configure your Africa's Talking voice callback URL to point to:

```
https://your-domain.com/voice
```

### Testing Voice Locally

```bash
# Make an outbound call
curl -X POST http://localhost:3000/voice/make-call \
  -H "Content-Type: application/json" \
  -d '{"to":"+2348012345678","from":"+234XXXXXXXXXX"}'

# Request OTP verification call
curl -X POST http://localhost:3000/voice/otp-verification \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+2348012345678"}'
```

## Testing


### Using Africa's Talking Simulator

1. Go to [Africa's Talking Simulator](https://simulator.africastalking.com)
2. Select your app and USSD service code
3. Test your USSD flows interactively



## Exposing Local Server for Testing

To test callbacks from Africa's Talking, you need to expose your local server to the internet. Here are several tunneling options:

### 1. ngrok (Recommended)

Popular and reliable with a free tier.

```bash
# Install ngrok
npm install -g ngrok

# Or download from https://ngrok.com/download

# Expose port 3000
ngrok http 3000
```

**Pros**: Stable, request inspector, custom domains (paid)
**Free tier**: Random URLs, limited connections

---

### 2. localtunnel

Free and open source, no signup required.

```bash
# Install
npm install -g localtunnel

# Expose port 3000
lt --port 3000

# With custom subdomain
lt --port 3000 --subdomain myapp
```

**Pros**: Free, custom subdomains, no account needed
**Cons**: Less stable, URLs may change

---

### 3. Cloudflare Tunnel (cloudflared)

Free, fast, and secure by Cloudflare.

```bash
# Install (macOS)
brew install cloudflared

# Install (Linux)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared

# Quick tunnel (no account needed)
cloudflared tunnel --url http://localhost:3000
```

**Pros**: Fast, secure, free, no account for quick tunnels
**Cons**: Requires Cloudflare account for persistent tunnels

---

### 4. serveo

No installation required, uses SSH.

```bash
# Expose port 3000
ssh -R 80:localhost:3000 serveo.net
```

**Pros**: No installation, works anywhere with SSH
**Cons**: Can be unreliable, limited features

---

### 5. localhost.run

Simple SSH-based tunneling.

```bash
# Expose port 3000
ssh -R 80:localhost:3000 localhost.run
```

**Pros**: No installation, free
**Cons**: Random URLs only

---

### 6. Tailscale Funnel

If you use Tailscale for networking.

```bash
# Install Tailscale first from https://tailscale.com

# Enable funnel
tailscale funnel 3000
```

**Pros**: Secure, integrates with Tailscale network
**Cons**: Requires Tailscale setup

---

### Comparison Table

| Service | Free Tier | Custom Subdomain | No Signup | Stability |
|---------|-----------|------------------|-----------|-----------|
| ngrok | Yes | Paid | No | High |
| localtunnel | Yes | Yes | Yes | Medium |
| Cloudflare Tunnel | Yes | With account | Yes* | High |
| serveo | Yes | No | Yes | Low |
| localhost.run | Yes | No | Yes | Medium |
| Tailscale Funnel | Yes | Yes | No | High |

### Setting Up Callback URLs

Once you have your tunnel URL (e.g., `https://abc123.ngrok.io`), configure it in Africa's Talking:

1. Go to [Africa's Talking Dashboard](https://account.africastalking.com)
2. Select your application
3. Go to **USSD** > **Callback URL** and set: `https://your-tunnel-url/ussd`
4. Go to **Voice** > **Callback URL** and set: `https://your-tunnel-url/voice`

## Troubleshooting

### Common Issues

1. **Missing environment variables**
   ```
   Error: Missing required environment variables: AT_API_KEY, AT_USERNAME
   ```
   Solution: Ensure your `.env` file has all required variables.

2. **Port already in use**
   ```
   Error: listen EADDRINUSE: address already in use :::3000
   ```
   Solution: Change the PORT in `.env` or kill the process using port 3000.

3. **USSD session not maintaining state**
   - Ensure you're using the same `sessionId` for all requests in a session
   - Check that the `text` field accumulates previous inputs

## Resources

- [Africa's Talking Documentation](https://developers.africastalking.com/)
- [USSD Documentation](https://developers.africastalking.com/docs/ussd/overview)
- [Voice Documentation](https://developers.africastalking.com/docs/voice/overview)
- [Node.js SDK](https://github.com/AfricasTalkingLtd/africastalking-node.js)

## License

MIT
