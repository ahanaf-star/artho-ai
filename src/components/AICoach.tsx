import React, { useState, useRef, useEffect } from 'react';
import { Transaction, SavingsGoal, CoachMessage, User } from '../types/financial';
import { askFinancialCoach } from '../services/aiService';
import { convertAmount } from '../services/currencyService';
import { NavScreen } from './Sidebar';

interface AICoachProps {
  transactions: Transaction[];
  goals: SavingsGoal[];
  monthlyIncome?: number;
  userName?: string;
  user?: User;
  initialQuery?: string;
  onNavigate: (screen: NavScreen) => void;
  isBanglaMode: boolean;
  onToggleBangla: (val: boolean) => void;
}

function formatGreeting(userName?: string, isBangla?: boolean): string {
  const trimmed = userName?.trim();
  const firstName = trimmed ? trimmed.split(' ')[0] : '';
  if (isBangla) {
    return firstName ? `আসসালামু আলাইকুম ${firstName}!` : 'আসসালামু আলাইকুম!';
  }
  return firstName ? `Assalamu Alaikum ${firstName}!` : 'Assalamu Alaikum!';
}

function buildInitialCoachMessages(
  userName?: string,
  isBangla?: boolean
): CoachMessage[] {
  const greeting = formatGreeting(userName, isBangla);
  return [
    {
      id: 'msg-initial-assistant',
      sender: 'assistant',
      text: isBangla
        ? `${greeting} আমি অর্থবাঁচাও এআই (ArthoAI) পার্সোনাল ফাইন্যান্সিয়াল কোচ।\n\nআপনার মাসিক বাজেট, সঞ্চয়ের লক্ষ্য বা ক্যাশ-ফ্লো সম্পর্কিত যেকোনো প্রশ্ন আমাকে করতে পারেন। আপনার সঠিক লেনদেন এবং সঞ্চয়ের লক্ষ্য অনুযায়ী আমি আপনার জন্য সম্পূর্ণ তথ্যভিত্তিক পরামর্শ ও বিশ্লেষণ প্রদান করব।\n\nশুরু করতে নিচের সাজেস্ট করা প্রশ্নগুলো ক্লিক করুন অথবা আপনার প্রশ্ন লিখুন:`
        : `${greeting} I am your ArthoAI Personal Financial Coach.\n\nAsk me anything about your monthly budget, savings goals, or cash flow. Once you log your transactions and savings targets, I will deliver precise, ledger-grounded insights tailored to your financial life in Bangladesh.\n\nTo get started, click a suggested question below or type your inquiry:`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isDeterministic: true,
    },
  ];
}

export const AICoach: React.FC<AICoachProps> = ({
  transactions,
  goals,
  monthlyIncome,
  userName,
  user,
  initialQuery,
  onNavigate,
  isBanglaMode,
  onToggleBangla,
}) => {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [voiceListening, setVoiceListening] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const effectiveUserName = user?.name || userName;
  const rawIncome = monthlyIncome !== undefined ? monthlyIncome : user?.monthlyIncome;
  const incomeCurrency = user?.monthlyIncomeCurrency || 'BDT';
  const effectiveIncome =
    rawIncome !== undefined && rawIncome > 0 && incomeCurrency !== 'BDT'
      ? convertAmount(rawIncome, incomeCurrency, 'BDT')
      : rawIncome;
  const hasData = (transactions && transactions.length > 0) || (goals && goals.length > 0);

  // Initialize conversation stream with authentic data
  const [messages, setMessages] = useState<CoachMessage[]>(() =>
    buildInitialCoachMessages(effectiveUserName, isBanglaMode)
  );

  // Keep greeting personalized to authenticated user when in initial state
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'msg-initial-assistant') {
        return buildInitialCoachMessages(effectiveUserName, isBanglaMode);
      }
      return prev;
    });
  }, [effectiveUserName, isBanglaMode]);

  const streamEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialQuery) {
      handleSendMessage(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text) return;

    const userMsg: CoachMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    const recentHistory = messages
      .filter((m) => m.id !== 'msg-initial-assistant')
      .slice(-6)
      .map((m) => ({
        role: m.sender === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.text,
      }));

    try {
      const coachMsg = await askFinancialCoach(
        text,
        transactions,
        goals,
        effectiveIncome,
        isBanglaMode,
        effectiveUserName,
        0,
        recentHistory
      );
      setMessages((prev) => [...prev, coachMsg]);
    } catch (err) {
      console.error('Error fetching AI response:', err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleVoiceSim = () => {
    setVoiceListening(true);
    setTimeout(() => {
      setVoiceListening(false);
      setInputText('আগামী মাসে আমার টাকা কত থাকতে পারে?');
    }, 2000);
  };

  return (
    <div className="flex flex-col w-full gap-space-lg pb-space-xl">
      {/* Toast feedback */}
      {actionFeedback && (
        <div className="p-3 rounded-xl bg-secondary text-on-secondary flex items-center justify-between shadow-md">
          <span className="text-sm font-semibold">{actionFeedback}</span>
          <button onClick={() => setActionFeedback(null)} className="p-1">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Top Coach Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20">
        <div className="flex flex-col gap-space-xs max-w-2xl">
          <div className="flex items-center gap-space-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
              AI Engine v4.2 • Synced with 3 accounts (bKash, Nagad, City Bank)
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
            {isBanglaMode
              ? 'অর্থবাঁচাও এআই আর্থিক কোচ'
              : 'ArthoBachao AI Personal Financial Coach'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Conversational intelligence backed by your actual transactional data &amp; behavioral models
          </p>
        </div>

        {/* Controls & Localization */}
        <div className="flex items-center gap-space-sm self-start lg:self-center">
          <div className="inline-flex p-1 rounded-full bg-surface-container-low border border-outline-variant/20">
            <button
              onClick={() => onToggleBangla(false)}
              className={`px-3 py-1.5 rounded-full font-label-md text-label-md font-semibold transition-all ${
                !isBanglaMode
                  ? 'bg-surface-container-lowest shadow-sm text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              English
            </button>
            <button
              onClick={() => onToggleBangla(true)}
              className={`px-3 py-1.5 rounded-full font-label-md text-label-md font-semibold transition-all ${
                isBanglaMode
                  ? 'bg-surface-container-lowest shadow-sm text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              বাংলা (Easy Bangla mode)
            </button>
          </div>

          <button
            onClick={() => {
              if (window.confirm('Clear conversation history?')) {
                setMessages([]);
                setActionFeedback('Conversation history cleared.');
                setTimeout(() => setActionFeedback(null), 3000);
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-error transition-colors border border-outline-variant/30 flex items-center gap-1.5"
            title="Clear Chat History"
          >
            <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
            <span className="text-xs font-semibold hidden sm:inline">Clear Chat</span>
          </button>

          <button
            onClick={() => {
              setActionFeedback('Coach preferences: Dhaka lifestyle rules active.');
              setTimeout(() => setActionFeedback(null), 3000);
            }}
            className="p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant transition-colors border border-outline-variant/30"
            title="Coach Preferences"
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </button>
        </div>
      </div>

      {/* Prompt Quick-Select Ribbon */}
      <div className="flex flex-col gap-space-xs">
        <div className="flex items-center justify-between px-space-xs">
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">
            Suggested Inquiries Based on Dhaka Lifestyle
          </span>
          <span className="font-label-sm text-label-sm text-secondary font-medium">
            Refreshed 12m ago
          </span>
        </div>

        <div className="flex items-center gap-space-xs overflow-x-auto pb-1 scrollbar-none">
          {[
            {
              text: 'Why do I run short before month-end?',
              icon: 'help_outline',
            },
            {
              text: 'How can I save ৳5,000 more each month?',
              icon: 'savings',
            },
            {
              text: 'Am I on track for my ৳30,000 Emergency Fund?',
              icon: 'flag',
            },
            {
              text: 'Which category is increasing my spending the most?',
              icon: 'trending_up',
            },
            {
              text: 'What is affecting my financial health score?',
              icon: 'vital_signs',
            },
            {
              text: 'আগামী মাসে আমার টাকা কত থাকতে পারে?',
              icon: 'calendar_month',
            },
            {
              text: 'আমি কীভাবে প্রতি মাসে আরও টাকা save করতে পারি?',
              icon: 'savings',
            },
          ].map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt.text)}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-surface-container-lowest hover:bg-surface-container-high shadow-xs text-on-surface font-label-md text-label-md transition-all border border-outline-variant/30 active:scale-95"
            >
              <span className="material-symbols-outlined text-secondary text-[16px]">
                {prompt.icon}
              </span>
              <span>{prompt.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Primary Coach Workspace: 2-Column Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* Left: Conversation Flow (8 Cols) */}
        <div className="xl:col-span-8 flex flex-col gap-space-lg">
          <div className="flex flex-col gap-space-lg">
            {/* Context Timestamp */}
            <div className="flex items-center justify-center">
              <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm border border-outline-variant/20">
                Today • Real-time Sync Active
              </span>
            </div>

            {/* Message Stream */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 text-center shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-tertiary-container text-on-tertiary flex items-center justify-center mb-4 shadow-sm">
                  <span className="material-symbols-outlined text-[30px]">auto_awesome</span>
                </div>
                <h3 className="font-headline-md text-xl font-bold text-on-surface">
                  {isBanglaMode ? 'অর্থবাঁচাও এআই কোচ প্রস্তুত' : 'How can I assist your finances today?'}
                </h3>
                <p className="font-body-md text-sm text-on-surface-variant max-w-md mt-1">
                  {isBanglaMode
                    ? 'আপনার মাসিক আয়, ব্যয়, বিকাশ ও ব্যাংকের লেনদেন বিশ্লেষণ করে বাস্তবভিত্তিক পরামর্শ প্রদান করা হবে।'
                    : 'Grounded in your actual transactions, bKash balances, and ৳30,000 Emergency Fund progress.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 max-w-lg w-full">
                  <button
                    onClick={() => handleSendMessage('Why do I run short before month-end?')}
                    className="p-3 text-left rounded-xl bg-surface-container-low hover:bg-surface-container text-xs font-semibold text-on-surface border border-outline-variant/30 transition-colors"
                  >
                    "Why do I run short before month-end?"
                  </button>
                  <button
                    onClick={() => handleSendMessage('How can I save ৳5,000 more each month?')}
                    className="p-3 text-left rounded-xl bg-surface-container-low hover:bg-surface-container text-xs font-semibold text-on-surface border border-outline-variant/30 transition-colors"
                  >
                    "How can I save ৳5,000 more each month?"
                  </button>
                  <button
                    onClick={() => handleSendMessage('Am I on track for my emergency fund?')}
                    className="p-3 text-left rounded-xl bg-surface-container-low hover:bg-surface-container text-xs font-semibold text-on-surface border border-outline-variant/30 transition-colors"
                  >
                    "Am I on track for my emergency fund?"
                  </button>
                  <button
                    onClick={() => handleSendMessage('আগামী মাসে আমার টাকা কত থাকতে পারে?')}
                    className="p-3 text-left rounded-xl bg-surface-container-low hover:bg-surface-container text-xs font-semibold text-on-surface border border-outline-variant/30 transition-colors"
                  >
                    "আগামী মাসে আমার টাকা কত থাকতে পারে?"
                  </button>
                </div>
              </div>
            )}

            {messages.map((msg) => {
              if (msg.sender === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end pl-12">
                    <div className="flex flex-col items-end gap-1">
                      <div className="p-space-md rounded-2xl rounded-tr-none bg-primary-container text-on-primary shadow-sm max-w-xl">
                        <p className="font-body-lg text-body-lg font-medium">{msg.text}</p>
                      </div>
                      <span className="font-label-sm text-label-sm text-outline px-1">
                        {msg.timestamp} • Sent from Dhaka
                      </span>
                    </div>
                  </div>
                );
              }

              // Assistant message
              const sData = msg.structuredData;
              const isBookmarked = bookmarkedIds.has(msg.id);

              return (
                <div key={msg.id} className="flex items-start gap-space-sm pr-2 lg:pr-10">
                  <div className="w-10 h-10 rounded-xl bg-tertiary-container flex items-center justify-center text-on-tertiary shrink-0 shadow-sm mt-1">
                    <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
                  </div>

                  <div className="flex-1 flex flex-col gap-space-md">
                    <div className="p-space-lg rounded-2xl rounded-tl-none bg-surface-container-lowest shadow-sm flex flex-col gap-space-md border border-outline-variant/20">
                      {/* AI Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
                        <div className="flex items-center gap-space-xs">
                          <span className="font-title-md text-title-md text-on-surface font-bold">
                            ArthoBachao AI Coach
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm">
                            {msg.isDeterministic ? 'Deterministic Math' : 'Gemini AI Coach'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-outline">
                          <button
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="p-1 rounded-lg hover:bg-surface-container-low transition-colors"
                            title="Copy response"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {copiedId === msg.id ? 'check' : 'content_copy'}
                            </span>
                          </button>
                          <button
                            onClick={() => toggleBookmark(msg.id)}
                            className="p-1 rounded-lg hover:bg-surface-container-low transition-colors"
                            title="Bookmark"
                          >
                            <span
                              className={`material-symbols-outlined text-[16px] ${
                                isBookmarked ? 'text-secondary font-bold' : ''
                              }`}
                            >
                              {isBookmarked ? 'bookmark' : 'bookmark_border'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Message Core */}
                      <div className="flex flex-col gap-space-sm text-on-surface font-body-lg text-body-lg leading-relaxed whitespace-pre-line">
                        {msg.text}
                      </div>

                      {/* Velocity Micro-Bar if available */}
                      {sData?.targetVelocity && (
                        <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-space-xs border border-outline-variant/15">
                          <div className="flex justify-between items-center font-label-md text-label-md">
                            <span className="text-on-surface-variant font-medium">
                              Monthly Target Velocity
                            </span>
                            <span className="font-bold text-on-surface">
                              ৳{sData.targetVelocity.current.toLocaleString()}{' '}
                              <span className="font-normal text-outline">
                                / ৳{sData.targetVelocity.needed.toLocaleString()} needed
                              </span>
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
                            <div
                              className="h-full bg-secondary rounded-full"
                              style={{ width: `${sData.targetVelocity.percentage}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between items-center font-label-sm text-label-sm text-outline">
                            <span>Current Baseline ({sData.targetVelocity.percentage}%)</span>
                            <span>
                              Shortfall: ৳{sData.targetVelocity.shortfall.toLocaleString()}/mo (
                              {100 - sData.targetVelocity.percentage}%)
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Structured Recommendation Cards */}
                      {sData?.recommendations && sData.recommendations.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md pt-space-xs">
                          {sData.recommendations.map((rec, i) => (
                            <div
                              key={i}
                              className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-space-md relative overflow-hidden border border-outline-variant/20"
                            >
                              <div
                                className={`absolute top-0 left-0 right-0 h-1 ${
                                  i === 0 ? 'bg-secondary' : 'bg-tertiary-container'
                                }`}
                              ></div>
                              <div className="flex flex-col gap-space-xs">
                                <div className="flex items-center justify-between">
                                  <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface">
                                    <span className="material-symbols-outlined text-[18px]">
                                      {rec.icon}
                                    </span>
                                  </div>
                                  <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                                    {rec.badge}
                                  </span>
                                </div>
                                <h2 className="font-title-md text-title-md text-on-surface pt-1 font-bold">
                                  {rec.category}
                                </h2>
                                <div className="flex items-baseline gap-2">
                                  <span className="font-numeric-hero-mobile text-numeric-hero-mobile text-on-surface font-bold">
                                    ৳{rec.currentMonthly.toLocaleString()}
                                  </span>
                                  <span className="font-label-sm text-label-sm text-outline">
                                    current / mo
                                  </span>
                                </div>
                                <div className="p-space-xs px-space-sm rounded-lg bg-surface-container-low text-on-surface-variant font-body-sm text-body-sm border border-outline-variant/15">
                                  <strong className="text-on-surface font-semibold">Why:</strong>{' '}
                                  {rec.why}
                                </div>
                                <div className="flex items-center gap-1.5 font-label-md text-label-md text-secondary font-semibold">
                                  <span className="material-symbols-outlined text-[16px]">
                                    savings
                                  </span>
                                  Potential monthly savings: ৳{rec.potentialSavings.toLocaleString()}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setActionFeedback(`Action applied: ${rec.actionLabel}`);
                                  setTimeout(() => setActionFeedback(null), 3000);
                                }}
                                className="w-full py-2.5 px-3 rounded-lg bg-primary-container text-on-primary hover:bg-on-surface transition-colors font-title-md text-title-md flex items-center justify-center gap-2 active:scale-95"
                              >
                                <span className="material-symbols-outlined text-[18px] text-secondary-container">
                                  tune
                                </span>
                                {rec.actionLabel}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Dynamic Goal Simulation Component */}
                      {sData?.simulation && (
                        <div className="p-space-lg rounded-xl bg-surface-container-low flex flex-col gap-space-md border border-outline-variant/20">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
                            <div>
                              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-bold">
                                Goal Simulation
                              </span>
                              <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                                Projected Timeline Comparison
                              </h3>
                            </div>
                            <span className="font-label-md text-label-md text-on-surface bg-surface-container-lowest px-3 py-1 rounded-full shadow-sm border border-outline-variant/20">
                              Target: ৳{sData.simulation.target.toLocaleString()}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                            <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-xs opacity-75 border border-outline-variant/20">
                              <div className="flex justify-between items-center">
                                <span className="font-label-md text-label-md text-on-surface-variant">
                                  Current Trajectory
                                </span>
                                <span className="material-symbols-outlined text-outline text-[18px]">
                                  schedule
                                </span>
                              </div>
                              <div className="flex items-baseline gap-1.5">
                                <span className="font-numeric-hero text-numeric-hero text-on-surface font-bold">
                                  {sData.simulation.currentMonths}
                                </span>
                                <span className="font-title-md text-title-md text-outline">
                                  months
                                </span>
                              </div>
                              <span className="font-body-sm text-body-sm text-outline">
                                Estimated Goal: {sData.simulation.currentEstDate}
                              </span>
                            </div>

                            <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-xs relative overflow-hidden border border-secondary/40">
                              <div className="absolute right-0 top-0 w-24 h-24 bg-secondary-container/20 rounded-full blur-2xl"></div>
                              <div className="flex justify-between items-center">
                                <span className="font-label-md text-label-md text-secondary font-semibold">
                                  With ArthoBachao AI Optimization
                                </span>
                                <span className="material-symbols-outlined text-secondary text-[18px]">
                                  rocket_launch
                                </span>
                              </div>
                              <div className="flex items-baseline gap-1.5">
                                <span className="font-numeric-hero text-numeric-hero text-secondary font-bold">
                                  {sData.simulation.optimizedMonths}
                                </span>
                                <span className="font-title-md text-title-md text-secondary font-medium">
                                  months
                                </span>
                              </div>
                              <span className="font-body-sm text-body-sm text-on-surface font-medium flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px] text-secondary">
                                  check_circle
                                </span>
                                Goal reached by {sData.simulation.optimizedEstDate}!
                              </span>
                            </div>
                          </div>

                          {/* Simulation Sparkline Timeline SVG */}
                          <div className="p-space-sm rounded-lg bg-surface-container-lowest shadow-sm border border-outline-variant/15">
                            <div className="flex items-center justify-between text-outline font-label-sm text-label-sm px-1 mb-1">
                              <span>Month 0 (Now)</span>
                              <span>Month 3 (৳15.5k)</span>
                              <span className="text-secondary font-bold">
                                Month {sData.simulation.optimizedMonths} (৳30k Achieved)
                              </span>
                            </div>
                            <svg
                              className="w-full h-12 text-secondary"
                              preserveAspectRatio="none"
                              viewBox="0 0 500 48"
                            >
                              <path
                                d="M 0 45 Q 250 35 500 24"
                                fill="none"
                                stroke="currentColor"
                                strokeDasharray="4 4"
                                strokeOpacity="0.25"
                                strokeWidth="2"
                              ></path>
                              <path
                                d="M 0 45 C 150 40, 320 18, 480 4"
                                fill="none"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeWidth="3.5"
                              ></path>
                              <circle cx="480" cy="4" fill="currentColor" r="4.5"></circle>
                            </svg>
                          </div>

                          {/* Interactive CTA Strip */}
                          <div className="flex flex-col sm:flex-row items-center gap-space-sm pt-space-xs">
                            <button
                              onClick={() => onNavigate('savings-goals')}
                              className="w-full sm:flex-1 py-3 px-space-md rounded-xl bg-primary-container text-on-primary font-title-md text-title-md flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-opacity active:scale-95"
                            >
                              <span className="material-symbols-outlined text-[18px] text-secondary-container">
                                auto_awesome
                              </span>
                              Build My Tailored Savings Plan
                            </button>
                            <button
                              onClick={() => {
                                setInputText(
                                  'What happens if I also cut non-bank ATM withdrawal fees?'
                                );
                              }}
                              className="w-full sm:w-auto py-3 px-space-md rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-title-md text-title-md transition-colors shadow-sm border border-outline-variant/30"
                            >
                              Ask a Follow-up Question
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-center gap-2 text-outline text-sm italic pl-12">
                <span className="material-symbols-outlined text-[18px] text-secondary animate-spin">
                  sync
                </span>
                <span>ArthoBachao AI Coach is analyzing transactional patterns...</span>
              </div>
            )}
            <div ref={streamEndRef} />
          </div>

          {/* Sticky Input Composer */}
          <div className="sticky bottom-4 z-20 flex flex-col gap-space-xs">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputText);
              }}
              className="p-2 rounded-2xl bg-surface-container-lowest shadow-md flex items-center gap-space-xs border border-outline-variant/30"
            >
              <button
                type="button"
                onClick={() => {
                  setActionFeedback('Slip / Transaction attached (bKash Cash-out #TXN105)');
                  setTimeout(() => setActionFeedback(null), 3000);
                }}
                className="p-2.5 rounded-xl hover:bg-surface-container-low text-on-surface-variant transition-colors"
                title="Attach transaction or slip"
              >
                <span className="material-symbols-outlined text-[20px]">attach_file</span>
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isBanglaMode
                    ? 'আপনার বাজেট বা সঞ্চয় সম্পর্কে জিজ্ঞাসা করুন (যেমন: আমি কীভাবে আরও সঞ্চয় করব?)...'
                    : 'Ask ArthoBachao AI anything about your money in English or বাংলা...'
                }
                className="flex-1 bg-transparent py-2.5 px-space-xs text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none"
              />

              <button
                type="button"
                onClick={handleVoiceSim}
                className={`p-2.5 rounded-xl transition-colors ${
                  voiceListening
                    ? 'bg-error-container text-error animate-pulse'
                    : 'hover:bg-surface-container-low text-on-surface-variant'
                }`}
                title="Voice query in Bangla/English"
              >
                <span className="material-symbols-outlined text-[20px]">mic</span>
              </button>

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2.5 px-4 rounded-xl bg-primary-container text-on-primary hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1 font-title-md text-title-md"
              >
                <span>Send</span>
                <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
              </button>
            </form>
            <div className="flex items-center justify-between px-space-sm font-label-sm text-label-sm text-outline">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-secondary">
                  verified_user
                </span>
                <span>Bank-grade 256-bit encryption. No plain-text data sold.</span>
              </div>
              <span>Shift + Enter for new line</span>
            </div>
          </div>
        </div>

        {/* Right: Coach Memory & Guardrails Sidebar Widget (4 Cols) */}
        <div className="xl:col-span-4 flex flex-col gap-space-lg">
          {/* Memory Parameters Card */}
          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-md border border-outline-variant/20">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-secondary text-[20px]">
                  psychology
                </span>
                <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                  Coach Memory
                </h3>
              </div>
              <button
                onClick={() => onNavigate('settings-profile')}
                className="font-label-sm text-label-sm text-secondary font-semibold hover:underline"
              >
                Edit Context
              </button>
            </div>

            <p className="font-body-sm text-body-sm text-on-surface-variant">
              ArthoBachao AI keeps these personal baselines locked into working memory when answering queries:
            </p>

            <div className="flex flex-col gap-space-xs">
              <div className="p-space-sm rounded-xl bg-surface-container-low flex items-center justify-between border border-outline-variant/15">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                    speed
                  </span>
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    Risk Tolerance
                  </span>
                </div>
                <span className="font-label-md text-label-md font-semibold text-on-surface">
                  {user?.riskTolerance || 'Not set'}
                </span>
              </div>

              <div className="p-space-sm rounded-xl bg-surface-container-low flex items-center justify-between border border-outline-variant/15">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[18px]">
                    crisis_alert
                  </span>
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    Primary Goal
                  </span>
                </div>
                <span className="font-label-md text-label-md font-semibold text-secondary">
                  {(() => {
                    const primary = goals.find((g) => g.id === user?.primaryGoalId) || goals[0];
                    if (!primary) return 'No goal set';
                    const amountText = primary.targetAmount >= 1000 ? `৳${(primary.targetAmount / 1000).toFixed(0)}k` : `৳${primary.targetAmount}`;
                    return `${primary.title} (${amountText})`;
                  })()}
                </span>
              </div>

              <div className="p-space-sm rounded-xl bg-surface-container-low flex items-center justify-between border border-outline-variant/15">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                    payments
                  </span>
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    Monthly Income
                  </span>
                </div>
                <span className="font-label-md text-label-md font-semibold text-on-surface">
                  {effectiveIncome !== undefined && effectiveIncome > 0
                    ? `৳${effectiveIncome.toLocaleString()}`
                    : 'Not provided'}
                </span>
              </div>

              <div className="p-space-sm rounded-xl bg-surface-container-low flex items-center justify-between border border-outline-variant/15">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                    lock
                  </span>
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    Privacy Status
                  </span>
                </div>
                <span className="font-label-sm text-label-sm font-semibold text-secondary">
                  {user?.privacyStatus || 'E2E Encrypted'}
                </span>
              </div>
            </div>

            {/* Bangla Prompt Helper Tooltip Card */}
            <div className="p-space-md rounded-xl bg-surface-container-high flex flex-col gap-space-xs border border-outline-variant/20">
              <div className="flex items-center gap-1.5 text-on-surface">
                <span className="material-symbols-outlined text-[18px] text-tertiary-container">
                  translate
                </span>
                <span className="font-title-md text-title-md font-bold">বাংলায় প্রশ্ন করুন</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                যেকোনো সময় বাংলায় টাইপ করে পরামর্শ নিন। যেমন:
              </p>
              <div
                onClick={() => handleSendMessage('আগামী মাসে আমার টাকা কত থাকতে পারে?')}
                className="p-space-xs px-space-sm rounded-lg bg-surface-container-lowest font-body-sm text-body-sm text-on-surface font-medium cursor-pointer hover:bg-surface-container transition-colors border border-outline-variant/30"
              >
                "আগামী মাসে আমার টাকা কত থাকতে পারে?"
              </div>
            </div>
          </div>

          {/* Quick Financial Reality Card */}
          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-md border border-outline-variant/20">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
              <span className="font-title-md text-title-md text-on-surface font-bold">
                90-Day Cash Flow Pulse
              </span>
              <span className="font-label-sm text-label-sm text-secondary font-bold">
                Dhaka Metro
              </span>
            </div>

            <div className="grid grid-cols-2 gap-space-sm">
              <div className="p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/15">
                <span className="font-label-sm text-label-sm text-outline">Fixed Outflow</span>
                <p className="font-numeric-hero-mobile text-numeric-hero-mobile text-on-surface mt-0.5 font-bold">
                  ৳22,100
                </p>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Rent, Bills, EMI
                </span>
              </div>
              <div className="p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/15">
                <span className="font-label-sm text-label-sm text-outline">Discretionary</span>
                <p className="font-numeric-hero-mobile text-numeric-hero-mobile text-on-surface mt-0.5 font-bold">
                  ৳13,200
                </p>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Dining, MFS, Transit
                </span>
              </div>
            </div>

            <div className="p-space-md rounded-xl bg-surface-container-low flex items-start gap-space-sm border border-outline-variant/15">
              <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">
                lightbulb
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                ArthoBachao AI continuously scans cash-out fees at Bkash &amp; Nagad agent points. You can
                save up to ৳420/month just by switching 3 withdrawals to City Bank ATM cards.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
