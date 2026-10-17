# ArthoBachao AI — Database Architecture & Data Pipeline Guide

## 1. Executive Summary & Database Identity
- **Database Engine:** MongoDB Atlas (Cloud-hosted Replica Set)
- **Database Name:** `arthobachao`
- **ODM:** Mongoose v8+
- **Primary Connection Config File:** `server/config/database.ts`
- **Application Architecture:** Unified Node.js Express server + React TypeScript Vite frontend with REST APIs.

The ArthoBachao AI database is dedicated strictly to personal financial health management, budgeting, savings goal tracking, and deterministic financial intelligence for users in Bangladesh.

---

## 2. Environment Variables & Connection Configuration

### Required Server Environment Variables
The application reads database configuration strictly on the server side:

| Variable | Required? | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `MONGODB_URI` | **Yes** | `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority` | MongoDB Atlas connection string with credentials. |
| `MONGODB_DB_NAME` | No | `arthobachao` | Target database name. Defaults explicitly to `arthobachao` in `server/config/database.ts`. |
| `PORT` | No | `3000` | Port for the backend API and Express server. |
| `JWT_SECRET` | **Yes** | `your_secret_key` | Secret key used to sign and verify user authentication tokens. |
| `GEMINI_API_KEY` | **Yes** | `AIzaSy...` | API key for Google Gemini model calls (AI Financial Coach). |

> [!CAUTION]
> `MONGODB_URI`, `JWT_SECRET`, and `GEMINI_API_KEY` must **never** be exposed in the frontend client bundle, committed to Git, or logged with plain credentials.

### Centralized Connection Lifecycle (`server/config/database.ts`)
The connection initialization is centralized with the following guarantees:
1. **Singleton & Duplicate Prevention:** Inspects `mongoose.connection.readyState`. If already connected (`readyState === 1`), reuses the active connection; if connecting (`readyState === 2`), awaits completion.
2. **Safe Database Name Enforcement:** Explicitly passes `{ dbName: targetDbName }` (default `arthobachao`) to prevent accidental creation of fallback default databases (such as `test`).
3. **Credential Masking:** Masks username and password before logging connection attempts: `uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')`.
4. **Graceful Shutdown:** Registers one-time listeners for `SIGINT` and `SIGTERM` signals to cleanly invoke `disconnectDB()`.
5. **Standalone Resilience:** If `MONGODB_URI` is unconfigured or Atlas is temporarily unreachable, logs a clear warning without crashing the Node.js process, allowing standalone mock/fallback modes for non-database operations.

---

## 3. Data Architecture & Collections Inventory

The database `arthobachao` consists of four primary operational collections:

```mermaid
erDiagram
    users ||--o{ transactions : "owns (userId)"
    users ||--o{ savingsgoals : "owns (userId)"
    users ||--o{ categories : "owns (userId)"
    categories ||--o{ transactions : "categorizes (name)"
    savingsgoals ||--o{ transactions : "funded by (goalId / title)"

    users {
        ObjectId _id PK
        string customId UK
        string email UK
        string name
        number monthlyIncome
        array linkedAccounts
        array recurringObligations
        string passwordHash
        string preferredLanguage
        date createdAt
    }

    transactions {
        ObjectId _id PK
        string customId
        string userId FK
        string type "expense | income | transfer"
        number amount
        string category
        string description
        string date "YYYY-MM-DD"
        string merchant
        string account
        string paymentMethod
        number fee
        boolean isRecurring
        date createdAt
    }

    savingsgoals {
        ObjectId _id PK
        string customId
        string userId FK
        string name
        string title
        number targetAmount
        number currentAmount
        string deadline "YYYY-MM-DD"
        string status "On Track | At Risk | Completed"
        number monthlyPace
        date createdAt
    }

    categories {
        ObjectId _id PK
        string customId
        string userId FK
        string name
        string type "expense | income"
        date createdAt
    }
```

### Collection 1: `users`
- **Mongoose Model:** `UserModel` (`server/models/User.ts`)
- **Domain:** User identity, authentication, profile metadata, and financial accounts.
- **Key Fields:**
  - `_id` (`ObjectId`): MongoDB internal identifier.
  - `customId` (`String`, unique, indexed): Application-level ID format (e.g. `usr_...`).
  - `name` (`String`, required): Full user name.
  - `email` (`String`, required, unique, indexed): User email address (lowercased).
  - `passwordHash` (`String`): Salted bcrypt password hash.
  - `monthlyIncome` (`Number`): Benchmark/declared monthly baseline income in BDT (৳).
  - `linkedAccounts` (`Array`): Financial accounts linked by the user:
    - `name` (`String`), `balance` (`Number`), `accountNumber` (`String`), `type` (`String`).
  - `recurringObligations` (`Array`): Fixed bills and recurring obligations (rent, utilities).
  - `preferredLanguage` (`'en' | 'bn'`, default `'en'`).
  - `currency` (`String`, default `'BDT'`).

### Collection 2: `transactions`
- **Mongoose Model:** `TransactionModel` (`server/models/Transaction.ts`)
- **Domain:** Authoritative financial ledger of all inflows, outflows, and account transfers.
- **Key Fields:**
  - `_id` (`ObjectId`): Unique record ID.
  - `customId` (`String`, indexed): Optional application ID.
  - `userId` (`String`, required, indexed): Scopes the transaction to the owning user.
  - `type` (`String`, required, enum: `['expense', 'income', 'transfer']`): Transaction type.
  - `amount` (`Number`, required, min: 0.01): Transaction value in BDT.
  - `category` (`String`, required): Name of expense/income category (standard or custom).
  - `description` (`String`, required): Details of the purchase or deposit.
  - `date` (`String`, required, format `YYYY-MM-DD`): Transaction date in local time.
  - `merchant` (`String`): Counterparty or merchant. Required for expenses, optional for income.
  - `account` (`String`): Source or destination account (e.g., `bKash`, `City Bank`, `Nagad`).
  - `paymentMethod` (`String`): Mechanism (e.g. `bKash QR`, `Debit Card`, `Cash`).
  - `fee` (`Number`): Fee associated with the transaction (e.g., 1.85% MFS cash-out fee).
  - `isRecurring` (`Boolean`): Flag for regular bills or salaries.

### Collection 3: `savingsgoals`
- **Mongoose Model:** `SavingsGoalModel` (`server/models/SavingsGoal.ts`)
- **Domain:** Dedicated financial targets (Emergency fund, Hajj, Eid savings, Tech gadgets).
- **Key Fields:**
  - `_id` (`ObjectId`): Unique target ID.
  - `customId` (`String`, indexed): Application ID (e.g. `goal-...`).
  - `userId` (`String`, required, indexed): Scopes the target to the owner.
  - `name` / `title` (`String`, required): Descriptive name of the goal.
  - `targetAmount` (`Number`, required, min: 1): Target amount in BDT.
  - `currentAmount` (`Number`, default 0): Current accumulated savings in BDT.
  - `deadline` (`String`, required, format `YYYY-MM-DD`): Target completion date.
  - `monthlyPace` (`Number`): Expected monthly contribution.
  - `status` (`String`, enum: `['On Track', 'At Risk', 'Completed']`).
  - `milestones` (`Array`): Milestone progress checkpoints.

### Collection 4: `categories`
- **Mongoose Model:** `CategoryModel` (`server/models/Category.ts`)
- **Domain:** User-defined custom expense and income categories.
- **Key Fields:**
  - `_id` (`ObjectId`): Unique record ID.
  - `customId` (`String`, indexed): Application ID.
  - `userId` (`String`, required, indexed): User who owns this custom category.
  - `name` (`String`, required): Display title (e.g., `Sadaqah`, `Books & Tuition`, `Freelance Fees`).
  - `type` (`String`, enum: `['expense', 'income']`, default `'expense'`).
- **Indexes:** Compound index on `{ userId: 1, name: 1 }` prevents duplicates per user and accelerates category lookup.

---

## 4. Entity Relationships & Scoping
- **Foreign Key Convention:** All user-specific resources (`transactions`, `savingsgoals`, `categories`) store `userId`.
- **User Scoping:**
  When querying user records, queries check both MongoDB `_id` (converted to string) and `customId`:
  ```typescript
  { $or: [{ userId }, { userId: String(userId) }] }
  ```
  Every API endpoint verifies JWT authentication (`requireAuth` or `optionalAuth`) and injects the authenticated `userId`. Unauthenticated clients cannot view or alter another user's documents.
- **Transactions & Categories:**
  Transactions store category names directly as strings (`category: "Food & Groceries"`). Custom categories in `categories` supplement default categories, and spending aggregation dynamically groups transactions by category name.
- **Transactions & Savings Goals:**
  Goal deposits can be linked to transactions via descriptions or explicit goal transfers. Progress calculations compare `currentAmount` with `targetAmount` and calculate the velocity required based on remaining days to `deadline`.

---

## 5. Financial Data Semantics & Calculation Integrity
To ensure strict financial accuracy, the application enforces the following rules:
1. **Benchmark vs. Ledger:**
   - Profile `monthlyIncome`: An expected benchmark or declared expectation. It is **not** treated as an actual transaction.
   - Recorded `income` transactions: Real, authenticated inflows for the month.
   - Recorded `expense` transactions: Real, authenticated outflows for the month.
   - `netSavings = actualIncomes - actualExpenses`.
2. **Transfer Deduplication:**
   - Transactions with `type === 'transfer'` represent internal account transfers (e.g., Bank -> bKash).
   - Transfers are strictly excluded from income and expense aggregates to prevent artificial inflation of cash flow.
3. **Current Balance Source of Truth:**
   - If user has configured `linkedAccounts`, current balance is computed as `sum(linkedAccounts.balance)`.
   - If accounts are not configured, current balance is calculated deterministically as cumulative net cash flow `sum(incomes) - sum(expenses)`.

---

## 6. AI Coach Data Pipeline & Security
The AI Coach operates under strict factual grounding:

```mermaid
sequenceDiagram
    autonumber
    actor User as Authenticated User (Browser)
    participant Client as Frontend (AICoach.tsx / aiService.ts)
    participant Server as Express Server (/api/ai/coach)
    participant DB as MongoDB Atlas (arthobachao)
    participant Engine as Context Builder & Deterministic Engine
    participant Gemini as Google Gemini AI (2.5-flash / 1.5-flash)

    User->>Client: Types question ("How can I save more?")
    Note over Client: Strips client financial data.<br/>Sends only message, language & recent history.
    Client->>Server: POST /api/ai/coach (Bearer JWT)
    Server->>Server: Authenticate token via authUser
    Server->>DB: Fetch user's transactions, goals & userDoc
    DB-->>Server: Authoritative raw records
    Server->>Engine: buildCoachContext(userId)
    Engine-->>Server: Authoritative CoachContext (Dhaka timezone)
    Server->>Gemini: Prompt with Authoritative Facts Block & Strict Number Validation Rule
    alt Gemini Succeeds & Passes Validation
        Gemini-->>Server: Strictly valid JSON ({ answer, factsUsed })
    else Gemini Fails, Times Out, or Number Hallucination Detected
        Server->>Engine: generateDeterministicCoachResponse(intent, coachContext)
        Engine-->>Server: Deterministic factual response
    end
    Server-->>Client: HTTP 200 { answer, source, factsUsed }
    Client-->>User: Displays verified financial advice
```

### Pipeline Guarantees:
1. **Client Never Injects Totals:** Authenticated requests send only `{ message, language, history }`. The client never sends `financialContext` or totals.
2. **Server-Side Single Source of Truth:** `buildCoachContext(userId)` reads the authenticated user's records directly from MongoDB Atlas.
3. **Zero Fabricated Fallback Figures:** All client fallback mock numbers (`৳১৬,০০০`, `৳৮,২০০`, `৳৩,২০০`) have been eliminated. In the event of network disruption, a transparent connection error is displayed.
4. **Validation Guardrails:** `validateCoachNumbers` parses every number in Gemini's response and verifies it against the precomputed facts block. Any hallucinated figure immediately triggers the deterministic fallback engine.

---

## 7. Connecting to MongoDB

### Local Development Setup
1. Create a local `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```
2. Set your Atlas connection string in `.env`:
   ```env
   PORT=3000
   MONGODB_URI="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/arthobachao?retryWrites=true&w=majority"
   MONGODB_DB_NAME="arthobachao"
   GEMINI_API_KEY="AIzaSy..."
   JWT_SECRET="dev-jwt-secret-key-32-chars-minimum"
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Verify connection output in your terminal:
   ```
   [Database] Connecting to MongoDB (arthobachao) at mongodb+srv://***:***@...
   [Database] MongoDB connected successfully to database "arthobachao".
   ```

### Render Deployment Configuration
1. Open your Web Service dashboard on [Render](https://dashboard.render.com).
2. Navigate to **Environment**.
3. Add the following Environment Variables:
   - `MONGODB_URI`: Atlas connection string.
   - `MONGODB_DB_NAME`: `arthobachao`
   - `GEMINI_API_KEY`: Production Gemini API key.
   - `JWT_SECRET`: Production random 64-character secret.
4. Trigger a manual deploy.
5. In Render's live logs, verify:
   ```
   [Database] MongoDB connected successfully to database "arthobachao".
   ```

### Verifying Connection Health
- Call the health check endpoint:
  ```bash
  curl http://localhost:3000/api/health
  # Or on production:
  curl https://arthobachao-ai.onrender.com/api/health
  ```
- Expected JSON response:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-17T09:00:00.000Z",
    "database": "connected",
    "databaseName": "arthobachao",
    "ai": "configured"
  }
  ```

---

## 8. Data Inspection Using MongoDB Compass
To inspect and manage live records safely using MongoDB Compass:
1. Download and open **MongoDB Compass**.
2. Paste your Atlas connection string into the New Connection box:
   `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/`
3. Click **Connect**.
4. In the left database navigation panel, locate and click **`arthobachao`**.
5. You will see the four collections:
   - `users`
   - `transactions`
   - `savingsgoals`
   - `categories`
6. Useful Compass Filters:
   - Find transactions for a specific user:
     `{ "userId": "usr_demo_01" }`
   - Find high-value expenses:
     `{ "type": "expense", "amount": { "$gt": 5000 } }`
   - Find active savings goals:
     `{ "status": "On Track" }`

---

## 9. Safe Backup & Disaster Recovery Procedures
To prevent data loss and ensure business continuity:

### 1. MongoDB Atlas Automated Snapshots (Recommended)
- Enable Cloud Backup in MongoDB Atlas (under **Cluster > Backup**).
- Atlas maintains automated continuous point-in-time restores (up to 35 days) with zero impact on production performance.

### 2. Manual Backup with `mongodump`
To export a timestamped logical dump of the `arthobachao` database:
```bash
mongodump --uri="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/arthobachao" --out="./backups/backup-$(date +%Y%m%d_%H%M%S)"
```

### 3. Restoring from a Backup with `mongorestore`
```bash
mongorestore --uri="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/arthobachao" --drop ./backups/backup-20261017_150000/arthobachao
```
> [!WARNING]
> Use `--drop` with extreme caution. It replaces existing collections before restoring.

---

## 10. Security & Credential Hygiene Checklist
- [x] `.env` is listed in `.gitignore` and never committed to version control.
- [x] `MONGODB_URI` and `GEMINI_API_KEY` are read exclusively by server-side modules.
- [x] Vite client build (`dist/assets/`) contains zero server environment secrets.
- [x] All database queries for transactions, goals, and categories filter strictly by `userId`.
- [x] Passwords are never stored in plaintext (salted bcrypt hash via `bcryptjs`).
- [x] Passwords, secret keys, and connection credentials are masked in server logs.
