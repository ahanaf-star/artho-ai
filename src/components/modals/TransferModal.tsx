import React, { useState } from 'react';
import { UserProfile } from '../../types/financial';
import { formatBDT } from '../../services/financialCalculations';
import { formatCurrency, convertAmount, normalizeCurrencyCode } from '../../services/currencyService';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onTransfer: (from: string, to: string, amount: number) => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  user,
  onTransfer,
}) => {
  const [fromAccount, setFromAccount] = useState<'City Bank' | 'bKash' | 'Nagad'>('City Bank');
  const [toAccount, setToAccount] = useState<'bKash' | 'Nagad' | 'City Bank'>('bKash');
  const [amount, setAmount] = useState('');

  if (!isOpen) return null;

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val <= 0 || fromAccount === toAccount) return;
    onTransfer(fromAccount, toAccount, val);
    onClose();
  };

  const userCurrency = normalizeCurrencyCode(user?.currency);
  const fromBal = user.linkedAccounts.find((a) => a.name === fromAccount)?.balance || 0;
  const formattedFromBal =
    userCurrency === 'BDT'
      ? formatBDT(fromBal)
      : `${formatCurrency(convertAmount(fromBal, 'BDT', userCurrency), userCurrency)} (${formatBDT(fromBal)})`;

  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[24px]">sync_alt</span>
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
              Transfer Funds
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleTransferSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs font-semibold text-outline uppercase tracking-wider">
              <span>Transfer From</span>
              <span>Available: {formattedFromBal}</span>
            </div>
            <select
              value={fromAccount}
              onChange={(e) => setFromAccount(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body-md"
            >
              <option value="City Bank">City Bank Account</option>
              <option value="bKash">bKash Mobile Wallet</option>
              <option value="Nagad">Nagad Wallet</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-outline uppercase tracking-wider">
              Transfer To
            </label>
            <select
              value={toAccount}
              onChange={(e) => setToAccount(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body-md"
            >
              <option value="bKash">bKash Mobile Wallet</option>
              <option value="Nagad">Nagad Wallet</option>
              <option value="City Bank">City Bank Account</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-outline uppercase tracking-wider">
              Amount (৳)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 font-bold text-secondary text-lg">৳</span>
              <input
                type="number"
                required
                max={fromBal}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="2000"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest font-headline-md text-on-surface font-bold focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low text-xs text-on-surface-variant flex items-center gap-2 border border-outline-variant/15">
            <span className="material-symbols-outlined text-[16px] text-secondary">verified</span>
            <span>Zero inter-bank NPSB transfer fee via Artho AI Auto-sweep link.</span>
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
              Confirm Transfer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
