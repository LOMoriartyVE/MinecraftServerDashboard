'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, ExternalLink, RefreshCw, Layers, Sparkles, 
  Maximize2, Radio, Server, Check, Copy, Compass, Eye, AlertCircle, ShieldCheck
} from 'lucide-react';

export default function BlueMap({ serverId, activeServer, apiFetch, showToast }) {
  // Determine default port based on server selection
  // Server1 -> 8100, Server2 -> 8101
  const getDefaultPort = (id) => {
    if (id === 'Server2' || id === 'server2') return '8101';
    return '8100';
  };

  const [mapHost, setMapHost] = useState('http://localhost');
  const [mapPort, setMapPort] = useState(getDefaultPort(serverId));
  const [customUrl, setCustomUrl] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isOnline, setIsOnline] = useState(null); // null = checking, true = reachable, false = offline/blocked
  const [viewMode, setViewMode] = useState('embedded'); // 'embedded' | 'fullscreen'

  // Update port when serverId changes
  useEffect(() => {
    setMapPort(getDefaultPort(serverId));
  }, [serverId]);

  const targetMapUrl = customUrl.trim() || `${mapHost}:${mapPort}`;

  // Check if BlueMap port is accessible
  useEffect(() => {
    let isMounted = true;
    const checkBlueMapHealth = async () => {
      try {
        const res = await fetch(targetMapUrl, { method: 'HEAD', mode: 'no-cors' });
        if (isMounted) setIsOnline(true);
      } catch (err) {
        if (isMounted) setIsOnline(false);
      }
    };

    checkBlueMapHealth();
    const interval = setInterval(checkBlueMapHealth, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [targetMapUrl]);

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
    if (showToast) showToast('BlueMap viewer refreshed', 'info');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetMapUrl);
    setCopied(true);
    if (showToast) showToast('BlueMap URL copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenExternal = () => {
    window.open(targetMapUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="h-full flex flex-col bg-obsidian-950 text-slate-100 overflow-hidden">
      
      {/* HEADER CONTROLS BAR */}
      <div className="bg-obsidian-900/90 backdrop-blur-md border-b border-obsidian-800 p-4 flex flex-wrap items-center justify-between gap-4 z-10">
        
        {/* Left Side: Title & Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-mcgreen-500/10 border border-mcgreen-500/30 flex items-center justify-center text-mcgreen-400 shadow-inner">
            <Globe className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">BlueMap 3D Web Map</h2>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-mcgreen-500/20 text-mcgreen-300 border border-mcgreen-500/30 font-semibold">
                NeoForge v5.7
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Server: <strong className="text-slate-200">{activeServer?.name || serverId || 'Server1'}</strong></span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono text-[11px]">
                <span className={`w-2 h-2 rounded-full ${isOnline === true ? 'bg-emerald-400 animate-ping' : isOnline === false ? 'bg-amber-400' : 'bg-slate-400'}`}></span>
                {isOnline === true ? 'Active Web Server' : isOnline === false ? 'Direct Port Check' : 'Checking Port...'}
              </span>
            </p>
          </div>
        </div>

        {/* Right Side: URL Configurator & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Port Presets */}
          <div className="flex items-center bg-obsidian-950 border border-obsidian-800 rounded-lg p-1 text-xs">
            <button
              onClick={() => { setMapPort('8100'); setCustomUrl(''); }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all ${
                mapPort === '8100' && !customUrl ? 'bg-mcgreen-500/20 text-mcgreen-300 font-semibold border border-mcgreen-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Port 8100 (S1)
            </button>
            <button
              onClick={() => { setMapPort('8101'); setCustomUrl(''); }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all ${
                mapPort === '8101' && !customUrl ? 'bg-mcgreen-500/20 text-mcgreen-300 font-semibold border border-mcgreen-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Port 8101 (S2)
            </button>
          </div>

          {/* Quick Host / URL Input */}
          <div className="relative flex items-center">
            <input
              type="text"
              value={customUrl || targetMapUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="http://localhost:8100"
              className="bg-obsidian-950 border border-obsidian-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-mcgreen-500/50 w-52"
            />
          </div>

          {/* Action Buttons */}
          <button
            onClick={handleCopyLink}
            title="Copy Direct Link"
            className="p-2 rounded-lg bg-obsidian-800 border border-obsidian-700 text-slate-300 hover:text-slate-100 hover:bg-obsidian-700 transition-all text-xs flex items-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={handleRefresh}
            title="Refresh Viewer"
            className="p-2 rounded-lg bg-obsidian-800 border border-obsidian-700 text-slate-300 hover:text-slate-100 hover:bg-obsidian-700 transition-all text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleOpenExternal}
            className="px-3 py-1.5 rounded-lg bg-mcgreen-600 hover:bg-mcgreen-500 text-slate-900 font-semibold text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-mcgreen-500/10"
          >
            <span>Open Full Map</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* IFRAME CONTAINER */}
      <div className="flex-1 relative w-full h-full bg-slate-950">
        
        {/* BlueMap Embedded Viewer */}
        <iframe
          key={iframeKey}
          src={targetMapUrl}
          title="BlueMap 3D Web Map"
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />

        {/* HELPFUL DIAGNOSTIC OVERLAY (FLOATING MINI CARD) */}
        {isOnline === false && (
          <div className="absolute bottom-4 left-4 max-w-md bg-obsidian-900/95 backdrop-blur-md border border-amber-500/30 rounded-xl p-4 shadow-2xl z-20 text-xs">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-slate-100">BlueMap Connection Tip</h4>
                <p className="text-slate-400 mt-1">
                  If the 3D map fails to load inside the frame:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-1 mt-2 font-mono text-[11px]">
                  <li>Ensure Minecraft Server <strong className="text-mcgreen-400">{activeServer?.name || serverId}</strong> is Online.</li>
                  <li>BlueMap generates 3D world tiles in the background upon first start.</li>
                  <li>Click <button onClick={handleOpenExternal} className="text-mcgreen-400 underline hover:text-mcgreen-300">Open Full Map</button> to open directly in a new tab.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
