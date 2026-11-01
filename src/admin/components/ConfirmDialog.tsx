import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Hapus',
  cancelText = 'Batal',
  isDanger = true,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border-2 border-black max-w-sm w-full p-6 shadow-2xl text-stone-900">
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
            <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
          </div>
          <h3 className="font-serif font-bold text-base text-stone-900 leading-tight">
            {title}
          </h3>
        </div>
        <div className="text-xs text-stone-600 leading-relaxed mb-6">
          {message}
        </div>
        <div className="flex items-center justify-end space-x-2.5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full border-2 border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-full border-2 border-black text-xs font-bold transition-transform active:scale-95 ${
              isDanger
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-stone-900 text-white hover:bg-black'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
