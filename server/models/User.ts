import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  customId?: string;
  name: string;
  email: string;
  profileImage?: string;
  preferredLanguage: 'en' | 'bn';
  currency: string;
  monthlyIncome?: number;
  riskTolerance?: 'Low' | 'Moderate' | 'Aggressive';
  tagline?: string;
  city?: string;
  memberStatus?: string;
  primaryGoalId?: string;
  linkedAccounts?: Array<{
    name: string;
    balance: number;
    accountNumber: string;
    type: string;
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
      default: '৳',
      trim: true,
    },
    monthlyIncome: {
      type: Number,
      required: false,
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
    passwordHash: {
      type: String,
      required: false,
    },
    linkedAccounts: [
      {
        name: { type: String, required: true },
        balance: { type: Number, default: 0 },
        accountNumber: { type: String, default: '' },
        type: { type: String, default: 'MFS' },
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
        return ret;
      },
    },
  }
);

export const UserModel = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
