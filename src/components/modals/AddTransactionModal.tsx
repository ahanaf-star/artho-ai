import React, { useState } from 'react';
import { Transaction, CategoryName, TransactionType, CustomCategory } from '../../types/financial';
import { getLocalDateString } from '../../services/financialCalculations';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (transaction: Transaction) => void;
  customCategories?: CustomCategory[];
  onCreateCategory?: (name: string) => Promise<CustomCategory | null>;
  isBangla?: boolean;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onAddTransaction,
  customCategories = [],
  onCreateCategory,
  isBangla = false,
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CategoryName>('Food & Groceries');
  const [account, setAccount] = useState<'bKash' | 'City Bank' | 'Nagad'>('bKash');
  const [date, setDate] = useState<string>(() => getLocalDateString());
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      date: date || getLocalDateString(),
      type,
      category,
      amount: parsedAmount,
      merchant: merchant.trim(),
      description: description.trim() || `${category} transaction`,
      account,
      paymentMethod: `${account} Direct`,
      classification:
        category === 'Food & Groceries' || category === 'Shopping & Gadgets'
          ? 'discretionary'
          : category === 'Cash-out & Bank Fees'
          ? 'anomalies'
          : 'essential',
      isAnomaly: category === 'Cash-out & Bank Fees',
      location: 'Dhaka',
    };

    onAddTransaction(newTx);
    setAmount('');
    setMerchant('');
    setDescription('');
    setDate(getLocalDateString());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
            {isBangla ? 'নতুন লেনদেন যুক্ত করুন' : 'Add New Transaction'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container-low rounded-xl">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-2 rounded-lg font-title-md text-sm font-semibold transition-all ${
                type === 'expense'
                  ? 'bg-surface-container-lowest shadow-sm text-error font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Expense (-)
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                setCategory('Salary & Inflow');
              }}
              className={`py-2 rounded-lg font-title-md text-sm font-semibold transition-all ${
                type === 'income'
                  ? 'bg-surface-container-lowest shadow-sm text-secondary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Income (+)
            </button>
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-outline uppercase tracking-wider">
              Amount (৳ BDT)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 font-bold text-secondary text-lg">৳</span>
              <input
                type="number"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest font-headline-md text-on-surface font-bold focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>
          </div>

          {/* Transaction Date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-outline uppercase tracking-wider">
              Transaction Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>

          {/* Merchant */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-outline uppercase tracking-wider">
              {isBangla ? 'মার্চেন্ট / প্রতিষ্ঠান (ঐচ্ছিক)' : 'Merchant / Counterparty (Optional)'}
            </label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder={
                type === 'income'
                  ? isBangla
                    ? 'যেমন: প্রতিষ্ঠান, ক্লায়েন্ট, উৎস (ঐচ্ছিক)'
                    : 'e.g. Employer, Client, Source (Optional)'
                  : isBangla
                  ? 'যেমন: স্বপ্ন, পাঠাও, ডেসকো (ঐচ্ছিক)'
                  : 'e.g. Shwapno, Pathao Food, DESCO (Optional)'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                {isBangla ? 'ক্যাটাগরি' : 'Category'}
              </label>
              {type === 'expense' && onCreateCategory && (
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickAddOpen(!isQuickAddOpen);
                    setQuickAddError(null);
                  }}
                  className="text-[11px] text-secondary font-semibold hover:underline flex items-center gap-0.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {isQuickAddOpen ? 'close' : 'add_circle'}
                  </span>
                  <span>{isQuickAddOpen ? (isBangla ? 'বাতিল' : 'Cancel') : (isBangla ? '+ ক্যাটাগরি যোগ করুন' : '+ Add Category')}</span>
                </button>
              )}
            </div>

            {/* Quick Add Custom Category Inline Box */}
            {isQuickAddOpen && type === 'expense' && (
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2 animate-in fade-in duration-150 my-1">
                <span className="text-[11px] font-semibold text-on-surface">
                  {isBangla ? 'নতুন ব্যয়ের ক্যাটাগরি তৈরি করুন' : 'Create Custom Expense Category'}
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => {
                      setNewCatName(e.target.value);
                      setQuickAddError(null);
                    }}
                    placeholder={isBangla ? 'যেমন: স্বাস্থ্যসেবা, শিক্ষা' : 'e.g. Healthcare, Education'}
                    maxLength={50}
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                  <button
                    type="button"
                    disabled={isCreatingCategory || !newCatName.trim()}
                    onClick={async () => {
                      const trimmed = newCatName.trim();
                      if (!trimmed) {
                        setQuickAddError(isBangla ? 'ক্যাটাগরির নাম আবশ্যক' : 'Category name is required');
                        return;
                      }
                      if (trimmed.length > 50) {
                        setQuickAddError(isBangla ? 'সর্বোচ্চ ৫০ অক্ষর হতে পারে' : 'Max 50 characters allowed');
                        return;
                      }
                      const standardList = [
                        'food & groceries',
                        'shopping & gadgets',
                        'utility & fixed costs',
                        'transportation',
                        'cash-out & bank fees',
                        'entertainment & others',
                      ];
                      if (
                        standardList.includes(trimmed.toLowerCase()) ||
                        customCategories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())
                      ) {
                        setQuickAddError(isBangla ? 'এই ক্যাটাগরি ইতিমধ্যে বিদ্যমান' : 'Category already exists');
                        return;
                      }
                      if (onCreateCategory) {
                        setIsCreatingCategory(true);
                        setQuickAddError(null);
                        try {
                          const created = await onCreateCategory(trimmed);
                          if (created) {
                            setCategory(created.name);
                            setNewCatName('');
                            setIsQuickAddOpen(false);
                          }
                        } catch (err: any) {
                          setQuickAddError(err?.message || (isBangla ? 'তৈরি করতে ব্যর্থ হয়েছে' : 'Failed to create'));
                        } finally {
                          setIsCreatingCategory(false);
                        }
                      }
                    }}
                    className="px-3 py-1.5 text-xs rounded-lg bg-secondary text-on-secondary font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0 flex items-center gap-1"
                  >
                    {isCreatingCategory && (
                      <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                    )}
                    <span>{isCreatingCategory ? (isBangla ? 'তৈরি হচ্ছে...' : 'Saving...') : (isBangla ? 'যোগ করুন' : 'Add')}</span>
                  </button>
                </div>
                {quickAddError && (
                  <span className="text-[10px] text-error font-medium">{quickAddError}</span>
                )}
              </div>
            )}

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryName)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container"
            >
              {type === 'expense' ? (
                <>
                  <optgroup label={isBangla ? 'স্ট্যান্ডার্ড ক্যাটাগরি' : 'Standard Categories'}>
                    <option value="Food & Groceries">Food &amp; Groceries</option>
                    <option value="Shopping & Gadgets">Shopping &amp; Gadgets</option>
                    <option value="Utility & Fixed Costs">Utility &amp; Fixed Costs</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Cash-out & Bank Fees">Cash-out &amp; Bank Fees</option>
                    <option value="Entertainment & Others">Entertainment &amp; Others</option>
                  </optgroup>
                  {customCategories.length > 0 && (
                    <optgroup label={isBangla ? 'কাস্টম ক্যাটাগরি' : 'Custom Categories'}>
                      {customCategories.map((c) => (
                        <option key={c.id || c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </>
              ) : (
                <>
                  <option value="Salary & Inflow">Salary &amp; Inflow</option>
                  <option value="Savings & Investment">Savings &amp; Investment Yield</option>
                </>
              )}
            </select>
          </div>

          {/* Account */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-outline uppercase tracking-wider">
              Account / Wallet
            </label>
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container"
            >
              <option value="bKash">bKash Mobile Wallet</option>
              <option value="City Bank">City Bank Account / Card</option>
              <option value="Nagad">Nagad Wallet</option>
            </select>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-outline uppercase tracking-wider">
              Description / Note
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Weekend grocery run"
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-title-md hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-primary-container text-on-primary font-title-md hover:opacity-95 transition-opacity active:scale-95 shadow-sm"
            >
              Save Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
