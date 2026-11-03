import React, { useState, useEffect } from 'react';

export default function ResearchModal({ isOpen, onClose }) {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [copied, setCopied] = useState(false);

  const categories = [
    'All Categories',
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
      const catParam = selectedCategory && selectedCategory !== 'All Categories' ? selectedCategory : null;
      const res = await fetch('http://localhost:8000/api/v1/research/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: catParam })
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

  const handleCopy = () => {
    if (!selectedReport) return;
    const text = `# ${selectedReport.title}\n\nCategory: ${selectedReport.category}\nDate: ${selectedReport.created_at}\n\n${selectedReport.content}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const filteredReports = reports.filter(r => {
    if (!selectedCategory || selectedCategory === 'All Categories') return true;
    return r.category === selectedCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3">
      <div className="terminal-card w-full max-w-5xl h-[88vh] flex flex-col border border-[#1E293E] shadow-2xl">
        {/* Header */}
        <div className="terminal-header bg-[#0D1424] border-b border-[#1A253D] px-3.5 py-2.5 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-base">🧠</span>
            <div>
              <span className="text-white font-bold text-xs tracking-wide">AI Quantitative Market Research Terminal</span>
              <span className="text-[10px] text-gray-400 block font-mono">Delta Market Structure & Volatility Intelligence</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-[#070B12] border border-[#182236] rounded px-2 py-1 text-[10px] text-gray-200 font-mono cursor-pointer"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn-terminal-primary text-[10px] py-1 px-3 rounded flex items-center space-x-1"
            >
              <span>{generating ? '⚡ Synthesizing...' : '⚡ Generate Article'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white px-2 py-0.5 rounded text-sm font-mono ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Articles List */}
          <div className="w-80 border-r border-[#141C2E] bg-[#070B12] overflow-y-auto p-2 space-y-1.5 flex flex-col">
            <div className="text-[10px] text-gray-500 font-mono px-1 pb-1 border-b border-[#141C2E] flex justify-between">
              <span>Saved Reports ({filteredReports.length})</span>
              <button onClick={fetchReports} className="text-amber-400 hover:underline">Refresh</button>
            </div>

            {loading ? (
              <div className="text-gray-500 text-center py-10 text-xs font-mono">Loading telemetry reports...</div>
            ) : filteredReports.length === 0 ? (
              <div className="text-gray-500 text-center py-10 text-xs font-mono space-y-1">
                <div>No reports found.</div>
                <div className="text-[10px] text-gray-600">Click "Generate Article" to synthesize AI analysis.</div>
              </div>
            ) : (
              filteredReports.map(r => (
                <div
                  key={r.id}
                  onClick={() => setSelectedReport(r)}
                  className={`p-2 rounded cursor-pointer transition border text-xs font-mono ${
                    selectedReport?.id === r.id
                      ? 'bg-[#101827] border-amber-500/50 text-white'
                      : 'bg-[#0A0E17] border-[#141C2E] text-gray-400 hover:border-gray-700 hover:text-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[9px] text-amber-400 font-bold uppercase">{r.category}</span>
                    <span className="text-[9px] text-gray-500">
                      {new Date(r.created_at).toLocaleTimeString().slice(0, 5)}
                    </span>
                  </div>
                  <div className="text-gray-200 font-semibold text-[11px] line-clamp-2 leading-snug">{r.title}</div>
                </div>
              ))
            )}
          </div>

          {/* Right Area: Article Reader */}
          <div className="flex-1 bg-[#06090F] overflow-y-auto p-5 font-mono text-xs leading-relaxed text-gray-300">
            {selectedReport ? (
              <div className="max-w-3xl mx-auto space-y-3.5">
                <div className="border-b border-[#141C2E] pb-3 flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/35 text-[9px] font-bold uppercase">
                      {selectedReport.category}
                    </span>
                    <h1 className="text-base font-bold text-white mt-1.5 font-sans leading-snug">{selectedReport.title}</h1>
                    <p className="text-[10px] text-gray-500 mt-0.5">Generated: {new Date(selectedReport.created_at).toUTCString()}</p>
                  </div>

                  <button
                    onClick={handleCopy}
                    className="btn-terminal text-[10px] py-1 px-2.5 flex-shrink-0"
                  >
                    {copied ? '✓ Copied' : '📋 Copy'}
                  </button>
                </div>

                {/* Article Content Render */}
                <div className="whitespace-pre-wrap font-mono text-[11px] text-gray-300 bg-[#0A0E17] p-4 rounded border border-[#141C2E] leading-relaxed space-y-2">
                  {selectedReport.content}
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-16 text-xs">Select an article from the left sidebar to inspect full analysis.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

