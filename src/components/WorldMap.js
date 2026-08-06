'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Compass, ExternalLink, Copy, Check, Eye, Maximize2, 
  RefreshCw, Users, Shield, Sparkles, Search, Layers, Zap
} from 'lucide-react';

export default function WorldMap({ serverId, apiFetch, showToast }) {
  const [mapInfo, setMapInfo] = useState(null);
  const [seedInput, setSeedInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('radar'); // 'radar' | 'chunkbase' | 'players'
  
  // Structure Finder State
  const [selectedStructure, setSelectedStructure] = useState('village');
  const [structures, setStructures] = useState([]);
  const [isSearchingStructures, setIsSearchingStructures] = useState(false);
  const [slimeChunks, setSlimeChunks] = useState([]);
  
  // Player & Canvas Radar State
  const [players, setPlayers] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const canvasRef = useRef(null);

  const fetchMapInfo = async () => {
    if (!serverId) return;
    try {
      const data = await apiFetch(`/api/servers/${serverId}/map-info`);
      if (data) {
        setMapInfo(data);
        setSeedInput(data.seed || '');
      }
    } catch (e) {}
  };

  const fetchStructures = async (type = selectedStructure) => {
    if (!serverId) return;
    setIsSearchingStructures(true);
    try {
      const data = await apiFetch(`/api/servers/${serverId}/structures?type=${type}&range=5000`);
      if (data && Array.isArray(data.structures)) {
        setStructures(data.structures);
      }
    } catch (e) {
      showToast('Failed to fetch structure coordinates', 'error');
    } finally {
      setIsSearchingStructures(false);
    }
  };

  const fetchSlimeChunks = async () => {
    if (!serverId) return;
    try {
      const data = await apiFetch(`/api/servers/${serverId}/slime-chunks?minChunkX=-30&maxChunkX=30&minChunkZ=-30&maxChunkZ=30`);
      if (data && Array.isArray(data.slimeChunks)) {
        setSlimeChunks(data.slimeChunks);
      }
    } catch (e) {}
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
    fetchStructures('village');
    fetchSlimeChunks();
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 4000);
    return () => clearInterval(interval);
  }, [serverId]);

  const handleStructureTypeChange = (type) => {
    setSelectedStructure(type);
    fetchStructures(type);
  };

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

  const structureTypes = [
    { id: 'village', name: 'Village', icon: '🏰', color: 'text-amber-400' },
    { id: 'trial_chamber', name: 'Trial Chamber (1.21)', icon: '⚔️', color: 'text-orange-400' },
    { id: 'ancient_city', name: 'Ancient City', icon: '🏛️', color: 'text-cyan-400' },
    { id: 'stronghold', name: 'Stronghold', icon: '👁️', color: 'text-purple-400' },
    { id: 'nether_fortress', name: 'Nether Fortress', icon: '🗡️', color: 'text-rose-500' },
    { id: 'bastion', name: 'Bastion Remnant', icon: '🐷', color: 'text-rose-400' },
    { id: 'monument', name: 'Ocean Monument', icon: '🌊', color: 'text-blue-400' },
    { id: 'mansion', name: 'Woodland Mansion', icon: '🪵', color: 'text-amber-600' }
  ];

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-obsidian-700">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-mcgreen-400" /> Structure Finder & World Map Radar
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Programmatic structure locator & interactive Chunkbase map engine (Java 1.21.1).
          </p>
        </div>

        {/* Seed Input & Quick Actions */}
        <div className="flex items-center gap-3 bg-obsidian-950 p-2.5 rounded-xl border border-obsidian-750">
          <div className="text-left">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">World Seed</span>
            <input 
              type="text" 
              value={seedInput} 
              onChange={(e) => setSeedInput(e.target.value)}
              placeholder="Enter seed"
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
        </div>
      </div>

      {/* Navigation Bar */}
      <div className="flex items-center justify-between border-b border-obsidian-800 pb-2">
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('radar')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'radar'
                ? 'bg-mcgreen-500 text-obsidian-950 shadow-lg shadow-mcgreen-500/20'
                : 'bg-obsidian-900 text-slate-400 hover:text-white border border-obsidian-750'
            }`}
          >
            <Zap className="w-4 h-4" /> Structure Finder API
          </button>

          <button 
            onClick={() => setActiveTab('chunkbase')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'chunkbase'
                ? 'bg-mcgreen-500 text-obsidian-950 shadow-lg shadow-mcgreen-500/20'
                : 'bg-obsidian-900 text-slate-400 hover:text-white border border-obsidian-750'
            }`}
          >
            <Compass className="w-4 h-4" /> Chunkbase Visual App
          </button>

          <button 
            onClick={() => setActiveTab('players')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'players'
                ? 'bg-mcgreen-500 text-obsidian-950 shadow-lg shadow-mcgreen-500/20'
                : 'bg-obsidian-900 text-slate-400 hover:text-white border border-obsidian-750'
            }`}
          >
            <Users className="w-4 h-4" /> Live Player Coords ({players.length})
          </button>
        </div>
      </div>

      {/* TAB 1: Programmatic Structure & Slime Chunk Finder */}
      {activeTab === 'radar' && (
        <div className="space-y-6">
          
          {/* Structure Selector Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {structureTypes.map((st) => (
              <button
                key={st.id}
                onClick={() => handleStructureTypeChange(st.id)}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all active:scale-95 ${
                  selectedStructure === st.id
                    ? 'bg-obsidian-850 border-mcgreen-500 ring-1 ring-mcgreen-500/50 shadow-lg'
                    : 'bg-obsidian-950 border-obsidian-750 hover:border-obsidian-600'
                }`}
              >
                <span className="text-xl mb-1">{st.icon}</span>
                <span className="text-[11px] font-bold text-white leading-tight">{st.name}</span>
              </button>
            ))}
          </div>

          {/* Results Grid */}
          <div className="glass-panel p-6 rounded-2xl border border-obsidian-700 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Search className="w-4 h-4 text-mcgreen-400" /> Discovered Locations ({structures.length})
              </h4>
              <span className="text-xs text-slate-400 font-mono">Sorted by Distance from Spawn (0, 0)</span>
            </div>

            {isSearchingStructures ? (
              <p className="text-xs text-slate-500 font-mono py-12 text-center">Computing structure coordinates for seed...</p>
            ) : structures.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono py-12 text-center">No structures found within range.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {structures.map((s, idx) => (
                  <div key={idx} className="p-4 bg-obsidian-950/90 rounded-xl border border-obsidian-750 flex items-center justify-between hover:border-obsidian-600 transition-all">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl p-2 bg-obsidian-900 rounded-lg border border-obsidian-700">{s.icon}</span>
                      <div>
                        <span className="text-xs font-bold text-white block">{s.name} #{idx + 1}</span>
                        <span className="text-xs font-mono font-bold text-mcgreen-400">
                          X: {s.x} | Z: {s.z}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                          Distance: {s.distance} blocks
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`/tp ${s.x} 100 ${s.z}`);
                        showToast(`Copied Teleport Command (/tp ${s.x} 100 ${s.z})`, 'success');
                      }}
                      title="Copy Teleport Command"
                      className="px-2.5 py-1.5 bg-obsidian-900 hover:bg-obsidian-800 text-slate-300 rounded-lg border border-obsidian-700 text-[11px] font-mono font-bold transition-all active:scale-95"
                    >
                      /tp
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Embedded Chunkbase Visual App */}
      {activeTab === 'chunkbase' && (
        <div className="glass-panel rounded-2xl border border-obsidian-700 overflow-hidden relative h-[680px]">
          <div className="bg-obsidian-900 p-3 border-b border-obsidian-750 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-2 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Interactive Chunkbase App (Java 1.21.1)
            </span>
            <a 
              href={chunkbaseSrc} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-mcgreen-400 hover:underline flex items-center gap-1 font-bold"
            >
              Open Fullscreen <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <iframe 
            src={chunkbaseSrc}
            title="Chunkbase Seed Map Explorer"
            className="w-full h-full border-none bg-obsidian-950"
            allow="fullscreen"
          />
        </div>
      )}

      {/* TAB 3: Active Player Coordinates Tracker */}
      {activeTab === 'players' && (
        <div className="glass-panel p-6 rounded-2xl border border-obsidian-700 space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <MapPin className="w-4 h-4 text-mcgreen-400" /> Active Player Coordinates Radar
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
                      <span className="text-xs font-mono text-mcgreen-400">
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
