"use client";

import React, { FormEvent, KeyboardEvent, useState } from "react";

type Props = {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
};

export const ChatInput: React.FC<Props> = ({
  value,
  loading,
  onChange,
  onSend,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!loading && value.trim()) {
      onSend();
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && value.trim()) {
        onSend();
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 glass-effect rounded-2xl p-4 border border-white/10"
    >
      <div className="flex items-stretch gap-3">
        <div className="flex-1 relative">
          <div className={`relative transition-all duration-300`}>
            <textarea
              className="w-full resize-none bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm text-white placeholder-white/50 focus:outline-none h-[60px] backdrop-blur-sm transition-all"
              placeholder='Ask about policies, benefits, or anything HR-related...'
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-3">
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs bg-white/10 border border-white/20 rounded">
                ⏎ Send
              </kbd>
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs bg-white/10 border border-white/20 rounded">
                ⇧⏎ New line
              </kbd>
            </div>
          </div>
        </div>
        
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="flex items-center justify-center rounded-xl px-4 min-h-[60px] h-[60px] bg-gradient-to-r from-blue-600 to-emerald-500 text-white font-semibold disabled:opacity-40"
        >
          <span className="flex items-center gap-2">
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send
              </>
            )}
          </span>
        </button>
      </div>
      
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-white/10">
        <p className="text-xs text-gray-400">
          <span className="inline-flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            RAG-powered responses
          </span>
        </p>
        <p className="text-xs text-gray-400">
          <span className="inline-flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Enterprise-grade security
          </span>
        </p>
      </div>
    </form>
  );
};