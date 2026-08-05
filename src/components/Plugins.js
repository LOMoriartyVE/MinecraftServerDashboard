'use client';

import React, { useState, useEffect } from 'react';
import { 
  Puzzle, ToggleLeft, ToggleRight, Trash2, Save, RefreshCw, Search, 
  Download, CheckCircle2, AlertTriangle, X, Sparkles, Filter, Package,
  Layers, Monitor, Server as ServerIcon, ShieldCheck, ChevronRight, History
} from 'lucide-react';

export default function Plugins({ apiFetch, serverId, activeServer, showToast }) {
  const [activeTab, setActiveTab] = useState('installed'); // 'installed' | 'explore'
  
  // Installed Mods State
  const [mods, setMods] = useState([]);
  const [pendingChanges, setPendingChanges] = useState({});
  const [serverVersion, setServerVersion] = useState({ version: '1.0.0', changelog: [] });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingMods, setIsLoadingMods] = useState(true);
  const [isDownloadingPack, setIsDownloadingPack] = useState(false);

  // Explore Modrinth Search State
  const [searchQuery, setSearchQuery] = useState('waystones');
  const [platformFilter, setPlatformFilter] = useState('neoforge'); // 'all' | 'neoforge' | 'forge' | 'fabric'
  const [gameVersionFilter, setGameVersionFilter] = useState('1.21.1');
  const [envFilter, setEnvFilter] = useState('all'); // 'all' | 'client' | 'server' | 'both'
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Selected Mod Details & Version Matrix (Modrinth UI Style)
  const [selectedMod, setSelectedMod] = useState(null);
  const [modVersions, setModVersions] = useState([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [installingVersionId, setInstallingVersionId] = useState(null);

  // Load Installed Mods & Server Version
  const fetchInstalledData = async () => {
    if (!serverId) return;
    setIsLoadingMods(true);
    try {
      const [modsData, verData] = await Promise.all([
        apiFetch(`/api/servers/${serverId}/mods`),
        apiFetch(`/api/servers/${serverId}/version`).catch(() => ({ version: '1.0.0', changelog: [] }))
      ]);
      setMods(modsData || []);
      setServerVersion(verData || { version: '1.0.0', changelog: [] });
    } catch (err) {
      showToast(`Failed to load server modifications: ${err.message}`, 'error');
    } finally {
      setIsLoadingMods(false);
    }
  };

  useEffect(() => {
    fetchInstalledData();
  }, [serverId]);

  // Modrinth Search Execution
  const handleExecuteSearch = async (e) => {
    if (e) e.preventDefault();
    setIsSearching(true);
    try {
      const endpoint = `/api/mods/search?query=${encodeURIComponent(searchQuery)}&loader=${platformFilter}&version=${gameVersionFilter}`;
      const data = await apiFetch(endpoint);
      setSearchResults(data || []);
    } catch (err) {
      showToast(`Mod search failed: ${err.message}`, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Auto search on tab open
  useEffect(() => {
    if (activeTab === 'explore' && searchResults.length === 0) {
      handleExecuteSearch();
    }
  }, [activeTab]);

  // Load Version Matrix for selected Mod (Matches Modrinth UI Screenshot)
  const handleSelectModDetail = async (mod) => {
    setSelectedMod(mod);
    setModVersions([]);
    setIsLoadingVersions(true);
    try {
      const targetId = mod.id || mod.slug;
      const data = await apiFetch(`/api/mods/${targetId}/versions?slug=${encodeURIComponent(mod.slug || '')}`);
      setModVersions(data || []);
    } catch (err) {
      showToast(`Failed to load versions: ${err.message}`, 'error');
    } finally {
      setIsLoadingVersions(false);
    }
  };

  // 1-Click Remote Install from Modrinth
  const handleInstallRemoteMod = async (mod, versionFile = null) => {
    const vId = versionFile ? versionFile.id : mod.id;
    setInstallingVersionId(vId);
    showToast(`Downloading "${mod.title}" & creating safety backup...`, 'info');
    
    try {
      const res = await apiFetch(`/api/servers/${serverId}/mods/install-remote`, {
        method: 'POST',
        body: JSON.stringify({
          projectId: mod.id,
          title: mod.title,
          fileUrl: versionFile?.fileUrl,
          filename: versionFile?.filename
        })
      });

      if (res.success) {
        showToast(`Successfully installed ${mod.title}! Server version bumped.`, 'success');
        fetchInstalledData();
        setPendingChanges(prev => ({ ...prev, [res.filename]: true }));
      }
    } catch (err) {
      showToast(`Failed to install ${mod.title}: ${err.message}`, 'error');
    } finally {
      setInstallingVersionId(null);
    }
  };

  // Download Client Mods Pack (.zip)
  const handleDownloadClientPack = () => {
    setIsDownloadingPack(true);
    showToast('Generating Client Mods Pack (.zip)...', 'info');
    const zipUrl = `${apiFetch.daemonUrl || ''}/api/servers/${serverId}/mods/download-client-pack`;
    
    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = `Client_Mods_${serverId}_v${serverVersion.version}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setTimeout(() => {
      setIsDownloadingPack(false);
      showToast('Client Mods Pack download started!', 'success');
    }, 1500);
  };

  // Local Toggle & Pending state
  const handleToggleLocal = (filename, currentEnabled) => {
    const newStatus = !currentEnabled;
    setPendingChanges(prev => {
      const updated = { ...prev };
      if (updated[filename] !== undefined && updated[filename] === !newStatus) {
        delete updated[filename];
      } else {
        updated[filename] = newStatus;
      }
      return updated;
    });

    setMods(prev => prev.map(m => m.filename === filename ? { ...m, enabled: newStatus } : m));
  };

  // Delete Mod
  const handleDeleteMod = async (filename) => {
    if (!confirm(`Are you sure you want to delete "${filename}"? A safety backup will be created.`)) return;
    try {
      await apiFetch(`/api/servers/${serverId}/mods/${filename}`, { method: 'DELETE' });
      showToast(`Deleted ${filename} (Safety backup created)`, 'success');
      fetchInstalledData();
    } catch (err) {
      showToast(`Failed to delete mod: ${err.message}`, 'error');
    }
  };

  // Save all & restart
  const handleSaveAndRestart = async () => {
    setIsSaving(true);
    showToast('Creating safety backup & applying changes...', 'info');

    try {
      for (const [filename, enabled] of Object.entries(pendingChanges)) {
        await apiFetch(`/api/servers/${serverId}/mods/toggle`, {
          method: 'POST',
          body: JSON.stringify({ filename, enabled })
        });
      }

      showToast('Mod configuration saved! Rebooting server...', 'success');

      await apiFetch(`/api/servers/${serverId}/power`, {
        method: 'POST',
        body: JSON.stringify({ action: 'restart' })
      });

      setPendingChanges({});
      fetchInstalledData();
    } catch (err) {
      showToast(`Error saving mod configuration: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const formatSize = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  const hasPending = Object.keys(pendingChanges).length > 0;

  // Active Server Loader Detection
  const currentLoader = (activeServer?.version || 'NeoForge').toLowerCase();

  return (
    <div className="space-y-6 font-sans pb-24">
      
      {/* Full-Page Top Header Navigation & Version Pill */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 glass-panel p-5 rounded-2xl border border-obsidian-700">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Puzzle className="w-6 h-6 text-mcgreen-400" /> Plugins & Modifications
            </h3>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-mcgreen-500/15 text-mcgreen-400 border border-mcgreen-500/30">
              v{serverVersion.version || '1.0.0'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure server modifications, inspect compatibility, and search Modrinth / CurseForge databases.
          </p>
        </div>

        {/* Primary Sub-Page Tabs */}
        <div className="flex items-center gap-2 bg-obsidian-950 p-1.5 rounded-xl border border-obsidian-700 shrink-0">
          <button
            onClick={() => setActiveTab('installed')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'installed'
                ? 'bg-mcgreen-500 text-obsidian-950 shadow-md shadow-mcgreen-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" /> Installed Mods ({mods.length})
          </button>
          <button
            onClick={() => setActiveTab('explore')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'explore'
                ? 'bg-mcgreen-500 text-obsidian-950 shadow-md shadow-mcgreen-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" /> Explore & Install (Modrinth/Curse)
          </button>
        </div>
      </div>

      {/* TAB 1: INSTALLED MODS VIEW */}
      {activeTab === 'installed' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Action Toolbar: Download Client Pack & Refresh */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Server Modpack:</span>
              <span className="text-xs font-mono font-bold text-white bg-obsidian-850 px-2.5 py-1 rounded-lg border border-obsidian-700">
                NeoForge 1.21.1
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={handleDownloadClientPack}
                disabled={isDownloadingPack}
                className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold rounded-xl text-xs flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-purple-500/10"
              >
                {isDownloadingPack ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download Client Mods Pack (.zip)
              </button>

              <button 
                onClick={fetchInstalledData}
                className="p-2 bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 rounded-xl border border-obsidian-700 transition-all active:scale-95"
                title="Refresh list"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingMods ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Installed Mods Table */}
          <div className="glass-panel rounded-2xl border border-obsidian-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-obsidian-900/80 border-b border-obsidian-700 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-3.5">Mod Name / Filename</th>
                    <th className="px-4 py-3.5">Environment</th>
                    <th className="px-4 py-3.5">Size</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-center">Enable / Disable</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-700/60 font-sans">
                  {mods.map(mod => {
                    const isPending = pendingChanges[mod.filename] !== undefined;
                    const isNewMod = mod.filename.toLowerCase().includes('waystone') || isPending;
                    return (
                      <tr 
                        key={mod.filename}
                        className={`hover:bg-obsidian-800/40 transition-colors ${
                          isPending ? 'bg-amber-500/5' : ''
                        }`}
                      >
                        {/* Name & Filename */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              mod.enabled 
                                ? 'bg-mcgreen-500/10 text-mcgreen-400 border border-mcgreen-500/20' 
                                : 'bg-slate-800 text-slate-500 border border-slate-700'
                            }`}>
                              <Puzzle className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-white text-sm flex items-center gap-2">
                                {mod.name.replace(/[-_]/g, ' ')}
                                {isNewMod && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-obsidian-950 font-mono animate-pulse shadow-md shadow-amber-500/20">
                                    NEW
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{mod.filename}</div>
                            </div>
                          </div>
                        </td>

                        {/* Environment Side Badges */}
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-obsidian-850 text-slate-300 border border-obsidian-700">
                            <Monitor className="w-3 h-3 text-blue-400" />
                            <ServerIcon className="w-3 h-3 text-mcgreen-400" />
                            Client & Server
                          </span>
                        </td>

                        {/* Size */}
                        <td className="px-4 py-4 font-mono text-slate-400 text-xs">
                          {formatSize(mod.sizeBytes)}
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-4">
                          {mod.enabled ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-mcgreen-500/10 text-mcgreen-400 border border-mcgreen-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-mcgreen-400 animate-pulse" />
                              Enabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                              Disabled
                            </span>
                          )}
                        </td>

                        {/* Enable / Disable Toggle */}
                        <td className="px-4 py-4 text-center">
                          <button 
                            onClick={() => handleToggleLocal(mod.filename, mod.enabled)}
                            className={`transition-all transform active:scale-95 ${
                              mod.enabled ? 'text-mcgreen-400' : 'text-slate-600 hover:text-slate-400'
                            }`}
                          >
                            {mod.enabled ? <ToggleRight className="w-8 h-8 mx-auto" /> : <ToggleLeft className="w-8 h-8 mx-auto" />}
                          </button>
                        </td>

                        {/* Delete Action */}
                        <td className="px-5 py-4 text-right">
                          <button 
                            onClick={() => handleDeleteMod(mod.filename)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30 transition-all active:scale-95"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXPLORE & INSTALL MODS FULL-PAGE VIEW */}
      {activeTab === 'explore' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Filter Bar Controls (Platforms, Game Version, Environment) */}
          <div className="glass-panel p-4 rounded-2xl border border-obsidian-700 space-y-4">
            <form onSubmit={handleExecuteSearch} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Modrinth & CurseForge mods..."
                  className="w-full bg-obsidian-900 border border-obsidian-700 focus:border-mcgreen-500 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white outline-none font-sans"
                />
              </div>

              <button 
                type="submit"
                disabled={isSearching}
                className="px-5 py-2.5 bg-mcgreen-500 hover:bg-mcgreen-600 font-bold text-obsidian-950 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shrink-0"
              >
                {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search Database
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-obsidian-700/60 text-xs">
              
              {/* Platform Filter */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-mcgreen-400" /> Platform:
                </span>
                <select 
                  value={platformFilter}
                  onChange={(e) => { setPlatformFilter(e.target.value); handleExecuteSearch(); }}
                  className="bg-obsidian-900 border border-obsidian-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono outline-none"
                >
                  <option value="neoforge">NeoForge (Server Default)</option>
                  <option value="forge">Forge</option>
                  <option value="fabric">Fabric (Incompatible)</option>
                  <option value="all">All Platforms</option>
                </select>
              </div>

              {/* Game Version Filter */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold">Game Version:</span>
                <select 
                  value={gameVersionFilter}
                  onChange={(e) => { setGameVersionFilter(e.target.value); handleExecuteSearch(); }}
                  className="bg-obsidian-900 border border-obsidian-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono outline-none"
                >
                  <option value="1.21.1">1.21.1</option>
                  <option value="1.20.1">1.20.1</option>
                  <option value="1.19.2">1.19.2</option>
                  <option value="1.18.2">1.18.2</option>
                  <option value="all">All Versions</option>
                </select>
              </div>

              {/* Environment Filter */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold">Environment:</span>
                <select 
                  value={envFilter}
                  onChange={(e) => setEnvFilter(e.target.value)}
                  className="bg-obsidian-900 border border-obsidian-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono outline-none"
                >
                  <option value="all">All Side Environments</option>
                  <option value="client">Client-side Only</option>
                  <option value="server">Server-side Only</option>
                  <option value="both">Client & Server Both</option>
                </select>
              </div>

            </div>
          </div>

          {/* Search Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {searchResults.map(result => {
              const categories = result.categories.map(c => c.toLowerCase());
              const isFabricOnly = categories.includes('fabric') && !categories.includes('neoforge') && !categories.includes('forge');
              const isIncompatible = isFabricOnly && currentLoader.includes('neoforge');

              return (
                <div 
                  key={result.id}
                  className={`glass-panel p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                    isIncompatible 
                      ? 'border-rose-500/30 bg-rose-500/5 opacity-60' 
                      : 'border-obsidian-700 hover:border-mcgreen-500/40'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {result.iconUrl ? (
                          <img src={result.iconUrl} alt={result.title} className="w-11 h-11 rounded-xl object-cover bg-obsidian-800 shrink-0 border border-obsidian-700" />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-mcgreen-500/10 text-mcgreen-400 border border-mcgreen-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                            <Puzzle className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-white text-sm">{result.title}</h4>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 font-mono">
                              {result.source}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400">by {result.author}</p>
                        </div>
                      </div>

                      {isIncompatible ? (
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          Incompatible (Fabric Only)
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-mcgreen-500/15 text-mcgreen-400 border border-mcgreen-500/30">
                          Compatible
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed font-sans">
                      {result.description}
                    </p>

                    {/* Loader Badges & Environment Indicator */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {result.categories.map(cat => (
                        <span key={cat} className="px-2 py-0.5 rounded text-[9px] font-mono bg-obsidian-850 text-slate-300 border border-obsidian-750">
                          {cat}
                        </span>
                      ))}
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-obsidian-950 text-purple-400 border border-obsidian-700 flex items-center gap-1">
                        <Monitor className="w-3 h-3 text-blue-400" />
                        <ServerIcon className="w-3 h-3 text-mcgreen-400" />
                        {result.clientSide === 'required' && result.serverSide === 'required' ? 'Client & Server' : 'Universal'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-obsidian-700/60 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">
                      ⬇ {result.downloads?.toLocaleString()} downloads
                    </span>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleSelectModDetail(result)}
                        className="px-3 py-1.5 bg-obsidian-850 hover:bg-obsidian-800 text-slate-200 font-bold rounded-xl text-xs transition-all border border-obsidian-700"
                      >
                        View Versions Matrix
                      </button>
                      <button 
                        onClick={() => handleInstallRemoteMod(result)}
                        disabled={isIncompatible || installingVersionId === result.id}
                        className="px-4 py-1.5 bg-mcgreen-500 hover:bg-mcgreen-600 disabled:opacity-40 text-obsidian-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-mcgreen-500/20 active:scale-95"
                      >
                        {installingVersionId === result.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Install
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* MODRINTH OFFICIAL STYLE VERSIONS MATRIX MODAL (Matches User Screenshot) */}
      {selectedMod && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
          <div className="glass-panel w-full max-w-4xl rounded-2xl border border-obsidian-700 bg-obsidian-950 p-6 space-y-4 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-obsidian-700 pb-3">
              <div className="flex items-center gap-3">
                {selectedMod.iconUrl && (
                  <img src={selectedMod.iconUrl} alt={selectedMod.title} className="w-10 h-10 rounded-xl object-cover bg-obsidian-800 border border-obsidian-700" />
                )}
                <div>
                  <h4 className="text-base font-extrabold text-white">{selectedMod.title} - Release Versions</h4>
                  <p className="text-xs text-slate-400">Select specific game version and platform build to install</p>
                </div>
              </div>

              <button 
                onClick={() => setSelectedMod(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Versions Table (Matches Modrinth UI Screenshot!) */}
            <div className="flex-1 overflow-y-auto border border-obsidian-700 rounded-xl bg-obsidian-900/60">
              {isLoadingVersions ? (
                <div className="py-20 text-center text-slate-400 text-xs font-mono flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-mcgreen-400" />
                  <span>Fetching release version matrix from Modrinth...</span>
                </div>
              ) : modVersions.length === 0 ? (
                <div className="py-20 text-center text-slate-400 text-xs font-mono">
                  No release builds found matching this mod on Modrinth.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-obsidian-900 border-b border-obsidian-700 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-3">Version</th>
                      <th className="px-4 py-3">Game Version</th>
                      <th className="px-4 py-3">Platform</th>
                      <th className="px-4 py-3">Published</th>
                      <th className="px-4 py-3">Downloads</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-obsidian-700/60">
                    {modVersions.map(ver => (
                      <tr key={ver.id} className="hover:bg-obsidian-800/40 transition-colors">
                        <td className="px-4 py-3.5 font-bold font-mono text-white">
                          {ver.versionNumber || ver.name}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {ver.gameVersions.slice(0, 3).map(gv => (
                              <span key={gv} className="px-2 py-0.5 rounded text-[10px] font-mono bg-obsidian-800 text-mcgreen-400 border border-obsidian-750">
                                {gv}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {ver.loaders.map(loader => (
                              <span key={loader} className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                {loader}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                          {new Date(ver.datePublished).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-400">
                          {ver.downloads?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button 
                            onClick={() => handleInstallRemoteMod(selectedMod, ver)}
                            disabled={installingVersionId === ver.id}
                            className="px-3 py-1.5 bg-mcgreen-500 hover:bg-mcgreen-600 disabled:opacity-50 text-obsidian-950 font-bold rounded-lg text-xs flex items-center gap-1 ml-auto active:scale-95 transition-all"
                          >
                            {installingVersionId === ver.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                            Install
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Floating Save & Restart Server Action Bar */}
      {hasPending && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[90%] glass-panel p-4 rounded-2xl border border-mcgreen-500/50 shadow-2xl bg-obsidian-950/95 backdrop-blur-md flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Unsaved Mod Changes</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {Object.keys(pendingChanges).length} pending change(s). Server restart required.
              </p>
            </div>
          </div>

          <button 
            onClick={handleSaveAndRestart}
            disabled={isSaving}
            className="px-4 py-2 bg-mcgreen-500 hover:bg-mcgreen-600 disabled:opacity-50 text-obsidian-950 font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-mcgreen-500/25 active:scale-95 transition-all shrink-0"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save & Restart Server
          </button>
        </div>
      )}

    </div>
  );
}
