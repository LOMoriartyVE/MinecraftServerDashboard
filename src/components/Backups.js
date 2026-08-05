'use client';

import React, { useState, useEffect } from 'react';
import { HardDriveDownload, RefreshCw, PlusCircle, Archive, Trash2, AlertTriangle, Download, CheckCircle2 } from 'lucide-react';

export default function Backups({ apiFetch, serverId, showToast }) {
  const [backups, setBackups] = useState([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [deletingFilename, setDeletingFilename] = useState(null);

  const fetchBackups = async () => {
    if (!serverId) return;
    try {
      const data = await apiFetch(`/api/servers/${serverId}/backups`);
      setBackups(data || []);
    } catch (err) {
      showToast(`Failed to load backups list: ${err.message}`, 'error');
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [serverId]);

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    showToast('World backup snapshot started in background...', 'info');
    try {
      const res = await apiFetch(`/api/servers/${serverId}/backups/create`, {
        method: 'POST'
      });
      if (res.success) {
        showToast(res.message || 'World backup snapshot started!', 'success');
        fetchBackups();
        setTimeout(fetchBackups, 2000);
        setTimeout(fetchBackups, 4000);
        setTimeout(fetchBackups, 6000);
      }
    } catch (err) {
      showToast(`Backup creation failed: ${err.message}`, 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDeleteBackup = async (filename) => {
    if (!confirm(`⚠️ WARNING: Deleting "${filename}" is permanent and cannot be undone!\n\nAre you sure you want to delete this backup file?`)) {
      return;
    }

    setDeletingFilename(filename);
    try {
      await apiFetch(`/api/servers/${serverId}/backups/${filename}`, {
        method: 'DELETE'
      });
      showToast(`Successfully deleted backup ${filename}`, 'success');
      fetchBackups();
    } catch (err) {
      showToast(`Failed to delete backup: ${err.message}`, 'error');
    } finally {
      setDeletingFilename(null);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0.00 MB';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Recent';
    const d = new Date(isoString);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <HardDriveDownload className="w-5 h-5 text-mcgreen-400" /> Backups & System Snapshots
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Generate, download, or delete compressed world backups for your Minecraft server.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchBackups}
            className="p-2 bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-700 text-slate-300 rounded-xl transition-all active:scale-95"
            title="Refresh backups list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button 
            onClick={handleCreateBackup}
            disabled={isBackingUp}
            className="px-4 py-2 bg-mcgreen-500 hover:bg-mcgreen-600 text-obsidian-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-mcgreen-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
            Trigger New Backup
          </button>
        </div>
      </div>

      {/* Backups List Table */}
      <div className="glass-panel rounded-2xl border border-obsidian-700 overflow-hidden">
        <div className="p-4 border-b border-obsidian-700 bg-obsidian-900 flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Available World Backups ({backups.length})</span>
          <span className="text-[10px] text-mcgreen-400 font-mono">Directory: /backups/</span>
        </div>
        
        <div className="divide-y divide-obsidian-800 text-xs">
          {backups.map(backup => (
            <div 
              key={backup.filename || backup.name} 
              className="p-4 hover:bg-obsidian-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-mcgreen-500/10 text-mcgreen-400 border border-mcgreen-500/20 flex items-center justify-center shrink-0">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm font-mono flex items-center gap-2">
                    {backup.filename || backup.name}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-3 font-mono">
                    <span>Created: {formatDate(backup.createdAt)}</span>
                    <span>•</span>
                    <span className="text-mcgreen-400 font-bold">{backup.sizeMb ? `${backup.sizeMb} MB` : formatSize(backup.sizeBytes)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button 
                  onClick={() => handleDeleteBackup(backup.filename || backup.name)}
                  disabled={deletingFilename === (backup.filename || backup.name)}
                  className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 transition-all active:scale-95"
                  title="Delete backup archive"
                >
                  {deletingFilename === (backup.filename || backup.name) ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}

          {backups.length === 0 && (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              No backup archives created yet. Click <span className="text-mcgreen-400 font-bold">&quot;Trigger New Backup&quot;</span> above to create your first world snapshot.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
