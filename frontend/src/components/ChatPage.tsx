"use client";

import React, { useState, useEffect } from "react";
import { askQuestion } from "@/lib/api";
import type { Message } from "@/lib/types";
import { MessageList } from "@/components/MessageList";
import { ChatInput } from "@/components/ChatInput";
import { Header } from "@/components/Header";
import { QuickStart } from "@/components/QuickStart";
import { StatsPanel } from "@/components/StatsPanel";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm the BluePeak HR assistant. Ask me about company policies, org structure, NDA, probation, vacation, and more.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalQueries: 0, avgResponseTime: 0 });
  const [showQuickStart, setShowQuickStart] = useState(true);

  useEffect(() => {
    const handleQuickQuestion = (e: CustomEvent) => {
      setInput(e.detail);
      setShowQuickStart(false);
      setTimeout(() => {
        handleSend();
      }, 100);
    };

    window.addEventListener('quick-question', handleQuickQuestion as EventListener);
    return () => {
      window.removeEventListener('quick-question', handleQuickQuestion as EventListener);
    };
  }, []);

  useEffect(() => {
    // Скрыть QuickStart при начале ввода
    if (input.trim().length > 0) {
      setShowQuickStart(false);
    }
  }, [input]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setError(null);
    setInput("");
    setShowQuickStart(false);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    const startTime = Date.now();

    try {
      const { answer, sources, chunks } = await askQuestion(question);
      
      const responseTime = Date.now() - startTime;
      setStats(prev => ({
        totalQueries: prev.totalQueries + 1,
        avgResponseTime: (prev.avgResponseTime * prev.totalQueries + responseTime) / (prev.totalQueries + 1)
      }));

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: answer,
        sources,
        chunks,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error(err);
      setError("Unable to connect to the AI assistant. Please try again.");
      const errorMessage: Message = {
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        content: "I apologize, but I'm having trouble accessing the information right now. Please try your question again in a moment.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
  const handleQuickQuestion = (e: CustomEvent) => {
    setInput(e.detail);
    setShowQuickStart(false);
    
    // Автоматически отправляем через 50мс (чтобы UI успел обновиться)
    setTimeout(() => {
      handleSend();
    }, 50);
  };

  window.addEventListener('quick-question', handleQuickQuestion as EventListener);
  return () => {
    window.removeEventListener('quick-question', handleQuickQuestion as EventListener);
  };
}, []);

  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col relative">
      <Header stats={stats} />
      
      <main className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-4 md:px-6 py-6 gap-6">
        <div className="flex-1 flex gap-6">
          <div className="flex-1 flex flex-col gap-6">
            <MessageList messages={messages} loading={loading} />
            
            {showQuickStart && messages.length <= 1 && (
              <QuickStart />
            )}

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-2 text-red-300">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            )}

            <ChatInput
              value={input}
              loading={loading}
              onChange={setInput}
              onSend={handleSend}
            />
          </div>
          
          <StatsPanel stats={stats} />
        </div>
      </main>

      <footer className="border-t border-white/10 py-4 mt-8">
        <div className="max-w-6xl mx-auto px-4 md:px-6 text-center text-sm text-gray-400">
          <p>BluePeak AI Assistant v1.0 • Powered by RAG technology • {new Date().getFullYear()}</p>
          <p className="mt-1">Answers are based on uploaded company documents and are for informational purposes only.</p>
        </div>
      </footer>
    </div>
  );
};