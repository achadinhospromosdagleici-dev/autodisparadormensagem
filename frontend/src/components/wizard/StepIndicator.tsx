import React from 'react';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  number: number;
  title: string;
  isActive: boolean;
  isCompleted: boolean;
}

export function StepIndicator({ number, title, isActive, isCompleted }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`step-indicator ${
          isCompleted ? 'completed' : isActive ? 'active' : 'inactive'
        }`}
      >
        {isCompleted ? (
          <Check className="w-4 h-4" />
        ) : (
          <span className="text-sm font-semibold">{number}</span>
        )}
      </div>
      <span
        className={`text-sm font-medium transition-colors ${
          isActive ? 'text-foreground' : 'text-muted-foreground'
        }`}
      >
        {title}
      </span>
    </div>
  );
}
