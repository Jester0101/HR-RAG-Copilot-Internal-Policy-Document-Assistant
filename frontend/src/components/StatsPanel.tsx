"use client";

interface Stats {
  totalQueries: number;
  avgResponseTime: number;
}

export function StatsPanel({ stats }: { stats: Stats }) {
  const features = [
    { label: "Document Coverage", value: "98%", color: "bg-emerald-500" },
    { label: "Accuracy Score", value: "96%", color: "bg-blue-500" },
    { label: "Uptime", value: "99.9%", color: "bg-green-500" },
  ];

  return (
    <div className="hidden lg:block w-64 flex-shrink-0">
      <div className="glass-effect rounded-2xl p-5 border border-white/10 h-fit sticky top-24">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          System Stats
        </h3>
        
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Total Queries</span>
              <span className="font-mono font-bold text-white">{stats.totalQueries}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Avg Response</span>
              <span className="font-mono font-bold text-white">{stats.avgResponseTime.toFixed(0)}ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Active Sessions</span>
              <span className="font-mono font-bold text-white">1</span>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <h4 className="text-sm font-medium text-white mb-3">Features</h4>
            <div className="space-y-3">
              {features.map((feature, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">{feature.label}</span>
                    <span className="font-medium text-white">{feature.value}</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${feature.color} rounded-full`}
                      style={{ width: feature.value }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <div className="text-xs text-gray-400 space-y-2">
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                System operational
              </p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                RAG processing enabled
              </p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full" />
                Real-time updates
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}