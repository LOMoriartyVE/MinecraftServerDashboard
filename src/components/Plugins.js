'use client';

import React, { useState, useEffect } from 'react';
import { Puzzle, ShieldInfo, ToggleLeft, ToggleRight, FileText } from 'lucide-react';

export default function Plugins({ apiFetch, serverId, showToast }) {
  const [mods, setMods] = useState([]);

  useEffect(() => {
    if (!serverId) return;
    const fetchMods = async () => {
      try {
        const data = await apiFetch(`/api/servers/${serverId}/mods`);
        setMods(data || []);
      } catch (err) {
        // mods fail
      }
    };
    fetchMods();
  }, [serverId]);

  const toggleMod = (name, currentStatus) => {
    showToast(`${name} ${currentStatus ? 'disabled' : 'enabled'}. Server restart required to apply changes.`, 'info');
    setMods(prev => prev.map(m => m.name === name ? { ...m, enabled: !m.enabled } : m));
  };

  const formatSize = (bytes) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6 font-sans">
      
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Puzzle className="w-5 h-5 text-mcgreen-400" /> Plugins & Modifications
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Displaying modifications loaded in the server&apos;s <code className="text-mcgreen-400 font-mono">/mods</code> folder directory.
          </p>
        </div>
        <button 
          onClick={() => showToast('Drag & drop .jar mods into the File Explorer to install', 'info')}
          className="px-4 py-2 bg-mcgreen-500 hover:bg-mcgreen-600 text-obsidian-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-mcgreen-500/20 active:scale-95 transition-all"
        >
          Install JAR Mod
        </button>
      </div>

      {/* Grid of Mods */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mods.map(mod => (
          <div 
            key={mod.name} 
            className="glass-panel p-4 rounded-2xl flex flex-col justify-between border border-obsidian-700 space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[9px] bg-obsidian-800 text-mcgreen-400 border border-obsidian-750 font-mono">
                  {mod.category}
                </span>
                <button 
                  onClick={() => toggleMod(mod.name, mod.enabled)}
                  className={`transition-colors ${mod.enabled ? 'text-mcgreen-500' : 'text-slate-500'}`}
                >
                  {mod.enabled ? (
                    <ToggleRight className="w-8 h-8" />
                  ) : (
                    <ToggleLeft className="w-8 h-8" />
                  )}
                </button>
              </div>
              
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2 truncate">
                  {mod.name.replace(/[-_]/g, ' ')}
                </h4>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{mod.filename}</p>
                <p className="text-[11px] text-slate-400 mt-2">
                  File Size: {formatSize(mod.sizeBytes)}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-obsidian-700/60 flex items-center justify-between text-[11px]">
              <span className={`font-semibold ${mod.enabled ? 'text-mcgreen-400' : 'text-slate-500'}`}>
                {mod.enabled ? '● Active' : '○ Disabled'}
              </span>
              <button 
                onClick={() => showToast(`Opened configuration file index for ${mod.name}`, 'info')}
                className="text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
              >
                <FileText className="w-3.5 h-3.5" /> Config Files
              </button>
            </div>
          </div>
        ))}
        {mods.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 text-xs font-mono">
            No .jar modifications detected in the server&apos;s mods/ folder
          </div>
        )}
      </div>

    </div>
  );
}
