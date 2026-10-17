import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  customId?: string;
  userId: string;
  name: string;
  type: 'expense' | 'income';
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    customId: {
      type: String,
      sparse: true,
      index: true,
    },
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: {
        values: ['expense', 'income'],
        message: '{VALUE} is not a valid category type',
      },
      default: 'expense',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret.customId || ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index on userId and name for fast lookup and user scoping
CategorySchema.index({ userId: 1, name: 1 });

export const CategoryModel =
  mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema);
