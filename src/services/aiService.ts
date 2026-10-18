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
  startingBalance: number = 0,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<CoachMessage> {
  const isBn = isBangla;
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

  const hasAuth = Boolean(authHeaders['Authorization']);

  try {
    const endpoint =
      typeof window !== 'undefined' ? '/api/ai/coach' : 'http://localhost:3000/api/ai/coach';

    const requestPayload: any = {
      message: userQuery,
      prompt: userQuery,
      language: 'en',
      isBangla: false,
      history,
    };

    // Only attach client-calculated financialContext for unauthenticated demo/guest mode
    if (!hasAuth) {
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

      requestPayload.financialContext = {
        userName,
        monthlyIncome:
          monthlyIncome !== undefined
            ? monthlyIncome
            : overview.totalIncome > 0
            ? overview.totalIncome
            : 0,
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
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(requestPayload),
    });

    if (res.ok) {
      const data = await res.json();
      const answerText = data.answer || data.text;
      if (answerText) {
        return {
          id: `coach-${Date.now()}`,
          sender: 'assistant',
          text: answerText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isBangla: false,
          isDeterministic: data.source !== 'ai',
          source: data.source,
          factsUsed: data.factsUsed,
          followUps: data.followUps,
          dataGaps: data.dataGaps,
          dataWindow: data.dataWindow,
        };
      }
    } else if (res.status === 401) {
      return {
        id: `coach-${Date.now()}`,
        sender: 'assistant',
        text: 'Your session has expired. Please log in again to consult the AI Financial Coach with your verified records.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isBangla: false,
        isDeterministic: true,
      };
    }
  } catch (err) {
    console.warn('[AICoach] Network request to /api/ai/coach failed:', err);
  }

  // Service failure / connection error without fabricating data
  const errorText = 'Unable to connect to the Artho AI Coach service. Please check your internet connection or try again in a moment.';

  return {
    id: `coach-${Date.now()}`,
    sender: 'assistant',
    text: errorText,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isBangla: false,
    isDeterministic: true,
  };
}
