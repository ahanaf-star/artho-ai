import crypto from 'crypto';
import { TransactionModel } from '../models/Transaction';
import { SavingsGoalModel } from '../models/SavingsGoal';
import { UserModel } from '../models/User';
import {
  calculateFinancialHealthScore,
  DEFAULT_FINANCIAL_HEALTH_CONFIG,
} from '../../src/services/financialCalculations';
import {
  FinancialHealthResult,
} from '../../src/types/financial';
import { GoogleGenAI } from '@google/genai';
import { PRIMARY_GEMINI_MODEL } from '../config/geminiConfig';

export interface HealthScoreExplanation {
  summary: string;
  strengths: string[];
  attentionAreas: string[];
  suggestions: string[];
  nextStep: string;
  source: 'ai' | 'fallback';
  contextHash: string;
}

// In-memory cache for explanations: key = `${contextHash}_${language}`
const explanationCache = new Map<string, { explanation: HealthScoreExplanation; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

/**
 * Generate a deterministic hash representing the exact numerical state of the health score.
 */
export function generateHealthContextHash(result: FinancialHealthResult): string {
  const payload = {
    status: result.status,
    score: result.score,
    category: result.category,
    confidence: result.confidence,
    components: result.components.map((c) => ({
      key: c.key,
      score: c.score,
      available: c.available,
      rawValue: c.rawValue,
    })),
    dataWindow: result.dataWindow,
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

/**
 * Fetches data from MongoDB for the authenticated user and calculates the Financial Health Score.
 * Scoped strictly to authenticated userId.
 */
export async function getAuthoritativeUserHealthScore(
  userId: string
): Promise<FinancialHealthResult> {
  const user = await UserModel.findOne({
    $or: [
      { customId: userId },
      ...(userId.length === 24 ? [{ _id: userId }] : []),
    ],
  });

  const userIds = [userId];
  if (user) {
    if (user.customId && !userIds.includes(user.customId)) userIds.push(user.customId);
    if (user._id && !userIds.includes(user._id.toString())) userIds.push(user._id.toString());
  }

  const [transactions, goals] = await Promise.all([
    TransactionModel.find({ userId: { $in: userIds } }).sort({ date: -1 }).lean(),
    SavingsGoalModel.find({ userId: { $in: userIds } }).sort({ createdAt: -1 }).lean(),
  ]);

  const monthlyIncome = user?.monthlyIncome || 0;

  // Format transactions and goals for calculation function
  const formattedTxs: any[] = transactions.map((t: any) => ({
    id: t.customId || t._id?.toString(),
    type: t.type,
    amount: t.amount,
    category: t.category,
    description: t.description || '',
    date: t.date,
    merchant: t.merchant || '',
    classification: t.classification || 'essential',
    isAnomaly: t.isAnomaly || false,
    fee: t.fee || 0,
  }));

  const formattedGoals: any[] = goals.map((g: any) => ({
    id: g.customId || g._id?.toString(),
    title: g.title || g.name || 'Savings Goal',
    name: g.name || g.title || 'Savings Goal',
    targetAmount: g.targetAmount,
    currentAmount: g.currentAmount,
    deadline: g.deadline,
    category: g.category || 'General Savings',
    status: g.status || 'On Track',
  }));

  return calculateFinancialHealthScore({
    transactions: formattedTxs,
    goals: formattedGoals,
    monthlyIncome,
  });
}

/**
 * Deterministic local fallback explanation generator in English & Bengali.
 * Does not depend on Gemini or network calls.
 */
export function generateDeterministicHealthExplanation(
  health: FinancialHealthResult,
  language: 'en' | 'bn',
  contextHash: string
): HealthScoreExplanation {
  const isBn = language === 'bn';

  if (health.status === 'insufficient_data' || health.score === null) {
    return {
      summary: isBn
        ? 'আপনার আর্থিক স্বাস্থ্য স্কোর নির্ণয় করার জন্য পর্যাপ্ত ডেটা পাওয়া যায়নি। নির্ভুল স্কোরের জন্য নিয়মিত লেনদেন এবং সঞ্চয় লক্ষ্য যুক্ত করুন।'
        : 'Insufficient financial records to calculate an accurate health score. Add regular transactions and savings goals to unlock full score evaluation.',
      strengths: isBn ? ['অ্যাকাউন্ট চালু রয়েছে'] : ['Active Account Setup'],
      attentionAreas: isBn
        ? ['কমপক্ষে ৩ মাসের লেনদেনের ইতিহাস প্রয়োজন', 'সঞ্চয় লক্ষ্য যুক্ত করা প্রয়োজন']
        : ['Minimum 3 months of transaction history required', 'Active savings goals needed'],
      suggestions: isBn
        ? [
            'দৈনন্দিন আয় ও ব্যয়ের তথ্য যুক্ত করুন।',
            'একটি জরুরি তহবিল (Emergency Fund) লক্ষ্য তৈরি করুন।',
            'মোবাইল ব্যাংকিং ও ক্যাশ খরচের হিসাব রেকর্ড রাখুন।',
          ]
        : [
            'Record daily income and expense transactions regularly.',
            'Establish a dedicated Emergency Fund savings goal.',
            'Track MFS and cash spending habits to build history.',
          ],
      nextStep: isBn
        ? 'প্রথমেই একটি সঞ্চয় লক্ষ্য এবং সাম্প্রতিক লেনদেন যোগ করুন।'
        : 'Add your latest transactions and configure your primary savings goal to begin.',
      source: 'fallback',
      contextHash,
    };
  }

  // Component lookup helper
  const getComp = (key: string) => health.components.find((c) => c.key === key);

  const savingsRateComp = getComp('savings_rate');
  const expenseControlComp = getComp('expense_control');
  const emergencyFundComp = getComp('emergency_fund');
  const savingsGoalsComp = getComp('savings_goals');
  const cashFlowComp = getComp('cash_flow_health');

  const strengthsList: string[] = [];
  const attentionList: string[] = [];
  const suggestionsList: string[] = [];

  if (isBn) {
    if (savingsRateComp?.available && (savingsRateComp.score ?? 0) >= 70) {
      strengthsList.push(`সঞ্চয় হার সন্তোষজনক (${savingsRateComp.rawValue}%)`);
    } else if (savingsRateComp?.available) {
      attentionList.push(`সঞ্চয়ের হার বৃদ্ধি করা প্রয়োজন (${savingsRateComp.rawValue}%)`);
      suggestionsList.push('মাসিক আয়ের অন্তত ২০% সঞ্চয়ের জন্য প্রতি মাসের শুরুতে নির্দিষ্ট অংশ আলাদা রাখুন।');
    }

    if (expenseControlComp?.available && (expenseControlComp.score ?? 0) >= 70) {
      strengthsList.push(`ব্যয় নিয়ন্ত্রণ সীমার মধ্যে রয়েছে (${expenseControlComp.rawValue}%)`);
    } else if (expenseControlComp?.available) {
      attentionList.push(`আয়ের তুলনায় ব্যয় বেশি (${expenseControlComp.rawValue}%)`);
      suggestionsList.push('অপ্রয়োজনীয় শপিং ও অনির্ধারিত বাইরের খাবার খাওয়ার খরচ কিছুটা কমান।');
    }

    if (emergencyFundComp?.available && (emergencyFundComp.score ?? 0) >= 70) {
      strengthsList.push(`জরুরি তহবিল সুরক্ষিত (${emergencyFundComp.rawValue} মাস)`);
    } else {
      attentionList.push(
        emergencyFundComp?.available
          ? `জরুরি তহবিল ব্যাকআপ সীমিত (${emergencyFundComp.rawValue} মাস)`
          : 'জরুরি তহবিল লক্ষ্য নেই'
      );
      suggestionsList.push('কমপক্ষে ৩ থেকে ৬ মাসের প্রয়োজনীয় খরচের সমপরিমাণ জরুরি সঞ্চয় গড়ে তুলুন।');
    }

    if (savingsGoalsComp?.available && (savingsGoalsComp.score ?? 0) >= 70) {
      strengthsList.push(`সঞ্চয় লক্ষ্যসমূহ নিয়মিত গতিতে এগোচ্ছে (${savingsGoalsComp.rawValue}%)`);
    }

    if (cashFlowComp?.available && (cashFlowComp.score ?? 0) < 60) {
      attentionList.push('মাস শেষের ক্যাশ-ফ্লো কুশনে সতর্কতা রয়েছে');
      suggestionsList.push('মাস শেষের বড় বিল ও বাড়ি ভাড়ার আগেই নিরাপদ ক্যাশ ব্যালেন্স সংরক্ষণ করুন।');
    }

    if (strengthsList.length === 0) strengthsList.push('নিয়মিত ডিজিটাল লেনদেন ট্র্যাকিং সক্রিয়');
    if (attentionList.length === 0) attentionList.push('বর্তমান আর্থিক ভারসাম্য বজায় রাখুন');
    if (suggestionsList.length === 0) {
      suggestionsList.push('আপনার নিয়মিত বাজেট পর্যালোচনা করুন এবং সঞ্চয়ের গতি ধরে রাখুন।');
    }

    return {
      summary: `আপনার সার্বিক আর্থিক স্বাস্থ্য স্কোর ১০০ এর মধ্যে ${health.score} (${health.category})। এই স্কোরটি বিগত ${health.dataWindow.monthsOfData} মাসের আথিক তথ্যের ভিত্তিতে ${health.confidence === 'high' ? 'উচ্চ' : 'মাঝারি'} নির্ভরযোগ্যতার সাথে পরিমাপ করা হয়েছে।`,
      strengths: strengthsList,
      attentionAreas: attentionList,
      suggestions: suggestionsList.slice(0, 3),
      nextStep: 'আপনার জরুরি তহবিল এবং মাসিক উদ্বৃত্ত বজায় রেখে পরবর্তী আর্থিক লক্ষ্যে মনযোগ দিন।',
      source: 'fallback',
      contextHash,
    };
  }

  // English fallback
  if (savingsRateComp?.available && (savingsRateComp.score ?? 0) >= 70) {
    strengthsList.push(`Strong savings rate at ${savingsRateComp.rawValue}% of income`);
  } else if (savingsRateComp?.available) {
    attentionList.push(`Savings rate below benchmark (${savingsRateComp.rawValue}%)`);
    suggestionsList.push('Automate an initial 15-20% savings transfer at the beginning of each billing cycle.');
  }

  if (expenseControlComp?.available && (expenseControlComp.score ?? 0) >= 70) {
    strengthsList.push(`Effective spending discipline (${expenseControlComp.rawValue}% of income)`);
  } else if (expenseControlComp?.available) {
    attentionList.push(`Expenses consuming a high proportion of income (${expenseControlComp.rawValue}%)`);
    suggestionsList.push('Identify discretionary spending in dining and impulsive shopping to recover margins.');
  }

  if (emergencyFundComp?.available && (emergencyFundComp.score ?? 0) >= 70) {
    strengthsList.push(`Solid emergency liquidity (${emergencyFundComp.rawValue} months coverage)`);
  } else {
    attentionList.push(
      emergencyFundComp?.available
        ? `Limited emergency cushion (${emergencyFundComp.rawValue} months coverage)`
        : 'Dedicated emergency fund goal missing'
    );
    suggestionsList.push('Build a 3 to 6-month essential living expense cushion in a low-risk vault.');
  }

  if (savingsGoalsComp?.available && (savingsGoalsComp.score ?? 0) >= 70) {
    strengthsList.push(`Consistent milestone progress across active goals (${savingsGoalsComp.rawValue}%)`);
  }

  if (cashFlowComp?.available && (cashFlowComp.score ?? 0) < 60) {
    attentionList.push('Month-end cash flow cushion requires attention');
    suggestionsList.push('Schedule payments to avoid mid-month liquidity pinches before regular inflows.');
  }

  if (strengthsList.length === 0) strengthsList.push('Active expense accounting and account linkage');
  if (attentionList.length === 0) attentionList.push('Maintain consistent cash flow buffers');
  if (suggestionsList.length === 0) {
    suggestionsList.push('Keep tracking your daily transactions to maintain score accuracy.');
  }

  return {
    summary: `Your overall Financial Health Score is ${health.score} / 100 (${health.category}). This rating reflects ${health.dataWindow.monthsOfData} month(s) of activity with ${health.confidence} statistical confidence.`,
    strengths: strengthsList,
    attentionAreas: attentionList,
    suggestions: suggestionsList.slice(0, 3),
    nextStep: 'Protect your liquid cushion and continue funding active savings milestones systematically.',
    source: 'fallback',
    contextHash,
  };
}

/**
 * Generate AI-assisted health score explanation with strict validation, caching, and fallback.
 */
export async function getOrGenerateHealthExplanation(
  health: FinancialHealthResult,
  language: 'en' | 'bn',
  aiClient: GoogleGenAI | null
): Promise<HealthScoreExplanation> {
  const contextHash = generateHealthContextHash(health);
  const cacheKey = `${contextHash}_${language}`;

  // 1. Check cache
  const cached = explanationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.explanation;
  }

  // 2. If Gemini is unavailable, use deterministic fallback immediately
  if (!aiClient) {
    const fallback = generateDeterministicHealthExplanation(health, language, contextHash);
    explanationCache.set(cacheKey, { explanation: fallback, timestamp: Date.now() });
    return fallback;
  }

  // 3. Prepare sanitized payload for Gemini (0 PII, 0 user names, 0 account IDs)
  const factsPayload = {
    score: health.score,
    category: health.category,
    status: health.status,
    confidence: health.confidence,
    dataWindow: health.dataWindow,
    components: health.components.map((c) => ({
      key: c.key,
      label: c.label,
      score: c.score,
      available: c.available,
      rawValue: c.rawValue,
      rawUnit: c.rawUnit,
      status: c.status,
    })),
    strengths: health.strengths,
    attentionAreas: health.attentionAreas,
  };

  const isBn = language === 'bn';

  const systemInstruction = `You are Artho AI, a personal financial health assistant for Bangladesh.
All financial metrics have already been calculated by deterministic application code.
Use ONLY the supplied values.
Do NOT calculate, modify, invent, estimate, or derive financial numbers.
Explain the user's financial health in simple, supportive language.
Give educational and practical suggestions only.
Do not provide investment, loan, credit, or guaranteed financial advice.
Clearly explain when data is insufficient.
Respond in ${isBn ? 'Bengali (বাংলা)' : 'English'}.

Output MUST strictly be valid JSON adhering to this exact schema:
{
  "summary": "Short 2-3 sentence overview of the user's health score and standing",
  "strengths": ["Array of 1-3 verified strengths from the data"],
  "attentionAreas": ["Array of 1-3 verified areas needing focus"],
  "suggestions": ["Array of 2-3 practical, educational action steps"],
  "nextStep": "One clear priority next step"
}`;

  try {
    const response = await aiClient.models.generateContent({
      model: PRIMARY_GEMINI_MODEL,
      contents: JSON.stringify(factsPayload),
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const text = response.text || '';
    const parsed = JSON.parse(text);

    // Validate structured fields
    if (
      typeof parsed.summary === 'string' &&
      Array.isArray(parsed.strengths) &&
      Array.isArray(parsed.attentionAreas) &&
      Array.isArray(parsed.suggestions) &&
      typeof parsed.nextStep === 'string'
    ) {
      const explanation: HealthScoreExplanation = {
        summary: parsed.summary,
        strengths: parsed.strengths.slice(0, 3),
        attentionAreas: parsed.attentionAreas.slice(0, 3),
        suggestions: parsed.suggestions.slice(0, 3),
        nextStep: parsed.nextStep,
        source: 'ai',
        contextHash,
      };

      explanationCache.set(cacheKey, { explanation, timestamp: Date.now() });
      return explanation;
    }
  } catch (err: any) {
    console.warn('Gemini health explanation failed or invalid, falling back to deterministic engine:', err?.message || err);
  }

  // Fallback if AI generation failed or returned invalid JSON
  const fallback = generateDeterministicHealthExplanation(health, language, contextHash);
  explanationCache.set(cacheKey, { explanation: fallback, timestamp: Date.now() });
  return fallback;
}
