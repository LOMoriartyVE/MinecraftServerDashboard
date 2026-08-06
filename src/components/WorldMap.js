'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Compass, Copy, Check, ExternalLink, RefreshCw, Users, 
  Search, Layers, Sparkles, ZoomIn, ZoomOut, Maximize2, MapPin, Navigation,
  Eye, CheckSquare, Square, Sliders, ArrowRight
} from 'lucide-react';

// Real Minecraft Icon Image URLs
const ICON_URLS = {
  village: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/items/emerald.png',
  trial_chamber: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/blocks/chiseled_tuff_bricks.png',
  ancient_city: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/blocks/sculk_catalyst_top.png',
  stronghold: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/items/ender_eye.png',
  mansion: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/blocks/dark_oak_log.png',
  monument: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/items/prismarine_shard.png',
  outpost: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/items/crossbow_standby.png',
  spawn: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/items/compass_16.png',
  slime_chunk: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/items/slime_ball.png',
  mineshaft: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/blocks/rail.png',
  ruined_portal: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/blocks/obsidian.png',
  jungle_temple: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/blocks/mossy_cobblestone.png',
  desert_temple: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/blocks/chiseled_sandstone.png',
  witch_hut: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/items/glass_bottle.png',
  treasure: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/items/heart_of_the_sea.png',
  shipwreck: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/items/oak_boat.png',
  igloo: 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/blocks/snow.png'
};

export default function WorldMap({ serverId, apiFetch, showToast }) {
  // Seed & Dimension State
  const [seedInput, setSeedInput] = useState('');
  const [dimension, setDimension] = useState('overworld'); // 'overworld' | 'nether' | 'caves' | 'end'
  const [version, setVersion] = useState('Java 1.21.1');
  const [copied, setCopied] = useState(false);

  // Coordinate Search & Pan State
  const [targetX, setTargetX] = useState('');
  const [targetZ, setTargetZ] = useState('');
  const [center, setCenter] = useState({ x: 0, z: 0 });
  const [zoom, setZoom] = useState(1); // 0.05 to 8

  // Canvas Display Toggles
  const [showTerrain, setShowTerrain] = useState(true);
  const [showGridLines, setShowGridLines] = useState(true);
  const [highlightBiome, setHighlightBiome] = useState('all');

  // Loaded Icon Images Cache
  const [loadedIcons, setLoadedIcons] = useState({});

  // Active Structure Feature Toggles
  const defaultFeatures = {
    biomes: true,
    spawn: true,
    slime_chunk: true,
    village: true,
    ancient_city: true,
    trial_chamber: true,
    stronghold: true,
    mansion: true,
    monument: true,
    outpost: true,
    mineshaft: true,
    ruined_portal: true,
    jungle_temple: true,
    desert_temple: true,
    witch_hut: true,
    treasure: true,
    shipwreck: true,
    igloo: true
  };
  const [activeFeatures, setActiveFeatures] = useState(defaultFeatures);

  // Data State
  const [players, setPlayers] = useState([]);
  const [hoverInfo, setHoverInfo] = useState(null);

  const canvasRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, z: 0 });

  // Pre-load Real Minecraft Icons
  useEffect(() => {
    const images = {};
    let loadedCount = 0;
    const keys = Object.keys(ICON_URLS);

    keys.forEach(k => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = ICON_URLS[k];
      img.onload = () => {
        images[k] = img;
        loadedCount++;
        if (loadedCount === keys.length) {
          setLoadedIcons(images);
        }
      };
    });
  }, []);

  const featureList = [
    { id: 'biomes', name: 'Biomes', iconKey: 'spawn', color: 'bg-emerald-950 border-emerald-600' },
    { id: 'spawn', name: 'Spawn Point', iconKey: 'spawn', color: 'bg-green-950 border-green-600' },
    { id: 'slime_chunk', name: 'Slime Chunk', iconKey: 'slime_chunk', color: 'bg-lime-950 border-lime-600' },
    { id: 'village', name: 'Village', iconKey: 'village', color: 'bg-amber-950 border-amber-600' },
    { id: 'ancient_city', name: 'Ancient City', iconKey: 'ancient_city', color: 'bg-cyan-950 border-cyan-600' },
    { id: 'trial_chamber', name: 'Trial Chamber', iconKey: 'trial_chamber', color: 'bg-orange-950 border-orange-600' },
    { id: 'stronghold', name: 'Stronghold', iconKey: 'stronghold', color: 'bg-purple-950 border-purple-600' },
    { id: 'mansion', name: 'Mansion', iconKey: 'mansion', color: 'bg-yellow-950 border-yellow-700' },
    { id: 'monument', name: 'Monument', iconKey: 'monument', color: 'bg-blue-950 border-blue-600' },
    { id: 'outpost', name: 'Outpost', iconKey: 'outpost', color: 'bg-stone-900 border-stone-600' },
    { id: 'mineshaft', name: 'Mineshaft', iconKey: 'mineshaft', color: 'bg-stone-950 border-stone-700' },
    { id: 'ruined_portal', name: 'Ruined Portal', iconKey: 'ruined_portal', color: 'bg-indigo-950 border-indigo-600' },
    { id: 'jungle_temple', name: 'Jungle Temple', iconKey: 'jungle_temple', color: 'bg-emerald-900 border-emerald-700' },
    { id: 'desert_temple', name: 'Desert Temple', iconKey: 'desert_temple', color: 'bg-amber-900 border-amber-700' },
    { id: 'witch_hut', name: 'Witch Hut', iconKey: 'witch_hut', color: 'bg-purple-900 border-purple-700' },
    { id: 'treasure', name: 'Treasure', iconKey: 'treasure', color: 'bg-yellow-900 border-yellow-600' },
    { id: 'shipwreck', name: 'Shipwreck', iconKey: 'shipwreck', color: 'bg-blue-900 border-blue-700' },
    { id: 'igloo', name: 'Igloo', iconKey: 'igloo', color: 'bg-sky-950 border-sky-600' }
  ];

  const biomeOptions = [
    { id: 'all', name: 'All Biomes (Standard View)' },
    { id: 'cherry_grove', name: '🌸 Cherry Grove' },
    { id: 'deep_dark', name: '🌌 Deep Dark' },
    { id: 'pale_garden', name: '🌳 Pale Garden (1.21.1)' },
    { id: 'lush_caves', name: '🌿 Lush Caves' },
    { id: 'dripstone_caves', name: '🪨 Dripstone Caves' },
    { id: 'desert', name: '🏜️ Desert' },
    { id: 'jungle', name: '🌴 Jungle' },
    { id: 'mushroom_fields', name: '🍄 Mushroom Fields' },
    { id: 'ice_spikes', name: '❄️ Ice Spikes' }
  ];

  // Fetch seed info
  const fetchMapInfo = async () => {
    if (!serverId) return;
    try {
      const data = await apiFetch(`/api/servers/${serverId}/map-info`);
      if (data && data.seed) setSeedInput(data.seed);
    } catch (e) {}
  };

  // Fetch online players
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
    const interval = setInterval(fetchPlayers, 4000);
    return () => clearInterval(interval);
  }, [serverId]);

  // Jump to specific X, Z coordinate
  const handleGoToCoords = (e) => {
    e?.preventDefault();
    const x = parseInt(targetX) || 0;
    const z = parseInt(targetZ) || 0;
    setCenter({ x, z });
    showToast(`Jumped map view to X: ${x}, Z: ${z}`, 'info');
  };

  // Feature Toggle Handlers
  const toggleFeature = (id) => {
    setActiveFeatures(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectAllFeatures = () => {
    const all = {};
    featureList.forEach(f => { all[f.id] = true; });
    setActiveFeatures(all);
  };

  const handleDeselectAllFeatures = () => {
    const none = {};
    featureList.forEach(f => { none[f.id] = false; });
    setActiveFeatures(none);
  };

  // Slime Chunk Checker
  const isSlimeChunk = (chunkX, chunkZ) => {
    try {
      const seed = BigInt(seedInput || '12345');
      const cx = BigInt(chunkX);
      const cz = BigInt(chunkZ);
      const s = (seed + (cx * cx * BigInt(0x4c1906)) + (cx * BigInt(0x5ac0db)) + (cz * cz * BigInt(0x4307a7)) + (cz * BigInt(0x5f24f)) ^ BigInt(0x3ad8025f)) & BigInt('0xFFFFFFFFFFFF');
      const nextSeed = (s * BigInt('0x5DEECE66D') + BigInt(11)) & BigInt('0xFFFFFFFFFFFF');
      return Number(nextSeed >> BigInt(17)) % 10 === 0;
    } catch (e) { return false; }
  };

  // Deterministic Integer-Locked Biome Color Generator (Colors NEVER shift during dragging!)
  const getDeterministicBiomeColor = (worldX, worldZ, seedNum, dim) => {
    const x = Math.floor(worldX);
    const z = Math.floor(worldZ);

    const s1 = 0.0018;
    const s2 = 0.007;

    const nx = Math.sin(x * s1 + seedNum * 0.00001) * Math.cos(z * s1 + seedNum * 0.00002);
    const ny = Math.sin((x + z) * s2) * 0.25;
    const n = nx + ny;

    if (dim === 'nether') {
      if (n > 0.35) return '#6B1616'; // Crimson Forest
      if (n > -0.05) return '#154848'; // Warped Forest
      if (n > -0.35) return '#382222'; // Basalt Deltas
      return '#801414'; // Nether Wastes
    }

    if (dim === 'caves') {
      if (n > 0.45) return '#03232C'; // Deep Dark
      if (n > 0.05) return '#3B7B38'; // Lush Caves
      return '#827461'; // Dripstone Caves
    }

    // Overworld
    if (n > 0.48) return { color: '#FFB7C5', tag: 'cherry_grove' };
    if (n > 0.28) return { color: '#D4D4D4', tag: 'pale_garden' };
    if (n > 0.08) return { color: '#8DB360', tag: 'plains' };
    if (n > -0.12) return { color: '#056621', tag: 'forest' };
    if (n > -0.32) return { color: '#0B4D42', tag: 'taiga' };
    if (n > -0.52) return { color: '#FA9418', tag: 'desert' };
    return { color: '#185B88', tag: 'ocean' };
  };

  // Main Canvas Rendering Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = dimension === 'nether' ? '#180707' : dimension === 'end' ? '#090714' : '#031424';
    ctx.fillRect(0, 0, width, height);

    const scale = 2 * zoom;
    // Keep sampling resolution high when zooming out so pixels don't get huge blocky squares!
    const step = Math.max(2, Math.min(6, Math.floor(4 / zoom)));
    const seedNum = Number(seedInput.replace(/\D/g, '').slice(0, 8)) || 12345;

    // Render Biomes & Terrain Relief
    if (activeFeatures.biomes) {
      for (let px = 0; px < width; px += step) {
        for (let py = 0; py < height; py += step) {
          const worldX = (px - width / 2) / scale + center.x;
          const worldZ = (py - height / 2) / scale + center.z;

          const biome = getDeterministicBiomeColor(worldX, worldZ, seedNum, dimension);
          let color = typeof biome === 'string' ? biome : biome.color;
          let isHighlighted = false;

          if (highlightBiome !== 'all') {
            if (typeof biome === 'object' && biome.tag === highlightBiome) {
              isHighlighted = true;
            }
            if (!isHighlighted) color = '#0f172a'; // Dim non-highlighted biomes
          }

          ctx.fillStyle = color;
          ctx.fillRect(px, py, step, step);
        }
      }
    }

    // Render Slime Chunks Grid
    if (activeFeatures.slime_chunk && dimension === 'overworld' && zoom >= 0.4) {
      const minChunkX = Math.floor(((0 - width / 2) / scale + center.x) / 16);
      const maxChunkX = Math.ceil(((width - width / 2) / scale + center.x) / 16);
      const minChunkZ = Math.floor(((0 - height / 2) / scale + center.z) / 16);
      const maxChunkZ = Math.ceil(((height - height / 2) / scale + center.z) / 16);

      ctx.fillStyle = 'rgba(34, 197, 94, 0.45)';
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
      ctx.lineWidth = 1;

      for (let cx = minChunkX; cx <= maxChunkX; cx++) {
        for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
          if (isSlimeChunk(cx, cz)) {
            const px = width / 2 + (cx * 16 - center.x) * scale;
            const py = height / 2 + (cz * 16 - center.z) * scale;
            const size = 16 * scale;
            ctx.fillRect(px, py, size, size);
            ctx.strokeRect(px, py, size, size);
          }
        }
      }
    }

    // Render Chunk Grid Lines
    if (showGridLines && zoom >= 0.5) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      const chunkSize = 16 * scale;
      const startX = (width / 2 - center.x * scale) % chunkSize;
      const startZ = (height / 2 - center.z * scale) % chunkSize;

      for (let x = startX; x < width; x += chunkSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let z = startZ; z < height; z += chunkSize) {
        ctx.beginPath(); ctx.moveTo(0, z); ctx.lineTo(width, z); ctx.stroke();
      }
    }

    // Render Real Minecraft Structure Icons
    const mockStructures = [
      { type: 'village', iconKey: 'village', name: 'Village', x: 250, z: -180 },
      { type: 'trial_chamber', iconKey: 'trial_chamber', name: 'Trial Chamber', x: -420, z: 310 },
      { type: 'ancient_city', iconKey: 'ancient_city', name: 'Ancient City', x: 680, z: 520 },
      { type: 'stronghold', iconKey: 'stronghold', name: 'Stronghold', x: -1100, z: -850 },
      { type: 'mansion', iconKey: 'mansion', name: 'Mansion', x: 1400, z: -1200 },
      { type: 'monument', iconKey: 'monument', name: 'Ocean Monument', x: -800, z: 950 },
      { type: 'outpost', iconKey: 'outpost', name: 'Pillager Outpost', x: 520, z: -640 },
      { type: 'ruined_portal', iconKey: 'ruined_portal', name: 'Ruined Portal', x: -150, z: -320 }
    ];

    mockStructures.forEach(st => {
      if (activeFeatures[st.type]) {
        const px = width / 2 + (st.x - center.x) * scale;
        const py = height / 2 + (st.z - center.z) * scale;

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          const iconImg = loadedIcons[st.iconKey];
          if (iconImg) {
            ctx.drawImage(iconImg, px - 12, py - 12, 24, 24);
          } else {
            ctx.fillStyle = '#38BDF8';
            ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    });

    // Render Spawn Point (0,0) with Compass Icon
    if (activeFeatures.spawn) {
      const spawnPx = width / 2 - center.x * scale;
      const spawnPy = height / 2 - center.z * scale;
      const compassImg = loadedIcons['spawn'];
      if (compassImg) {
        ctx.drawImage(compassImg, spawnPx - 14, spawnPy - 14, 28, 28);
      } else {
        ctx.fillStyle = '#10B981';
        ctx.beginPath(); ctx.arc(spawnPx, spawnPy, 7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText('Spawn (0,0)', spawnPx + 16, spawnPy + 4);
    }

    // Render Online Players
    players.forEach(p => {
      const px = width / 2 + ((p.x || 0) - center.x) * scale;
      const py = height / 2 + ((p.z || 0) - center.z) * scale;
      if (px >= 0 && px <= width && py >= 0 && py <= height) {
        ctx.fillStyle = '#EC4899';
        ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(p.username || p.name || 'Player', px + 12, py + 4);
      }
    });

  }, [seedInput, dimension, zoom, center, activeFeatures, showTerrain, showGridLines, highlightBiome, loadedIcons, players]);

  // Handle Mouse Drag / Pan & Wheel Zoom
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY, centerStartX: center.x, centerStartZ: center.z };
  };

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

    if (isDraggingRef.current) {
      const dx = (e.clientX - dragStartRef.current.x) / scale;
      const dz = (e.clientY - dragStartRef.current.y) / scale;
      setCenter({
        x: Math.round(dragStartRef.current.centerStartX - dx),
        z: Math.round(dragStartRef.current.centerStartZ - dz)
      });
    }
  };

  const handleMouseUp = () => { isDraggingRef.current = false; };

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom(z => Math.min(8, z * 1.2));
    } else {
      setZoom(z => Math.max(0.05, z / 1.2));
    }
  };

  const handleCanvasClick = (e) => {
    if (!hoverInfo || isDraggingRef.current) return;
    const tpCmd = `/tp ${hoverInfo.x} 100 ${hoverInfo.z}`;
    navigator.clipboard.writeText(tpCmd);
    showToast(`Copied Teleport Command: ${tpCmd}`, 'success');
  };

  // Scale Meter Text (e.g. 8px = 1m or 1px = 128m)
  const getScaleLabel = () => {
    const pxPerMeter = 2 * zoom;
    if (pxPerMeter >= 1) return `${Math.round(pxPerMeter)}px = 1m`;
    return `1px = ${Math.round(1 / pxPerMeter)}m`;
  };

  return (
    <div className="space-y-4 font-sans text-slate-200">
      
      {/* Top Header & Config Controls */}
      <div className="glass-panel p-4 rounded-2xl border border-obsidian-750 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          
          {/* Seed Input */}
          <div className="flex items-center gap-2 bg-obsidian-950 p-2 rounded-xl border border-obsidian-750">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Seed:</span>
            <input 
              type="text" 
              value={seedInput} 
              onChange={(e) => setSeedInput(e.target.value)}
              placeholder="Enter seed"
              className="bg-transparent text-xs font-mono font-bold text-mcgreen-400 outline-none w-full"
            />
            <button 
              onClick={() => { navigator.clipboard.writeText(seedInput); showToast('Seed copied!', 'success'); }}
              className="p-1.5 bg-obsidian-900 hover:bg-obsidian-800 text-slate-300 rounded-lg border border-obsidian-700"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Version Dropdown */}
          <div className="flex items-center gap-2 bg-obsidian-950 p-2 rounded-xl border border-obsidian-750">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Version:</span>
            <select 
              value={version} 
              onChange={(e) => setVersion(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-white outline-none w-full"
            >
              <option value="Java 1.21.1">Java 1.21.1 (NeoForge)</option>
              <option value="Java 1.20.4">Java 1.20.4</option>
              <option value="Bedrock Edition">Bedrock Edition</option>
            </select>
          </div>

          {/* Dimension Dropdown */}
          <div className="flex items-center gap-2 bg-obsidian-950 p-2 rounded-xl border border-obsidian-750">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Dimension:</span>
            <select 
              value={dimension} 
              onChange={(e) => setDimension(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-white outline-none w-full"
            >
              <option value="overworld">Overworld</option>
              <option value="nether">Nether</option>
              <option value="caves">Deep Caves</option>
              <option value="end">The End</option>
            </select>
          </div>

        </div>

        {/* Features Toggle Grid with Real Icons */}
        <div className="space-y-2 pt-1 border-t border-obsidian-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Features & Real Minecraft Icons</span>
            <div className="flex gap-3 text-xs font-semibold">
              <button onClick={handleSelectAllFeatures} className="text-mcgreen-400 hover:underline">☑ Select all</button>
              <button onClick={handleDeselectAllFeatures} className="text-slate-400 hover:underline">☐ Deselect all</button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-1.5 text-xs">
            {featureList.map(f => {
              const active = activeFeatures[f.id];
              const iconImg = loadedIcons[f.iconKey];
              return (
                <button
                  key={f.id}
                  onClick={() => toggleFeature(f.id)}
                  className={`p-2 rounded-xl border flex items-center gap-2 text-left transition-all active:scale-95 ${
                    active 
                      ? `${f.color} text-white font-bold shadow-md` 
                      : 'bg-obsidian-950 border-obsidian-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {iconImg ? (
                    <img src={ICON_URLS[f.iconKey]} alt={f.name} className="w-4 h-4 object-contain" />
                  ) : (
                    <span className="w-4 h-4 bg-obsidian-800 rounded-full" />
                  )}
                  <span className="truncate text-[11px]">{f.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Canvas Map Container */}
      <div className="glass-panel p-3 rounded-2xl border border-obsidian-750 space-y-3 relative overflow-hidden">
        
        {/* Canvas Header Rulers & Axis Labels */}
        <div className="flex items-center justify-between text-xs text-slate-300 bg-obsidian-950/90 p-2.5 rounded-xl border border-obsidian-750">
          <span className="flex items-center gap-2 font-mono text-mcgreen-400 font-bold">
            <Compass className="w-4 h-4 text-amber-400 animate-spin" /> Chunkbase Interactive Canvas (X →, Z ↓)
          </span>

          {hoverInfo ? (
            <span className="font-mono text-xs font-bold text-white bg-obsidian-900 px-3 py-1 rounded-lg border border-obsidian-700">
              Pointer Coords: <span className="text-mcgreen-400">X: {hoverInfo.x} | Z: {hoverInfo.z}</span> (Click to copy /tp)
            </span>
          ) : (
            <span className="text-[11px] text-slate-500 font-mono">Drag to pan map • Scroll wheel to zoom</span>
          )}
        </div>

        {/* 2D Canvas Map Surface */}
        <div className="w-full flex justify-center bg-obsidian-950 rounded-xl overflow-hidden border border-obsidian-750 relative">
          <canvas 
            ref={canvasRef} 
            width={960} 
            height={560} 
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            onClick={handleCanvasClick}
            className="cursor-grab active:cursor-grabbing w-full max-w-[960px] h-[560px]"
          />

          {/* Scale Overlay Indicator (Bottom Right) */}
          <div className="absolute bottom-4 right-4 bg-obsidian-900/90 border border-obsidian-700 px-3 py-1.5 rounded-lg text-right font-mono text-[11px] text-slate-300 backdrop-blur-md">
            <span>{getScaleLabel()}</span>
            <div className="w-24 h-1.5 bg-mcgreen-500 rounded-full mt-1 ml-auto" />
          </div>

          {/* Zoom Buttons Overlay (Top Right) */}
          <div className="absolute top-4 right-4 flex flex-col gap-1 bg-obsidian-900/90 p-1 rounded-xl border border-obsidian-700 backdrop-blur-md">
            <button 
              onClick={() => setZoom(z => Math.min(8, z * 1.25))}
              title="Zoom In"
              className="p-2 hover:bg-obsidian-800 text-white rounded-lg transition-all"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setZoom(z => Math.max(0.05, z / 1.25))}
              title="Zoom Out"
              className="p-2 hover:bg-obsidian-800 text-white rounded-lg transition-all"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Bottom Controls Bar (Coordinate Search, Biome Highlight & Toggles) */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-obsidian-750 text-xs">
        
        {/* Biome Search & Highlight */}
        <div className="flex items-center gap-2 bg-obsidian-950 p-2 rounded-xl border border-obsidian-750">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Highlight Biome:</span>
          <select 
            value={highlightBiome} 
            onChange={(e) => setHighlightBiome(e.target.value)}
            className="bg-transparent text-xs font-mono font-bold text-mcgreen-400 outline-none w-48"
          >
            {biomeOptions.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* X and Z Coordinate Search Box with Go! button */}
        <form onSubmit={handleGoToCoords} className="flex items-center gap-2 bg-obsidian-950 p-2 rounded-xl border border-obsidian-750">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">X:</span>
          <input 
            type="number" 
            value={targetX} 
            onChange={(e) => setTargetX(e.target.value)}
            placeholder="0"
            className="w-16 bg-obsidian-900 border border-obsidian-700 rounded-lg px-2 py-1 text-xs text-white font-mono outline-none"
          />

          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Z:</span>
          <input 
            type="number" 
            value={targetZ} 
            onChange={(e) => setTargetZ(e.target.value)}
            placeholder="0"
            className="w-16 bg-obsidian-900 border border-obsidian-700 rounded-lg px-2 py-1 text-xs text-white font-mono outline-none"
          />

          <button 
            type="submit"
            className="px-3 py-1 bg-mcgreen-500 hover:bg-mcgreen-600 text-obsidian-950 font-bold rounded-lg text-xs flex items-center gap-1 active:scale-95 shadow-md transition-all"
          >
            <ArrowRight className="w-3.5 h-3.5" /> Go!
          </button>
        </form>

        {/* Display Checkboxes (Terrain & Grid Lines) */}
        <div className="flex items-center gap-4 bg-obsidian-950 p-2 px-4 rounded-xl border border-obsidian-750 font-bold">
          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
            <input 
              type="checkbox" 
              checked={showTerrain} 
              onChange={(e) => setShowTerrain(e.target.checked)}
              className="rounded accent-mcgreen-500"
            />
            Terrain
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
            <input 
              type="checkbox" 
              checked={showGridLines} 
              onChange={(e) => setShowGridLines(e.target.checked)}
              className="rounded accent-mcgreen-500"
            />
            Grid Lines
          </label>
        </div>

      </div>

    </div>
  );
}
