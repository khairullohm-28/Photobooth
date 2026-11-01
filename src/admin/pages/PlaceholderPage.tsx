import React from 'react';
import { Layers } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  phase: string;
  description: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  phase,
  description,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto animate-in fade-in duration-150">
      <div className="w-14 h-14 rounded-2xl bg-stone-100 border-2 border-black flex items-center justify-center text-stone-800 mb-4 shadow-sm">
        <Layers className="w-7 h-7 stroke-[2]" />
      </div>
      <span className="text-[10px] font-mono uppercase tracking-widest text-amber-700 font-bold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-300 mb-2">
        {phase}
      </span>
      <h2 className="font-serif font-bold text-xl text-stone-900 mb-1">
        {title}
      </h2>
      <p className="text-xs text-stone-500 leading-relaxed max-w-sm">
        {description}
      </p>
    </div>
  );
};
