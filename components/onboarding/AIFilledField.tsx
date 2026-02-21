import { Sparkles } from "lucide-react";

interface AIFilledFieldProps {
  isAIFilled: boolean;
  children: React.ReactNode;
  label?: string;
}

export function AIFilledField({ isAIFilled, children, label }: AIFilledFieldProps) {
  return (
    <div className="relative">
      {isAIFilled && (
        <div className="absolute -top-2 right-0 z-10">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-xs font-medium text-purple-700">
            <Sparkles className="w-3 h-3" />
            AI-filled
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
