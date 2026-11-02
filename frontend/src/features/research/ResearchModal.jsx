import React, { useState, useEffect } from 'react';

export default function ResearchModal({ isOpen, onClose }) {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  const categories = [
    'Liquidity Analysis',
    'Liquidity Sweeps',
    'Liquidity Absorption',
    'Orderbook Imbalance',
    'Liquidity Withdrawal',
    'Volatility Research',
    'Liquidation Research',
    'Historical Comparison'
  ];

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/research/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data);
        if (data.length > 0 && !selectedReport) {
          setSelectedReport(data[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load reports', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReports();
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/research/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory || null })
      });
      if (res.ok) {
        const newReport = await res.json();
        setReports([newReport, ...reports]);
        setSelectedReport(newReport);
      }
    } catch (e) {
      console.error('Report generation error', e);
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="terminal-card w-full max-w-5xl h-[85vh] flex flex-col border border-[#1E2538] shadow-2xl">
        {/* Header */}
        <div className="terminal-header flex justify-between items-center bg-[#141A26]">
          <div className="flex items-center space-x-2">
            <span>🧠</span>
            <span className="text-white font-bold">AI Market Research Engine & Articles</span>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-[#0A0E17] border border-[#1E2538] rounded px-2 py-1 text-[11px] text-gray-300 font-mono"
            >
              <option value="">Auto-Select Category</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-amber-500 hover:bg-amber-400 text-black px-3 py-1 rounded text-xs font-bold font-mono transition disabled:opacity-50"
            >
              {generating ? 'Synthesizing...' : '⚡ Generate Research'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white px-2 py-0.5 rounded text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Articles List */}
          <div className="w-80 border-r border-[#1E2538] bg-[#0A0E17] overflow-y-auto p-2 space-y-2">
            {loading ? (
              <div className="text-gray-500 text-center py-6 text-xs font-mono">Loading reports...</div>
            ) : reports.length === 0 ? (
              <div className="text-gray-500 text-center py-6 text-xs font-mono">No research reports found. Click Generate.</div>
            ) : (
              reports.map(r => (
                <div
                  key={r.id}
                  onClick={() => setSelectedReport(r)}
                  className={`p-2.5 rounded cursor-pointer transition border text-xs font-mono ${
                    selectedReport?.id === r.id
                      ? 'bg-[#141A26] border-amber-500/50 text-white'
                      : 'bg-[#0E121B] border-[#1A2030] text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <span className="text-[10px] text-amber-400 block font-bold mb-1">{r.category}</span>
                  <div className="text-gray-200 font-medium text-[11px] line-clamp-2 leading-snug">{r.title}</div>
                  <span className="text-[9px] text-gray-500 block mt-1.5">
                    {new Date(r.created_at).toLocaleTimeString()} UTC
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Right Area: Article Reader */}
          <div className="flex-1 bg-[#080B10] overflow-y-auto p-6 font-mono text-xs leading-relaxed text-gray-300">
            {selectedReport ? (
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="border-b border-gray-800 pb-3">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                    {selectedReport.category}
                  </span>
                  <h1 className="text-lg font-bold text-white mt-2 font-sans">{selectedReport.title}</h1>
                  <p className="text-[11px] text-gray-500 mt-1">Generated: {selectedReport.created_at}</p>
                </div>

                {/* Markdown Content Display */}
                <pre className="whitespace-pre-wrap font-mono text-xs text-gray-300 bg-[#0C1019] p-4 rounded border border-[#1E2538] leading-relaxed">
                  {selectedReport.content}
                </pre>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-12">Select an article from the left to read full research.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
