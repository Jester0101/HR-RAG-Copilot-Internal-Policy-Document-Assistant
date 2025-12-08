"use client";

import React, { useEffect, useRef } from "react";
import type { Message } from "@/lib/types";
import { ChatMessage } from "@/components/ChatMessage";

type Props = {
  messages: Message[];
  loading: boolean;
};

export const MessageList: React.FC<Props> = ({ messages, loading }) => {
  const endRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: messages.length > 5 ? "smooth" : "auto",
      block: "end",
    });
  }, [messages, loading]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto rounded-2xl glass-effect p-6 space-y-8 scroll-smooth min-h-0"
    >
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-center">
          <div className="max-w-md space-y-6">
            <div className="text-gradient text-4xl font-bold">BluePeak AI</div>
            <p className="text-gray-400">
              Your intelligent HR assistant. Ask me anything about company policies, benefits, or procedures.
            </p>
          </div>
        </div>
      ) : (
        <>
          {messages.map((m, index) => (
            <div
              key={m.id}
              className={`animate-in fade-in slide-in-from-bottom-4 duration-300 ${
                index === messages.length - 1 ? "animate-in" : ""
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <ChatMessage message={m} />
            </div>
          ))}
        </>
      )}

      {loading && (
        <div className="flex gap-4 items-start animate-in fade-in">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center font-bold text-white shadow-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 max-w-[75%] backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
              <span className="text-sm text-gray-300 font-medium">Analyzing documents...</span>
            </div>
            <div className="mt-3">
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full animate-shimmer" style={{
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 2s infinite linear'
                }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={endRef} className="h-px" />
    </div>
  );
};