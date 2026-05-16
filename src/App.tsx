import React, { useState, useEffect } from 'react';
import { BarChart3, Terminal, ChevronRight,Database, Calendar, User, Zap} from 'lucide-react';
import { motion } from 'motion/react';

interface Metrics {
  cycleTime: number;
  leadTime: number;
  prThroughput: number;
  deploymentFrequency: number;
  bugRate: number;
}

interface Analysis {
  mainIssue: string;
  reasoning: string;
  actions: string[];
  patternHint: string;
  teamName: string;
  story: string;
}

export default function App() {
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    developers: null,
    jira: null,
    prs: null,
    deployments: null,
    bugs: null
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  const [meta, setMeta] = useState<{ developers: { id: string, name: string }[], months: string[] }>({ developers: [], months: [] });
  const [rawData, setRawData] = useState<any>(null);
  const [selectedDevId, setSelectedDevId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  
  const [results, setResults] = useState<{ metrics: Metrics, analysis: Analysis } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    fetch('/api/ping')
      .then(res => res.json())
      .then(data => console.log("API Connectivity Check:", data))
      .catch(err => console.error("API Connectivity Check Failed:", err));
  }, []);

  const handleFileChange = (key: string, file: File | null) => {
    setFiles(prev => ({ ...prev, [key]: file }));
  };

  const uploadFiles = async () => {
    setIsUploading(true);
    const formData = new FormData();
    Object.entries(files).forEach(([key, file]) => {
      if (file) formData.append(key, file as any);
    });

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Upload failed (${res.status}): ${errorText.slice(0, 100)}`);
      }
      
      const data = await res.json();
      setMeta({ developers: data.developers, months: data.months });
      setRawData(data.raw); // Store facts for next request
      setIsDataLoaded(true);
      setSelectedDevId('');
      setSelectedMonth('');
      setResults(null);
    } catch (e: any) {
      console.error("Upload failed:", e);
      alert(e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const calculate = async () => {
    if (!selectedDevId || !selectedMonth) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ developerId: selectedDevId, month: selectedMonth, rawData })
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Calculation failed: ${errorText.slice(0, 100)}`);
      }

      const data = await res.json();
      setResults(data);
    } catch (e) {
      console.error("Calculation failed", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden">
      {/* Header Section */}
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/50 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <BarChart3 className="w-5 h-5 text-slate-950" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white font-display">DevCoach <span className="text-cyan-400">v1.0</span></h1>
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Coach MVP Intelligence</span>
          <div className="h-8 w-[1px] bg-slate-800"></div>
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/30 rounded border border-slate-700">
             <div className={`w-2 h-2 rounded-full ${isDataLoaded ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></div>
             <span className="text-[10px] uppercase font-bold">{isDataLoaded ? 'Live' : 'Offline'}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar / Data Controls */}
        <aside className="w-72 border-r border-slate-800 bg-slate-900/30 p-6 flex flex-col gap-8 overflow-y-auto shrink-0">
          <section>
            <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-4 font-bold flex items-center gap-2">
              <Database size={12} /> Data Ingestion
            </h3>
            <div className="space-y-3">
              {[
                { id: 'developers', label: 'Dim_Developers' },
                { id: 'jira', label: 'Fact_Jira_Issues' },
                { id: 'prs', label: 'Fact_Pull_Requests' },
                { id: 'deployments', label: 'Fact_CI_Deployments' },
                { id: 'bugs', label: 'Fact_Bug_Reports' }
              ].map((item) => (
                <div key={item.id} className="relative group">
                  <div className={`p-2.5 rounded-lg text-center transition-all border ${files[item.id] ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-dashed border-slate-700 bg-slate-800/20'}`}>
                    <input 
                      type="file" 
                      accept=".csv"
                      onChange={(e) => handleFileChange(item.id, e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <p className={`text-[11px] truncate ${files[item.id] ? 'text-cyan-100' : 'text-slate-400'}`}>
                      {files[item.id] ? files[item.id]?.name : item.label}
                    </p>
                    {files[item.id] && <span className="text-[9px] text-cyan-400 block mt-0.5">● Ready</span>}
                  </div>
                </div>
              ))}

              <button 
                onClick={uploadFiles}
                disabled={isUploading || Object.values(files).every(f => f === null)}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-lg text-xs font-bold text-white transition-all shadow-lg shadow-cyan-600/20"
              >
                {isUploading ? "Uploading..." : "Process All Data"}
              </button>
            </div>
          </section>

          <section className={`${isDataLoaded ? 'opacity-100' : 'opacity-30 pointer-events-none'} transition-opacity`}>
            <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-4 font-bold flex items-center gap-2">
              <BarChart3 size={12} /> Filter Options
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1.5 flex items-center gap-1">
                  <User size={10} /> Developer
                </label>
                <select 
                  value={selectedDevId}
                  onChange={(e) => setSelectedDevId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-xs rounded p-2 text-white focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                >
                  <option value="">Select Developer</option>
                  {meta.developers.map(dev => <option key={dev.id} value={dev.id}>{dev.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1.5 flex items-center gap-1">
                  <Calendar size={10} /> Period
                </label>
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-xs rounded p-2 text-white focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                >
                  <option value="">Select Month</option>
                  {meta.months.map(month => <option key={month} value={month}>{month}</option>)}
                </select>
              </div>
              <button 
                onClick={calculate}
                disabled={isAnalyzing || !selectedDevId || !selectedMonth}
                className="w-full mt-2 bg-slate-200 hover:bg-white text-slate-950 font-bold py-2.5 rounded-lg text-xs transition-all disabled:opacity-50"
              >
                {isAnalyzing ? "Analyzing..." : "Run Coach Intelligence"}
              </button>
            </div>
          </section>
        </aside>

        {/* Main Dashboard */}
        <main className="flex-1 p-8 flex flex-col gap-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 overflow-y-auto">
          {results ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {/* Metric Cards Grid - 5 columns as per design */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <MetricCard 
                  title="Cycle Time" 
                  value={`${results.metrics.cycleTime.toFixed(1)}d`} 
                  trend="Baseline Data" 
                  color="slate"
                />
                <MetricCard 
                  title="Lead Time" 
                  value={`${results.metrics.leadTime.toFixed(1)}d`} 
                  trend="Pipeline Value"
                  color="cyan"
                />
                <MetricCard 
                  title="PR Throughput" 
                  value={results.metrics.prThroughput} 
                  trend="Volume Count"
                  color="slate" 
                />
                <MetricCard 
                  title="Deploy Freq" 
                  value={results.metrics.deploymentFrequency} 
                  trend="Ship Consistency"
                  color="slate"
                />
                <MetricCard 
                  title="Bug Rate" 
                  value={`${results.metrics.bugRate.toFixed(1)}%`} 
                  trend="Error Margin"
                  color="slate"
                />
              </div>

              {/* Reasoning Engine Card */}
              <div className="flex-1 bg-slate-900/40 border border-cyan-500/20 rounded-2xl p-8 shadow-2xl relative flex flex-col min-h-[400px]">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                   <Terminal size={128} className="text-cyan-400" />
                </div>
                
                <div className="flex items-center gap-3 mb-8 relative z-10">
                  <div className="p-2.5 bg-cyan-500/20 rounded-lg border border-cyan-500/40">
                     <Zap className="w-5 h-5 text-cyan-400 fill-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight font-display italic underline decoration-cyan-500/30 underline-offset-8">Smart Coach Insights</h2>
                    <p className="text-[10px] text-slate-500 uppercase font-bold mt-2 tracking-widest">{results.analysis.teamName}</p>
                  </div>
                </div>

                <div className="flex-1 space-y-8 max-w-3xl relative z-10">
                  <div className="bg-cyan-950/20 border-l-4 border-cyan-500 p-8 rounded-r-xl transition-all hover:bg-cyan-950/30">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-cyan-400 font-bold uppercase text-[10px] tracking-widest">Main Diagnosis: {results.analysis.mainIssue}</p>
                      <div className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-[9px] font-mono border border-cyan-500/30 rounded">
                        #{results.analysis.patternHint}
                      </div>
                    </div>
                    <p className="text-2xl font-display text-white leading-tight font-bold mb-4">
                      "{results.analysis.reasoning}"
                    </p>
                    <div className="mb-6 p-4 bg-slate-900/40 rounded-lg border border-slate-700/30 italic text-slate-400 text-xs leading-relaxed">
                      <span className="text-cyan-400 font-bold not-italic text-[9px] block mb-1.5 tracking-widest uppercase">The Likely Story</span>
                      "{results.analysis.story}"
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed border-t border-slate-800 pt-4 mt-4">
                      Comprehensive pattern analysis indicates an area for optimization in your {results.analysis.mainIssue.toLowerCase()} workflow. Monitor these levels over the next sprint cycle.
                    </p>
                  </div>

                  <div className="p-5 bg-slate-800/40 rounded-xl border border-slate-700/50">
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-4 tracking-wider">Coach-Recommended Actions</p>
                    <ul className="text-xs space-y-3 text-slate-300">
                      {results.analysis.actions?.map((action, idx) => (
                        <li key={idx} className="flex gap-2 items-center">
                          <ChevronRight size={14} className="text-cyan-500" /> {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/10 border border-slate-800/50 border-dashed rounded-3xl min-h-[500px]">
              <div className="w-20 h-20 rounded-full border-2 border-slate-800 flex items-center justify-center mb-6 relative">
                 <div className="absolute inset-0 rounded-full border-t-2 border-cyan-500 animate-spin"></div>
                 <Database size={32} className="text-slate-700" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 font-display">Awaiting Data Intelligence</h3>
              <p className="text-slate-500 text-center max-w-sm px-6 text-sm">
                Upload your engineering CSV files in the sidebar and select a developer to unlock the Immersive Smart Coach analysis.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function MetricCard({ title, value, trend, color }: { title: string, value: string | number, trend: string, color: 'cyan' | 'slate' }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-xl transition-all hover:bg-slate-900/80 hover:border-slate-700 group relative overflow-hidden">
      <div className={`absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity`}></div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">{title}</p>
      <p className={`text-2xl font-mono ${color === 'cyan' ? 'text-cyan-400' : 'text-white'} font-bold`}>{value}</p>
      <p className="text-[9px] text-slate-500 mt-3 font-medium uppercase tracking-tighter">{trend}</p>
    </div>
  );
}
