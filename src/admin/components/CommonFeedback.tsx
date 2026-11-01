import React from 'react';
import { Inbox } from 'lucide-react';

export const SkeletonLoader: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="w-full space-y-3 animate-pulse">
      <div className="h-8 bg-stone-200 rounded-lg w-1/3 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-stone-100 rounded-xl border border-stone-200 w-full" />
      ))}
    </div>
  );
};

interface EmptyStateProps {
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-stone-300 rounded-2xl bg-stone-50/50 my-4">
      <div className="p-3 bg-white rounded-full border-2 border-black mb-3 text-stone-700 shadow-sm">
        {icon || <Inbox className="w-6 h-6 stroke-[1.8]" />}
      </div>
      <h4 className="font-serif font-bold text-sm text-stone-900 mb-1">{title}</h4>
      {description && <p className="text-xs text-stone-500 max-w-xs mb-4">{description}</p>}
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 rounded-full border-2 border-black bg-stone-900 text-white text-xs font-bold shadow hover:bg-black transition-all"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  variant = 'primary',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl border-2 border-black max-w-sm w-full p-6 shadow-2xl space-y-4">
        <h3 className="font-serif font-bold text-base text-stone-900">{title}</h3>
        <p className="text-xs text-stone-600 font-sans leading-relaxed">{message}</p>
        <div className="flex items-center justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-full border border-stone-300 hover:border-black text-xs font-serif font-bold text-stone-700 transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-full border-2 border-black text-xs font-serif font-bold tracking-wide transition-all active:scale-95 cursor-pointer shadow-sm ${
              variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-stone-950 hover:bg-stone-800 text-white'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

