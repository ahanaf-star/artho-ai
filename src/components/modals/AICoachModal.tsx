import React, { useEffect } from 'react';

interface AICoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCoach: () => void;
  isBangla?: boolean;
}

export const AICoachModal: React.FC<AICoachModalProps> = ({
  isOpen,
  onClose,
  onOpenCoach,
  isBangla = false,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary-container/40 text-on-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary text-[20px]">smart_toy</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
              {isBangla ? 'অর্থবাঁচাও এআই কোচ' : 'ArthoBachao AI Coach'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Short message */}
        <div className="py-2">
          <p className="font-body-md text-body-md text-on-surface leading-relaxed">
            {isBangla
              ? 'আপনার এআই কোচের কাছ থেকে ব্যক্তিগত আর্থিক দিকনির্দেশনা নিন।'
              : 'Get personalized financial guidance from your AI Coach.'}
          </p>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/15">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface font-title-md text-sm hover:bg-surface-container-high transition-colors"
          >
            {isBangla ? 'বন্ধ করুন' : 'Close'}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCoach();
            }}
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-title-md text-sm hover:opacity-95 active:scale-95 transition-all shadow-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px] text-secondary-container">chat</span>
            <span>{isBangla ? 'এআই কোচ খুলুন' : 'Open AI Coach'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
