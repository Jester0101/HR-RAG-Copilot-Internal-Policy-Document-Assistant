"use client";

import { useState } from "react";

const SUGGESTED_QUESTIONS = [
  "How many PTO days do full-time employees receive?",
  "What is the length of the probation period at BluePeak?",
  "What documents are required on the first day of onboarding?",
  "What does the NDA define as Confidential Information?",
  "What counts as acceptable remote work expectations?",
  "How does PTO accrue throughout the year?",
];

export function QuickStart() {
  const [isVisible, setIsVisible] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!isVisible) return null;

  const handleQuestionClick = (question: string, index: number) => {
    setSelectedIndex(index);
    setTimeout(() => {
      const event = new CustomEvent('quick-question', { detail: question });
      window.dispatchEvent(event);
    }, 150);
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-gray-200 mb-0.5">Quick Questions</h3>
          <p className="text-xs text-gray-500">Click to ask instantly</p>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1 hover:bg-white/5 rounded-lg"
          aria-label="Close suggestions"
        >
          Hide
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {SUGGESTED_QUESTIONS.map((question, idx) => (
          <button
            key={idx}
            className={`relative group text-left p-3 rounded-lg transition-all duration-200 ${
              selectedIndex === idx 
                ? 'bg-white/10 border border-white/20 shadow-lg' 
                : 'bg-white/3 border border-white/5 hover:bg-white/5 hover:border-white/10'
            }`}
            onClick={() => handleQuestionClick(question, idx)}
          >
            <div className="flex items-start gap-2">
              <div className={`w-2 h-2 rounded-full mt-1 transition-colors ${
                selectedIndex === idx 
                  ? 'bg-green-400' 
                  : 'bg-gray-600 group-hover:bg-blue-400'
              }`} />
              <div className="flex-1">
                <div className="text-xs font-medium text-gray-200 mb-1 line-clamp-2">
                  {question}
                </div>
                <div className={`text-[10px] transition-colors ${
                  selectedIndex === idx 
                    ? 'text-green-400' 
                    : 'text-gray-500 group-hover:text-blue-400'
                }`}>
                  {selectedIndex === idx ? 'Asking...' : 'Click to ask →'}
                </div>
              </div>
            </div>
            
            {/* Hover effect */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>
        ))}
      </div>
    </div>
  );
}