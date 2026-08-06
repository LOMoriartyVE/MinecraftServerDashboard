'use client';

import React, { useState, useEffect } from 'react';
import { 
  Activity, Users, Cpu, Zap, LineChart, Megaphone, Sun, Clock, Save, 
  ArrowRight, UserCheck, Copy, Check, Globe
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function Overview({ 
  activeServer, 
  telemetry, 
  sendPowerAction, 
  sendConsoleCommand, 
  setActiveTab,
  apiFetch,
  serverId,
  showToast
}) {
  const [history, setHistory] = useState({ cpu: [], ram: [], tps: [], labels: [] });
  const [players, setPlayers] = useState([]);
  const [copiedIp, setCopiedIp] = useState(false);

  // Fetch players on load
  useEffect(() => {
    if (!serverId) return;
    const fetchPlayers = async () => {
      try {
        const data = await apiFetch(`/api/servers/${serverId}/players`);
        setPlayers(data || []);
      } catch (err) {
        // roster fail
      }
    };
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 2000);
    return () => clearInterval(interval);
  }, [serverId]);

  // Keep a rolling history of telemetry for the chart
  useEffect(() => {
    if (!telemetry) return;
    
    setHistory(prev => {
      const now = new Date();
      const timeLabel = now.toTimeString().split(' ')[0].substring(3); // "HH:MM:SS" -> "MM:SS"
      
      const newCpu = [...prev.cpu, telemetry.cpuPercent].slice(-15);
      const newRam = [...prev.ram, telemetry.ramPercent].slice(-15);
      const newTps = [...prev.tps, telemetry.tps].slice(-15);
      const newLabels = [...prev.labels, timeLabel].slice(-15);
      
      return { cpu: newCpu, ram: newRam, tps: newTps, labels: newLabels };
    });
  }, [telemetry]);

  const chartData = {
    labels: history.labels,
    datasets: [
      {
        label: 'TPS',
        data: history.tps,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        tension: 0.3,
        yAxisID: 'y-tps',
      },
      {
        label: 'RAM %',
        data: history.ram,
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        borderWidth: 2,
        tension: 0.3,
        yAxisID: 'y-percent',
      },
      {
        label: 'CPU %',
        data: history.cpu,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        tension: 0.3,
        yAxisID: 'y-percent',
      }
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 9 } }
      },
      'y-tps': {
        type: 'linear',
        position: 'left',
        min: 0,
        max: 20,
        ticks: { color: '#10b981', font: { size: 9 } },
        grid: { color: 'rgba(255, 255, 255, 0.05)' }
      },
      'y-percent': {
        type: 'linear',
        position: 'right',
        min: 0,
        max: 100,
        ticks: { color: '#a855f7', font: { size: 9 } },
        grid: { display: false }
      }
    }
  };

  const handleMacroCommand = (cmd) => {
    sendConsoleCommand(cmd);
    setActiveTab('console');
  };

  // Safe defaults
  const showTps = activeServer?.status === 'online' ? (telemetry?.tps || '20.0') : '0.0';
  const showCpu = activeServer?.status === 'online' ? `${telemetry?.cpuPercent || 0}%` : '0%';
  const showRamGb = activeServer?.status === 'online' ? (telemetry?.ramUsedGb || '0.0') : '0.0';
  const showRamPercent = activeServer?.status === 'online' ? (telemetry?.ramPercent || 0) : 0;
  const showPlayers = activeServer?.status === 'online' ? (activeServer?.onlinePlayers || 0) : 0;

  const formatIdleTime = (sec) => {
    if (!sec || sec <= 0) return '00m 00s';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const currentServerIp = activeServer?.ip || activeServer?.serverIp || (serverId === 'Server2' ? 'mutant-shaving.tun.ply.gg' : 'wills-nederland.tun.ply.gg');

  return (
    <div className="space-y-6 font-sans">

      {/* Server IP & Public Connection Domain Card */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-obsidian-700 bg-gradient-to-r from-obsidian-900 via-obsidian-850 to-obsidian-900 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-inner">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Server Connection Address</span>
                <span className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                  Direct Playit.gg Tunnel IP
                </span>
              </div>
              <p className="text-base sm:text-lg font-black text-white font-mono mt-0.5 tracking-wide select-all">
                {currentServerIp}
              </p>
            </div>
          </div>

          <button 
            onClick={() => {
              navigator.clipboard.writeText(currentServerIp);
              if (showToast) showToast(`Copied ${currentServerIp} to clipboard!`, 'success');
              setCopiedIp(true);
              setTimeout(() => setCopiedIp(false), 2000);
            }}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 shrink-0 cursor-pointer"
          >
            {copiedIp ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            <span>{copiedIp ? 'Copied to Clipboard!' : 'Copy Server IP'}</span>
          </button>
        </div>
      </div>

      {/* Exaroton-Style Server Credit Usage Tracker */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-mcgreen-500/30 bg-gradient-to-r from-obsidian-900 via-obsidian-850 to-obsidian-900 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-mcgreen-500/10 text-mcgreen-400 border border-mcgreen-500/20 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Server Credit Usage</h4>
                <span className="text-[10px] bg-mcgreen-500/15 text-mcgreen-400 border border-mcgreen-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                  Formula: Uptime Hours × {telemetry?.maxRamGb || 4} GB RAM
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Tracks server resource consumption based on allocated RAM and uptime.
              </p>
            </div>
          </div>

          <div className="flex items-baseline gap-2 bg-obsidian-950/80 px-4 py-2.5 rounded-xl border border-obsidian-700 shrink-0">
            <span className="text-2xl font-black text-mcgreen-400 font-mono">
              {(telemetry?.creditsUsed || 0.00).toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-300 font-mono">credits</span>
            <span className="text-[10px] text-slate-500 ml-1">
              (≈ ${((telemetry?.creditsUsed || 0.00) * 0.01).toFixed(2)})
            </span>
          </div>
        </div>
      </div>

      {/* Stat Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* TPS Stat */}
        <div className="glass-panel p-4 rounded-xl relative overflow-hidden group hover:border-mcgreen-500/40 transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ticks Per Second</span>
            <div className="p-2 bg-mcgreen-500/10 text-mcgreen-400 rounded-lg">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-white font-mono">{showTps}</span>
            {activeServer?.status === 'online' && (
              <span className="text-[10px] font-semibold text-mcgreen-400 flex items-center gap-0.5">
                Optimal
              </span>
            )}
          </div>
          <div className="mt-3 w-full bg-obsidian-700 h-1 rounded-full overflow-hidden">
            <div 
              className="bg-mcgreen-500 h-full rounded-full transition-all duration-300" 
              style={{ width: activeServer?.status === 'online' ? '100%' : '0%' }}
            />
          </div>
        </div>

        {/* Online Players Stat */}
        <div className="glass-panel p-4 rounded-xl relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Online Players</span>
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-extrabold text-white font-mono">{showPlayers}</span>
              <span className="text-xs text-slate-400 font-mono">/ {activeServer?.maxPlayers || '20'}</span>
            </div>
          </div>
          <div className="mt-3 w-full bg-obsidian-700 h-1 rounded-full overflow-hidden">
            <div 
              className="bg-blue-500 h-full rounded-full transition-all duration-300" 
              style={{ width: `${(showPlayers / (parseInt(activeServer?.maxPlayers) || 20)) * 100}%` }}
            />
          </div>
        </div>

        {/* Server RAM */}
        <div className="glass-panel p-4 rounded-xl relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">RAM Usage</span>
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-extrabold text-white font-mono">{showRamGb}</span>
              <span className="text-xs text-slate-400 font-mono">/ {telemetry?.maxRamGb || 4} GB</span>
            </div>
            <span className="text-xs font-semibold text-purple-400 font-mono">{showRamPercent}%</span>
          </div>
          <div className="mt-3 w-full bg-obsidian-700 h-1 rounded-full overflow-hidden">
            <div 
              className="bg-purple-500 h-full rounded-full transition-all duration-300" 
              style={{ width: `${showRamPercent}%` }}
            />
          </div>
        </div>

        {/* CPU Load */}
        <div className="glass-panel p-4 rounded-xl relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CPU Load</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-white font-mono">{showCpu}</span>
            <span className="text-xs text-slate-400 font-mono">Allocated</span>
          </div>
          <div className="mt-3 w-full bg-obsidian-700 h-1 rounded-full overflow-hidden">
            <div 
              className="bg-amber-500 h-full rounded-full transition-all duration-300" 
              style={{ width: showCpu }}
            />
          </div>
        </div>

      </div>

      {/* Telemetry Chart & Macro Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Graph */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl flex flex-col h-[340px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <LineChart className="w-4 h-4 text-mcgreen-400" /> Live Performance Telemetry
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Real-time resource allocation sampling every 1.5s</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-mcgreen-400">
                <span className="w-2.5 h-0.5 bg-mcgreen-400 rounded-full" /> TPS
              </span>
              <span className="flex items-center gap-1 text-purple-400">
                <span className="w-2.5 h-0.5 bg-purple-400 rounded-full" /> RAM
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2.5 h-0.5 bg-amber-400 rounded-full" /> CPU
              </span>
            </div>
          </div>
          
          <div className="flex-1 relative w-full h-full min-h-0">
            {activeServer?.status === 'online' ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                Server is offline. Graph telemetry inactive.
              </div>
            )}
          </div>
        </div>

        {/* Quick Commands */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-[340px]">
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                Server Macro Controls
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Broadcast and execute global world macros</p>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {[
                { label: 'Broadcast Maintenance Warning', cmd: '/say Server maintenance in 10 minutes!', desc: '/say Server maintenance in 10m!', icon: Megaphone, color: 'hover:text-mcgreen-400' },
                { label: 'Clear World Weather', cmd: '/weather clear', desc: '/weather clear', icon: Sun, color: 'hover:text-amber-400' },
                { label: 'Set World Time to Day', cmd: '/time set day', desc: '/time set day', icon: Clock, color: 'hover:text-blue-400' },
                { label: 'Force Save World Chunk State', cmd: '/save-all', desc: '/save-all', icon: Save, color: 'hover:text-emerald-400' }
              ].map((macro, idx) => {
                const Icon = macro.icon;
                return (
                  <button 
                    key={idx}
                    onClick={() => handleMacroCommand(macro.cmd)}
                    disabled={activeServer?.status !== 'online'}
                    className={`w-full bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-700 hover:border-slate-600 disabled:opacity-50 disabled:hover:bg-obsidian-850 disabled:hover:border-obsidian-700 rounded-xl p-2.5 text-left transition-all flex items-center justify-between group`}
                  >
                    <div>
                      <p className={`text-xs font-semibold text-white group-hover:text-mcgreen-400 transition-colors`}>
                        {macro.label}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{macro.desc}</p>
                    </div>
                    <Icon className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="pt-3 border-t border-obsidian-700/60 flex justify-between items-center text-[10px] text-slate-500 font-mono">
            <span>Slots Manager</span>
            <span>Java 21</span>
          </div>
        </div>

      </div>

      {/* Online Players Grid */}
      <div className="glass-panel p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-mcgreen-400" /> Active Online Player Roster
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Recently active players logged in to this server</p>
          </div>
          <button 
            onClick={() => setActiveTab('players')}
            className="text-xs text-mcgreen-400 hover:underline font-semibold flex items-center gap-1"
          >
            Manage All Players <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {players.map(p => (
            <div 
              key={p.name}
              onClick={() => setActiveTab('players')}
              className="bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-700 p-2.5 rounded-xl flex items-center gap-2.5 cursor-pointer transition-all"
            >
              <img 
                src={`https://mc-heads.net/avatar/${p.name}`} 
                alt={`${p.name} Skin`}
                className="w-7 h-7 rounded-md bg-obsidian-800 border border-obsidian-700"
              />
              <div className="truncate">
                <p className="text-xs font-bold text-white truncate">{p.name}</p>
                <p className="text-[9px] text-mcgreen-400 font-mono">{p.ping} ms</p>
              </div>
            </div>
          ))}
          {players.length === 0 && (
            <div className="col-span-full py-6 text-center text-xs text-slate-500 font-mono">
              No players currently online.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
