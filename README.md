# 💰 Artho AI — AI-Powered Personal Finance Assistant

**Understand your money. Plan smarter. Reach your goals.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Artho%20AI-success?style=for-the-badge)](https://arthobachao-ai.onrender.com)
[![GitHub](https://img.shields.io/badge/GitHub-Source%20Code-black?style=for-the-badge&logo=github)](https://github.com/ahanaf-star/artho-ai)

---

## 1. Project Title
**Artho AI — AI-Powered Personal Finance Assistant**

---

## 2. Project Overview

### The Problem
Managing personal finances across multiple mobile wallets (e.g., bKash, Nagad), bank accounts, and daily cash transactions is fragmented and cognitively demanding. Most traditional budgeting apps either present static charts without actionable interpretation or rely entirely on black-box generative AI that hallucinates financial figures, calculates incorrect balances, or gives generic, ungrounded advice.

### The Solution
**Artho AI** bridges deterministic financial intelligence with conversational generative AI. All calculations—including transaction category aggregation, lowest/highest spending rankings, month-over-month trends, 50/30/20 budget allocations, and health scores—are executed deterministically in application code before reaching Google Gemini. Gemini acts strictly as an explanatory and coaching layer, constrained by a server-side number validator that rejects any ungrounded figures.

### Target Users
- Individuals and households seeking clarity over monthly cash flow and expense patterns.
- Goal-oriented savers planning for milestones (emergency funds, technology purchases, travel, education).
- Users looking for explainable, private financial coaching grounded in their real ledger without manual spreadsheet maintenance.

---

## 3. Key Features

- 🔐 **Authentication & Account Security**
  - Secure user signup and login with salted bcrypt password hashing (10 salt rounds).
  - Stateless JSON Web Token (JWT) session lifecycle with 7-day expiration.
  - Multi-tenant data isolation enforcing strict per-user ownership checks on every database query.
  - Modular OTP verification architecture with temporary bypass mode (`EMAIL_OTP_ENABLED=false`) for instant testing.

- 📊 **Financial Dashboard**
  - Instant overview of monthly income, total expenses, net savings, and savings rate.
  - Consolidated liquid balance calculated across linked wallets and cash accounts.
  - 7-day net cash-flow indicator and dynamic last-updated timestamp with manual refresh capability.

- 💳 **Transaction Ledger (CRUD)**
  - Full creation, viewing, editing, and deletion of income, expense, and transfer transactions.
  - Mandatory counterparty/merchant tracking for expense transactions.
  - Automatic category normalization preventing income categories from being misclassified as expenses and vice versa.

- 📈 **Spending Analysis & Anomaly Detection**
  - Category-by-category breakdown with percentage share of total outflows.
  - Dynamic month-over-month (MoM) spending difference calculations.
  - Outlier detection highlighting abnormal spikes in discretionary categories.
  - Merchant ranking identifying top counterparties and single largest transactions.

- 🎯 **Savings Goals & Pacing**
  - Create and track custom savings targets with target amounts, current accumulated savings, and target completion dates.
  - Dynamic monthly pacing calculation and scenario planning (Conservative, Balanced, Accelerated).
  - One-click quick deposit simulator with account vault allocation.
  - Complete goal deletion with modal confirmation dialog and error rollback.

- 🩺 **Transparent Financial Health Score**
  - 0–100 explainable score built on 4 weighted pillars: Saving Rate (25%), Expense Control (25%), Savings Goals (20%), and Cash Flow Health (10%), evaluated with multi-month Saving Consistency (20%).
  - Data sufficiency guards returning `score: null` and `status: "insufficient_data"` when transactions are scarce, preventing fabricated 100/100 ratings.

- 📅 **Cash Flow Forecasting & Buffer Guidance**
  - 7, 14, and 30-day projection curves modeling scheduled recurring obligations (rent, utilities).
  - Daily cash burn rate and recommended liquid emergency buffer calculation.

- 🗂️ **Custom Expense Categories**
  - Create and manage custom user categories alongside standard system categories.
  - Safe deletion safeguards preventing removal of categories currently attached to active transactions.

- 💱 **Multi-Currency Baseline Support**
  - Native support for Bangladeshi Taka (BDT / ৳) as default ledger currency.
  - Dynamic conversion rates across 12 major international currencies (USD, EUR, GBP, SAR, AED, INR, CAD, AUD, JPY, SGD, MYR).

- 📄 **Monthly Financial Statements**
  - Printable and exportable statement report formatted with `@media print` rules, reference numbers, and billing period selectors.

- 🤖 **AI Financial Coach**
  - Deterministically grounded conversational coaching powered by Google Gemini API.
  - 8-part structured future savings plans with duration feasibility, $T/M$ monthly targets, and weekly milestones.
  - Budget Deficit Alerts with 3 immediate reduction steps when spending exceeds income.
  - Zero-income liquid runway and cash burn analysis.
  - Illustrative starter budget template (৳30,000 baseline) for accounts with empty ledgers.
  - Server-side number validator intercepting responses and falling back to deterministic answers if any figure fails ledger verification.

- 🌍 **Language Support**
  - English

---

## 4. Technology Stack

### Frontend
- **Framework:** React 19 (`react`, `react-dom`)
- **Language:** TypeScript
- **Build Tool:** Vite 8
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`)
- **Animations:** Motion (`motion`)
- **Icons:** Lucide React (`lucide-react`)

### Backend
- **Runtime:** Node.js (v18+ or v20+ recommended)
- **Framework:** Express.js 4 (`express`)
- **TypeScript Runner:** `tsx`
- **Database ODM:** Mongoose 9 (`mongoose`)
- **Authentication:** `jsonwebtoken` (JWT), `bcryptjs`
- **Email Delivery:** Nodemailer (`nodemailer`), Brevo HTTPS API, Resend API

### Database & Persistence
- **Database Engine:** MongoDB Atlas (Cloud-hosted Replica Set)
- **Database Name:** `arthobachao`

### Artificial Intelligence
- **SDK:** `@google/genai` (Google Gen AI SDK v2.4+)
- **LLM Models:** Google Gemini approved models (`gemini-2.5-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`) with automatic fallback retry.

### Hosting & Deployment
- **Platform:** Render (Unified Node.js Web Service)
- **Frontend Distribution:** Static single-page application served via Express static middleware from `dist/`.

---

## 5. System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        USER WEB BROWSER                                │
│        React 19 + TypeScript SPA (Vite + Tailwind CSS v4)              │
│       Dashboard | Spending | Goals | Health Score | AI Coach           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST API (Bearer JWT)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       EXPRESS BACKEND SERVER                           │
│                     (Node.js + TypeScript / tsx)                       │
│                                                                        │
│   ├── Authentication Middleware (JWT verification, user isolation)     │
│   ├── Financial Controllers (CRUD for transactions, goals, categories) │
│   ├── Deterministic Calculations (extrema, rankings, health score)     │
│   └── AI Coaching Layer                                                │
│         ├── CoachContextBuilder (aggregates verified MongoDB data)     │
│         ├── IntentClassifier (classifies user query objective)         │
│         ├── Gemini Service (invokes Google Gen AI with system rules)   │
│         ├── CoachNumberValidator (extracts & audits every number)      │
│         └── CoachFallbackEngine (100% deterministic fallback)          │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
       ┌────────────────────────┐       ┌────────────────────────┐
       │     MONGODB ATLAS      │       │    GOOGLE GEMINI API   │
       │    (Replica Set)       │       │  (Server-Side Only)    │
       │                        │       │                        │
       │ Collections:           │       │ Models:                │
       │ • users                │       │ • gemini-2.5-flash     │
       │ • transactions         │       │ • gemini-1.5-flash     │
       │ • savingsgoals         │       │ • gemini-1.5-pro       │
       │ • categories           │       │                        │
       └────────────────────────┘       └────────────────────────┘
```

---

## 6. Project Structure

```text
artho-ai/
├── .github/
│   └── workflows/
│       └── static.yml              # GitHub Actions static deployment workflow
├── docs/
│   └── DATABASE_ARCHITECTURE.md    # MongoDB schemas, models, and data pipeline guide
├── reports/
│   ├── coach_evaluation_report.json # 100-case automated evaluation raw data
│   └── coach_evaluation_report.md   # 100-case evaluation report and benchmark breakdown
├── server/
│   ├── config/
│   │   ├── database.ts             # Centralized singleton MongoDB connection manager
│   │   └── geminiConfig.ts         # Approved Gemini model list and configuration
│   ├── controllers/
│   │   ├── authController.ts       # Signup, login, email OTP, and session handling
│   │   ├── categoryController.ts   # Custom categories CRUD and safety validations
│   │   ├── goalController.ts       # Savings goals CRUD, pacing, and deletion
│   │   ├── transactionController.ts# Transaction CRUD, categorization normalization
│   │   └── userController.ts       # User profile and linked wallet accounts
│   ├── evaluation/
│   │   ├── evaluator.ts            # 100-case evaluation engine
│   │   ├── fixtures.ts             # Deterministic evaluation user ledger fixtures
│   │   ├── runEvaluation.ts        # CLI runner for test:coach-eval
│   │   └── testCases.ts            # 100 bilingual test inquiries
│   ├── middleware/
│   │   └── authMiddleware.ts       # JWT requireAuth and optionalAuth verification
│   ├── models/
│   │   ├── Category.ts             # Mongoose Category schema
│   │   ├── SavingsGoal.ts          # Mongoose SavingsGoal schema
│   │   ├── Transaction.ts          # Mongoose Transaction schema
│   │   └── User.ts                 # Mongoose User schema
│   ├── routes/
│   │   ├── authRoutes.ts           # Authentication endpoints
│   │   ├── categoryRoutes.ts       # Category endpoints
│   │   ├── exchangeRateRoutes.ts   # Currency conversion endpoints
│   │   ├── goalRoutes.ts           # Savings goals endpoints
│   │   ├── transactionRoutes.ts    # Transaction ledger endpoints
│   │   └── userRoutes.ts           # User profile endpoints
│   ├── services/
│   │   ├── coachContextBuilder.ts  # Authoritative ledger context generator
│   │   ├── coachFallbackEngine.ts  # 100% deterministic grounded response generator
│   │   ├── coachGeminiService.ts   # Gemini caller with retry and number validation
│   │   ├── coachNumberValidator.ts # Server-side financial number auditing regex
│   │   ├── emailService.ts         # Facade for email delivery and OTP logic
│   │   ├── exchangeRateService.ts  # Multi-currency exchange rate calculation
│   │   ├── healthScoreService.ts   # Financial health score generation
│   │   ├── intentClassifier.ts     # NLP intent parser and savings target extractor
│   │   ├── email/                  # Modular Brevo, SMTP, Resend providers
│   │   └── otp/                    # Pure decoupled OTP credential & expiration engine
│   └── tests/                      # Comprehensive automated test suites
├── src/
│   ├── components/                 # React UI components (Dashboard, Coach, Goals, etc.)
│   ├── data/                       # Built-in providers and mock starter data
│   ├── services/                   # Frontend API, Auth, and Calculation clients
│   ├── types/                      # Shared TypeScript financial interfaces
│   ├── App.tsx                     # Main React application shell and router
│   ├── main.tsx                    # React client entry point
│   └── index.css                   # Tailwind styles and custom theme variables
├── .env.example                    # Safe environment variables configuration template
├── package.json                    # Project dependencies and npm scripts
├── server.ts                       # Unified Express server and entry point
├── tsconfig.json                   # TypeScript compiler configuration
├── vite.config.ts                  # Vite build tool configuration
├── DEPLOYMENT.md                   # Dedicated Render and production deployment guide
└── TESTING.md                      # Comprehensive test case catalog and audit results
```

---

## 7. Prerequisites

Before installing Artho AI, ensure your development machine has:
- **Node.js:** `v18.x` or `v20.x` or higher (verified with Node.js v22)
- **Package Manager:** `npm` (v9 or v10+)
- **Git:** Installed and available in PATH
- **MongoDB Database:** MongoDB Atlas cluster URI or a local MongoDB running on `mongodb://localhost:27017`
- **Google Gemini API Key:** An active key from [Google AI Studio](https://aistudio.google.com/)

---

## 8. Installation and Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ahanaf-star/artho-ai.git
   cd artho-ai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your `MONGODB_URI`, `JWT_SECRET`, and `GEMINI_API_KEY`.

---

## 9. Environment Configuration

All application configuration is read through environment variables:

| Variable Name | Required? | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `PORT` | Optional | `3000` | Port for the Node.js Express server. |
| `NODE_ENV` | Optional | `development` | Environment mode (`development`, `production`, `test`). |
| `APP_URL` | Optional | `http://localhost:3000` | Public URL of the web application. |
| `MONGODB_URI` | **Yes** | `mongodb+srv://...` | Connection URI for MongoDB Atlas cluster. |
| `MONGODB_DB_NAME` | Optional | `arthobachao` | Database name (default `arthobachao`). |
| `JWT_SECRET` | **Yes** | High-entropy string | Secret used to sign and verify user JWT tokens. |
| `GEMINI_API_KEY` | **Yes** | `AIzaSy...` | Server-side API key for Google Gemini model calls. |
| `EMAIL_OTP_ENABLED`| Optional | `false` | Set `false` to bypass email OTP verification; `true` to require OTP. |
| `EMAIL_PROVIDER` | Optional | `smtp` | Active email provider (`brevo`, `smtp`, `resend`). |
| `EMAIL_FROM` | Optional | `Artho AI <no-reply@...>`| Sender address displayed in verification emails. |
| `SMTP_HOST` | Optional | `smtp.gmail.com` | SMTP host for Nodemailer. |
| `SMTP_PORT` | Optional | `465` | SMTP port (465 SSL or 587 TLS). |
| `SMTP_USER` | Optional | `email@gmail.com` | SMTP username. |
| `SMTP_PASS` | Optional | 16-char App Password | SMTP application password. |
| `BREVO_API_KEY` | Optional | `xkeysib-...` | Brevo HTTPS API key (works on Render Free). |

> [!CAUTION]
> Never commit your real `.env` file or credentials to source control. The `.gitignore` file is configured to strictly exclude `.env`.

---

## 10. Database Setup

1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Under **Database Access**, create a database user with Read/Write privileges.
3. Under **Network Access**, add `0.0.0.0/0` (allow access from anywhere) to allow Render and local development connections.
4. Copy the standard connection string (`mongodb+srv://...`) into `MONGODB_URI` in `.env`.
5. The application automatically creates and verifies indexes on `users`, `transactions`, `savingsgoals`, and `categories`. If MongoDB is temporarily unreachable, the server logs a warning and enters memory-fallback mode without crashing.

For comprehensive schema documentation, consult [docs/DATABASE_ARCHITECTURE.md](file:///d:/arthobachao-ai/docs/DATABASE_ARCHITECTURE.md).

---

## 11. Gemini API Setup

1. Visit [Google AI Studio](https://aistudio.google.com/) and generate an API key.
2. Place the key in `.env` as `GEMINI_API_KEY="your_api_key_here"`.
3. In `server/config/geminiConfig.ts`, the application configures approved models (`gemini-2.5-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`) and incorporates automatic retry logic for transient errors (HTTP 503 / 429).
4. The API key is loaded only in `server.ts` and is never bundled into the client-side JavaScript.

---

## 12. Running the Application

Artho AI uses a unified single-process architecture. You do **not** need separate terminal windows for frontend and backend.

### Development Mode
```bash
npm run dev
```
- Spawns the Express backend with Vite in middleware mode.
- Serves the frontend with hot module replacement (HMR) and backend REST APIs on:
  **`http://localhost:3000`**

### Production Mode (Local Simulation)
```bash
npm run build
npm start
```
- Builds client assets into `dist/` and launches the production Express server on port 3000.

---

## 13. Testing

The repository contains automated unit, integration, and regression suites:

```bash
# Run Financial Planning Assistant Suite (8-part plans, 50/30/20, deficits)
npx tsx server/tests/financialPlanningAssistant.test.ts

# Run Factual Extrema & Accuracy Suite (Lowest/Highest category calculations)
npx tsx server/tests/factualAccuracy.test.ts

# Run Savings Planning & Feasibility Suite
npx tsx server/tests/savingsPlan.test.ts

# Run Registration & OTP Bypass Flow Suite
npx tsx server/tests/registrationVerificationFlow.test.ts

# Run Spending Categorization & Normalization Suite
npx tsx server/tests/spendingAnalysisCategorization.test.ts

# Run Financial Health Score Consistency Suite
npx tsx server/tests/financialHealthConsistency.test.ts

# Run Cash Flow Forecast & Buffer Consistency Suite
npx tsx server/tests/cashFlowForecastConsistency.test.ts

# Run Modular Email & OTP Provider Architecture Suite
npx tsx server/tests/modularEmailProviders.test.ts

# Run 100-Case Automated AI Coach Bilingual Evaluation Suite
npm run test:coach-eval
```

For complete test specifications and verification logs, refer to [TESTING.md](file:///d:/arthobachao-ai/TESTING.md).

---

## 14. Build and Lint

```bash
# Check TypeScript types across frontend and backend
npm run lint

# Compile and minify frontend assets for production
npm run build

# Preview the production build locally
npm run preview
```

---

## 15. Deployment

Artho AI is deployed as a single unified Node.js Web Service on **Render**:

- **Repository:** `https://github.com/ahanaf-star/artho-ai` (Branch: `main`)
- **Environment:** Node
- **Build Command:** `npm run build`
- **Start Command:** `npm start`
- **Health Check Endpoint:** `/api/health`

### Post-Deployment Verification
Run a non-destructive check against the live production health endpoint:
```bash
curl -s https://arthobachao-ai.onrender.com/api/health
```
Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "hasGeminiApiKey": true,
  "emailService": { "provider": "smtp", "configured": true }
}
```

For step-by-step production deployment instructions, troubleshooting, and secrets configuration, see [DEPLOYMENT.md](file:///d:/arthobachao-ai/DEPLOYMENT.md).

---

## 16. Security Considerations

- **Password Protection:** User passwords are encrypted with bcrypt using 10 salt rounds before database persistence. Plaintext passwords are never stored or logged.
- **Stateless Tokens:** Authentication sessions use signed JWT tokens (7-day lifespan).
- **Tenant Isolation:** All financial endpoints (`/api/users/:userId/*`, `/api/ai/coach`) verify that the authenticated user ID matches the resource owner, returning `403 Forbidden` on unauthorized access.
- **Server-Side AI Pipeline:** Sensitive keys (`GEMINI_API_KEY`, `MONGODB_URI`, `JWT_SECRET`) reside exclusively on the server and are never delivered in the browser bundle.
- **Number Validator Guard:** Gemini output is audited by regex parsing to ensure no ungrounded monetary figures or percentages are presented to the user.
- **Dependency Audit:** `npm audit` reports zero known vulnerabilities across all production dependencies.

---

## 17. Known Limitations

- **Email OTP Bypass Active:** To facilitate unblocked testing and judge evaluation, `EMAIL_OTP_ENABLED=false` is currently set in production. Registrations succeed immediately without requiring inbox verification.
- **Rate Limiting:** Resend verification incorporates a 60-second cooldown and 5-attempt ceiling, but global IP-based rate limiting (`express-rate-limit`) on general login/signup endpoints is not currently mounted.
- **Render Free Tier Spin-down:** On Render's Free tier, the web service may enter a sleep state after 15 minutes of inactivity. Initial page requests may take 30–50 seconds to wake up the service.
- **Vite Chunk Size:** The minified client bundle size warning (`> 500 kB`) appears during build, which can be further optimized with route-based dynamic imports in future iterations.

---

## 18. Live Application
Explore the live deployed application:
👉 **[https://arthobachao-ai.onrender.com](https://arthobachao-ai.onrender.com)**

---

## 19. Source Repository
Source code is available on GitHub:
👉 **[https://github.com/ahanaf-star/artho-ai](https://github.com/ahanaf-star/artho-ai)**

---

## 20. Responsible Use

Artho AI is an educational personal finance assistant designed to help users track cash flow and organize savings goals. 
- It does **not** execute automated bank transfers or financial transactions.
- It does **not** provide licensed investment, tax, legal, or credit advice.
- AI-generated guidance and forecasts are probabilistic interpretations of recorded transactions and should be reviewed by the user before making consequential financial decisions.

---

## 21. Contributors

- **Ahanaf Muttaky** ([@ahanaf-star](https://github.com/ahanaf-star)) — Full-Stack Architecture, Backend API & AI Integration
- **Abu Ubaydah** ([@abuubaydah2012](https://github.com/abuubaydah2012)) — Product Research, UI/UX Requirements & Financial Planning Domain Design