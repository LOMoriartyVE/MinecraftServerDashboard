'use client';

import React, { useState, useEffect } from 'react';
import { Sliders, Link, HelpCircle, Save, Image, Sparkles } from 'lucide-react';

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
  const [serverName, setServerName] = useState('');
  const [description, setDescription] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [isLoadingProps, setIsLoadingProps] = useState(false);

  useEffect(() => {
    setUrlInput(daemonUrl);
  }, [daemonUrl]);

  // Load server properties & identity metadata
  const fetchProperties = async () => {
    if (!serverId) return;
    setIsLoadingProps(true);
    try {
      const data = await apiFetch(`/api/servers/${serverId}/properties`);
      if (data) {
        setServerName(data.serverName || '');
        setDescription(data.description || '');
        setIconUrl(data.iconUrl || '');
        if (data.properties) setProperties(data.properties);
      }
    } catch (e) {
      // properties fallback read
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
      await apiFetch(`/api/servers/${serverId}/properties`, {
        method: 'POST',
        body: JSON.stringify({
          serverName,
          description,
          iconUrl,
          properties: {
            ...properties,
            motd: description
          }
        })
      });
      showToast('Server Identity, Image & Properties updated successfully! Restart server to apply.', 'success');
    } catch (err) {
      showToast(`Failed to save settings: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      <div>
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Sliders className="w-5 h-5 text-mcgreen-400" /> Settings & Configurations
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Customize server display name, description, server icon image, daemon connection link, and server properties.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">

        {/* Daemon Connection Link Card */}
        <div className="glass-panel p-6 rounded-2xl border border-obsidian-700 space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Link className="w-4 h-4 text-purple-400" /> Local Daemon API Link
          </h4>

          <form onSubmit={handleConnectionSave} className="flex gap-3">
            <input 
              type="text" 
              value={urlInput} 
              onChange={(e) => setUrlInput(e.target.value)} 
              placeholder="e.g. https://...trycloudflare.com or http://localhost:3001"
              className="flex-1 bg-obsidian-950 border border-obsidian-700 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-purple-500 font-mono"
            />
            <button 
              type="submit" 
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg shadow-purple-600/20"
            >
              Save Link
            </button>
          </form>
        </div>

        {/* Server Properties & Identity Manager */}
        <div className="glass-panel p-6 rounded-2xl border border-obsidian-700 space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-mcgreen-400" /> Server Identity & Properties
            </h4>
            {serverId && (
              <button 
                onClick={handleSaveProperties}
                className="px-4 py-2 bg-mcgreen-500 hover:bg-mcgreen-600 text-obsidian-950 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 shadow-lg shadow-mcgreen-500/20 transition-all"
              >
                <Save className="w-4 h-4" /> Save All Changes
              </button>
            )}
          </div>

          {isLoadingProps ? (
            <p className="text-xs text-slate-500 font-mono py-12 text-center">Parsing configuration parameters...</p>
          ) : serverId ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
              
              {/* Server Name, Description & Image Customizer */}
              <div className="md:col-span-2 p-4 bg-obsidian-950/80 rounded-2xl border border-obsidian-750 space-y-4 mb-2">
                <h5 className="text-xs font-bold text-mcgreen-400 uppercase tracking-wider flex items-center gap-2">
                  <Image className="w-4 h-4" /> Server Display Name, Description & Image Icon
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Server Display Name</label>
                    <input 
                      type="text" 
                      value={serverName} 
                      onChange={(e) => setServerName(e.target.value)}
                      placeholder="e.g. The Eastern Server"
                      className="w-full bg-obsidian-900 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-mcgreen-500 font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Server Image / Icon URL</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={iconUrl} 
                        onChange={(e) => setIconUrl(e.target.value)}
                        placeholder="https://... or data:image/png;base64,..."
                        className="w-full bg-obsidian-900 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-mcgreen-500 font-mono"
                      />
                      {iconUrl && (
                        <img src={iconUrl} alt="Server Icon Preview" className="w-9 h-9 rounded-lg border border-obsidian-700 object-cover shrink-0" />
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Server Description (MOTD)</label>
                    <input 
                      type="text" 
                      value={description} 
                      onChange={(e) => {
                        setDescription(e.target.value);
                        handlePropertyChange('motd', e.target.value);
                      }}
                      placeholder="Welcome to our NeoForge Survival Server!"
                      className="w-full bg-obsidian-900 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-mcgreen-500 font-sans"
                    />
                  </div>
                </div>
              </div>

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

              <div className="space-y-1 md:col-span-2">
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
