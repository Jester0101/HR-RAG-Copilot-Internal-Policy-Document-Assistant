"use client";

import type { MetricsSummary } from "@/lib/types";

export function StatsPanel({ stats }: { stats: MetricsSummary }) {
  const totalCacheEvents = stats.cacheHits + stats.cacheMisses;
  const hitPercent = totalCacheEvents > 0 ? Math.round((stats.cacheHits / totalCacheEvents) * 100) : 0;
  const missPercent = totalCacheEvents > 0 ? Math.round((stats.cacheMisses / totalCacheEvents) * 100) : 0;

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
              <span className="text-sm text-gray-400">Documents in memory</span>
              <span className="font-mono font-bold text-white">{stats.docCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Active Sessions</span>
              <span className="font-mono font-bold text-white">1</span>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <h4 className="text-sm font-medium text-white mb-3">Cache</h4>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Cache Hits</span>
                  <span className="font-mono font-bold text-white">{stats.cacheHits}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${hitPercent}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Cache Misses</span>
                  <span className="font-mono font-bold text-white">{stats.cacheMisses}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-rose-500 rounded-full"
                    style={{ width: `${missPercent}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Cache Hit Rate</span>
                  <span className="font-mono font-bold text-white">
                    {totalCacheEvents > 0 ? `${hitPercent}%` : "–"}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${hitPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
