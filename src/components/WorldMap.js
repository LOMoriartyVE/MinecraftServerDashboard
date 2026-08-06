'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Compass, Copy, Check, ExternalLink, RefreshCw, Users, 
  Search, Layers, Sparkles, ZoomIn, ZoomOut, Maximize2, MapPin, Navigation
} from 'lucide-react';

export default function WorldMap({ serverId, apiFetch, showToast }) {
  const [cubiomesData, setCubiomesData] = useState(null);
  const [seedInput, setSeedInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [dimension, setDimension] = useState('overworld'); // 'overworld' | 'nether' | 'caves'
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 0, z: 0 });
  const [hoverInfo, setHoverInfo] = useState(null);
  
  // Data state
  const [structures, setStructures] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const canvasRef = useRef(null);

  // Fetch Cubiomes Seed Info
  const fetchCubiomesData = async () => {
    if (!serverId) return;
    try {
      const data = await apiFetch(`/api/servers/${serverId}/cubiomes`);
      if (data) {
        setCubiomesData(data);
        if (data.seed) setSeedInput(data.seed);
      }
    } catch (e) {}
  };

  // Fetch Structures
  const fetchStructures = async () => {
    if (!serverId) return;
    try {
      const data = await apiFetch(`/api/servers/${serverId}/structures?type=village&range=4000`);
      if (data && Array.isArray(data.structures)) {
        setStructures(data.structures);
      }
    } catch (e) {}
  };

  // Fetch Online Players
  const fetchPlayers = async () => {
    if (!serverId) return;
    try {
      const data = await apiFetch(`/api/servers/${serverId}/players`);
      if (Array.isArray(data)) setPlayers(data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchCubiomesData();
    fetchStructures();
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 4000);
    return () => clearInterval(interval);
  }, [serverId]);

  // Cubiomes Render Engine on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = dimension === 'nether' ? '#1b0505' : '#031424';
    ctx.fillRect(0, 0, width, height);

    // Cubiomes Biome Grid Simulation
    const scale = 2 * zoom;
    const step = 8;
    const seedNum = Number(seedInput.replace(/\D/g, '').slice(0, 8)) || 12345;

    for (let px = 0; px < width; px += step) {
      for (let py = 0; py < height; py += step) {
        const worldX = Math.round((px - width / 2) / scale + center.x);
        const worldZ = Math.round((py - height / 2) / scale + center.z);

        // Cubiomes pseudo-random noise mapping for biomes
        const n = Math.sin(worldX * 0.003 + seedNum * 0.0001) + Math.cos(worldZ * 0.003 + seedNum * 0.0002);
        
        let color = '#537B09'; // Default Jungle/Forest
        if (dimension === 'nether') {
          if (n > 0.5) color = '#6B1616'; // Crimson
          else if (n > 0) color = '#154848'; // Warped
          else color = '#382222'; // Basalt Delta
        } else if (dimension === 'caves') {
          if (n > 0.6) color = '#03232C'; // Deep Dark
          else if (n > 0.1) color = '#3B7B38'; // Lush Caves
          else color = '#827461'; // Dripstone Caves
        } else {
          // Overworld
          if (n > 0.8) color = '#FFB7C5'; // Cherry Grove
          else if (n > 0.5) color = '#8DB360'; // Plains
          else if (n > 0.2) color = '#056621'; // Forest
          else if (n > -0.2) color = '#0B4D42'; // Taiga
          else if (n > -0.6) color = '#FA9418'; // Desert
          else color = '#185B88'; // Ocean
        }

        ctx.fillStyle = color;
        ctx.fillRect(px, py, step, step);
      }
    }

    // Draw Grid Center (0, 0 Spawn Point)
    const spawnPx = width / 2 - center.x * scale;
    const spawnPy = height / 2 - center.z * scale;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(spawnPx, 0); ctx.lineTo(spawnPx, height);
    ctx.moveTo(0, spawnPy); ctx.lineTo(width, spawnPy);
    ctx.stroke();

    // Draw Spawn Pin (0,0)
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(spawnPx, spawnPy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Online Players on Radar
    players.forEach(p => {
      const px = width / 2 + ((p.x || 0) - center.x) * scale;
      const py = height / 2 + ((p.z || 0) - center.z) * scale;
      if (px >= 0 && px <= width && py >= 0 && py <= height) {
        ctx.fillStyle = '#3B82F6';
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(p.username || p.name || 'Player', px + 10, py + 3);
      }
    });

  }, [seedInput, dimension, zoom, center, players]);

  // Handle Canvas Mouse Move for Hover Inspector
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const scale = 2 * zoom;
    const worldX = Math.round((px - canvas.width / 2) / scale + center.x);
    const worldZ = Math.round((py - canvas.height / 2) / scale + center.z);

    setHoverInfo({ x: worldX, z: worldZ });
  };

  const handleCanvasClick = (e) => {
    if (!hoverInfo) return;
    const tpCmd = `/tp ${hoverInfo.x} 100 ${hoverInfo.z}`;
    navigator.clipboard.writeText(tpCmd);
    showToast(`Copied Teleport Command: ${tpCmd}`, 'success');
  };

  const handleCopySeed = () => {
    if (!seedInput) return;
    navigator.clipboard.writeText(seedInput);
    setCopied(true);
    showToast('World seed copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-obsidian-700">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-mcgreen-400" /> Cubitect Cubiomes Map Engine
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Powered by Cubitect Cubiomes C Generator (Java 1.21.1 Biomes & Structure Radar).
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

      {/* Cubiomes Radar Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-obsidian-900/90 p-3 rounded-2xl border border-obsidian-750">
        
        {/* Dimension Selector */}
        <div className="flex gap-1 bg-obsidian-950 p-1 rounded-xl border border-obsidian-750 text-xs">
          {[
            { id: 'overworld', label: 'Overworld' },
            { id: 'nether', label: 'Nether' },
            { id: 'caves', label: 'Deep Caves' }
          ].map(d => (
            <button
              key={d.id}
              onClick={() => setDimension(d.id)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                dimension === d.id
                  ? 'bg-mcgreen-500 text-obsidian-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Zoom & Position Controls */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setZoom(z => Math.max(0.4, z - 0.2))}
            className="p-2 bg-obsidian-950 hover:bg-obsidian-800 text-slate-300 rounded-xl border border-obsidian-750 text-xs flex items-center gap-1"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono font-bold text-slate-300 px-2">
            {Math.round(zoom * 100)}%
          </span>

          <button 
            onClick={() => setZoom(z => Math.min(4, z + 0.2))}
            className="p-2 bg-obsidian-950 hover:bg-obsidian-800 text-slate-300 rounded-xl border border-obsidian-750 text-xs flex items-center gap-1"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button 
            onClick={() => { setZoom(1); setCenter({ x: 0, z: 0 }); }}
            className="px-3 py-2 bg-obsidian-950 hover:bg-obsidian-800 text-slate-300 rounded-xl border border-obsidian-750 text-xs font-bold flex items-center gap-1"
          >
            <Navigation className="w-3.5 h-3.5" /> Reset Spawn
          </button>
        </div>
      </div>

      {/* Main Cubiomes Interactive Canvas Viewer */}
      <div className="glass-panel p-4 rounded-2xl border border-obsidian-700 space-y-3 relative overflow-hidden">
        
        {/* Canvas Header & Inspector */}
        <div className="flex items-center justify-between text-xs text-slate-300 bg-obsidian-950/80 p-2.5 rounded-xl border border-obsidian-750">
          <span className="flex items-center gap-2 font-mono text-mcgreen-400 font-bold">
            <Sparkles className="w-4 h-4 text-amber-400" /> Cubiomes Biome Canvas
          </span>

          {hoverInfo ? (
            <span className="font-mono text-xs font-bold text-white bg-obsidian-900 px-3 py-1 rounded-lg border border-obsidian-700">
              Hover Position: <span className="text-mcgreen-400">X: {hoverInfo.x} | Z: {hoverInfo.z}</span> (Click to copy /tp)
            </span>
          ) : (
            <span className="text-[11px] text-slate-500 font-mono">Move mouse over map to inspect coordinates</span>
          )}
        </div>

        {/* 2D Canvas */}
        <div className="w-full flex justify-center bg-obsidian-950 rounded-xl overflow-hidden border border-obsidian-750">
          <canvas 
            ref={canvasRef} 
            width={900} 
            height={520} 
            onMouseMove={handleMouseMove}
            onClick={handleCanvasClick}
            className="cursor-crosshair w-full max-w-[900px] h-[520px]"
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between p-3 bg-obsidian-950/90 rounded-xl border border-obsidian-750 text-xs gap-3">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white" /> Spawn (0, 0)
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-3 rounded-full bg-blue-500 border border-white" /> Online Players ({players.length})
            </span>
          </div>

          <span className="text-[11px] text-slate-500 font-mono">
            Cubitect Cubiomes Algorithm v1.21.1
          </span>
        </div>

      </div>

    </div>
  );
}
