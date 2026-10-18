import { User } from '../types/financial';

export const INITIAL_USER: User = {
  id: 'usr-ahmed-01',
  name: 'Ahmed Rahman',
  email: 'ahmed.rahman@arthobachao.ai',
  preferredLanguage: 'en',
  currency: 'BDT',
  timeZone: 'Asia/Dhaka',
  timeFormat: '24h',
  lastFinancialUpdate: '2026-10-17T03:52:00.000Z',
  createdAt: '2024-08-01T00:00:00.000Z',
  tagline: 'Pro Member',
  memberStatus: 'Pro Member',
  city: 'Dhaka',
  monthlyIncome: 38500,
  riskTolerance: 'Moderate',
  primaryGoalId: 'goal-emergency-fund',
  privacyStatus: 'E2E Encrypted',
  linkedAccounts: [
    {
      name: 'bKash',
      balance: 9450,
      accountNumber: '017****8890',
      type: 'MFS',
    },
    {
      name: 'City Bank',
      balance: 11800,
      accountNumber: '210****4092',
      type: 'Bank Account',
    },
    {
      name: 'Nagad',
      balance: 3600,
      accountNumber: '018****2211',
      type: 'MFS',
    },
  ],
  isEmailVerified: true,
};
