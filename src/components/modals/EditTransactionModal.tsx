import React, { useState, useEffect } from 'react';
import { Transaction, CategoryName, TransactionType, CustomCategory } from '../../types/financial';
import { getLocalDateString } from '../../services/financialCalculations';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onUpdateTransaction: (transaction: Transaction) => Promise<void>;
  onDeleteTransaction: (transactionId: string) => Promise<void>;
  customCategories?: CustomCategory[];
  isBangla?: boolean;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onUpdateTransaction,
  onDeleteTransaction,
  customCategories = [],
  isBangla = false,
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CategoryName>('Food & Groceries');
  const [account, setAccount] = useState<'bKash' | 'City Bank' | 'Nagad'>('bKash');
  const [date, setDate] = useState<string>(() => getLocalDateString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmount(String(transaction.amount));
      setMerchant(transaction.merchant || '');
      setDescription(transaction.description || '');
      setCategory(transaction.category);
      setAccount((transaction.account as any) || 'bKash');
      setDate(transaction.date || getLocalDateString());
      setShowDeleteConfirm(false);
      setErrorMessage(null);
    }
  }, [transaction, isOpen]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setErrorMessage(isBangla ? 'অনুগ্রহ করে সঠিক পরিমাণ লিখুন' : 'Please enter a valid amount greater than 0');
      return;
    }

    const updatedTx: Transaction = {
      ...transaction,
      date: date || transaction.date || getLocalDateString(),
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
    };

    setIsSubmitting(true);
    try {
      await onUpdateTransaction(updatedTx);
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err?.message || (isBangla ? 'লেনদেন আপডেট করতে ব্যর্থ হয়েছে' : 'Failed to update transaction'));
    }
  };

  const handleDelete = async () => {
    setErrorMessage(null);
    setIsDeleting(true);
    try {
      await onDeleteTransaction(transaction.id);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: any) {
      setIsDeleting(false);
      setErrorMessage(err?.message || (isBangla ? 'লেনদেন ডিলিট করতে ব্যর্থ হয়েছে' : 'Failed to delete transaction'));
    }
  };

  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-primary">edit_note</span>
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
              {isBangla ? 'লেনদেন সম্পাদনা করুন' : 'Edit Transaction'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting || isDeleting}
            className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-error-container/40 text-on-error-container text-xs flex items-center gap-2 border border-error/30 animate-in fade-in duration-150">
            <span className="material-symbols-outlined text-[18px] text-error shrink-0">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Delete Confirmation Box */}
        {showDeleteConfirm ? (
          <div className="p-4 rounded-xl bg-error-container/20 border border-error/30 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-error font-title-md font-bold">
              <span className="material-symbols-outlined text-[20px]">warning</span>
              <span>{isBangla ? 'আপনি কি নিশ্চিত?' : 'Confirm Deletion'}</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {isBangla
                ? 'এই লেনদেনটি স্থায়ীভাবে ডিলিট করা হবে এবং ডাটাবেজ ও সমস্ত আর্থিক হিসাব থেকে অপসারিত হবে।'
                : 'This transaction will be permanently removed from MongoDB and all dependent financial calculations will recalculate.'}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors"
              >
                {isBangla ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="flex-1 py-2 rounded-lg bg-error text-on-error text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isDeleting && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                <span>{isDeleting ? (isBangla ? 'ডিলিট হচ্ছে...' : 'Deleting...') : (isBangla ? 'ডিলিট নিশ্চিত করুন' : 'Confirm Delete')}</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* Type Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container-low rounded-xl">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`py-2 rounded-lg font-title-md text-sm font-semibold transition-all ${type === 'expense'
                  ? 'bg-surface-container-lowest shadow-sm text-error font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
                  }`}
              >
                {isBangla ? 'ব্যয় (-)' : 'Expense (-)'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('income');
                  if (category !== 'Salary & Inflow' && category !== 'Savings & Investment') {
                    setCategory('Salary & Inflow');
                  }
                }}
                className={`py-2 rounded-lg font-title-md text-sm font-semibold transition-all ${type === 'income'
                  ? 'bg-surface-container-lowest shadow-sm text-secondary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
                  }`}
              >
                {isBangla ? 'আয় (+)' : 'Income (+)'}
              </button>
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                {isBangla ? 'পরিমাণ (৳ BDT)' : 'Amount (৳ BDT)'}
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

            {/* Date */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                {isBangla ? 'তারিখ' : 'Transaction Date'}
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
                      : 'e.g. Shwapno, Pathao, DESCO (Optional)'
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                {isBangla ? 'ক্যাটাগরি' : 'Category'}
              </label>
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
                    {(customCategories.length > 0 ||
                      (category &&
                        ![
                          'Food & Groceries',
                          'Shopping & Gadgets',
                          'Utility & Fixed Costs',
                          'Transportation',
                          'Cash-out & Bank Fees',
                          'Entertainment & Others',
                        ].includes(category))) && (
                      <optgroup label={isBangla ? 'কাস্টম ক্যাটাগরি' : 'Custom Categories'}>
                        {customCategories.map((c) => (
                          <option key={c.id || c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                        {category &&
                          ![
                            'Food & Groceries',
                            'Shopping & Gadgets',
                            'Utility & Fixed Costs',
                            'Transportation',
                            'Cash-out & Bank Fees',
                            'Entertainment & Others',
                          ].includes(category) &&
                          !customCategories.some(
                            (c) => c.name.toLowerCase() === category.toLowerCase()
                          ) && (
                            <option value={category}>{category}</option>
                          )}
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
                {isBangla ? 'অ্যাকাউন্ট / ওয়ালেট' : 'Account / Wallet'}
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
                {isBangla ? 'বিবরণ' : 'Description / Note'}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Weekly grocery run"
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/15">
              <button
                type="button"
                disabled={isSubmitting || isDeleting}
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-2.5 rounded-xl text-error hover:bg-error-container/20 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                <span>{isBangla ? 'ডিলিট' : 'Delete'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting || isDeleting}
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface font-title-md text-sm hover:bg-surface-container-high transition-colors disabled:opacity-50"
                >
                  {isBangla ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isDeleting}
                  className="px-4 py-2.5 rounded-xl bg-primary-container text-on-primary font-title-md text-sm hover:opacity-95 transition-opacity active:scale-95 shadow-sm flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSubmitting && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                  <span>{isSubmitting ? (isBangla ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (isBangla ? 'পরিবর্তন সংরক্ষণ করুন' : 'Save Changes')}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

