'use client';

import React, { useState, useEffect } from 'react';
import { Puzzle, ToggleLeft, ToggleRight, Trash2, Save, RefreshCw, Search, Download, CheckCircle2, AlertTriangle, X, Sparkles, ShieldCheck } from 'lucide-react';

export default function Plugins({ apiFetch, serverId, showToast }) {
  const [mods, setMods] = useState([]);
  const [pendingChanges, setPendingChanges] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Modrinth Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [installingId, setInstallingId] = useState(null);

  const fetchMods = async () => {
    if (!serverId) return;
    setIsLoading(true);
    try {
      const data = await apiFetch(`/api/servers/${serverId}/mods`);
      setMods(data || []);
      setPendingChanges({});
    } catch (err) {
      showToast(`Failed to load mods: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMods();
  }, [serverId]);

  // Execute Modrinth API search
  const handleSearchMods = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const data = await apiFetch(`/api/mods/search?query=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data || []);
    } catch (err) {
      showToast(`Search failed: ${err.message}`, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // 1-Click Install Mod from Modrinth
  const handleInstallRemoteMod = async (mod) => {
    setInstallingId(mod.id);
    showToast(`Downloading "${mod.title}" & creating safety backup...`, 'info');
    try {
      const res = await apiFetch(`/api/servers/${serverId}/mods/install-remote`, {
        method: 'POST',
        body: JSON.stringify({
          projectId: mod.id,
          title: mod.title
        })
      });

      if (res.success) {
        showToast(`Successfully installed ${mod.title}! Pre-installation backup saved.`, 'success');
        fetchMods();
        // Mark pending restart
        setPendingChanges(prev => ({ ...prev, [res.filename]: true }));
      }
    } catch (err) {
      showToast(`Failed to install ${mod.title}: ${err.message}`, 'error');
    } finally {
      setInstallingId(null);
    }
  };

  // Toggle mod status locally in pending state
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

    setMods(prev => prev.map(m => {
      if (m.filename === filename) {
        return { ...m, enabled: newStatus };
      }
      return m;
    }));
  };

  // Delete mod
  const handleDeleteMod = async (filename) => {
    if (!confirm(`Are you sure you want to delete "${filename}"? A safety backup will be created.`)) return;
    try {
      await apiFetch(`/api/servers/${serverId}/mods/${filename}`, { method: 'DELETE' });
      showToast(`Deleted ${filename} (Pre-deletion safety backup created)`, 'success');
      fetchMods();
    } catch (err) {
      showToast(`Failed to delete mod: ${err.message}`, 'error');
    }
  };

  // Save all pending changes & restart server
  const handleSaveAndRestart = async () => {
    setIsSaving(true);
    showToast('Creating safety backup & applying mod changes...', 'info');

    try {
      for (const [filename, enabled] of Object.entries(pendingChanges)) {
        await apiFetch(`/api/servers/${serverId}/mods/toggle`, {
          method: 'POST',
          body: JSON.stringify({ filename, enabled })
        });
      }

      showToast('Mod changes saved! Rebooting Minecraft server...', 'success');

      await apiFetch(`/api/servers/${serverId}/power`, {
        method: 'POST',
        body: JSON.stringify({ action: 'restart' })
      });

      setPendingChanges({});
      fetchMods();
    } catch (err) {
      showToast(`Error saving mod configuration: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const formatSize = (bytes) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const hasPending = Object.keys(pendingChanges).length > 0;

  return (
    <div className="space-y-6 font-sans relative pb-20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Puzzle className="w-5 h-5 text-mcgreen-400" /> Plugins & Modifications
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Manage, enable, or search & 1-click install mods directly from Modrinth / CurseForge database.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="px-4 py-2 bg-mcgreen-500 hover:bg-mcgreen-600 text-obsidian-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-mcgreen-500/20 active:scale-95 transition-all"
          >
            <Sparkles className="w-4 h-4" /> Search Modrinth / CurseForge
          </button>
          <button 
            onClick={fetchMods}
            className="p-2 bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 rounded-xl border border-obsidian-700 transition-all active:scale-95"
            title="Refresh mods list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Modern Sleek List View */}
      <div className="glass-panel rounded-2xl border border-obsidian-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-obsidian-900/80 border-b border-obsidian-700 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3.5">Mod Name / Filename</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Size</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-center">Enable / Disable</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-700/60 font-sans">
              {mods.map(mod => {
                const isPending = pendingChanges[mod.filename] !== undefined;
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
                            {isPending && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono">
                                Pending
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{mod.filename}</div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-4">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-obsidian-800 text-slate-300 border border-obsidian-750 font-mono">
                        {mod.category}
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

                    {/* Enable / Disable Toggle Switch */}
                    <td className="px-4 py-4 text-center">
                      <button 
                        onClick={() => handleToggleLocal(mod.filename, mod.enabled)}
                        className={`transition-all transform active:scale-95 ${
                          mod.enabled ? 'text-mcgreen-400' : 'text-slate-600 hover:text-slate-400'
                        }`}
                        title={mod.enabled ? 'Click to disable mod' : 'Click to enable mod'}
                      >
                        {mod.enabled ? (
                          <ToggleRight className="w-8 h-8 mx-auto" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 mx-auto" />
                        )}
                      </button>
                    </td>

                    {/* Delete Action */}
                    <td className="px-5 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteMod(mod.filename)}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30 transition-all active:scale-95"
                        title="Delete mod file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {mods.length === 0 && !isLoading && (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500 text-xs font-mono">
                    No .jar modifications found in <code className="text-mcgreen-400 font-mono">/mods</code> directory
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save & Restart Server
          </button>
        </div>
      )}

      {/* Modrinth / CurseForge Search & 1-Click Installer Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-obsidian-700 bg-obsidian-950 p-6 space-y-4 max-h-[85vh] flex flex-col">
            
            <div className="flex items-center justify-between border-b border-obsidian-700 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-mcgreen-400" /> Search & 1-Click Install Mods (Modrinth)
              </h4>
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSearchMods} className="flex gap-2">
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search mods e.g. Waystones, JEI, Create, JourneyMap..."
                className="flex-1 bg-obsidian-900 border border-obsidian-700 focus:border-mcgreen-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono outline-none"
              />
              <button 
                type="submit"
                disabled={isSearching}
                className="px-4 py-2 bg-mcgreen-500 hover:bg-mcgreen-600 text-obsidian-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all"
              >
                {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 font-sans">
              {searchResults.map(result => (
                <div 
                  key={result.id}
                  className="bg-obsidian-900/80 border border-obsidian-700/80 p-3.5 rounded-xl flex items-start justify-between gap-4 hover:border-mcgreen-500/40 transition-all"
                >
                  <div className="flex items-start gap-3">
                    {result.iconUrl ? (
                      <img src={result.iconUrl} alt={result.title} className="w-10 h-10 rounded-lg object-cover bg-obsidian-800 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-mcgreen-500/10 text-mcgreen-400 border border-mcgreen-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                        <Puzzle className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <h5 className="font-bold text-white text-xs flex items-center gap-2">
                        {result.title}
                        <span className="text-[9px] text-slate-400 font-normal">by {result.author}</span>
                      </h5>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {result.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] bg-obsidian-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                          ⬇ {result.downloads?.toLocaleString()} downloads
                        </span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleInstallRemoteMod(result)}
                    disabled={installingId === result.id}
                    className="px-3 py-1.5 bg-mcgreen-500 hover:bg-mcgreen-600 disabled:opacity-50 text-obsidian-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shrink-0 transition-all active:scale-95"
                  >
                    {installingId === result.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    Install
                  </button>
                </div>
              ))}

              {searchResults.length === 0 && !isSearching && (
                <div className="py-12 text-center text-slate-500 text-xs font-mono">
                  {searchQuery ? 'No mods found for query' : 'Type a mod name above to search Modrinth & CurseForge database'}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
