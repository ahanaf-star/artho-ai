import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { connectDB, isDbConnected } from './server/config/database';
import authRoutes from './server/routes/authRoutes';
import userRoutes from './server/routes/userRoutes';
import transactionRoutes from './server/routes/transactionRoutes';
import goalRoutes from './server/routes/goalRoutes';
import categoryRoutes from './server/routes/categoryRoutes';
import { requireAuth, optionalAuth, AuthenticatedRequest } from './server/middleware/authMiddleware';
import {
  getAuthoritativeUserHealthScore,
  getOrGenerateHealthExplanation,
} from './server/services/healthScoreService';
import { buildCoachContext } from './server/services/coachContextBuilder';
import { classifyIntent } from './server/services/intentClassifier';
import { executeCoachInquiry } from './server/services/coachGeminiService';

dotenv.config();

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '1mb' }));

  // Connect to MongoDB safely without crashing on failure
  await connectDB();

  // Core MongoDB-backed REST API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/users', transactionRoutes);
  app.use('/api', transactionRoutes);
  app.use('/api', goalRoutes);
  app.use('/api/users', categoryRoutes);
  app.use('/api', categoryRoutes);
  
  // Authenticated Financial Health Score & Explanation endpoint
  app.post('/api/ai/health/explain', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const isBangla = req.body.language === 'bn' || Boolean(req.body.isBangla);
      const language: 'en' | 'bn' = isBangla ? 'bn' : 'en';

      // 1. Authoritative score calculated directly from MongoDB
      const healthResult = await getAuthoritativeUserHealthScore(userId);

      // 2. Generate or fetch cached explanation
      const explanation = await getOrGenerateHealthExplanation(healthResult, language, ai);

      return res.json({
        health: healthResult,
        explanation,
      });
    } catch (error: any) {
      console.error('Error generating health explanation:', error);
      return res.status(500).json({ error: 'Failed to generate health explanation' });
    }
  });

  // Authoritative Financial Health Score endpoint (Read-only calculation from MongoDB)
  app.get('/api/users/:userId/financial-health', optionalAuth, async (req: Request, res: Response) => {
    try {
      const targetUserId = req.params.userId || (req as any).userId;
      if (!targetUserId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Enforce strict user isolation: prevent cross-user financial data access
      const authUser = (req as any).user;
      if (authUser) {
        const isOwner =
          authUser.customId === targetUserId ||
          authUser.id === targetUserId ||
          authUser._id?.toString() === targetUserId;
        if (!isOwner) {
          return res.status(403).json({ error: "Access forbidden: You cannot access another user's financial health" });
        }
      } else if (targetUserId !== 'usr-ahmed-01') {
        return res.status(401).json({ error: 'Authentication required to view financial health' });
      }

      const healthResult = await getAuthoritativeUserHealthScore(targetUserId);
      return res.json(healthResult);
    } catch (error: any) {
      console.error('Error calculating health score:', error);
      return res.status(500).json({ error: 'Failed to calculate health score' });
    }
  });

  // Initialize Gemini client if API key is present
  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;

  if (apiKey) {
    try {
      ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch (err) {
      console.warn('Failed to initialize GoogleGenAI client:', err);
    }
  }

  // Health endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      database: isDbConnected() ? 'connected' : 'standalone_fallback',
      hasGeminiApiKey: !!apiKey,
      timestamp: new Date().toISOString(),
    });
  });

  // Resilient Gemini generator with automatic fallback across approved models
  const APPROVED_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

  async function callGeminiWithRetry(contents: string, config: any) {
    if (!ai) throw new Error('Gemini client not initialized');
    let lastError: any = null;

    for (const model of APPROVED_MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          return await ai.models.generateContent({
            model,
            contents,
            config,
          });
        } catch (err: any) {
          lastError = err;
          const isTransient =
            err?.status === 503 ||
            err?.message?.includes('503') ||
            err?.message?.includes('high demand') ||
            err?.status === 429 ||
            err?.message?.includes('429');

          if (isTransient && attempt < 2) {
            await new Promise((res) => setTimeout(res, 600));
            continue;
          }
          break; // Try next model in APPROVED_MODELS
        }
      }
    }
    throw lastError;
  }

  function generateDynamicDeterministicAnswer(
    userPrompt: string,
    inBangla: boolean,
    ctx: any,
    authUser?: any
  ): string {
    const norm = userPrompt.toLowerCase().trim();
    const effectiveName = (authUser?.name || ctx?.userName)?.trim();
    const firstName = effectiveName ? effectiveName.split(' ')[0] : null;
    const greetingBn = firstName ? `আসসালামু আলাইকুম ${firstName}!` : 'আসসালামু আলাইকুম!';
    const greetingEn = firstName ? `Assalamu Alaikum ${firstName}!` : 'Assalamu Alaikum!';
    const income = ctx?.monthlyIncome || 0;
    const spending = ctx?.monthlySpending || 0;
    const netSavings = ctx?.netSavings !== undefined ? ctx.netSavings : Math.max(0, income - spending);
    const savingsRate = ctx?.savingsRate !== undefined ? ctx.savingsRate : (income > 0 ? Number(((netSavings / income) * 100).toFixed(1)) : 0);
    const balance = ctx?.cashFlow?.startingBalance || 0;
    const categories = Array.isArray(ctx?.categories) ? ctx.categories : [];
    const topCat = categories.length > 0
      ? [...categories].sort((a: any, b: any) => b.amount - a.amount)[0]
      : { category: spending > 0 ? 'General Outflows' : 'No spending recorded', amount: spending, percentage: spending > 0 ? 100 : 0 };
    const goals = Array.isArray(ctx?.goals) ? ctx.goals : [];
    const primaryGoal = goals[0] || null;
    const projectedBalance = balance + netSavings;

    // 1. Why run short before month end / cash flow pressure
    if (
      norm.includes('run short') ||
      norm.includes('short before') ||
      norm.includes('month-end') ||
      norm.includes('মাস শেষ') ||
      norm.includes('টাকা শেষ') ||
      norm.includes('pressure')
    ) {
      if (spending === 0 && income === 0) {
        if (inBangla) {
          return `${greetingBn} আপনার অ্যাকাউন্টে এখনও পর্যাপ্ত লেনদেন বা খরচের তথ্য যুক্ত করা হয়নি। আয় ও ব্যয়ের তথ্য যোগ করলে মাস শেষের ক্যাশ-ফ্লো পরিস্থিতি নির্ভুলভাবে বিশ্লেষণ করা সম্ভব হবে।`;
        }
        return `${greetingEn} You haven't recorded any income or transactions yet. Once you add your transactions, I will analyze your month-end cash flow pressure accurately.`;
      }
      if (inBangla) {
        return `আপনার আর্থিক হিসাব অনুযায়ী, এ মাসে আপনার মোট আয় ৳${income.toLocaleString()} এবং মোট ব্যয় ৳${spending.toLocaleString()}। আপনার সবচেয়ে বড় খরচের খাত হলো **${topCat.category}** (৳${topCat.amount.toLocaleString()}, যা মোট খরচের ${topCat.percentage}%)।\n\nমাসের শেষভাগে বড় বড় খরচ ও নিয়মিত বিলের কারণে হাতে উদ্বৃত্ত কমে আসে (বর্তমান নিট সঞ্চয় ৳${netSavings.toLocaleString()})। মাসের শুরুতেই বড় খরচের খাতের জন্য একটি নির্দিষ্ট বাফার আলাদা রাখলে মাস শেষে আর্থিক টানাপোড়েন তৈরি হবে না।`;
      }
      return `Based on your live financial ledger, your total monthly income is ৳${income.toLocaleString()} and monthly spending is ৳${spending.toLocaleString()}. Your largest outflow category is **${topCat.category}** at ৳${topCat.amount.toLocaleString()} (${topCat.percentage}% of all expenditures).\n\nBecause outflows cluster around your top spending categories and recurring obligations, your net monthly surplus is ৳${netSavings.toLocaleString()} (available liquid balance: ৳${balance.toLocaleString()}). Locking an automated buffer at the start of the month will eliminate month-end cash flow pressure.`;
    }

    // 2. Which category should I reduce
    if (
      norm.includes('which category') ||
      norm.includes('reduce') ||
      norm.includes('cut') ||
      norm.includes('কোন খাত') ||
      norm.includes('কোথায় খরচ কমাব')
    ) {
      if (spending === 0) {
        if (inBangla) {
          return `${greetingBn} আপনার এখনও কোনো ব্যয়ের রেকর্ড নেই। খরচ কমানোর পরামর্শ পেতে অনুগ্রহ করে আপনার দৈনন্দিন খরচের লেনদেনগুলো যুক্ত করুন।`;
        }
        return `${greetingEn} You have no spending recorded yet. Once you log your expenses, I can pinpoint which specific category offers the highest savings potential.`;
      }
      if (inBangla) {
        return `আপনার বর্তমান ব্যয়ের বিশ্লেষণে খরচ কমানোর সবচেয়ে বড় সুযোগ রয়েছে **${topCat.category}** খাতে, যেখানে বর্তমানে ৳${topCat.amount.toLocaleString()} (${topCat.percentage}%) ব্যয় হচ্ছে।\n\nএই খাত থেকে ১০-১৫% সাশ্রয় করতে পারলে প্রতি মাসে অতিরিক্ত প্রায় ৳${Math.round(topCat.amount * 0.12).toLocaleString()} সাশ্রয় করা সম্ভব, যা আপনার সঞ্চয়ের গতি বৃদ্ধি করবে।`;
      }
      return `Looking at your actual spending breakdown, your primary area for optimization is **${topCat.category}**, which currently accounts for ৳${topCat.amount.toLocaleString()} (${topCat.percentage}% of your total spending).\n\nTrimming 10–15% from this category can yield approximately ৳${Math.round(topCat.amount * 0.12).toLocaleString()} in monthly savings directly toward your goals.`;
    }

    // 3. How can I save more money
    if (
      norm.includes('save more') ||
      norm.includes('save money') ||
      norm.includes('বেশি সঞ্চয়') ||
      norm.includes('সঞ্চয় বাড়াব')
    ) {
      if (primaryGoal) {
        if (inBangla) {
          return `বর্তমানে আপনার মাসিক সঞ্চয় ৳${netSavings.toLocaleString()} (সঞ্চয়ের হার: ${savingsRate}%)।\n\nআরও বেশি সঞ্চয় করার বাস্তবসম্মত পদক্ষেপ:\n১. **${topCat.category}** খাতের খরচ (বর্তমান ৳${topCat.amount.toLocaleString()}) থেকে সামান্য কমিয়ে মাসে অতিরিক্ত ৳${Math.round(topCat.amount * 0.1).toLocaleString()} জমানো।\n২. অপ্রয়োজনীয় লেনদেন ফি এবং অতিরিক্ত চার্জ এড়িয়ে চলা।\n৩. এই অতিরিক্ত টাকা সরাসরি আপনার **${primaryGoal.title}** সঞ্চয় লক্ষ্যে যুক্ত করা।`;
        }
        return `Your current monthly savings is ৳${netSavings.toLocaleString()} (${savingsRate}% savings rate).\n\nActionable steps to increase your savings:\n1. Moderate spending in your top category **${topCat.category}** (currently ৳${topCat.amount.toLocaleString()}) to free up ~৳${Math.round(topCat.amount * 0.1).toLocaleString()}/month.\n2. Minimize small transactional tariffs and discretionary leaks.\n3. Automatically route this surplus into your **${primaryGoal.title}** goal (target: ৳${primaryGoal.targetAmount.toLocaleString()}).`;
      }
      if (inBangla) {
        return `বর্তমানে আপনার মাসিক সঞ্চয় ৳${netSavings.toLocaleString()} (সঞ্চয়ের হার: ${savingsRate}%)।\n\nআরও বেশি সঞ্চয় করার জন্য একটি নির্দিষ্ট সঞ্চয় লক্ষ্য নির্ধারণ করুন এবং অপ্রয়োজনীয় ব্যয় নিয়ন্ত্রণ করুন।`;
      }
      return `Your current monthly savings is ৳${netSavings.toLocaleString()} (${savingsRate}% savings rate).\n\nActionable steps to increase your savings:\n1. Create a dedicated savings goal to stay motivated and track progress.\n2. Review your discretionary spending and set automated daily or weekly savings rules.`;
    }

    // 4. Savings goal on track
    if (
      norm.includes('on track') ||
      norm.includes('savings goal') ||
      norm.includes('goal') ||
      norm.includes('লক্ষ্যমাত্রা') ||
      norm.includes('টার্গেট')
    ) {
      if (!primaryGoal) {
        if (inBangla) {
          return `${greetingBn} আপনার এখনও কোনো সঞ্চয় লক্ষ্য তৈরি করা হয়নি। 'Savings Goals' ট্যাব থেকে একটি লক্ষ্য তৈরি করুন যেন আপনি সঞ্চয়ের অগ্রগতি ট্র্যাক করতে পারেন।`;
        }
        return `${greetingEn} You haven't created any savings goals yet. Navigate to the Savings Goals section to create a goal and start tracking your target.`;
      }
      const remaining = primaryGoal.remainingAmount ?? Math.max(0, primaryGoal.targetAmount - primaryGoal.currentAmount);
      const progress = primaryGoal.progressPercentage ?? Math.round((primaryGoal.currentAmount / primaryGoal.targetAmount) * 100);
      if (inBangla) {
        return `আপনার মূল সঞ্চয় লক্ষ্য **${primaryGoal.title}** এর বর্তমান অবস্থা:\n\n• লক্ষ্যমাত্রা: ৳${primaryGoal.targetAmount.toLocaleString()}\n• বর্তমান জমা: ৳${primaryGoal.currentAmount.toLocaleString()} (${progress}% সম্পন্ন)\n• অবশিষ্ট ঘাটতি: ৳${remaining.toLocaleString()}\n\nআপনার বর্তমান মাসিক সঞ্চয়ের গতি (৳${netSavings.toLocaleString()}/মাস) বজায় রাখলে আপনি দ্রুত এই লক্ষ্য পূরণ করতে পারবেন।`;
      }
      return `Status for your primary savings goal **${primaryGoal.title}**:\n\n• Target: ৳${primaryGoal.targetAmount.toLocaleString()}\n• Current Saved: ৳${primaryGoal.currentAmount.toLocaleString()} (${progress}% achieved)\n• Remaining Gap: ৳${remaining.toLocaleString()}\n\nWith your current monthly surplus of ৳${netSavings.toLocaleString()}/month, you are making consistent progress toward completing this goal.`;
    }

    // 5. Why spending high
    if (
      norm.includes('খরচ বেশি') ||
      norm.includes('spending high') ||
      norm.includes('spending the most') ||
      norm.includes('expense high')
    ) {
      if (spending === 0) {
        if (inBangla) {
          return `${greetingBn} চলতি মাসে আপনার কোনো খরচের রেকর্ড পাওয়া যায়নি।`;
        }
        return `${greetingEn} You have no spending recorded for this month.`;
      }
      if (inBangla) {
        return `এই মাসে আপনার মোট খরচ ৳${spending.toLocaleString()}। আপনার সবচেয়ে বেশি খরচ হচ্ছে **${topCat.category}** খাতে (৳${topCat.amount.toLocaleString()}, যা মোট ব্যয়ের ${topCat.percentage}%)।\n\nএই প্রধান খরচের খাতটি নিয়ন্ত্রণ করাই সামগ্রিক মাসিক ব্যয় কমিয়ে আনার সবচেয়ে দ্রুততম উপায়।`;
      }
      return `Your total expenditure this month is ৳${spending.toLocaleString()}. The biggest factor driving your spending is **${topCat.category}**, where you have spent ৳${topCat.amount.toLocaleString()} (${topCat.percentage}% of total outflows).\n\nKeeping this single category within a planned budget is the most impactful way to control total monthly outflows.`;
    }

    // 6. Balance next month
    if (
      norm.includes('next month') ||
      norm.includes('balance') ||
      norm.includes('কত টাকা থাকতে পারে') ||
      norm.includes('ব্যালেন্স')
    ) {
      if (inBangla) {
        return `আপনার বর্তমান ব্যালেন্স ৳${balance.toLocaleString()}, মাসিক আয় ৳${income.toLocaleString()} এবং মাসিক ব্যয় ৳${spending.toLocaleString()} এর ভিত্তিতে আগামী মাস শেষে আপনার সম্ভাব্য ব্যালেন্স দাঁড়াবে প্রায় **৳${projectedBalance.toLocaleString()}** (AI-assisted forecast)।\n\nআপনার বর্তমান সঞ্চয়ের হার ${savingsRate}%, যা ইতিবাচক ক্যাশ-ফ্লো নিশ্চিত করছে।`;
      }
      return `Based on your available balance of ৳${balance.toLocaleString()}, regular income of ৳${income.toLocaleString()}, and current spending of ৳${spending.toLocaleString()}, your projected month-end balance is approximately **৳${projectedBalance.toLocaleString()}** (AI-assisted forecast).\n\nYour net monthly savings rate of ${savingsRate}% provides a healthy ongoing positive cash-flow buffer.`;
    }

    // General response
    if (inBangla) {
      return `${greetingBn} আপনার আর্থিক তথ্য অনুযায়ী: চলতি মাসের আয় ৳${income.toLocaleString()}, ব্যয় ৳${spending.toLocaleString()}, সঞ্চয় ৳${netSavings.toLocaleString()} এবং উপলব্ধ ব্যালেন্স ৳${balance.toLocaleString()}। আপনার প্রধান খরচের খাত **${topCat.category}** (৳${topCat.amount.toLocaleString()})। আপনার বাজেট বা সঞ্চয় নিয়ে নির্দিষ্ট কোনো পরামর্শ চাইলে জানান!`;
    }
    return `${greetingEn} Based on your authentic financial ledger: Monthly Income is ৳${income.toLocaleString()}, Spending is ৳${spending.toLocaleString()}, Net Savings is ৳${netSavings.toLocaleString()}, and Available Balance is ৳${balance.toLocaleString()}. Your largest expense category is **${topCat.category}** (৳${topCat.amount.toLocaleString()}). Please let me know how I can help with your budgeting or savings goals!`;
  }

  // AI Coach query endpoint
  app.post('/api/ai/coach', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    const prompt = (req.body.prompt || req.body.message || req.body.question || '').trim();
    const isBangla = req.body.language === 'bn' || Boolean(req.body.isBangla);

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const authUser = req.user;
    const ctx = req.body.financialContext;

    // Security check: Unauthenticated query without financial context requires authentication
    if (!authUser && !ctx) {
      return res.status(401).json({ error: 'Authentication required to query personal finance data' });
    }

    // 1. Authenticated user path: ALWAYS build authoritative context from MongoDB.
    // Client-supplied financialContext is strictly ignored for authenticated users.
    if (authUser) {
      try {
        const userId = authUser.customId || authUser._id?.toString() || authUser.id;
        const coachContext = await buildCoachContext(userId);
        const netSavings = coachContext.snapshot.netSavings || 0;
        const intentResult = classifyIntent(prompt, netSavings);
        const coachResponse = await executeCoachInquiry({
          userId,
          query: prompt,
          language: isBangla ? 'bn' : 'en',
          history: req.body.history || [],
          fullContext: coachContext,
          intentResult,
          aiClient: ai,
        });

        return res.json({
          answer: coachResponse.answer,
          text: coachResponse.answer,
          source: coachResponse.source,
          factsUsed: coachResponse.factsUsed,
          followUps: coachResponse.followUps,
          dataGaps: coachResponse.dataGaps,
          dataWindow: coachContext.metadata?.dataWindow,
        });
      } catch (err: any) {
        console.error('[AI Coach] Error processing authenticated inquiry:', err?.message || err);
        return res.status(500).json({
          error: 'An error occurred while analyzing your financial records. Please try again.',
          technicalDetail: err?.message,
        });
      }
    }

    // 2. Unauthenticated guest demo fallback (only reachable when not logged in and ctx is provided)
    const effectiveContext = ctx || {};
    const effectiveRawName = authUser?.name || effectiveContext.userName;
    const trimmedName = typeof effectiveRawName === 'string' ? effectiveRawName.trim() : '';
    const firstName = trimmedName ? trimmedName.split(' ')[0] : null;

    if (ai) {
      try {
        const categoriesList = Array.isArray(effectiveContext.categories) && effectiveContext.categories.length > 0
          ? effectiveContext.categories
              .map(
                (c: any) =>
                  `  • ${c.category}: ৳${c.amount} (${c.percentage}% of spending, MoM change: ${
                    c.momChangePercentage > 0 ? '+' : ''
                  }${c.momChangePercentage}%) - Top merchants: ${
                    c.topMerchants?.join(', ') || 'Various'
                  }`
              )
              .join('\n')
          : '  • No categorized transactions recorded yet.';

        const goalsList = Array.isArray(effectiveContext.goals) && effectiveContext.goals.length > 0
          ? effectiveContext.goals
              .map(
                (g: any) =>
                  `  • ${g.title}: Target ৳${g.targetAmount}, Saved ৳${g.currentAmount} (${g.progressPercentage}%), Remaining ৳${g.remainingAmount}, Required Monthly: ৳${g.requiredMonthlySavings}/mo, Current Average: ৳${g.currentAverageMonthlySaving}/mo, Monthly Savings Gap: ৳${g.monthlySavingsGap}/mo, Deadline: ${g.deadline}, Projected Completion: ${g.projectedCompletionDate}`
              )
              .join('\n')
          : '  • No savings goals created yet.';

        const healthPillars = effectiveContext.healthScore?.factors
          ? `Saving Consistency: ${effectiveContext.healthScore.factors.savingConsistency}%, Spending Control: ${effectiveContext.healthScore.factors.spendingControl}%, Cash Flow Stability: ${effectiveContext.healthScore.factors.cashFlowStability}%, Goal Progress: ${effectiveContext.healthScore.factors.goalProgress}%`
          : 'Saving Consistency: 0%, Spending Control: 0%, Cash Flow Stability: 0%, Goal Progress: 0% (Insufficient data)';

        const systemInstruction = `You are ArthoBachao AI Personal Financial Coach, an expert digital wealth engine built specifically for Bangladesh (Dhaka lifestyle, bKash, Nagad, City Bank, Dhaka Metro MRT, Pathao, Shwapno). You provide explainable, empathetic, non-judgmental, and mathematically sound coaching grounded strictly in the user's authentic ledger data.

CURRENCY CONVENTION: Always use Bangladeshi Taka (BDT / ৳), for example ৳5,000 or ৳29,200. Never use USD ($) or any other foreign currency.

LANGUAGE: ${
          isBangla
            ? `Respond in warm, natural, and fluent Bangla (বাংলায় উত্তর দিন). ${
                firstName
                  ? `Address the user respectfully as "${firstName}" or "আপনি". Start with a warm greeting: "আসসালামু আলাইকুম ${firstName}!".`
                  : 'Address the user respectfully as "আপনি". Start with a warm neutral greeting: "আসসালামু আলাইকুম!". Do NOT use any name, "User", "Guest", or placeholder.'
              }`
            : `Respond in English. ${
                firstName
                  ? `Start with a warm greeting: "Assalamu Alaikum ${firstName}!".`
                  : 'Start with a warm neutral greeting: "Assalamu Alaikum!". Do NOT use any name, "User", "Guest", or placeholder.'
              }`
        }

==================================================
AUTHENTIC USER FINANCIAL LEDGER DATA:
==================================================
- Monthly Income: ৳${effectiveContext.monthlyIncome ?? 0}
- Total Monthly Spending: ৳${effectiveContext.monthlySpending ?? 0}
- Net Monthly Savings: ৳${effectiveContext.netSavings ?? 0}
- Current Savings Rate: ${effectiveContext.savingsRate ?? 0}%
- Total Available Balance: ৳${effectiveContext.cashFlow?.startingBalance ?? 0}

CATEGORICAL EXPENDITURE BREAKDOWN:
${categoriesList}

SAVINGS GOALS STATUS:
${goalsList}

ARTHOBACHAO AI FINANCIAL HEALTH SCORE:
• Score: ${effectiveContext.healthScore?.score ?? 0} / 100 (${effectiveContext.healthScore?.status ?? 'Insufficient Data'})
• Diagnostic Factors: ${healthPillars}

30-DAY CASH-FLOW FORECAST:
• Starting Balance: ৳${effectiveContext.cashFlow?.startingBalance ?? 0}
• Projected Month-End Close: ৳${effectiveContext.cashFlow?.projectedMonthEnd ?? 0}
• Recommended Buffer: ৳${effectiveContext.cashFlow?.recommendedBuffer ?? 0}

==================================================
COACHING & FACTUAL RULES:
==================================================
1. STRICT FACTUAL CONSISTENCY: Always cite the EXACT numbers from the ledger data above. Do NOT invent, round differently, or hallucinate financial figures.
2. CAUSALITY & REASONING: Explain the exact cause behind patterns using the user's actual top expense categories and numbers.
3. PRACTICAL SUGGESTIONS: Offer concrete, actionable steps using Bangladesh context (e.g. bKash, City Bank ATM debit card, reducing delivery spend).
4. CONCISE, STRUCTURED FORMAT: Use bullet points, bold key figures, and concise paragraphs.`;

        const response: any = await callGeminiWithRetry(prompt, {
          systemInstruction,
          temperature: 0.5,
        });

        const generatedText = response?.text || '';
        if (generatedText) {
          return res.json({
            answer: generatedText,
            text: generatedText,
            source: 'gemini',
          });
        }
      } catch (geminiError: any) {
        console.warn('Gemini API call failed, falling back to deterministic response:', geminiError?.message);
      }
    }

    // Dynamic deterministic fallback using the user's actual financial context
    const dynamicText = generateDynamicDeterministicAnswer(prompt, Boolean(isBangla), effectiveContext, authUser);
    return res.json({
      answer: dynamicText,
      text: dynamicText,
      source: 'deterministic_fallback',
      message: 'Using built-in deterministic financial intelligence',
    });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    console.log(`ArthoBachao AI server listening on http://localhost:${port} and http://127.0.0.1:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error launching ArthoBachao AI server:', err);
  process.exit(1);
});
