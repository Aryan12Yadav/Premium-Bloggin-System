import React from 'react';

export default function EventStream({ events = [] }) {
  return (
    <div className="terminal-card flex flex-col h-full">
      <div className="terminal-header">
        <span>Live Liquidity Events & Triggers</span>
        <span className="text-[10px] text-emerald-400 font-mono">Real-Time Ingestion</span>
      </div>

      <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[160px] text-xs font-mono">
        {events.length === 0 ? (
          <div className="text-gray-500 text-center py-4 text-[11px]">
            Monitoring orderbook & trades for sweep, absorption, and withdrawal triggers...
          </div>
        ) : (
          events.slice(0, 15).map((evt, idx) => {
            const isSweep = evt.event_type.includes('SWEEP');
            const isAbsorption = evt.event_type.includes('ABSORPTION');
            const badgeColor = isSweep
              ? 'bg-purple-950/80 text-purple-300 border-purple-800'
              : isAbsorption
              ? 'bg-blue-950/80 text-blue-300 border-blue-800'
              : 'bg-amber-950/80 text-amber-300 border-amber-800';

            return (
              <div
                key={evt.event_id || idx}
                className="bg-[#0A0E17] p-2 rounded border border-[#161E30] flex flex-col space-y-1 hover:border-gray-700 transition"
              >
                <div className="flex justify-between items-center text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${badgeColor}`}>
                    {evt.event_type} • {evt.direction}
                  </span>
                  <span className="text-gray-500">
                    ${evt.price_level?.toLocaleString() || 'N/A'}
                  </span>
                </div>
                <div className="text-[11px] text-gray-300">
                  {evt.evidence && evt.evidence.length > 0
                    ? evt.evidence[0]
                    : 'Pattern detected satisfying mathematical detection criteria.'}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
