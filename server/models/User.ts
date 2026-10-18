import mongoose, { Document, Schema } from 'mongoose';
import { normalizeCurrency } from '../services/exchangeRateService';

export interface IUser extends Document {
  customId?: string;
  name: string;
  email: string;
  profileImage?: string;
  preferredLanguage: 'en' | 'bn';
  currency: string;
  timeZone?: string;
  timeFormat?: '12h' | '24h';
  lastFinancialUpdate?: string;
  monthlyIncome?: number;
  monthlyIncomeCurrency?: string;
  monthlyInflowBaseline?: number;
  baselineCurrency?: string;
  riskTolerance?: 'Low' | 'Moderate' | 'Aggressive';
  tagline?: string;
  city?: string;
  memberStatus?: string;
  primaryGoalId?: string;
  hasSeededGoals?: boolean;
  linkedAccounts?: Array<{
    name: string;
    balance: number;
    accountNumber: string;
    type: string;
  }>;
  walletAccounts?: Array<{
    id: string;
    userId?: string;
    countryCode?: string;
    country?: string;
    accountType: string;
    provider: string;
    displayName?: string;
    accountNumber?: string;
    currency?: string;
    balance?: number;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
  recurringObligations?: Array<{
    id: string;
    name: string;
    amount: number;
    dueDay: number;
    category?: string;
    recurrenceRule: 'monthly' | 'weekly' | 'custom';
    isEnabled: boolean;
  }>;
  passwordHash?: string;
  isEmailVerified?: boolean;
  emailVerificationToken?: string;
  emailVerificationOtp?: string;
  emailVerificationExpires?: Date;
  emailVerificationSentAt?: Date;
  emailVerificationAttempts?: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    customId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    profileImage: {
      type: String,
      default: '',
    },
    preferredLanguage: {
      type: String,
      enum: ['en', 'bn'],
      default: 'en',
    },
    currency: {
      type: String,
      default: 'BDT',
      trim: true,
    },
    timeZone: {
      type: String,
      default: 'Asia/Dhaka',
      trim: true,
    },
    timeFormat: {
      type: String,
      enum: ['12h', '24h'],
      default: '24h',
    },
    lastFinancialUpdate: {
      type: String,
      required: false,
    },
    monthlyIncome: {
      type: Number,
      required: false,
    },
    monthlyIncomeCurrency: {
      type: String,
      default: 'BDT',
      trim: true,
    },
    riskTolerance: {
      type: String,
      enum: ['Low', 'Moderate', 'Aggressive'],
      required: false,
    },
    tagline: {
      type: String,
      default: 'Standard Member',
    },
    city: {
      type: String,
      default: 'Dhaka',
    },
    memberStatus: {
      type: String,
      default: 'Standard Member',
    },
    primaryGoalId: {
      type: String,
      required: false,
    },
    hasSeededGoals: {
      type: Boolean,
      default: false,
    },
    passwordHash: {
      type: String,
      required: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      required: false,
    },
    emailVerificationOtp: {
      type: String,
      required: false,
    },
    emailVerificationExpires: {
      type: Date,
      required: false,
    },
    emailVerificationSentAt: {
      type: Date,
      required: false,
    },
    emailVerificationAttempts: {
      type: Number,
      default: 0,
    },
    linkedAccounts: [
      {
        name: { type: String, required: true },
        balance: { type: Number, default: 0 },
        accountNumber: { type: String, default: '' },
        type: { type: String, default: 'MFS' },
      },
    ],
    walletAccounts: [
      {
        id: { type: String, required: true },
        userId: { type: String, required: false },
        countryCode: { type: String, default: 'BD' },
        country: { type: String, default: 'Bangladesh' },
        accountType: { type: String, required: true, default: 'Bank Account' },
        provider: { type: String, required: true },
        displayName: { type: String, default: '' },
        accountNumber: { type: String, default: '' },
        currency: { type: String, default: 'BDT' },
        balance: { type: Number, default: 0 },
        notes: { type: String, default: '' },
        createdAt: { type: String },
        updatedAt: { type: String },
      },
    ],
    recurringObligations: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        amount: { type: Number, required: true },
        dueDay: { type: Number, required: true },
        category: { type: String, default: 'Utility & Fixed Costs' },
        recurrenceRule: { type: String, default: 'monthly' },
        isEnabled: { type: Boolean, default: true },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret.customId || ret._id.toString();
        delete ret.__v;
        delete ret.passwordHash;
        ret.currency = normalizeCurrency(ret.currency);
        ret.monthlyIncomeCurrency = normalizeCurrency(ret.monthlyIncomeCurrency || 'BDT');
        ret.monthlyInflowBaseline = ret.monthlyIncome;
        ret.baselineCurrency = ret.monthlyIncomeCurrency;
        if (ret.updatedAt instanceof Date) {
          ret.updatedAt = ret.updatedAt.toISOString();
        }
        if (ret.createdAt instanceof Date) {
          ret.createdAt = ret.createdAt.toISOString();
        }
        return ret;
      },
    },
  }
);

UserSchema.virtual('monthlyInflowBaseline')
  .get(function (this: any) {
    return this.monthlyIncome;
  })
  .set(function (this: any, val: number) {
    this.monthlyIncome = val;
  });

UserSchema.virtual('baselineCurrency')
  .get(function (this: any) {
    return this.monthlyIncomeCurrency;
  })
  .set(function (this: any, val: string) {
    this.monthlyIncomeCurrency = val;
  });

export const UserModel = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
