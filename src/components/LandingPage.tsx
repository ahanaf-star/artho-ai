import React, { useState } from 'react';
import { NavScreen } from './Sidebar';
import { formatBDT } from '../services/financialCalculations';

interface LandingPageProps {
  onNavigate: (screen: NavScreen) => void;
  isBangla: boolean;
  onToggleBangla: (val: boolean) => void;
  isAuthenticated?: boolean;
  onOpenLogin?: () => void;
  onOpenSignup?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigate,
  isBangla,
  onToggleBangla,
  isAuthenticated = false,
  onOpenLogin,
  onOpenSignup,
}) => {
  // Interactive Calculator State
  const [calcIncome, setCalcIncome] = useState(38500);
  const [calcDiscretionary, setCalcDiscretionary] = useState(13200);
  const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(0);

  // Computed projections
  const potentialSavings = Math.round(calcDiscretionary * 0.22);
  const sixMonthSavings = potentialSavings * 6;

  const faqs = [
    {
      qEn: 'How does Artho AI connect to bKash, Nagad, and City Bank?',
      aEn: 'Artho AI aggregates read-only transaction alerts and statements with end-to-end local encryption. It never asks for your transactional PINs or OTPs, providing clean classification and anomaly detection without compromising account custody.',
    },
    {
      qEn: 'Does the AI Financial Coach support conversational financial coaching?',
      aEn: 'Yes! Powered by Gemini, the AI Coach fluently understands your financial data, spending patterns, and cash flow needs. It offers clear, actionable, and strictly data-grounded financial advice in English.',
    },
    {
      qEn: 'What makes the Financial Health Score different from a credit score?',
      aEn: 'Unlike opaque credit scoring models, Artho AI gives you a 100% transparent, explainable 0–100 score based on Saving Consistency, Spending Control, Cash Flow Stability, and Liquidity Buffer Readiness. Every point gained is tied to actionable habits.',
    },
    {
      qEn: 'Can I simulate cash flow to avoid running out of money before month-end?',
      aEn: 'Absolutely. The 30-Day Cash-Flow Forecast projects your daily liquidity curve, pinpoints upcoming pressure zones (like clustered rent on the 26th and utility bills), and lets you simulate expense cuts to ensure a safe positive balance.',
    },
  ];

  return (
    <div className="flex flex-col w-full pb-space-xl">
      {/* Public Navigation Header */}
      <header className="w-full flex items-center justify-between py-3.5 px-4 sm:px-6 mb-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => onNavigate('landing')}
        >
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary shadow-xs">
            <span className="material-symbols-outlined text-[24px] text-secondary-container">
              account_balance_wallet
            </span>
          </div>
          <span className="font-title-lg text-base sm:text-lg font-bold text-on-surface tracking-tight leading-tight">
            Artho AI
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">

          {isAuthenticated ? (
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-4 py-2 rounded-xl bg-primary text-on-primary font-title-md text-xs sm:text-sm font-bold shadow-xs hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <span>Go to Dashboard</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => (onOpenLogin ? onOpenLogin() : onNavigate('login'))}
                className="px-3.5 sm:px-4 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-title-md text-xs sm:text-sm font-semibold border border-outline-variant/30 transition-all active:scale-95"
              >
                Sign In
              </button>
              <button
                onClick={() => (onOpenSignup ? onOpenSignup() : onNavigate('signup'))}
                className="px-3.5 sm:px-4 py-2 rounded-xl bg-primary text-on-primary font-title-md text-xs sm:text-sm font-bold shadow-xs hover:opacity-95 active:scale-95 transition-all flex items-center gap-1"
              >
                <span>Get Started</span>
                <span className="material-symbols-outlined text-[16px] hidden sm:inline">arrow_forward</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Top Hero Banner */}
      <section className="relative overflow-hidden pt-10 pb-16 lg:py-20 rounded-3xl bg-gradient-to-br from-surface-container-lowest via-surface to-surface-container-low border border-outline-variant/30 shadow-sm">
        {/* Subtle decorative glow circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-secondary-container/20 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-tertiary-container/10 blur-3xl pointer-events-none"></div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 flex flex-col items-center text-center">
          {/* Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container-highest border border-outline-variant/30 shadow-xs mb-6">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="font-label-md text-label-md text-on-surface font-semibold">
              Next-Gen AI Wealth &amp; Savings Engine
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-sm text-[11px] font-bold">
              Powered by Gemini
            </span>
          </div>

          {/* Main Title */}
          <h1 className="font-headline-xl text-4xl sm:text-5xl lg:text-6xl font-extrabold text-on-surface tracking-tight leading-[1.15] max-w-4xl">
            Understand your money.{' '}
            <span className="bg-gradient-to-r from-secondary to-primary-container bg-clip-text text-transparent">
              Plan smarter.
            </span>{' '}
            Reach your goals.
          </h1>

          {/* Subtitle */}
          <p className="font-body-lg text-lg sm:text-xl text-on-surface-variant max-w-2xl mt-5 leading-relaxed">
            AI-assisted spending analysis, 30-day cash flow forecasting, and a financial coach grounded in your real financial numbers.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mt-8 w-full sm:w-auto">
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary text-on-primary font-title-lg text-title-lg font-bold shadow-lg hover:shadow-xl hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>Explore Live Dashboard</span>
              <span className="material-symbols-outlined text-[20px] text-secondary-container">
                arrow_forward
              </span>
            </button>

            <button
              onClick={() => onNavigate('ai-coach')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-surface-container-lowest text-on-surface font-title-lg text-title-lg font-bold shadow-sm hover:bg-surface-container-high border border-outline-variant/40 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px] text-tertiary-container">
                auto_awesome
              </span>
              <span>Ask Gemini AI Coach</span>
            </button>
          </div>

          {/* Localized trust strip */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-10 pt-8 border-t border-outline-variant/20 text-xs sm:text-sm text-on-surface-variant font-medium">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
              <span>100% Deterministic Financial Math</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-[18px]">lock</span>
              <span>Local Device Data Isolation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-[18px]">insights</span>
              <span>Data-Grounded Insights</span>
            </div>
          </div>
        </div>
      </section>

      {/* Live Financial Metrics Snapshot (Real Synthetic Baseline) */}
      <section className="mt-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
              Live Demo Financial Baseline
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Actual values calculated for demo user Ahmed Rahman
            </p>
          </div>
          <button
            onClick={() => onNavigate('dashboard')}
            className="text-xs font-bold text-secondary hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Open in Interactive Dashboard</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md">
          <div className="p-space-md rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-xs">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">
              Monthly Inflow
            </span>
            <p className="font-headline-lg text-headline-lg font-bold text-on-surface mt-1">
              ৳38,500
            </p>
            <span className="text-xs text-secondary font-medium">Salary &amp; Inflows</span>
          </div>

          <div className="p-space-md rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-xs">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">
              Monthly Spending
            </span>
            <p className="font-headline-lg text-headline-lg font-bold text-on-surface mt-1">
              ৳29,200
            </p>
            <span className="text-xs text-on-surface-variant font-medium">75.8% of income</span>
          </div>

          <div className="p-space-md rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-xs">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">
              Net Savings Rate
            </span>
            <p className="font-headline-lg text-headline-lg font-bold text-secondary mt-1">
              24.2% <span className="text-sm text-on-surface font-normal">(৳9,300)</span>
            </p>
            <span className="text-xs text-secondary font-medium">Exceeds 20% benchmark</span>
          </div>

          <div className="p-space-md rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-xs">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">
              Health Score
            </span>
            <p className="font-headline-lg text-headline-lg font-bold text-on-surface mt-1">
              79 <span className="text-sm text-outline font-normal">/ 100</span>
            </p>
            <span className="text-xs text-secondary font-bold">Very Good (Top 26%)</span>
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid (6 Core Pillars) */}
      <section className="mt-14">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold uppercase tracking-wider">
            Engine Capabilities
          </span>
          <h2 className="font-headline-xl text-3xl sm:text-4xl text-on-surface font-bold mt-2">
            Built for Real-Life Financial Success
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">
            Every feature is engineered to tackle real daily friction points faced by urban professionals.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">
          {/* Card 1: Spending Analysis */}
          <div
            onClick={() => onNavigate('spending-analysis')}
            className="p-space-lg rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-xs hover:shadow-md hover:border-secondary/40 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-secondary mb-4 group-hover:bg-secondary-container transition-colors">
                <span className="material-symbols-outlined text-[26px]">pie_chart</span>
              </div>
              <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                Categorical Spending Breakdown
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                Detailed breakdowns across 8 standard categories with surge detection. Pinpoint why Food &amp; Dining rose 14% this month.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-outline-variant/15 flex items-center justify-between text-sm font-bold text-secondary">
              <span>Explore Spending View</span>
              <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </div>
          </div>

          {/* Card 2: AI Financial Coach */}
          <div
            onClick={() => onNavigate('ai-coach')}
            className="p-space-lg rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-xs hover:shadow-md hover:border-secondary/40 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-tertiary-container text-on-tertiary flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[26px]">auto_awesome</span>
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                  Gemini AI Financial Coach
                </h3>
                <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container text-[10px] font-bold">
                  Live
                </span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                Ask in English: "Why do I run short before month-end?" or "How can I save ৳5,000 more?" Never invents numbers.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-outline-variant/15 flex items-center justify-between text-sm font-bold text-secondary">
              <span>Chat with Coach</span>
              <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </div>
          </div>

          {/* Card 3: Cash Flow Forecast */}
          <div
            onClick={() => onNavigate('cash-flow-forecast')}
            className="p-space-lg rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-xs hover:shadow-md hover:border-secondary/40 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-primary-container mb-4 group-hover:bg-surface-container-highest transition-colors">
                <span className="material-symbols-outlined text-[26px]">trending_up</span>
              </div>
              <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                30-Day Cash-Flow Forecast
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                Anticipate daily balance trajectory, identify clustered pressure zones (rent &amp; bills on the 26th), and simulate expense cuts.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-outline-variant/15 flex items-center justify-between text-sm font-bold text-secondary">
              <span>View Forecast Curve</span>
              <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </div>
          </div>

          {/* Card 4: Savings Goals & Vaults */}
          <div
            onClick={() => onNavigate('savings-goals')}
            className="p-space-lg rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-xs hover:shadow-md hover:border-secondary/40 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-secondary mb-4 group-hover:bg-secondary-container transition-colors">
                <span className="material-symbols-outlined text-[26px]">savings</span>
              </div>
              <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                Smart Savings Goals &amp; Scenarios
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                Emergency Fund tracking, milestone banners, and 3 AI velocity plans (Relaxed, Balanced, Aggressive) calibrated to your pace.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-outline-variant/15 flex items-center justify-between text-sm font-bold text-secondary">
              <span>Manage Goals</span>
              <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </div>
          </div>

          {/* Card 5: Explainable Health Score */}
          <div
            onClick={() => onNavigate('financial-health')}
            className="p-space-lg rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-xs hover:shadow-md hover:border-secondary/40 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-primary-container mb-4 group-hover:bg-surface-container-highest transition-colors">
                <span className="material-symbols-outlined text-[26px]">vital_signs</span>
              </div>
              <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                Transparent Health Score (79/100)
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                Four clear pillars: Saving Consistency (88%), Spending Control (72%), Cash Flow Stability (76%), and Liquidity Buffer (80%).
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-outline-variant/15 flex items-center justify-between text-sm font-bold text-secondary">
              <span>View Health Breakdown</span>
              <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </div>
          </div>

          {/* Card 6: Unified Financial Dashboard & Reports */}
          <div
            onClick={() => onNavigate('dashboard')}
            className="p-space-lg rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-xs hover:shadow-md hover:border-secondary/40 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-primary-container mb-4 group-hover:bg-primary-container group-hover:text-on-primary transition-colors">
                <span className="material-symbols-outlined text-[26px]">grid_view</span>
              </div>
              <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                Unified Ledger &amp; PDF Reports
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                Consolidate bank accounts, bKash, and cash in one real-time dashboard. Generate clean, professional monthly financial reports instantly.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-outline-variant/15 flex items-center justify-between text-sm font-bold text-secondary">
              <span>Open Live Dashboard</span>
              <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Savings Simulator Box */}
      <section className="mt-14 p-space-lg sm:p-space-xl rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/20 pb-4">
            <div>
              <span className="text-xs font-bold text-secondary uppercase tracking-wider">
                Instant Calculator
              </span>
              <h3 className="font-headline-md text-2xl font-bold text-on-surface">
                Simulate Your Monthly Savings Velocity
              </h3>
            </div>
            <span className="text-xs text-outline">Interactive Simulation Model</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="flex flex-col gap-5">
              {/* Slider 1: Monthly Income */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span className="text-on-surface">Monthly Income</span>
                  <span className="font-mono text-secondary font-bold">
                    {formatBDT(calcIncome)}
                  </span>
                </div>
                <input
                  type="range"
                  min="20000"
                  max="100000"
                  step="1000"
                  value={calcIncome}
                  onChange={(e) => setCalcIncome(parseInt(e.target.value, 10))}
                  className="w-full accent-secondary cursor-pointer"
                />
                <div className="flex justify-between text-xs text-outline">
                  <span>৳20,000</span>
                  <span>৳60,000</span>
                  <span>৳100,000</span>
                </div>
              </div>

              {/* Slider 2: Discretionary Spending */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span className="text-on-surface">Discretionary Spending (Dining, MFS, Shopping)</span>
                  <span className="font-mono text-on-surface font-bold">
                    {formatBDT(calcDiscretionary)}
                  </span>
                </div>
                <input
                  type="range"
                  min="4000"
                  max="35000"
                  step="500"
                  value={calcDiscretionary}
                  onChange={(e) => setCalcDiscretionary(parseInt(e.target.value, 10))}
                  className="w-full accent-secondary cursor-pointer"
                />
                <div className="flex justify-between text-xs text-outline">
                  <span>৳4,000</span>
                  <span>৳18,000</span>
                  <span>৳35,000</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container-low text-xs text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[18px]">lightbulb</span>
                <span>
                  By trimming just 22% of non-essential friction, you preserve capital without giving up your lifestyle.
                </span>
              </div>
            </div>

            {/* Projected Output Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-highest text-on-primary flex flex-col justify-between shadow-md">
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider text-secondary-container font-bold">
                  Potential Optimization Result
                </span>
                <span className="text-3xl font-extrabold text-on-primary mt-1">
                  +{formatBDT(potentialSavings)}
                  <span className="text-sm font-normal text-on-primary-container"> / month</span>
                </span>
                <span className="text-xs text-on-primary-container mt-1">
                  Adds up to{' '}
                  <strong className="text-secondary-container font-bold">
                    {formatBDT(sixMonthSavings)}
                  </strong>{' '}
                  in your Emergency Fund in 6 months!
                </span>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex flex-col gap-2">
                <button
                  onClick={() => onNavigate('savings-goals')}
                  className="w-full py-2.5 rounded-xl bg-secondary-container text-on-secondary-container font-title-md text-sm font-bold hover:opacity-95 active:scale-95 transition-all text-center"
                >
                  Turn into a Savings Goal →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions Accordion */}
      <section className="mt-14 max-w-4xl mx-auto w-full">
        <div className="text-center mb-8">
          <h2 className="font-headline-md text-2xl sm:text-3xl font-bold text-on-surface">
            Frequently Asked Questions
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Common questions about data privacy, AI insights, and bank sync
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, idx) => {
            const isOpen = faqOpenIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-surface-container-lowest border border-outline-variant/30 overflow-hidden shadow-xs"
              >
                <button
                  onClick={() => setFaqOpenIndex(isOpen ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-title-md text-on-surface font-semibold hover:bg-surface-container-low transition-colors"
                >
                  <span>{faq.qEn}</span>
                  <span className="material-symbols-outlined text-[20px] text-outline shrink-0">
                    {isOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-5 sm:px-5 font-body-md text-sm text-on-surface-variant leading-relaxed border-t border-outline-variant/15 pt-3">
                    {faq.aEn}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Final Action Banner */}
      <section className="mt-14 p-8 sm:p-12 rounded-3xl bg-primary text-on-primary text-center flex flex-col items-center gap-4 shadow-lg border border-outline-variant/20">
        <h2 className="font-headline-xl text-3xl sm:text-4xl font-extrabold max-w-2xl">
          Take Control of Your Financial Future Today
        </h2>
        <p className="font-body-lg text-primary-fixed-dim max-w-xl text-sm sm:text-base">
          Explore the full interactive prototype with synthetic financial data and Gemini AI Coach.
        </p>
        <button
          onClick={() => onNavigate('dashboard')}
          className="mt-2 px-8 py-3.5 rounded-xl bg-secondary-container text-on-secondary-container font-title-lg font-bold hover:opacity-95 active:scale-95 transition-all shadow-md flex items-center gap-2"
        >
          <span>Launch Artho AI Dashboard</span>
          <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
        </button>
      </section>
    </div>
  );
};
