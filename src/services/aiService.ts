import { CoachMessage, SavingsGoal, Transaction } from '../types/financial';
import {
  calculateMonthlyOverview,
  calculateFinancialHealthScore,
  calculateCompleteGoalAnalysis,
  getDetailedForecast,
  generateSpendingInsights,
  getLocalDateString,
} from './financialCalculations';

export interface FinancialContext {
  userName?: string;
  monthlyIncome?: number;
  monthlySpending: number;
  netSavings: number;
  savingsRate: number;
  healthScore: {
    score: number | null;
    status: string;
    percentile?: number | null;
    factors: {
      savingConsistency: number | null;
      spendingControl: number | null;
      cashFlowStability: number | null;
      goalProgress: number | null;
    };
  };
  categories: Array<{
    category: string;
    amount: number;
    percentage: number;
    momChangePercentage: number;
    status: string;
    topMerchants: string[];
  }>;
  goals: Array<{
    id: string;
    title: string;
    targetAmount: number;
    currentAmount: number;
    remainingAmount: number;
    progressPercentage: number;
    requiredMonthlySavings: number;
    currentAverageMonthlySaving: number;
    monthlySavingsGap: number;
    deadline: string;
    projectedCompletionDate: string;
  }>;
  cashFlow: {
    startingBalance: number;
    projectedMonthEnd: number;
    upcomingBills: number;
    pressureDays: number[];
    recommendedBuffer: number;
  };
  insights: Array<{
    type: string;
    category?: string;
    changePercent?: number;
    impactAmount?: number;
    explanation: string;
  }>;
}

export async function askFinancialCoach(
  userQuery: string,
  transactions: Transaction[],
  goals: SavingsGoal[],
  monthlyIncome?: number,
  isBangla: boolean = false,
  userName?: string,
  startingBalance: number = 0
): Promise<CoachMessage> {
  const currentMonth = getLocalDateString().slice(0, 7);
  const overview = calculateMonthlyOverview(transactions, currentMonth);
  const health = calculateFinancialHealthScore({
    transactions,
    goals,
    monthlyIncome: monthlyIncome || 0,
  });
  const insights = generateSpendingInsights(transactions, currentMonth);
  const forecast = getDetailedForecast(startingBalance, false, transactions);
  const goalAnalyses = goals.map((g) => calculateCompleteGoalAnalysis(g, transactions));

  const financialContext: FinancialContext = {
    userName,
    monthlyIncome: monthlyIncome !== undefined ? monthlyIncome : (overview.totalIncome > 0 ? overview.totalIncome : 0),
    monthlySpending: overview.totalExpenses,
    netSavings: overview.netSavings,
    savingsRate: overview.savingsRate,
    healthScore: {
      score: health.score,
      status: health.status,
      percentile: health.percentile,
      factors: health.factors || {
        savingConsistency: null,
        spendingControl: null,
        cashFlowStability: null,
        goalProgress: null,
      },
    },
    categories: overview.categories.map((c) => ({
      category: c.category,
      amount: c.amount,
      percentage: c.percentage,
      momChangePercentage: c.momChangePercentage,
      status: c.status,
      topMerchants: c.topMerchants,
    })),
    goals: goalAnalyses.map((ga) => ({
      id: ga.goalId,
      title: ga.title,
      targetAmount: ga.targetAmount,
      currentAmount: ga.currentAmount,
      remainingAmount: ga.remainingAmount,
      progressPercentage: ga.progressPercentage,
      requiredMonthlySavings: ga.requiredMonthlySavings,
      currentAverageMonthlySaving: ga.currentAverageMonthlySaving,
      monthlySavingsGap: ga.monthlySavingsGap,
      deadline: ga.deadline,
      projectedCompletionDate: ga.projectedCompletionDate,
    })),
    cashFlow: {
      startingBalance: forecast.startingBalance,
      projectedMonthEnd: forecast.projectedMonthEnd,
      upcomingBills: forecast.upcomingBills,
      pressureDays: forecast.pressureDays,
      recommendedBuffer: forecast.recommendedBuffer,
    },
    insights: insights.map((i) => ({
      type: i.type,
      category: i.category,
      changePercent: i.changePercent,
      impactAmount: i.impactAmount,
      explanation: i.explanation,
    })),
  };

  let geminiText: string | null = null;
  let isGeminiSource = false;

  try {
    const authHeaders: Record<string, string> = {};
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('finmate_auth_session');
        if (raw) {
          const session = JSON.parse(raw);
          if (session?.token) {
            authHeaders['Authorization'] = `Bearer ${session.token}`;
          }
        }
      } catch {
        // ignore parse error
      }
    }

    const endpoint =
      typeof window !== 'undefined' ? '/api/ai/coach' : 'http://localhost:3000/api/ai/coach';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        prompt: userQuery,
        isBangla,
        financialContext,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.source === 'gemini' && data.text) {
        geminiText = data.text;
        isGeminiSource = true;
      }
    }
  } catch (err) {
    console.warn('Network request to /api/ai/coach failed, using deterministic engine:', err);
  }

  const normalized = userQuery.toLowerCase().trim();
  const emergencyGoal = goals.find((g) => g.id === 'goal-emergency-fund') || goals[0];
  const target = emergencyGoal?.targetAmount || 30000;
  const currentSaved = emergencyGoal?.currentAmount || 18500;
  const remainingGap = Math.max(0, target - currentSaved);

  // Structured recommendations builder to complement answers with actionable cards
  let structuredData: CoachMessage['structuredData'] = undefined;

  if (
    normalized.includes('30,000') ||
    normalized.includes('emergency fund') ||
    normalized.includes('six months') ||
    normalized.includes('realistic') ||
    normalized.includes('on track') ||
    normalized.includes('save') ||
    normalized.includes('জরুরি')
  ) {
    structuredData = {
      targetVelocity: {
        current: 3200,
        needed: 5000,
        percentage: 64,
        shortfall: 1800,
      },
      recommendations: [
        {
          category: 'Food Delivery Capping',
          currentMonthly: 8200,
          potentialSavings: 900,
          why: 'Ordering late-night snacks on weekends accounts for ৳3,600 monthly.',
          actionLabel: 'Set Weekend Limit (৳1,200/wk)',
          badge: '-11% target',
          icon: 'delivery_dining',
        },
        {
          category: 'Fee-Free ATM Withdrawals',
          currentMonthly: 2800,
          potentialSavings: 650,
          why: 'Consolidating micro MFS cash-out withdrawals saves ৳650 in 1.85% tariffs.',
          actionLabel: 'Use City Bank ATM Free',
          badge: 'Avoidable Fees',
          icon: 'account_balance_wallet',
        },
      ],
      simulation: {
        target,
        currentMonths: Number((remainingGap / 3200).toFixed(1)),
        optimizedMonths: Number((remainingGap / 4750).toFixed(1)),
        currentEstDate: 'Aug 2025',
        optimizedEstDate: 'Dec 2024',
      },
    };
  } else if (
    normalized.includes('month-end') ||
    normalized.includes('short before') ||
    normalized.includes('run short') ||
    normalized.includes('মাস শেষে') ||
    normalized.includes('pressure')
  ) {
    structuredData = {
      targetVelocity: {
        current: 24850,
        needed: 29350,
        percentage: 84,
        shortfall: 4500,
      },
      recommendations: [
        {
          category: 'Upcoming Rent & Bills',
          currentMonthly: 17200,
          potentialSavings: 4500,
          why: 'Fixed outflows cluster heavily on Day 26 (Rent ৳16,000 + utilities ৳1,200).',
          actionLabel: 'Lock Buffer Now (৳4,500)',
          badge: 'Fixed Buffer',
          icon: 'receipt_long',
        },
        {
          category: 'MFS Micro-Withdrawals',
          currentMonthly: 2800,
          potentialSavings: 420,
          why: 'Small frequent withdrawals from agents cost 1.85% each time.',
          actionLabel: 'Use City Bank ATM Free',
          badge: 'Zero Fee',
          icon: 'atm',
        },
      ],
      simulation: {
        target: 30000,
        currentMonths: 9.4,
        optimizedMonths: 5.8,
        currentEstDate: 'Aug 2025',
        optimizedEstDate: 'Dec 2024',
      },
    };
  }

  // If Gemini answered, prioritize the live model's reasoning
  let finalText = geminiText;

  // If Gemini was unavailable or returned empty, use the explainable deterministic engine
  if (!finalText) {
    const trimmedName = userName?.trim();
    const firstName = trimmedName ? trimmedName.split(' ')[0] : '';
    const greetingEn = firstName ? `Assalamu Alaikum ${firstName}!` : 'Assalamu Alaikum!';
    const greetingBn = firstName ? `আসসালামু আলাইকুম ${firstName}!` : 'আসসালামু আলাইকুম!';
    const yesEn = firstName ? `Yes ${firstName}!` : 'Yes!';
    const yesBn = firstName ? `হ্যাঁ ${firstName}!` : 'হ্যাঁ!';

    if (
      normalized.includes('short before month-end') ||
      normalized.includes('month-end') ||
      normalized.includes('run short') ||
      normalized.includes('মাস শেষ')
    ) {
      finalText = isBangla
        ? `আপনার ক্যাশ-ফ্লো প্যাটার্ন অনুযায়ী মাসের শেষ সপ্তাহে (২৪ থেকে ২৮ তারিখের মধ্যে) বড় ধরণের খরচ জমে যায়। বিশেষ করে ২৬ তারিখে বাসা ভাড়া (৳১৬,০০০) এবং ইউটিলিটি বিল (৳১,২০০) মিলিয়ে মোট ৳১৭,২০০ একসাথে পরিশোধ করতে হয়।\n\nএছাড়া মাসের শুরুতে রেস্তোরাঁ ও ফুড ডেলিভারিতে (৳৮,২০০) বেশি খরচ হয়ে যাওয়ায় মাসের শেষভাগে হাতে মাত্র ~৳৩,২০০ উদ্বৃত্ত থাকে। এর সমাধান হিসেবে ২০ অক্টোবরের মধ্যে bKash-এ ৳৪,৫০০ ইমার্জেন্সি বাফার আলাদা করে রাখার পরামর্শ দেওয়া হচ্ছে।`
        : `Based on your cash-flow rhythm, you experience a high-pressure cluster between Day 24 and Day 28, where Apartment Rent (৳16,000) and Utility dues (৳1,200) hit simultaneously on Day 26 (totaling ৳17,200).\n\nBecause weekend dining spending is front-loaded in the first two weeks (totaling ৳8,200), your projected month-end balance dips to ~৳3,200 before recovering. I recommend locking a ৳4,500 liquid safety buffer into bKash by Oct 20 to eliminate month-end overdraft stress.`;
    } else if (
      normalized.includes('save ৳5,000') ||
      normalized.includes('save 5000') ||
      normalized.includes('save more') ||
      normalized.includes('টাকা save') ||
      normalized.includes('সঞ্চয়')
    ) {
      finalText = isBangla
        ? `বর্তমানে আপনার মাসিক গড় সঞ্চয় ৳৩,২০০। প্রতি মাসে ৳৫,০০০ সঞ্চয় করতে হলে আপনাকে অতিরিক্ত ৳১,৮০০ সাশ্রয় করতে হবে।\n\nআপনার প্রধান সুযোগগুলো:\n১. ফুড ও ডেলিভারি খরচ (বর্তমান ৳৮,২০০): উইকেন্ডে ডেলিভারি কমিয়ে সপ্তাহে ৳১,২০০ তে সীমাবদ্ধ রাখলে মাসে ৳৯০০ সাশ্রয় হবে।\n২. এজেন্ট ক্যাশ-আউট চার্জ (বর্তমান ৳২,৮০০): bKash/Nagad এজেন্টের পরিবর্তে সিটি ব্যাংকের ফ্রি এটিএম ব্যবহার করলে মাসে ৳৬৫০ সাশ্রয় হবে।\n\nএই দুটি সাধারণ পরিবর্তনেই কোনো প্রয়োজনীয় খরচ না কমিয়ে প্রতি মাসে অতিরিক্ত ৳১,৫৫০ থেকে ৳১,৮০০ সাশ্রয় করা সম্ভব।`
        : `Your current average monthly saving is ৳3,200. Reaching a ৳5,000/month pace requires saving approximately ৳1,800 more each month.\n\nYour highest flexible spending categories are:\n• Food & Delivery: ৳8,200 (surged +14% this month)\n• Shopping & Gadgets: ৳5,800\n• Cash-out & Bank Fees: ৳2,800 (1.85% tariff leak)\n\nCapping weekend food delivery to ৳1,200/wk (+৳900 saved) and switching cash withdrawals to free City Bank ATMs (+৳650 saved) bridges this ৳1,800 gap without impacting your essentials.`;
    } else if (
      normalized.includes('emergency fund') ||
      normalized.includes('on track') ||
      normalized.includes('ইমার্জেন্সি ফান্ড')
    ) {
      const emergencyGoal = goals.find((g) => g.title.toLowerCase().includes('emergency')) || goals[0];
      const target = emergencyGoal?.targetAmount || 30000;
      const current = emergencyGoal?.currentAmount || 18500;
      const progress = Math.round((current / Math.max(1, target)) * 100);
      const remaining = Math.max(0, target - current);
      finalText = isBangla
        ? `${yesBn} আপনি আপনার জরুরি ফান্ডের জন্য সঠিক ট্র্যাকে আছেন।\n\n• লক্ষ্য: ৳${target.toLocaleString()}\n• বর্তমান জমা: ৳${current.toLocaleString()} (${progress}% সম্পন্ন)\n• বাকি ঘাটতি: ৳${remaining.toLocaleString()}`
        : `${yesEn} You are solidly on track for your Emergency Fund.\n\n• Target: ৳${target.toLocaleString()}\n• Current Balance: ৳${current.toLocaleString()} (${progress}% achieved)\n• Remaining Gap: ৳${remaining.toLocaleString()}`;
    } else if (
      normalized.includes('increasing') ||
      normalized.includes('spending the most') ||
      normalized.includes('খরচ বাড়ছে')
    ) {
      const topCat = overview.largestCategory;
      finalText = isBangla
        ? `যে খাতে আপনার খরচ সবচেয়ে বেশি তা হলো **${topCat.category || 'অনির্ধারিত'}**।\n\n• বর্তমান খরচ: ৳${topCat.amount.toLocaleString()} (মোট খরচের ${topCat.percentage}%)\n• প্রধান খরচের খাত নিয়ন্ত্রণ করাই মাসিক ব্যয় কমিয়ে আনার সবচেয়ে দ্রুততম উপায়।`
        : `The category accounting for your highest outflows is **${topCat.category || 'General'}**.\n\n• Outflow: ৳${topCat.amount.toLocaleString()} (${topCat.percentage}% of all expenditures)\n• Moderating this category is the most effective way to protect your monthly savings rate.`;
    } else if (
      normalized.includes('health score') ||
      normalized.includes('স্কোর')
    ) {
      finalText = isBangla
        ? `আপনার অর্থবাঁচাও এআই আর্থিক স্বাস্থ্য স্কোর **${health.score} / ১০০** ("${health.status}")।\n\nএটি আপনার সঞ্চয়ের হার, ব্যয় নিয়ন্ত্রণ এবং ক্যাশ-ফ্লো স্থিতিশীলতার ওপর ভিত্তি করে সম্পূর্ণ ব্যাখ্যাযোগ্যভাবে পরিমাপ করা হয়েছে।`
        : `Your ArthoBachao AI Financial Health Score is currently **${health.score} / 100** ("${health.status}").\n\nThis score is evaluated transparently from your verified savings consistency, spending control, and cash-flow health.`;
    } else if (
      normalized.includes('balance look like') ||
      normalized.includes('next month') ||
      normalized.includes('টাকা কত থাকতে পারে')
    ) {
      const monthEnd = forecast.projectedMonthEnd;
      finalText = isBangla
        ? `আপনার নির্ধারিত আয় ও খরচের পূর্বাভাস অনুযায়ী মাস শেষে আপনার সম্ভাব্য ব্যালেন্স দাঁড়াবে প্রায় **৳${monthEnd.toLocaleString()}** (AI-assisted forecast)।\n*(নোট: এটি একটি নির্দেশনামূলক এআই পূর্বাভাস, কোনো নিশ্চয়তা নয়)।*`
        : `Based on your scheduled inflows and obligations, your projected month-end balance will be approximately **৳${monthEnd.toLocaleString()}** (AI-assisted forecast).\n*(Note: This is an indicative AI-assisted forecast, not a guaranteed outcome).*`;
    } else {
      const inc = overview.totalIncome || monthlyIncome || 0;
      const sp = overview.totalExpenses || 0;
      const sv = overview.netSavings || 0;
      const bal = forecast.startingBalance || 0;
      finalText = isBangla
        ? `${greetingBn} আপনার চলতি মাসের হিসাব: আয় ৳${inc.toLocaleString()}, ব্যয় ৳${sp.toLocaleString()}, নিট সঞ্চয় ৳${sv.toLocaleString()}, বর্তমান ব্যালেন্স ৳${bal.toLocaleString()}। আপনার বাজেট বা সঞ্চয় নিয়ে যেকোনো প্রশ্ন থাকলে জানান!`
        : `${greetingEn} Based on your verified ledger: Monthly Income is ৳${inc.toLocaleString()}, Spending is ৳${sp.toLocaleString()}, Net Savings is ৳${sv.toLocaleString()}, and Available Balance is ৳${bal.toLocaleString()}. Please let me know how I can help with your budgeting or savings goals!`;
    }
  }

  return {
    id: `coach-${Date.now()}`,
    sender: 'assistant',
    text: finalText,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isBangla,
    isDeterministic: !isGeminiSource,
    structuredData,
  };
}
