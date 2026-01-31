# SMTP to OAuth Relay for Gmail

An SMTP server that accepts standard SMTP connections and relays emails through Gmail's API using OAuth 2.0 authentication. This eliminates the need for refactoring existing SMTP-based systems to support OAuth directly.

**Architecture:**

```
Your App → SMTP (Port 2525) → This Relay → OAuth 2.0 → Gmail API → Email Delivered
```

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Google Cloud Setup](#google-cloud-setup-detailed)
4. [Installation & Configuration](#installation--configuration)
5. [Running the Relay](#running-the-relay)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# 1. Clone/setup project
npm install

# 2. Set up Google Cloud credentials (see Google Cloud Setup section)

# 3. Create .env file with your credentials
cp .env.example .env
# Edit .env with your Google OAuth credentials

# 4. Build and run
npm run build
npm start

# 5. Authorize Gmail account (opens browser at http://localhost:3001)
# Complete the OAuth flow to authorize an email address

# 6. Send test email
./send-test.sh recipient@example.com "Test Subject" "Test message"
```

---

## Prerequisites

- **Node.js** 18.0+ (ES modules support)
- **npm** 9.0+
- **Google Account** with access to Google Cloud Console
- **Internet connection** (for OAuth and Gmail API)

---

## Google Cloud Setup

This section provides step-by-step instructions to set up OAuth credentials for Gmail.

### Step 1: Create a Google Cloud Project

#### 1.1 Go to Google Cloud Console

- Navigate to [Google Cloud Console](https://console.cloud.google.com/)
- Sign in with your Google account

#### 1.2 Create a New Project

- Click the project dropdown (top left, next to "Google Cloud")
- Click **"New Project"**
- Enter project name: `SMTP OAuth Relay` (or your preferred name)
- Click **"Create"**

#### 1.3 Select Your Project

- Click the project dropdown again
- Select the newly created `SMTP OAuth Relay` project

### Step 2: Enable Gmail API

#### 2.1 Navigate to APIs Library

- In the left sidebar, click **"APIs & Services"** → **"Library"**
- Or use the search bar at the top

#### 2.2 Search for Gmail API

- In the search box, type `Gmail API`
- Click on the **"Gmail API"** result
- Click the blue **"Enable"** button

#### 2.3 Verify Gmail API is Enabled

- You should see "Gmail API" with a checkmark in the "APIs & Services" > "Enabled APIs & Services" page

### Step 3: Configure OAuth Consent Screen

The consent screen is what users see when they authorize your application.

#### 3.1 Access OAuth Consent Screen

- Go to **"APIs & Services"** → **"OAuth consent screen"** (in left sidebar)
- If prompted, click **"Create OAuth 2.0 Client ID"**

#### 3.2 Choose User Type

- Select **"External"** (unless you're using Google Workspace, then select "Internal")
- Click **"Create"**

#### 3.3 Fill in App Information

1. **App name**: `SMTP OAuth Relay` (displayed to users)
2. **User support email**: Your email address (support@yourcompany.com)
3. **App logo** (optional): Upload a logo if desired
4. **Application home page** (optional): `http://localhost:3001`
5. **Links** (optional):
   - Privacy policy: Leave blank or add your privacy policy URL
   - Terms of service: Leave blank or add your ToS URL
6. **Developer contact information**: Your email address

Click **"Save and Continue"**

#### 3.4 Add Scopes

Scopes define what permissions the app can request from users.

1. Click **"Add or Remove Scopes"**
2. Search for and select:
   - `https://www.googleapis.com/auth/gmail.send`
   - (This is the ONLY scope needed - send emails only, no inbox access)
3. Click **"Update"**
4. Click **"Save and Continue"**

#### 3.5 Add Test Users

These are the Gmail addresses that can authorize with your app during testing.

1. Click **"Add Users"**
2. Enter your Gmail addresses (one per line):
   ```
   your-email@gmail.com
   test@gmail.com
   colleague@gmail.com
   ```
3. Click **"Add"**
4. Click **"Save and Continue"**

#### 3.6 Review Summary

- Review all information on the summary page
- Everything looks correct? Great! Click **"Back to Dashboard"**

### Step 4: Create OAuth 2.0 Credentials

This is where you get the Client ID and Client Secret.

#### 4.1 Create Credentials

- Go to **"APIs & Services"** → **"Credentials"**
- Click **"+ Create Credentials"**
- Select **"OAuth client ID"**

#### 4.2 Configure Application Type

- Choose application type: **"Web application"**
- Name your credential: `SMTP Relay Client` (or any name)

#### 4.3 Add Authorized Redirect URIs

This is the callback URL where Google will send the authorization code.

1. Under "Authorized redirect URIs", click **"Add URI"**
2. Enter: `http://localhost:3001/oauth2callback`
3. If deploying to production, also add:
   - `https://your-domain.com/oauth2callback` (replace with your actual domain)
4. Click **"Create"**

#### 4.4 Save Your Credentials

A popup will show your credentials. **SAVE THESE NOW** - you won't see them again:

- **Client ID**: `xxxxxxxxxxxx.apps.googleusercontent.com`
- **Client Secret**: `GOCSPX-xxxxxxxxxxxxxxxxxxxx`

Click **"Download JSON"** if you want to download the credentials file.

---

## Installation & Configuration

### Step 1: Clone or Navigate to Project

```bash
cd /path/to/smtp-oauth-relay
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Create Environment Configuration

#### 3.1 Copy Example File

```bash
cp .env.example .env
```

### Step 4: Build TypeScript

```bash
npm run build
```

This compiles TypeScript files from `src/` to `dist/`.

---

## Running the Relay

### Development Mode (with auto-reload)

```bash
npm run dev
```

This rebuilds on file changes and restarts the server.

### Production Mode

```bash
npm run build
npm start
```

### Next Step: Authorize a Gmail Account

1. The server automatically opens `http://localhost:3001` in your browser
2. **Enter your Gmail address** (must be added as test user in Google Cloud)
3. Click **"Begin Authorization 🚀"**
4. Sign in with your Google account
5. Click **"Allow"** when prompted
6. You'll see credentials to use with your SMTP client

---

## Testing

### Test 1: Send Email via CLI

```bash
# Using the test script
./send-test.sh recipient@example.com "Test Subject" "Hello, World!"

# Or using npm directly
npm test recipient@example.com "Test Subject" "Hello, World!"
```

The test script will:

1. Connect to the relay on localhost:2525
2. Use the sender email you authorized
3. Send an email to the recipient
4. Print status messages

### Test 2: Check Email in Gmail

- Open your authorized Gmail account
- Check **Sent Mail** to verify the email was sent
- Verify the recipient received the email
- Check headers in Gmail to see "via Gmail SMTP-OAuth Relay"

## Troubleshooting

### "Email not authorized" Error

**Problem**: When connecting via SMTP, you get "Account xyz@gmail.com is not authorized."

**Solution**:

1. Make sure you've completed the OAuth flow (http://localhost:3001)
2. The email must be added as a test user in Google Cloud Console
3. Check that `relay.db` exists (should be created after first authorization)

### "Invalid email format" Error

**Problem**: SMTP authentication fails with "Invalid email address format"

**Solution**:

- Ensure you're using a valid Gmail address with @ symbol
- Example: `your.name+label@gmail.com` is valid
- `@` or `user` alone are invalid

### "No refresh token received" Error

**Problem**: Authorization fails with "User might already be authorized. Try revoking..."

**Solution**:

1. Go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
2. Find "SMTP OAuth Relay"
3. Click **"Remove Access"**
4. Try authorizing again in the setup UI

### "CSRF Protection: State mismatch" Error

**Problem**: OAuth callback fails with state mismatch

**Solution**:

- This is a security feature to prevent CSRF attacks
- Make sure cookies are enabled in your browser
- Try accessing http://localhost:3001 again in a private/incognito window
- Check that `GOOGLE_REDIRECT_URI` in `.env` matches exactly: `http://localhost:3001/oauth2callback`

### Gmail API Not Enabled

**Problem**: "The Calendar API has not been used..." or similar

**Solution**:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to "APIs & Services" > "Enabled APIs & Services"
4. Verify "Gmail API" is in the list with a checkmark
5. If not, re-enable it from the Library

---
