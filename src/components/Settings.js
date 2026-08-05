'use client';

import React, { useState, useEffect } from 'react';
import { Sliders, Link, HelpCircle, Save } from 'lucide-react';

export default function Settings({
  daemonUrl,
  setDaemonUrl,
  connectionMode,
  setConnectionMode,
  activeServer,
  serverId,
  apiFetch,
  showToast
}) {
  const [urlInput, setUrlInput] = useState(daemonUrl);
  const [properties, setProperties] = useState({});
  const [isLoadingProps, setIsLoadingProps] = useState(false);

  useEffect(() => {
    setUrlInput(daemonUrl);
  }, [daemonUrl]);

  // Load server.properties fields
  const fetchProperties = async () => {
    if (!serverId) return;
    setIsLoadingProps(true);
    try {
      const data = await apiFetch(`/api/servers/${serverId}/files/content?path=server.properties`);
      const props = {};
      data.content.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#') && line.includes('=')) {
          const parts = line.split('=');
          const key = parts[0].trim();
          const value = parts.slice(1).join('=').trim();
          props[key] = value;
        }
      });
      setProperties(props);
    } catch (e) {
      // props read fail
    } finally {
      setIsLoadingProps(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [serverId]);

  const handleConnectionSave = (e) => {
    e.preventDefault();
    let cleanedUrl = urlInput.trim();
    // remove trailing slash
    if (cleanedUrl.endsWith('/')) {
      cleanedUrl = cleanedUrl.slice(0, -1);
    }
    setDaemonUrl(cleanedUrl);
    showToast(`Daemon configuration updated. Attempting link...`, 'success');
  };

  const handlePropertyChange = (key, value) => {
    setProperties(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveProperties = async () => {
    if (!serverId) return;
    try {
      let content = '#Minecraft server properties\n';
      content += `#Updated by ObsidianNode Dashboard: ${new Date().toISOString()}\n`;
      for (const [key, val] of Object.entries(properties)) {
        content += `${key}=${val}\n`;
      }
      
      await apiFetch(`/api/servers/${serverId}/files/save`, {
        method: 'POST',
        body: JSON.stringify({
          path: 'server.properties',
          content
        })
      });
      showToast('Successfully updated server properties. Restart to apply.', 'success');
    } catch (err) {
      showToast(`Failed to update properties: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      <div>
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Sliders className="w-5 h-5 text-mcgreen-400" /> Settings & Configurations
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Link the frontend to your local daemon or manage server configuration properties.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Connection Setup */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col space-y-4 h-fit">
          <div className="pb-2 border-b border-obsidian-700">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Link className="w-4 h-4 text-mcgreen-400" /> Daemon Integration Linker
            </h4>
          </div>

          <form onSubmit={handleConnectionSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Daemon Endpoint URL (Direct HTTPS)
              </label>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="e.g. https://xxx.trycloudflare.com"
                className="w-full bg-obsidian-950 border border-obsidian-700 focus:border-mcgreen-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-mcgreen-500 hover:bg-mcgreen-600 text-obsidian-950 font-bold py-2 rounded-xl text-xs transition-all active:scale-95 shadow-lg shadow-mcgreen-500/20"
            >
              Update Daemon Link
            </button>
          </form>
        </div>

        {/* Server Config GUI Form */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl flex flex-col space-y-4">
          <div className="pb-2 border-b border-obsidian-700 flex justify-between items-center">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Server Properties Manager
            </h4>
            {serverId && (
              <button 
                onClick={handleSaveProperties}
                className="px-3 py-1.5 bg-mcgreen-500 hover:bg-mcgreen-600 text-obsidian-950 rounded-lg text-xs font-semibold flex items-center gap-1.5 active:scale-95 shadow-md shadow-mcgreen-500/20 transition-all"
              >
                <Save className="w-3.5 h-3.5" /> Save Configuration
              </button>
            )}
          </div>

          {isLoadingProps ? (
            <p className="text-xs text-slate-500 font-mono py-12 text-center">Parsing configuration parameters...</p>
          ) : serverId ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
              
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Difficulty</label>
                <select 
                  value={properties['difficulty'] || 'easy'} 
                  onChange={(e) => handlePropertyChange('difficulty', e.target.value)}
                  className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-mcgreen-500"
                >
                  <option value="peaceful">Peaceful</option>
                  <option value="easy">Easy</option>
                  <option value="normal">Normal</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Game Mode</label>
                <select 
                  value={properties['gamemode'] || 'survival'} 
                  onChange={(e) => handlePropertyChange('gamemode', e.target.value)}
                  className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-mcgreen-500"
                >
                  <option value="survival">Survival</option>
                  <option value="creative">Creative</option>
                  <option value="adventure">Adventure</option>
                  <option value="spectator">Spectator</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Max Players</label>
                <input 
                  type="number" 
                  value={properties['max-players'] || '20'} 
                  onChange={(e) => handlePropertyChange('max-players', e.target.value)}
                  className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-mcgreen-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Server Port</label>
                <input 
                  type="text" 
                  value={properties['server-port'] || '25565'} 
                  onChange={(e) => handlePropertyChange('server-port', e.target.value)}
                  className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-mcgreen-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Online Mode</label>
                <select 
                  value={properties['online-mode'] || 'true'} 
                  onChange={(e) => handlePropertyChange('online-mode', e.target.value)}
                  className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-mcgreen-500"
                >
                  <option value="true">True (Official Authentication)</option>
                  <option value="false">False (Offline/Cracked Mode)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Allow Flight</label>
                <select 
                  value={properties['allow-flight'] || 'false'} 
                  onChange={(e) => handlePropertyChange('allow-flight', e.target.value)}
                  className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-mcgreen-500"
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">MOTD (Server Description)</label>
                <input 
                  type="text" 
                  value={properties['motd'] || 'A Minecraft Server'} 
                  onChange={(e) => handlePropertyChange('motd', e.target.value)}
                  className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-mcgreen-500 font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">View Distance</label>
                <input 
                  type="number" 
                  value={properties['view-distance'] || '10'} 
                  onChange={(e) => handlePropertyChange('view-distance', e.target.value)}
                  className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-mcgreen-500 font-mono"
                />
              </div>

            </div>
          ) : (
            <p className="text-xs text-slate-500 font-mono py-12 text-center">Please select a server node first.</p>
          )}
        </div>

      </div>

    </div>
  );
}
