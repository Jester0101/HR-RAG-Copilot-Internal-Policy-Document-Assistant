"use client";

import React, { useState, useEffect } from "react";
import type { Message } from "@/lib/types";
import { isInfoNotFoundResponse } from "@/lib/messageUtils";

type Props = {
  message: Message;
};


export const ChatMessage: React.FC<Props> = ({ message }) => {
  const [expandedSources, setExpandedSources] = useState(false);
  const [openSourceIndex, setOpenSourceIndex] = useState<number | null>(null);
  const isUser = message.role === "user";
  const [timestamp, setTimestamp] = useState<string | null>(null);
  const isInfoNotFound = message.isInfoNotFound ?? isInfoNotFoundResponse(message.content);

  useEffect(() => {
    setTimestamp(
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }, []);

  const bm25Max = message.sources && message.sources.length > 0
    ? Math.max(...message.sources.map(s => s.bm25Score || 0))
    : 0;

  return (
    <div className={`group flex gap-4 items-start ${isUser ? "justify-end" : ""}`}>
      {/* Assistant avatar */}
      {!isUser && (
        <div className="relative flex-shrink-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center font-bold text-white shadow-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black" />
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`relative max-w-[75%] rounded-2xl px-5 py-4 leading-relaxed ${
          isUser
            ? "bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 shadow-lg"
            : "bg-white/5 border border-white/10 backdrop-blur-sm"
        }`}
      >
        {/* Message content */}
        <div className="prose prose-invert max-w-none">
          <div className="whitespace-pre-wrap text-gray-100">{message.content}</div>
        </div>

        {/* Sources section */}
        {!isUser && !isInfoNotFound && message.sources && message.sources.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <button
              onClick={() => setExpandedSources(!expandedSources)}
              className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <svg className={`w-3 h-3 transition-transform ${expandedSources ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {expandedSources ? 'Hide sources' : `Show ${message.sources.length} source${message.sources.length > 1 ? 's' : ''}`}
            </button>

            {expandedSources && (
              <div className="mt-3 space-y-2">
                <ul className="space-y-2">
                  {message.sources.map((s, i) => {
                    const fill =
                      bm25Max > 0 && s.bm25Score !== undefined
                        ? Math.max(0, Math.min(100, (s.bm25Score / bm25Max) * 100))
                        : 0;
                    const isOpen = openSourceIndex === i;

                    return (
                      <li
                        key={`${s.file}-${i}`}
                        className="text-xs p-2 bg-white/5 rounded-lg border border-white/5 hover:border-blue-500/30 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => setOpenSourceIndex(isOpen ? null : i)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">
                                  #{s.index || i + 1}
                                </span>
                                <span className="font-medium truncate">{s.file}</span>
                              </div>
                              <div className="text-gray-500 text-[10px]">{s.docType}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-20">
                                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all"
                                    style={{ width: `${fill}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-[10px] font-mono text-gray-400">
                                {s.bm25Score !== undefined ? s.bm25Score.toFixed(3) : "—"}
                              </span>
                            </div>
                          </div>
                        </button>

                        {isOpen && s.chunk && (
                          <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10 text-gray-200 text-xs leading-relaxed">
                            {s.chunk}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        {timestamp && (
          <div className={`absolute -bottom-6 text-[10px] text-gray-500 ${isUser ? 'right-0' : 'left-0'}`}>
            {timestamp}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="relative flex-shrink-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold text-white shadow-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-black" />
        </div>
      )}
    </div>
  );
};
