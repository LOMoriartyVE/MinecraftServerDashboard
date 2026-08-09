'use client';

import React, { useState, useEffect } from 'react';
import { 
  Globe, ExternalLink, RefreshCw, Layers, Sparkles, 
  Maximize2, Radio, Server, Check, Copy, Compass, Eye, AlertCircle, ShieldCheck, Link2
} from 'lucide-react';

export default function BlueMap({ serverId, activeServer, daemonUrl, apiFetch, showToast }) {
  const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // Connection modes:
  // 'proxy' -> Same-Origin Vercel Proxy (/api/proxy/bluemap/Server1/?daemonUrl=...) - NEVER blocked by frame options
  // 'direct' -> Local Port (http://localhost:8100)
  // 'tunnel' -> Direct Tunnel URL (https://...trycloudflare.com/bluemap/Server1/)
  const [connectionMode, setConnectionMode] = useState('proxy');
  
  const getDefaultPort = (id) => {
    if (id === 'Server2' || id === 'server2') return '8101';
    return '8100';
  };

  const [mapPort, setMapPort] = useState(getDefaultPort(serverId));
  const [customUrl, setCustomUrl] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMapPort(getDefaultPort(serverId));
  }, [serverId]);

  const cleanDaemon = (daemonUrl || 'http://localhost:3001').replace(/\/$/, '');
  const targetServer = serverId || 'Server1';

  // Construct target iframe URL based on selected mode
  const proxiedVercelUrl = `/api/proxy/bluemap/${targetServer}/?daemonUrl=${encodeURIComponent(cleanDaemon)}`;
  const directTunnelUrl = `${cleanDaemon}/bluemap/${targetServer}/`;
  const directPortUrl = `http://localhost:${mapPort}/`;

  let targetMapUrl = customUrl.trim();
  if (!targetMapUrl) {
    if (connectionMode === 'proxy') targetMapUrl = proxiedVercelUrl;
    else if (connectionMode === 'tunnel') targetMapUrl = directTunnelUrl;
    else targetMapUrl = directPortUrl;
  }

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
    if (showToast) showToast('BlueMap viewer refreshed', 'info');
  };

  const handleCopyLink = () => {
    const fullLink = targetMapUrl.startsWith('/') ? `${window.location.origin}${targetMapUrl}` : targetMapUrl;
    navigator.clipboard.writeText(fullLink);
    setCopied(true);
    if (showToast) showToast('BlueMap URL copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenExternal = () => {
    const externalLink = connectionMode === 'proxy' 
      ? directTunnelUrl 
      : (targetMapUrl.startsWith('/') ? `${window.location.origin}${targetMapUrl}` : targetMapUrl);
    window.open(externalLink, '_blank', 'noopener,noreferrer');
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
              <span>Server: <strong className="text-slate-200">{activeServer?.name || targetServer}</strong></span>
              <span>•</span>
              <span className="font-mono text-[11px] text-slate-300">
                Mode: <strong className="text-mcgreen-400">
                  {connectionMode === 'proxy' ? 'Vercel Same-Origin Proxy' : connectionMode === 'tunnel' ? 'Direct Tunnel' : 'Local Port'}
                </strong>
              </span>
            </p>
          </div>
        </div>

        {/* Right Side: URL Configurator & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Connection Mode Selector */}
          <div className="flex items-center bg-obsidian-950 border border-obsidian-800 rounded-lg p-1 text-xs">
            <button
              onClick={() => { setConnectionMode('proxy'); setCustomUrl(''); }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all flex items-center gap-1 ${
                connectionMode === 'proxy' && !customUrl ? 'bg-mcgreen-500/20 text-mcgreen-300 font-semibold border border-mcgreen-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Vercel Proxy</span>
            </button>
            <button
              onClick={() => { setConnectionMode('tunnel'); setCustomUrl(''); }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all flex items-center gap-1 ${
                connectionMode === 'tunnel' && !customUrl ? 'bg-mcgreen-500/20 text-mcgreen-300 font-semibold border border-mcgreen-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3 h-3 text-cyan-400" />
              <span>Tunnel</span>
            </button>
            <button
              onClick={() => { setConnectionMode('direct'); setCustomUrl(''); }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all flex items-center gap-1 ${
                connectionMode === 'direct' && !customUrl ? 'bg-mcgreen-500/20 text-mcgreen-300 font-semibold border border-mcgreen-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Link2 className="w-3 h-3 text-blue-400" />
              <span>Local Port</span>
            </button>
          </div>

          {/* Server Port Switchers (for direct port mode) */}
          {connectionMode === 'direct' && (
            <div className="flex items-center bg-obsidian-950 border border-obsidian-800 rounded-lg p-1 text-xs">
              <button
                onClick={() => { setMapPort('8100'); setCustomUrl(''); }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                  mapPort === '8100' ? 'bg-obsidian-700 text-slate-100 font-bold' : 'text-slate-400'
                }`}
              >
                8100 (S1)
              </button>
              <button
                onClick={() => { setMapPort('8101'); setCustomUrl(''); }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                  mapPort === '8101' ? 'bg-obsidian-700 text-slate-100 font-bold' : 'text-slate-400'
                }`}
              >
                8101 (S2)
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <button
            onClick={handleCopyLink}
            title="Copy Map Link"
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
            <span>Open Map Tab</span>
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

        {/* HELPFUL DIAGNOSTIC OVERLAY */}
        <div className="absolute bottom-4 left-4 max-w-md bg-obsidian-900/95 backdrop-blur-md border border-obsidian-800 rounded-xl p-3.5 shadow-2xl z-20 text-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-slate-200 text-xs">Vercel Same-Origin Proxy Active</h4>
              <p className="text-slate-400 mt-0.5 text-[11px]">
                Proxying BlueMap via Vercel Same-Origin removes X-Frame-Options and HTTPS security blocks.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button 
                  onClick={handleOpenExternal} 
                  className="px-2.5 py-1 rounded bg-mcgreen-500/20 text-mcgreen-400 border border-mcgreen-500/30 hover:bg-mcgreen-500/30 transition-all font-mono text-[10px]"
                >
                  Open Direct Tab ↗
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
