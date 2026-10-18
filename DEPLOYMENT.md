# Artho AI — Production Deployment Guide

This guide documents the production deployment architecture, prerequisites, configuration, verification, and troubleshooting procedures for **Artho AI**.

---

## 1. Deployment Architecture Overview

Artho AI is architected as a **single unified Web Service** running on Node.js:
- **Client Frontend:** Single Page Application (SPA) built with React 19, TypeScript, and Vite.
- **Backend API:** Express.js REST API providing authentication, transaction ledger management, savings goals, and AI financial coaching.
- **Single-Service Model:** During production build (`npm run build`), Vite compiles the client assets into the `dist/` directory. At runtime (`npm start` / `tsx server.ts`), Express serves the compiled static files and handles all API routes (`/api/*`) on the exact same port. Any unmatched route falls back to `dist/index.html` for client-side routing.
- **Benefits:** No cross-origin CORS overhead in production, zero frontend/backend deployment drift, and single-port hosting compatible with Render Free tier.

---

## 2. Prerequisites

Before deploying Artho AI to production, ensure you have:
1. **GitHub Account:** Access to the repository [`https://github.com/ahanaf-star/artho-ai`](https://github.com/ahanaf-star/artho-ai).
2. **Render Account:** A free or paid account at [Render](https://render.com/).
3. **MongoDB Atlas Cluster:** A cloud database cluster (M0 Free Tier or higher) at [MongoDB Cloud](https://cloud.mongodb.com/).
4. **Google AI Studio Key:** An active API key with access to Gemini models from [Google AI Studio](https://aistudio.google.com/).
5. **(Optional) Transactional Email Provider:** Brevo API key or Gmail App Password for email verification.

---

## 3. Step-by-Step Deployment Instructions

### Step 1: MongoDB Atlas Configuration
1. Log into **MongoDB Atlas** and navigate to your cluster.
2. Under **Security → Database Access**:
   - Create a database user (e.g., `artho_admin`) with **Read and write to any database** privileges.
3. Under **Security → Network Access**:
   - Add IP Access: `0.0.0.0/0` (Allow Access from Anywhere) to permit Render's dynamic IP ranges to connect.
4. Under **Database → Connect**:
   - Select **Drivers** (Node.js) and copy the connection string:
     `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority`
   - Set the target database name explicitly as `arthobachao`.

### Step 2: Render Web Service Setup
1. Log into the **Render Dashboard**.
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository: `ahanaf-star/artho-ai`.
4. Configure the Web Service settings:
   - **Name:** `arthobachao-ai` (or your chosen service name)
   - **Region:** Singapore / Oregon / Frankfurt (select closest to target audience)
   - **Branch:** `main`
   - **Root Directory:** *(leave blank for repository root)*
   - **Runtime:** `Node`
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free` (or Starter for persistent uptime)

### Step 3: Configure Environment Variables in Render
In the Render Web Service dashboard, go to the **Environment** tab and add the following key-value pairs:

| Key | Value / Guidance | Required? |
| :--- | :--- | :---: |
| `NODE_ENV` | `production` | **Yes** |
| `PORT` | `10000` *(Render sets this automatically, default 3000 used locally)* | Auto |
| `MONGODB_URI` | `mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority` | **Yes** |
| `MONGODB_DB_NAME` | `arthobachao` | Optional (default: `arthobachao`) |
| `JWT_SECRET` | Generate a 64-character random string (e.g., `openssl rand -hex 32`) | **Yes** |
| `GEMINI_API_KEY` | Your Google Gemini API key from AI Studio (`AIzaSy...`) | **Yes** |
| `APP_URL` | `https://arthobachao-ai.onrender.com` | Optional |
| `EMAIL_OTP_ENABLED` | `false` *(Set `false` to bypass email OTP; `true` once email domain is verified)* | Optional |
| `EMAIL_PROVIDER` | `smtp` or `brevo` | Optional |
| `EMAIL_FROM` | `Artho AI <support@arthoai.com>` | Optional |
| `BREVO_API_KEY` | Optional Brevo API key for HTTPS port 443 delivery on Render Free | Optional |

> [!CAUTION]
> Never print or log real secret values. Render encrypts environment variables at rest.

### Step 4: Trigger Initial Build & Deploy
1. Click **Create Web Service** (or **Manual Deploy → Deploy latest commit**).
2. Monitor the Render deployment log:
   - Git checkout succeeds.
   - `npm install` installs production and build dependencies.
   - `npm run build` runs `vite build`, producing `dist/index.html` and bundled assets.
   - `npm start` launches `tsx server.ts`.
   - Log confirms: `Artho AI server listening on http://localhost:...`.
   - Log confirms: `MongoDB connected successfully to database: arthobachao`.

---

## 4. Post-Deployment Verification & Health Checks

### 1. Automated Health Check Endpoint
The backend includes a dedicated, non-destructive health endpoint at `/api/health`.

Run the following command against your live deployment:
```bash
curl -s https://arthobachao-ai.onrender.com/api/health
```

**Expected JSON Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "hasGeminiApiKey": true,
  "emailService": {
    "provider": "smtp",
    "configured": true,
    "smtpConfigured": true
  },
  "timestamp": "2026-10-19T02:15:00.000Z"
}
```

### 2. Frontend Smoke Test
Open the live URL in a web browser:
- `https://arthobachao-ai.onrender.com`
- Verify that the Landing Page loads with fintech styling.
- Verify that navigation between `/login`, `/signup`, and `/dashboard` renders cleanly without 404 errors.

### 3. User Journey Smoke Test
1. Click **Get Started / Sign Up**.
2. Register a new test account (e.g. `test.evaluator@example.com`).
3. Since `EMAIL_OTP_ENABLED=false` is active, verify that registration signs in immediately and redirects to the **Dashboard**.
4. Create a test transaction:
   - Type: `Expense`, Amount: `1200`, Category: `Food & Groceries`, Merchant: `Shwapno`.
5. Verify that the Dashboard, Spending Analysis, and Financial Health indicators update immediately.
6. Open the **AI Coach** tab and send a question:
   - *"Which category did I spend the most money on?"*
7. Verify that the AI Coach cites **Food & Groceries** at **৳1,200** accurately.

---

## 5. Common Deployment Issues & Troubleshooting

### Issue 1: Render Free Tier Cold Starts
- **Symptom:** First request after 15 minutes of inactivity takes 30–50 seconds to respond.
- **Cause:** Render Free tier spins down inactive web services.
- **Resolution:** Normal behavior for free tier. Once spun up, subsequent requests respond in milliseconds. For 24/7 warm instances, upgrade to Render Starter tier.

### Issue 2: MongoDB Connection Timeout (`MongoServerSelectionError`)
- **Symptom:** Health check reports `"database": "standalone_fallback"`.
- **Cause:** MongoDB Atlas Network Access whitelist does not include Render's IP address.
- **Resolution:** In MongoDB Atlas, go to **Network Access** and ensure `0.0.0.0/0` is added to allow connections from any cloud provider.

### Issue 3: Gemini API 404 or Model Not Found
- **Symptom:** AI Coach falls back to deterministic engine with log `Model not found`.
- **Cause:** Deprecated Gemini model name or inactive API key.
- **Resolution:** The application uses approved models defined in `server/config/geminiConfig.ts` (`gemini-2.5-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`) with automated retry. Ensure your API key is active in Google AI Studio.

### Issue 4: SMTP Outbound Timeout on Render Free
- **Symptom:** `SMTP failure: Connection timeout` when dispatching emails.
- **Cause:** Render Free tier blocks outbound TCP connections on ports 25, 465, and 587.
- **Resolution:** 
  1. Keep `EMAIL_OTP_ENABLED=false` for uninterrupted demo testing, OR
  2. Configure `BREVO_API_KEY` with `EMAIL_PROVIDER=brevo`, which communicates over HTTPS Port 443 and bypasses all SMTP port blocks.

---

## 6. Safe Redeployment Procedure

When pushing updates to production:
1. Validate types locally: `npm run lint`
2. Validate production build locally: `npm run build`
3. Run core test suites: `npx tsx server/tests/financialPlanningAssistant.test.ts`
4. Commit and push cleanly to `main`:
   ```bash
   git push origin main
   ```
5. Render automatically detects the push and triggers a zero-downtime deployment.
6. Re-run `curl -s https://arthobachao-ai.onrender.com/api/health` to confirm the new version is live and healthy.
