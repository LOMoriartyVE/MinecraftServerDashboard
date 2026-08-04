'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TermIcon, Trash2, Download, Send } from 'lucide-react';

export default function Console({ logs, sendConsoleCommand, clearConsole }) {
  const [filter, setFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [commandInput, setCommandInput] = useState('');
  
  const containerRef = useRef(null);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll, filter]);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.level === filter;
  });

  const handleCommandSubmit = (e) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    sendConsoleCommand(commandInput.trim());
    setCommandInput('');
  };

  const handleDownload = () => {
    const textContent = logs.map(l => `[${l.time}] [${l.level}]: ${l.msg}`).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `server-console-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col space-y-4 font-mono">
      
      {/* Top Console Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-obsidian-900 p-3 rounded-xl border border-obsidian-700">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-white flex items-center gap-2">
            <TermIcon className="w-4 h-4 text-mcgreen-400" /> Terminal Logs Stream
          </span>
          <div className="flex items-center gap-1 bg-obsidian-850 px-2 py-1 rounded-lg border border-obsidian-700 text-[10px]">
            {['all', 'INFO', 'WARN', 'ERROR'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  filter === f 
                    ? 'bg-mcgreen-500 text-obsidian-950 font-bold' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={autoScroll} 
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-obsidian-700 text-mcgreen-500 focus:ring-mcgreen-500 bg-obsidian-850"
            />
            Auto-scroll
          </label>
          <button 
            onClick={clearConsole}
            className="px-2.5 py-1 text-xs bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 border border-obsidian-700 rounded-lg transition-all flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
          <button 
            onClick={handleDownload}
            className="px-2.5 py-1 text-xs bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 border border-obsidian-700 rounded-lg transition-all flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Download
          </button>
        </div>
      </div>

      {/* Terminal logs list */}
      <div 
        ref={containerRef}
        className="flex-1 bg-obsidian-950 border border-obsidian-700 rounded-xl p-4 font-mono text-[11px] overflow-y-auto space-y-1 shadow-inner h-[480px]"
      >
        {filteredLogs.map((log, idx) => {
          let badgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
          if (log.level === 'WARN') badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
          if (log.level === 'ERROR') badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/30';

          return (
            <div 
              key={idx}
              className="console-line flex items-start gap-2 text-slate-300 hover:bg-obsidian-900 px-1 py-0.5 rounded transition-colors"
            >
              <span className="text-slate-500 shrink-0 select-none">[{log.time}]</span>
              <span className={`px-1 rounded border text-[9px] font-bold shrink-0 ${badgeClass}`}>
                {log.level}
              </span>
              <span className="break-all whitespace-pre-wrap">{log.msg}</span>
            </div>
          );
        })}
        {filteredLogs.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs">
            Terminal output empty
          </div>
        )}
      </div>

      {/* Console Input Submit bar */}
      <form onSubmit={handleCommandSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-mcgreen-400 font-bold">$</span>
          <input 
            type="text" 
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Enter Minecraft server command (e.g. /op Player, /give @a diamond 64)..." 
            className="w-full bg-obsidian-900 border border-obsidian-700 focus:border-mcgreen-500 rounded-xl pl-8 pr-4 py-3 text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>
        <button 
          type="submit" 
          className="bg-mcgreen-500 hover:bg-mcgreen-600 text-obsidian-950 font-bold px-6 py-3 rounded-xl text-xs flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-mcgreen-500/20"
        >
          <Send className="w-4 h-4" /> Execute
        </button>
      </form>

    </div>
  );
}
