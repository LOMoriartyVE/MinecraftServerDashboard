'use client';

import React, { useState, useEffect } from 'react';
import { Search, ShieldAlert, UserX, Heart, Utensils, ShieldCheck } from 'lucide-react';

export default function Players({ apiFetch, serverId, showToast }) {
  const [players, setPlayers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchPlayers = async () => {
    try {
      const data = await apiFetch(`/api/servers/${serverId}/players`);
      setPlayers(data || []);
    } catch (err) {
      // players read failed
    }
  };

  useEffect(() => {
    if (!serverId) return;
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 2000);
    return () => clearInterval(interval);
  }, [serverId]);

  const handlePlayerAction = async (username, action) => {
    try {
      await apiFetch(`/api/servers/${serverId}/players/${username}/action`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      showToast(`Executed ${action.toUpperCase()} on player ${username}`, 'success');
      setIsModalOpen(false);
      fetchPlayers();
    } catch (err) {
      showToast(`Action failed: ${err.message}`, 'error');
    }
  };

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.uuid.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 font-sans">
      
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search online players by username or UUID..." 
            className="w-full bg-obsidian-900 border border-obsidian-700 focus:border-mcgreen-500 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => showToast('Whitelist configuration is managed in server.properties', 'info')}
            className="px-3 py-2 bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-700 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-mcgreen-400" /> Whitelist Config
          </button>
          <button 
            onClick={() => showToast('Permanent ban lists are stored in banned-players.json', 'info')}
            className="px-3 py-2 bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-700 rounded-xl text-xs font-semibold text-rose-400 flex items-center gap-1.5"
          >
            <UserX className="w-4 h-4" /> Ban List
          </button>
        </div>
      </div>

      {/* Players Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-obsidian-700">
        <div className="overflow-x-auto font-sans">
          <table className="w-full text-left text-xs">
            <thead className="bg-obsidian-900 border-b border-obsidian-700 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3.5">Player</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Health / Food</th>
                <th className="px-4 py-3.5">Ping</th>
                <th className="px-4 py-3.5">IP Address</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-800/60 font-medium">
              {filteredPlayers.map(p => (
                <tr key={p.name} className="hover:bg-obsidian-850/80 transition-colors">
                  <td className="px-4 py-3 flex items-center gap-3">
                    <img 
                      src={`https://mc-heads.net/avatar/${p.name}`} 
                      className="w-8 h-8 rounded-lg bg-obsidian-800 border border-obsidian-700"
                      alt={p.name}
                    />
                    <div>
                      <p className="font-bold text-white leading-none">{p.name}</p>
                      <p className="text-[9px] font-mono text-slate-400 mt-1">{p.uuid.substring(0, 18)}...</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.isOp ? (
                      <span className="px-2 py-0.5 rounded text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">OP ADMIN</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[9px] bg-slate-800 text-slate-300 border border-slate-700">Member</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-rose-400 font-mono text-xs flex items-center gap-1">
                        <Heart className="w-3 h-3 fill-rose-500/30" /> {p.health}/20
                      </span>
                      <span className="text-amber-500 font-mono text-xs flex items-center gap-1">
                        <Utensils className="w-3 h-3" /> {p.food}/20
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-mcgreen-400">{p.ping} ms</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{p.ip}</td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => {
                        setSelectedPlayer(p);
                        setIsModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-obsidian-800 hover:bg-obsidian-700 border border-obsidian-700 rounded-lg text-slate-200 text-xs transition-all"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
              {filteredPlayers.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-slate-500 text-xs font-mono">
                    No players online matching filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manage Player Modal */}
      {isModalOpen && selectedPlayer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-obsidian-900 border border-obsidian-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-obsidian-700 flex justify-between items-center">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Player Controller</span>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            
            <div className="p-5 flex flex-col items-center text-center space-y-3">
              <img 
                src={`https://mc-heads.net/avatar/${selectedPlayer.name}`} 
                className="w-16 h-16 rounded-xl bg-obsidian-800 border border-obsidian-750 shadow-lg"
                alt={selectedPlayer.name}
              />
              <div>
                <h4 className="font-bold text-lg text-white">{selectedPlayer.name}</h4>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{selectedPlayer.uuid}</p>
              </div>
            </div>

            <div className="px-5 pb-5 grid grid-cols-2 gap-2 text-xs font-semibold">
              <button 
                onClick={() => handlePlayerAction(selectedPlayer.name, 'kick')}
                className="py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl"
              >
                Kick Player
              </button>
              <button 
                onClick={() => handlePlayerAction(selectedPlayer.name, 'ban')}
                className="py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl"
              >
                Ban Player
              </button>
              <button 
                onClick={() => handlePlayerAction(selectedPlayer.name, selectedPlayer.isOp ? 'deop' : 'op')}
                className="py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl"
              >
                {selectedPlayer.isOp ? 'De-OP Admin' : 'Make OP Admin'}
              </button>
              <button 
                onClick={() => handlePlayerAction(selectedPlayer.name, 'tp')}
                className="py-2.5 bg-mcgreen-500/10 hover:bg-mcgreen-500/20 text-mcgreen-400 border border-mcgreen-500/30 rounded-xl"
              >
                Teleport to Spawn
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
