'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Compass, ExternalLink, Copy, Check, Eye, Maximize2, RefreshCw, Users, Shield, Sparkles } from 'lucide-react';

export default function WorldMap({ serverId, apiFetch, showToast }) {
  const [mapInfo, setMapInfo] = useState(null);
  const [seedInput, setSeedInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('seedmap'); // 'seedmap' | 'players'
  const [players, setPlayers] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMapInfo = async () => {
    if (!serverId) return;
    setIsLoading(true);
    try {
      const data = await apiFetch(`/api/servers/${serverId}/map-info`);
      if (data) {
        setMapInfo(data);
        setSeedInput(data.seed || '');
      }
    } catch (e) {
      // fallback
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlayers = async () => {
    if (!serverId) return;
    try {
      const data = await apiFetch(`/api/servers/${serverId}/players`);
      if (Array.isArray(data)) setPlayers(data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchMapInfo();
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 5000);
    return () => clearInterval(interval);
  }, [serverId]);

  const handleCopySeed = () => {
    if (!seedInput) return;
    navigator.clipboard.writeText(seedInput);
    setCopied(true);
    showToast('World seed copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const currentSeed = seedInput.trim();
  const chunkbaseSrc = currentSeed
    ? `https://www.chunkbase.com/apps/seed-map#seed=${encodeURIComponent(currentSeed)}&platform=java_1_21_1`
    : `https://www.chunkbase.com/apps/seed-map#platform=java_1_21_1`;

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-obsidian-700">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-mcgreen-400" /> World Seed & Chunkbase Explorer
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Interactive biome, structure & slime chunk locator powered by Chunkbase (Java 1.21.1).
          </p>
        </div>

        {/* Seed Info Box */}
        <div className="flex items-center gap-3 bg-obsidian-950 p-2.5 rounded-xl border border-obsidian-750">
          <div className="text-left">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">World Seed</span>
            <input 
              type="text" 
              value={seedInput} 
              onChange={(e) => setSeedInput(e.target.value)}
              placeholder="Enter seed (or leave blank)"
              className="bg-transparent text-xs font-mono font-bold text-mcgreen-400 outline-none w-44"
            />
          </div>

          <button 
            onClick={handleCopySeed}
            disabled={!seedInput}
            title="Copy Seed"
            className="p-2 bg-obsidian-900 hover:bg-obsidian-800 text-slate-300 rounded-lg border border-obsidian-700 transition-all active:scale-95 disabled:opacity-50"
          >
            {copied ? <Check className="w-4 h-4 text-mcgreen-400" /> : <Copy className="w-4 h-4" />}
          </button>

          <a 
            href={chunkbaseSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-mcgreen-500 hover:bg-mcgreen-600 text-obsidian-950 rounded-lg text-xs font-bold flex items-center gap-1.5 active:scale-95 shadow-md shadow-mcgreen-500/20 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Chunkbase Site
          </a>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-obsidian-800 pb-2">
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('seedmap')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'seedmap'
                ? 'bg-mcgreen-500 text-obsidian-950 shadow-lg shadow-mcgreen-500/20'
                : 'bg-obsidian-900 text-slate-400 hover:text-white border border-obsidian-750'
            }`}
          >
            <Compass className="w-4 h-4" /> Seed Map Explorer
          </button>

          <button 
            onClick={() => setActiveTab('players')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'players'
                ? 'bg-mcgreen-500 text-obsidian-950 shadow-lg shadow-mcgreen-500/20'
                : 'bg-obsidian-900 text-slate-400 hover:text-white border border-obsidian-750'
            }`}
          >
            <Users className="w-4 h-4" /> Live Player Coordinates ({players.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={fetchMapInfo}
            className="p-2 bg-obsidian-900 hover:bg-obsidian-800 text-slate-300 rounded-xl border border-obsidian-750 transition-all active:scale-95 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>

          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 bg-obsidian-900 hover:bg-obsidian-800 text-slate-300 rounded-xl border border-obsidian-750 transition-all active:scale-95 text-xs flex items-center gap-1.5"
          >
            <Maximize2 className="w-3.5 h-3.5" /> {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>

      {/* Tab 1: Chunkbase Seed Map Frame */}
      {activeTab === 'seedmap' && (
        <div className={`glass-panel rounded-2xl border border-obsidian-700 overflow-hidden relative ${
          isFullscreen ? 'fixed inset-4 z-50 bg-obsidian-950 shadow-2xl flex flex-col' : 'h-[680px]'
        }`}>
          <div className="bg-obsidian-900 p-3 border-b border-obsidian-750 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-2 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Interactive Chunkbase App (Java 1.21.1)
            </span>
            <span className="text-[11px] text-slate-500">Find Biomes, Slime Chunks, Trial Chambers & Ancient Cities</span>
          </div>

          <iframe 
            src={chunkbaseSrc}
            title="Chunkbase Seed Map Explorer"
            className="w-full h-full border-none bg-obsidian-950"
            allow="fullscreen"
          />
        </div>
      )}

      {/* Tab 2: Player Radar & Coordinates */}
      {activeTab === 'players' && (
        <div className="glass-panel p-6 rounded-2xl border border-obsidian-700 space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <MapPin className="w-4 h-4 text-mcgreen-400" /> Active Player Radar & Coordinates
          </h4>

          {players.length === 0 ? (
            <p className="text-xs text-slate-500 font-mono py-12 text-center">No online players to track right now.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {players.map((p, idx) => (
                <div key={idx} className="p-4 bg-obsidian-950/80 rounded-xl border border-obsidian-750 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img 
                      src={`https://mc-heads.net/avatar/${p.username || p.name || 'Steve'}/40`} 
                      alt={p.username || p.name}
                      className="w-10 h-10 rounded-lg border border-obsidian-700 bg-obsidian-900"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">{p.username || p.name}</span>
                      <span className="text-[11px] font-mono text-mcgreen-400">
                        {p.x !== undefined ? `X: ${p.x} Y: ${p.y} Z: ${p.z}` : 'Position: Overworld (0, 64, 0)'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
