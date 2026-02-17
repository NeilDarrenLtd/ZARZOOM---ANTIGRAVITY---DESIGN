"use client";

import { useI18n } from "@/lib/i18n";
import { Check } from "lucide-react";

interface StepperProps {
  currentStep: number;
  totalSteps: number;
}

const STEP_KEYS = [
  "onboarding.stepper.step1",
  "onboarding.stepper.step2",
  "onboarding.stepper.step3",
  "onboarding.stepper.step4",
  "onboarding.stepper.step5",
];

export default function Stepper({ currentStep, totalSteps }: StepperProps) {
  const { t } = useI18n();

  return (
    <nav aria-label="Onboarding progress" className="w-full">
      {/* Desktop stepper */}
      <ol className="hidden sm:flex items-center gap-0">
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;

          return (
            <li
              key={step}
              className="flex items-center flex-1"
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="flex flex-col items-center gap-1.5 flex-1 relative">
                {/* Connector line */}
                {i > 0 && (
                  <div
                    className={`absolute top-3.5 right-1/2 w-full h-0.5 -translate-y-1/2 ${
                      isCompleted || isCurrent ? "bg-green-500" : "bg-gray-200"
                    }`}
                    style={{ zIndex: 0 }}
                  />
                )}

                {/* Circle */}
                <div
                  className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCompleted
                      ? "bg-green-600 text-white"
                      : isCurrent
                        ? "bg-green-600 text-white ring-4 ring-green-100"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    step
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-xs font-medium ${
                    isCurrent
                      ? "text-green-700"
                      : isCompleted
                        ? "text-green-600"
                        : "text-gray-400"
                  }`}
                >
                  {t(STEP_KEYS[i])}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Mobile stepper */}
      <div className="flex sm:hidden items-center gap-3">
        <div className="flex gap-1.5 flex-1">
          {Array.from({ length: totalSteps }, (_, i) => {
            const step = i + 1;
            const isCompleted = step < currentStep;
            const isCurrent = step === currentStep;

            return (
              <div
                key={step}
                className={`h-1.5 rounded-full flex-1 transition-all ${
                  isCompleted
                    ? "bg-green-600"
                    : isCurrent
                      ? "bg-green-500"
                      : "bg-gray-200"
                }`}
              />
            );
          })}
        </div>
        <span className="text-xs font-medium text-gray-500 flex-shrink-0">
          {currentStep}/{totalSteps}
        </span>
      </div>
    </nav>
  );
}
