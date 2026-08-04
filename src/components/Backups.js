'use client';

import React, { useState, useEffect } from 'react';
import { HardDriveDownload, RefreshCw, PlusCircle, Archive } from 'lucide-react';

export default function Backups({ apiFetch, serverId, showToast }) {
  const [backups, setBackups] = useState([]);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const fetchBackups = async () => {
    try {
      const data = await apiFetch(`/api/servers/${serverId}/backups`);
      setBackups(data || []);
    } catch (err) {
      // backups fail
    }
  };

  useEffect(() => {
    if (!serverId) return;
    fetchBackups();
  }, [serverId]);

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    showToast('Starting world chunk snapshot compilation...', 'info');
    try {
      const res = await apiFetch(`/api/servers/${serverId}/backups`, {
        method: 'POST'
      });
      if (res.success) {
        showToast(res.message, 'success');
        // Poll for updates in 2.5s
        setTimeout(() => {
          fetchBackups();
          setIsBackingUp(false);
        }, 3000);
      }
    } catch (err) {
      showToast(`Backup failed: ${err.message}`, 'error');
      setIsBackingUp(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
      const gb = mb / 1024;
      return `${gb.toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  };

  return (
    <div className="space-y-6 font-sans">
      
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <HardDriveDownload className="w-5 h-5 text-mcgreen-400" /> Backups & System Snapshots
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Generate and restore compression archives of your server world files.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchBackups}
            className="p-2 bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-700 text-slate-300 rounded-xl"
            title="Refresh backups list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button 
            onClick={handleCreateBackup}
            disabled={isBackingUp}
            className="px-4 py-2 bg-mcgreen-500 hover:bg-mcgreen-600 text-obsidian-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-mcgreen-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <PlusCircle className="w-4 h-4" /> Trigger New Backup
          </button>
        </div>
      </div>

      {/* Grid List of Backups */}
      <div className="glass-panel rounded-2xl border border-obsidian-700 overflow-hidden">
        <div className="p-4 border-b border-obsidian-700 bg-obsidian-900 flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Available Archives</span>
          <span className="text-[10px] text-mcgreen-400 font-mono">Location: /simplebackups/</span>
        </div>
        
        <div className="divide-y divide-obsidian-850 font-mono text-xs">
          {backups.map(backup => (
            <div 
              key={backup.name} 
              className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-obsidian-850/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Archive className="w-5 h-5 text-slate-500 shrink-0" />
                <div>
                  <p className="font-bold text-slate-200 truncate">{backup.name}</p>
                  <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                    Saved: {formatDate(backup.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-6">
                <span className="text-slate-300 text-xs font-bold font-mono">
                  {formatSize(backup.sizeBytes)}
                </span>
                <button 
                  onClick={() => showToast(`Restore archive option is disabled. Please unzip manually to apply server restoration.`, 'warn')}
                  className="px-3 py-1 bg-obsidian-800 hover:bg-obsidian-750 border border-obsidian-700 text-slate-300 hover:text-white rounded-lg transition-colors text-xs font-semibold"
                >
                  Restore
                </button>
              </div>
            </div>
          ))}
          {backups.length === 0 && (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              No server snapshots discovered in simplebackups/
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
