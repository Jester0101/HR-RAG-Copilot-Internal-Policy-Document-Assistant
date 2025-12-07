"use client";

export function WelcomeMessage() {
  return (
    <div className="text-center space-y-6 py-12">
      <div className="inline-block">
        <div className="text-5xl font-bold mb-4">
          <span className="text-gradient">Welcome to BluePeak AI</span>
        </div>
        <div className="text-lg text-gray-400 max-w-2xl mx-auto">
          Your intelligent HR assistant powered by advanced AI and RAG technology
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto mt-8">
        <div className="glass-effect p-6 rounded-2xl border border-white/10">
          <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4 mx-auto">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 className="font-semibold text-white mb-2">Secure & Private</h3>
          <p className="text-sm text-gray-400">Your data stays within company infrastructure</p>
        </div>

        <div className="glass-effect p-6 rounded-2xl border border-white/10">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-4 mx-auto">
            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="font-semibold text-white mb-2">Instant Answers</h3>
          <p className="text-sm text-gray-400">Get accurate responses from company documents</p>
        </div>

        <div className="glass-effect p-6 rounded-2xl border border-white/10">
          <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4 mx-auto">
            <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="font-semibold text-white mb-2">Document-Based</h3>
          <p className="text-sm text-gray-400">Answers sourced directly from HR policies</p>
        </div>
      </div>
    </div>
  );
}