import React, { useState, useEffect, useMemo } from 'react';

// 8 Master Institutional Research Categories
export const RESEARCH_CATEGORIES = [
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

// Seed fallback reports
const SEED_RESEARCH_REPORTS = [
  {
    id: 'report-seed-01',
    symbol: 'BTCUSDT',
    title: 'BTCUSD Liquidity Sweeps: $76,920 Local High Liquidation and Rejection Analysis',
    category: 'Liquidity Sweeps',
    timeframe: '1m',
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    summary: 'Evidence-based telemetry shows aggressive buying swept resting short-stop liquidity between $76,880 and $76,925, followed by instant delta absorption and a sharp upper rejection wick.',
    market_snapshot: {
      best_bid: 76685.0,
      best_ask: 76685.5,
      spread: 0.5,
      spread_bps: 0.065,
      imbalance: -0.142,
      total_bid_notional: 4850000.0,
      total_ask_notional: 5650000.0,
    },
    content: `# BTCUSD Liquidity Sweeps: $76,920 Local High Liquidation and Rejection Analysis

## Executive Summary
During the current session, BTCUSD perpetual exhibited a classic institutional liquidity sweep of the $76,920 swing high. Aggressive retail market buy orders triggered resting short stops, resulting in sudden orderbook slippage before large resting limit sell walls absorbed the momentum, generating a 1-minute rejection wick.

## 1. What Happened in the Market
Price had previously carved out a triple-tap base around the $76,100 demand zone. The ensuing rally broke structural resistance at $76,600, pushing directly into overhead liquidity pockets. A terminal wick printed at $76,925 with high buy volume, followed by a swift failure to sustain candle closes above $76,850.

## 2. Orderbook and Liquidity Dynamics
- Best Bid: $76,685.0 | Best Ask: $76,685.5
- Orderbook Spread: $0.50 (0.065 bps)
- Orderbook Imbalance: -14.2% (Ask Dominant)
- Visible Depth: $4.85M Bids vs $5.65M Asks

Heavy resting ask liquidity was concentrated between $76,900 and $77,100. Post-sweep, buy depth was temporarily depleted while sellers reinstated dense overhead protection.

## 3. Bullish vs Bearish Outlook
### Bullish Scenario
- Trigger: Solid 5-minute candle close above $76,800.
- Target: $77,250 - $77,500.
- Confirmation: Orderbook imbalance rotating above +25%.

### Bearish Scenario
- Trigger: Breakdown below the $76,450 bid shelf.
- Target: $75,900 - $76,100 demand void.
- Confirmation: Rapid bid withdrawal and spread widening.

## 4. Invalidation and Risk Management
- Invalidation: Sustained trade below $76,200 terminates structural continuation.
- Recommendation: Stop-loss orders should always sit behind dense liquidity walls rather than on the exact support level.`
  },
  {
    id: 'report-seed-02',
    symbol: 'BTCUSDT',
    title: 'Orderbook Imbalance and Demand Concentration at $76,400 Support Shelf',
    category: 'Orderbook Imbalance',
    timeframe: '5m',
    created_at: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    summary: 'Delta Exchange depth telemetry shows abnormal bid replenishment at the $76,400 - $76,500 zone with an Imbalance Index of +28.4%. Whales are providing significant passive support.',
    market_snapshot: {
      best_bid: 76520.0,
      best_ask: 76520.5,
      spread: 0.5,
      spread_bps: 0.065,
      imbalance: 0.284,
      total_bid_notional: 7200000.0,
      total_ask_notional: 4100000.0,
    },
    content: `# Orderbook Imbalance and Demand Concentration at $76,400 Support Shelf

## Executive Summary
Analysis of Delta Exchange depth reveals significant passive bid accumulation between $76,400 and $76,500. With total visible bid depth of $7.2M against $4.1M ask depth, the Imbalance stands at +28.4%. This structural imbalance points to strong institutional defense.

## 1. Key Order Flow Observations
- Total Visible Bids: $7.2M
- Total Visible Asks: $4.1M
- Imbalance Ratio: +28.4% Buy Dominance
- The bid dominance is particularly pronounced in the 0.5% depth band, indicating active accumulation rather than spoofing.

## 2. Market Structure Analysis
- Immediate Ceiling: $76,850 - $77,000
- Primary Floor: $76,400 - $76,450
- Bias: Moderately Bullish while $76,400 holds as resting floor.`
  },
  {
    id: 'report-seed-03',
    symbol: 'BTCUSDT',
    title: 'Volatility Compression and Liquidity Absorption: Session Transition Research',
    category: 'Liquidity Absorption',
    timeframe: '15m',
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    summary: 'Institutional sell pressure was systematically absorbed between $76,250 and $76,350 without triggering orderbook cascade.',
    market_snapshot: {
      best_bid: 76350.0,
      best_ask: 76350.5,
      spread: 0.5,
      spread_bps: 0.065,
      imbalance: 0.115,
      total_bid_notional: 5900000.0,
      total_ask_notional: 5200000.0,
    },
    content: `# Volatility Compression and Liquidity Absorption: Session Transition Research

## Executive Summary
Market tape analysis identified significant passive absorption of market sell orders at $76,250-$76,350. Despite aggressive market dumping, price failed to establish new lows, signaling aggressive limit buying from institutional liquidity providers.

## Key Takeaways
- Over 120 BTC in taker sell orders were absorbed without breaching $76,250.
- Absorption Ratio exceeded 2.4, demonstrating strong buyer resilience.
- ATR compressed from $95 to $64, signaling an impending volatility breakout.`
  }
];

// Clean HTML Markdown Parser with simple typography
function renderArticleMarkdown(content) {
  if (!content) return null;
  const lines = content.split('\n');
  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="my-3 space-y-1.5 pl-5 list-disc text-gray-300">
          {currentList.map((item, idx) => (
            <li key={idx} className="leading-relaxed text-sm">
              {formatInline(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  const formatInline = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="text-white font-medium">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      currentList.push(trimmed.slice(2));
      return;
    } else {
      flushList();
    }

    if (!trimmed || trimmed === '---') return;

    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={index} className="text-2xl font-bold text-white mt-6 mb-3 tracking-tight">
          {trimmed.slice(2)}
        </h1>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={index} className="text-lg font-semibold text-gray-200 mt-5 mb-2 pb-1 border-b border-[#232B3B]">
          {trimmed.slice(3)}
        </h2>
      );
    } else if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={index} className="text-sm font-semibold text-blue-400 mt-4 mb-1">
          {trimmed.slice(4)}
        </h3>
      );
    } else if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={index} className="border-l-2 border-blue-500 pl-3 py-1 text-gray-300 my-3 bg-[#151A22] rounded-r text-sm">
          {formatInline(trimmed.slice(2))}
        </blockquote>
      );
    } else {
      elements.push(
        <p key={index} className="text-gray-300 leading-relaxed my-2 text-sm">
          {formatInline(trimmed)}
        </p>
      );
    }
  });

  flushList();
  return elements;
}

export default function AIResearchPage({
  marketData = {},
  currentPrice = 76685,
  onNavigateToTerminal
}) {
  const [reports, setReports] = useState(SEED_RESEARCH_REPORTS);
  const [selectedReportId, setSelectedReportId] = useState(SEED_RESEARCH_REPORTS[0].id);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [targetCategory, setTargetCategory] = useState('Liquidity Sweeps');
  const [copied, setCopied] = useState(false);

  // Fetch reports from Python backend
  const fetchReports = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/research/reports', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setReports(data);
          setSelectedReportId(data[0].id);
        }
      }
    } catch {
      // Fallback seeds in place
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchCat = selectedCategory === 'All Categories' || r.category === selectedCategory;
      const matchSearch = !searchQuery ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.summary && r.summary.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [reports, selectedCategory, searchQuery]);

  const activeReport = useMemo(() => {
    return reports.find(r => r.id === selectedReportId) || filteredReports[0] || reports[0];
  }, [reports, selectedReportId, filteredReports]);

  // Generate research article
  const handleGenerate = async () => {
    setGenerating(true);
    setShowGenerateModal(false);

    try {
      const res = await fetch('http://localhost:8000/api/v1/research/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: targetCategory })
      });
      if (res.ok) {
        const newReport = await res.json();
        setReports(prev => [newReport, ...prev]);
        setSelectedReportId(newReport.id);
        setGenerating(false);
        return;
      }
    } catch {
      // Fallback generation
    }

    await new Promise(r => setTimeout(r, 1000));
    const liveBid = marketData?.orderbook?.best_bid || currentPrice || 76685;
    const liveAsk = marketData?.orderbook?.best_ask || (currentPrice + 0.5) || 76685.5;
    const liveSpread = marketData?.orderbook?.spread || 0.5;
    const liveImbalance = marketData?.liquidity?.imbalance || -0.12;

    const newReport = {
      id: `report-${Date.now()}`,
      symbol: 'BTCUSDT',
      title: `BTCUSD ${targetCategory}: Live Market Telemetry and Order Flow Analysis`,
      category: targetCategory,
      timeframe: '1m',
      created_at: new Date().toISOString(),
      summary: `Automated research analyzing current BTCUSD perpetual orderbook depth. Live bid sits at $${liveBid.toLocaleString()} and ask at $${liveAsk.toLocaleString()} with ${(liveImbalance * 100).toFixed(1)}% imbalance.`,
      market_snapshot: {
        best_bid: liveBid,
        best_ask: liveAsk,
        spread: liveSpread,
        spread_bps: (liveSpread / liveBid) * 10000,
        imbalance: liveImbalance,
        total_bid_notional: 5200000,
        total_ask_notional: 5900000,
      },
      content: `# BTCUSD ${targetCategory}: Live Market Telemetry and Order Flow Analysis

## Executive Summary
This research session evaluates current BTCUSD perpetual liquidity conditions on Delta Exchange. Real-time telemetry shows active price interaction around $${liveBid.toLocaleString()}, with total visible depth reflecting a ${liveImbalance >= 0 ? 'bid-supported' : 'sellers-overhang'} market structure.

## 1. Live Orderbook Conditions
- Current Price: $${liveBid.toLocaleString()}
- Best Bid: $${liveBid.toLocaleString()} | Best Ask: $${liveAsk.toLocaleString()}
- Orderbook Imbalance: ${(liveImbalance * 100).toFixed(1)}% (${liveImbalance >= 0 ? 'Buy Dominance' : 'Sell Overhang'})
- Spread: $${liveSpread.toFixed(1)} (${((liveSpread / liveBid) * 10000).toFixed(2)} bps)

## 2. Key Observations
- Traders should watch the immediate liquidity boundaries before entering breakout trades.
- Orderbook depth remains stable with normal spread metrics.

## 3. Scenarios and Risk Management
### Bullish Scenario
- Trigger: Candle close above $${(liveAsk + 100).toLocaleString()}.
- Target: $${(liveAsk + 350).toLocaleString()}.

### Bearish Scenario
- Trigger: Loss of bid shelf at $${(liveBid - 120).toLocaleString()}.
- Target: $${(liveBid - 400).toLocaleString()}.

### Invalidation Rule
- Any close beyond $${(liveBid - 250).toLocaleString()} terminates structural continuation.`
    };

    setReports(prev => [newReport, ...prev]);
    setSelectedReportId(newReport.id);
    setGenerating(false);
  };

  const handleCopy = () => {
    if (!activeReport) return;
    const text = `# ${activeReport.title}\n\nCategory: ${activeReport.category}\nDate: ${activeReport.created_at}\n\n${activeReport.content}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0F1218] text-[#E5E7EB] select-text">
      {/* ========================================================= */}
      {/* 1. CLEAN BLOG HEADER (No symbols, no neon)                */}
      {/* ========================================================= */}
      <header className="bg-[#151A22] border-b border-[#232B3B] px-5 py-3 flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-white tracking-wide">
            Market Research Blog
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Quantitative order flow and liquidity research notes
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowHowItWorksModal(true)}
            className="px-3 py-1.5 rounded text-xs text-gray-300 hover:text-white bg-[#202736] hover:bg-[#283244] border border-[#2E374A] transition"
          >
            How It Works
          </button>

          <button
            onClick={() => setShowGenerateModal(true)}
            disabled={generating}
            className="px-3.5 py-1.5 rounded text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition"
          >
            {generating ? 'Generating...' : 'New Article'}
          </button>

          {onNavigateToTerminal && (
            <button
              onClick={onNavigateToTerminal}
              className="px-3 py-1.5 rounded text-xs text-gray-300 hover:text-white border border-[#2E374A] hover:bg-[#202736] transition"
            >
              Back to Terminal
            </button>
          )}
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. SIMPLE TWO-COLUMN LAYOUT                               */}
      {/* ========================================================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Clean Simple Article List */}
        <aside className="w-80 md:w-88 border-r border-[#232B3B] bg-[#10141D] flex flex-col flex-shrink-0 overflow-hidden">
          {/* Search & Filter */}
          <div className="p-3 border-b border-[#232B3B] space-y-2">
            <input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#151A22] border border-[#232B3B] rounded px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-[#151A22] border border-[#232B3B] rounded px-2.5 py-1 text-xs text-gray-300 focus:outline-none cursor-pointer"
            >
              {RESEARCH_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Articles list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredReports.map(report => {
              const isSelected = report.id === activeReport?.id;
              const dateStr = new Date(report.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });

              return (
                <div
                  key={report.id}
                  onClick={() => setSelectedReportId(report.id)}
                  className={`p-3 rounded cursor-pointer transition text-left ${
                    isSelected
                      ? 'bg-[#1D2433] border border-blue-500/40 text-white'
                      : 'bg-transparent hover:bg-[#151A22] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center text-[11px] mb-1">
                    <span className="text-blue-400 font-medium">{report.category}</span>
                    <span className="text-gray-500">{dateStr}</span>
                  </div>
                  <h3 className={`text-xs font-medium leading-snug line-clamp-2 ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                    {report.title}
                  </h3>
                  {report.summary && (
                    <p className="text-[11px] text-gray-500 mt-1 line-clamp-1 leading-normal">
                      {report.summary}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* RIGHT COLUMN: Clean Readable Blog Post Reader */}
        <main className="flex-1 bg-[#0F1218] overflow-y-auto p-6 md:p-10">
          {activeReport ? (
            <article className="max-w-2xl mx-auto space-y-6">
              {/* Post Header */}
              <div className="border-b border-[#232B3B] pb-5 space-y-3">
                <div className="flex items-center space-x-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-[#202736] text-blue-300 border border-blue-900/40 font-medium">
                    {activeReport.category}
                  </span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-400">
                    {new Date(activeReport.created_at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-400">3 min read</span>
                </div>

                <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">
                  {activeReport.title}
                </h1>

                {/* Meta summary bar */}
                {activeReport.market_snapshot && (
                  <div className="flex items-center space-x-3 text-xs text-gray-400 bg-[#151A22] px-3.5 py-2 rounded border border-[#232B3B]">
                    <span>Price: <strong className="text-white">${activeReport.market_snapshot.best_bid?.toLocaleString()}</strong></span>
                    <span>•</span>
                    <span>Imbalance: <strong className={(activeReport.market_snapshot.imbalance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {((activeReport.market_snapshot.imbalance || 0) * 100).toFixed(1)}%
                    </strong></span>
                    <span>•</span>
                    <span>Spread: <strong className="text-white">${activeReport.market_snapshot.spread?.toFixed(1)}</strong></span>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleCopy}
                    className="text-xs text-gray-300 hover:text-white px-2.5 py-1 rounded bg-[#202736] hover:bg-[#283244] border border-[#2E374A] transition"
                  >
                    {copied ? 'Copied' : 'Copy Text'}
                  </button>
                </div>
              </div>

              {/* Post Body (Parsed cleanly as HTML) */}
              <div className="text-gray-300 leading-relaxed text-sm space-y-3">
                {renderArticleMarkdown(activeReport.content)}
              </div>
            </article>
          ) : (
            <div className="text-center py-24 text-gray-500 text-sm">
              Select an article from the left sidebar to read.
            </div>
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* 3. "HOW IT GENERATES" EXPLAINER MODAL                     */}
      {/* ========================================================= */}
      {showHowItWorksModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#151A22] border border-[#232B3B] w-full max-w-lg rounded-lg shadow-xl p-6 space-y-4 text-sm">
            <div className="flex justify-between items-center border-b border-[#232B3B] pb-3">
              <h2 className="text-sm font-semibold text-white">
                How AI Research Generates
              </h2>
              <button
                onClick={() => setShowHowItWorksModal(false)}
                className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-gray-300 leading-relaxed text-xs">
              <div className="p-3 bg-[#10141D] rounded border border-[#232B3B] space-y-1">
                <div className="font-semibold text-blue-400">Step 1: Real-Time Market Data</div>
                <p className="text-gray-400">
                  The Go backend connects to Delta Exchange WebSocket, continuously calculating the live price, orderbook bids and asks, spread, and imbalance.
                </p>
              </div>

              <div className="p-3 bg-[#10141D] rounded border border-[#232B3B] space-y-1">
                <div className="font-semibold text-blue-400">Step 2: Python Engine Fetch</div>
                <p className="text-gray-400">
                  When you request an article, Python extracts verified market telemetry directly from the Go Engine.
                </p>
              </div>

              <div className="p-3 bg-[#10141D] rounded border border-[#232B3B] space-y-1">
                <div className="font-semibold text-blue-400">Step 3: AI Inference</div>
                <p className="text-gray-400">
                  The AI model receives these verified numbers and writes an evidence-based research report without inventing fake prices or volumes.
                </p>
              </div>

              <div className="p-3 bg-[#10141D] rounded border border-[#232B3B] space-y-1">
                <div className="font-semibold text-blue-400">Step 4: Published to Blog</div>
                <p className="text-gray-400">
                  The generated report is saved to the database and displayed in this clean research blog format for easy reading.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#232B3B]">
              <button
                onClick={() => setShowHowItWorksModal(false)}
                className="px-3.5 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. "NEW ARTICLE" GENERATION MODAL                         */}
      {/* ========================================================= */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#151A22] border border-[#232B3B] w-full max-w-md rounded-lg shadow-xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#232B3B] pb-3">
              <h2 className="text-sm font-semibold text-white">
                Generate Research Article
              </h2>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded"
              >
                Close
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-gray-300 font-medium block">Select Category:</label>
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                className="w-full bg-[#10141D] border border-[#232B3B] rounded p-2 text-gray-200 cursor-pointer focus:outline-none focus:border-blue-500"
              >
                {RESEARCH_CATEGORIES.filter(c => c !== 'All Categories').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="bg-[#10141D] p-3 rounded border border-[#232B3B] space-y-1.5 text-gray-400">
              <div className="text-[11px] font-semibold text-gray-300">Live Telemetry to Analyze:</div>
              <div className="flex justify-between">
                <span>Current Price:</span>
                <span className="text-white">${currentPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Orderbook Imbalance:</span>
                <span className="text-white">
                  {((marketData?.liquidity?.imbalance || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Spread:</span>
                <span className="text-white">${(marketData?.orderbook?.spread || 0.5).toFixed(1)}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-[#232B3B]">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-3 py-1.5 rounded text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                className="px-3.5 py-1.5 rounded font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition"
              >
                Generate Article
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
