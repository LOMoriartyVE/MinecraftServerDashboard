'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Terminal, Users, Puzzle, FolderTree, HardDriveDownload, 
  Sliders, ChevronDown, PlusCircle, Cpu, LogOut, CheckCircle, 
  AlertTriangle, AlertOctagon, Info, Bell, Power, Menu, X, RefreshCw, Clock, Compass, MapPin,
  Copy, Check, Globe
} from 'lucide-react';

import Overview from './Overview';
import Console from './Console';
import Players from './Players';
import Plugins from './Plugins';
import Files from './Files';
import Backups from './Backups';
import Settings from './Settings';
import BlueMap from './BlueMap';

export default function Dashboard() {
  // Navigation & Settings State
  const [activeTab, setActiveTab] = useState('overview');
  const [daemonUrl, setDaemonUrl] = useState(process.env.NEXT_PUBLIC_DAEMON_URL || 'http://localhost:3001');
  const [connectionMode, setConnectionMode] = useState('direct'); // 'direct' or 'proxy'
  const [isConnected, setIsConnected] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Servers & Active Server
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [activeServer, setActiveServer] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Telemetry & Console Logs
  const [telemetry, setTelemetry] = useState(null);
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Dashboard Initialized', desc: 'ObsidianNode is ready for deployment.', time: 'Just now', type: 'info' }
  ]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Toast State
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false });

  // Refs for WebSockets / polling
  const wsRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Load settings from localStorage on client mount
  useEffect(() => {
    const savedUrl = localStorage.getItem('obsidian_daemon_url');
    const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
    
    if (savedUrl) {
      // On Vercel, ignore localhost URLs stored from local testing
      if (isVercel && (savedUrl.includes('localhost') || savedUrl.includes('127.0.0.1'))) {
        if (process.env.NEXT_PUBLIC_DAEMON_URL) {
          setDaemonUrl(process.env.NEXT_PUBLIC_DAEMON_URL);
          localStorage.setItem('obsidian_daemon_url', process.env.NEXT_PUBLIC_DAEMON_URL);
        }
      } else {
        setDaemonUrl(savedUrl);
      }
    }
    
    const savedMode = localStorage.getItem('obsidian_connection_mode');
    if (savedMode) {
      setConnectionMode(savedMode);
    } else if (isVercel) {
      setConnectionMode('proxy');
    }
  }, []);

  // Show toast notification
  const showToast = (message, type = 'info') => {
    setToast({ message, type, visible: true });
  };

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, visible: false }));
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  // General Direct HTTPS Fetch Client
  const apiFetch = async (endpoint, options = {}) => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${daemonUrl}${cleanEndpoint}`;
    
    const headers = new Headers(options.headers || {});
    headers.set('bypass-tunnel-reminder', 'true');
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const fetchOptions = {
      ...options,
      headers
    };

    try {
      const res = await fetch(url, fetchOptions);
      if (!res.ok) {
        throw new Error(`API returned HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      throw err;
    }
  };

  // Fetch servers list with smart localhost port auto-discovery
  const fetchServers = async (targetUrl = daemonUrl) => {
    try {
      const data = await apiFetch('/api/servers');
      setServers(data);
      setIsConnected(true);
      
      // Auto select first server if none selected
      if (data.length > 0 && !selectedServerId) {
        setSelectedServerId(data[0].id);
      }
    } catch (err) {
      // If primary URL fails and we are running locally on localhost,
      // auto-discover local daemon ports (3001, 3002, 3003, 3004, 3005)
      if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        const ports = [3001, 3002, 3003, 3004, 3005];
        for (const p of ports) {
          const testUrl = `http://localhost:${p}`;
          try {
            const res = await fetch(`${testUrl}/api/servers`, { 
              headers: { 'bypass-tunnel-reminder': 'true' } 
            });
            if (res.ok) {
              const testData = await res.json();
              setDaemonUrl(testUrl);
              localStorage.setItem('obsidian_daemon_url', testUrl);
              setServers(testData);
              setIsConnected(true);
              if (testData.length > 0 && !selectedServerId) {
                setSelectedServerId(testData[0].id);
              }
              return;
            }
          } catch (e) {
            // port not active
          }
        }
      }
      if (!localStorage.getItem('obsidian_daemon_url')) {
        setIsConnected(false);
      }
    }
  };

  // Poll server lists and telemetry
  useEffect(() => {
    fetchServers();
    
    pollIntervalRef.current = setInterval(() => {
      fetchServers();
    }, 3000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [daemonUrl, connectionMode, selectedServerId]);

  // Fetch active server telemetry periodically
  useEffect(() => {
    if (!selectedServerId || !isConnected) return;
    
    const fetchTelemetry = async () => {
      try {
        const data = await apiFetch(`/api/servers/${selectedServerId}/telemetry`);
        setTelemetry(data);
      } catch (err) {
        // failed telemetry
      }
    };

    const fetchServerDetails = async () => {
      try {
        const data = await apiFetch(`/api/servers/${selectedServerId}`);
        setActiveServer(data);
      } catch (err) {
        // failed details
      }
    };

    fetchTelemetry();
    fetchServerDetails();
    
    const timer = setInterval(() => {
      fetchTelemetry();
      fetchServerDetails();
    }, 1500);

    return () => clearInterval(timer);
  }, [selectedServerId, isConnected]);

  // Manage Real-time log stream (WebSocket in direct mode, REST polling in proxy mode)
  useEffect(() => {
    if (!selectedServerId || !isConnected) return;
    setLogs([]); // Reset logs when changing servers
    
    if (connectionMode === 'direct') {
      // Connect WebSockets
      const wsUrl = daemonUrl.replace(/^http/, 'ws') + `/ws/servers/${selectedServerId}`;
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          showToast(`Connected to real-time console`, 'success');
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'init') {
            setLogs(data.logs || []);
          } else if (data.type === 'log') {
            setLogs(prev => [...prev, data.log].slice(-200));
          } else if (data.type === 'status') {
            // handle live status broadcast
            setServers(prev => prev.map(s => s.id === data.serverId ? { ...s, status: data.status } : s));
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
        };

        return () => {
          if (wsRef.current) wsRef.current.close();
        };
      } catch (err) {
        // socket fail
      }
    } else {
      // Fallback REST polling for proxy mode
      const getLogs = async () => {
        try {
          const data = await apiFetch(`/api/servers/${selectedServerId}/logs`);
          setLogs(data || []);
        } catch (e) {
          // logs fail
        }
      };
      
      getLogs();
      const logsTimer = setInterval(getLogs, 1500);
      return () => clearInterval(logsTimer);
    }
  }, [selectedServerId, isConnected, connectionMode, daemonUrl]);

  // Send power commands to server
  const sendPowerAction = async (action) => {
    if (!selectedServerId) return;
    
    // Optimistic UI update: instantly reflect power status change in 0ms
    const targetStatus = action === 'start' ? 'starting' : action === 'stop' ? 'stopping' : action === 'kill' ? 'offline' : 'starting';
    setServers(prev => prev.map(s => s.id === selectedServerId ? { ...s, status: targetStatus } : s));

    let warningMsg = '';
    if (action === 'start') warningMsg = 'Booting Minecraft JVM...';
    if (action === 'stop') warningMsg = 'Shutting down Minecraft server...';
    if (action === 'kill') warningMsg = 'Killing process forcefully...';
    if (action === 'restart') warningMsg = 'Rebooting Minecraft server...';

    showToast(warningMsg, action === 'stop' || action === 'kill' ? 'warn' : 'info');

    try {
      const res = await apiFetch(`/api/servers/${selectedServerId}/power`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      if (res.success) {
        showToast(res.message, 'success');
        // trigger quick refresh
        fetchServers();
      }
    } catch (e) {
      showToast(`Error executing power command: ${e.message}`, 'error');
      fetchServers();
    }
  };

  // Send Custom Console Command
  const sendConsoleCommand = async (command) => {
    if (!selectedServerId) return;
    if (connectionMode === 'direct' && wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'command', command }));
    } else {
      // HTTP API Fallback
      try {
        await apiFetch(`/api/servers/${selectedServerId}/console`, {
          method: 'POST',
          body: JSON.stringify({ command })
        });
      } catch (err) {
        showToast(`Failed to execute command: ${err.message}`, 'error');
      }
    }
  };

  const activeServerInfo = servers.find(s => s.id === selectedServerId);

  // Render Subpages
  const renderSubpage = () => {
    // Always allow the settings tab to render so the user can enter/update their daemon URL
    if (activeTab === 'settings') {
      return (
        <Settings 
          daemonUrl={daemonUrl}
          setDaemonUrl={(url) => {
            setDaemonUrl(url);
            localStorage.setItem('obsidian_daemon_url', url);
          }}
          connectionMode={connectionMode}
          setConnectionMode={(mode) => {
            setConnectionMode(mode);
            localStorage.setItem('obsidian_connection_mode', mode);
          }}
          activeServer={activeServerInfo}
          serverId={selectedServerId}
          apiFetch={apiFetch}
          showToast={showToast}
        />
      );
    }

    if (!isConnected) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-obsidian-950 text-slate-300 font-sans">
          <div className="max-w-md w-full glass-panel p-6 rounded-2xl space-y-4 border border-obsidian-700">
            <h3 className="font-bold text-white text-base text-center">Connect Local API Daemon</h3>
            <div className="space-y-3">
              <input
                type="text"
                defaultValue={daemonUrl}
                placeholder="Paste your Daemon Link (e.g. https://xxx.trycloudflare.com)"
                id="offline_daemon_url_input"
                className="w-full bg-obsidian-900 border border-obsidian-700 focus:border-mcgreen-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
              />
              <button 
                onClick={() => {
                  const val = document.getElementById('offline_daemon_url_input')?.value?.trim();
                  if (val) {
                    setDaemonUrl(val);
                    localStorage.setItem('obsidian_daemon_url', val);
                    showToast('Connecting to daemon...', 'info');
                  }
                }}
                className="w-full bg-mcgreen-500 hover:bg-mcgreen-600 text-obsidian-950 font-bold py-2 rounded-xl text-xs transition-all shadow-lg shadow-mcgreen-500/20"
              >
                Connect Daemon
              </button>
            </div>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <Overview 
            activeServer={activeServerInfo} 
            telemetry={telemetry} 
            sendPowerAction={sendPowerAction}
            sendConsoleCommand={sendConsoleCommand}
            setActiveTab={setActiveTab}
            apiFetch={apiFetch}
            serverId={selectedServerId}
          />
        );
      case 'console':
        return (
          <Console 
            logs={logs} 
            sendConsoleCommand={sendConsoleCommand} 
            clearConsole={() => setLogs([])}
          />
        );
      case 'players':
        return (
          <Players 
            apiFetch={apiFetch} 
            serverId={selectedServerId} 
            showToast={showToast}
          />
        );
      case 'plugins':
        return (
          <Plugins 
            apiFetch={apiFetch} 
            serverId={selectedServerId} 
            activeServer={activeServerInfo}
            showToast={showToast}
            daemonUrl={daemonUrl}
          />
        );
      case 'files':
        return (
          <Files 
            apiFetch={apiFetch} 
            serverId={selectedServerId} 
            showToast={showToast}
          />
        );
      case 'backups':
        return (
          <Backups 
            apiFetch={apiFetch} 
            serverId={selectedServerId} 
            showToast={showToast}
            daemonUrl={daemonUrl}
          />
        );
      case 'settings':
        return (
          <Settings 
            daemonUrl={daemonUrl}
            setDaemonUrl={(url) => {
              setDaemonUrl(url);
              localStorage.setItem('obsidian_daemon_url', url);
            }}
            connectionMode={connectionMode}
            setConnectionMode={(mode) => {
              setConnectionMode(mode);
              localStorage.setItem('obsidian_connection_mode', mode);
            }}
            activeServer={activeServerInfo}
            serverId={selectedServerId}
            apiFetch={apiFetch}
            showToast={showToast}
          />
        );
      case 'map':
        return (
          <BlueMap 
            serverId={selectedServerId}
            activeServer={activeServerInfo}
            daemonUrl={daemonUrl}
            apiFetch={apiFetch}
            showToast={showToast}
          />
        );
      default:
        return <div className="text-center text-xs text-slate-400 p-12">Page not found</div>;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden text-slate-200 bg-obsidian-950 font-sans">
      
      {/* MOBILE BACKDROP OVERLAY */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden transition-opacity"
        />
      )}

      {/* SIDEBAR NAVIGATION (Desktop + Mobile Off-Canvas Drawer) */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 md:w-64 bg-obsidian-900 border-r border-obsidian-700 flex flex-col shrink-0
        transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        
        {/* Mobile Close Button & Brand Header */}
        <div className="p-4 border-b border-obsidian-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mcgreen-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-mcgreen-500/20">
              <Box className="w-6 h-6 text-obsidian-950 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-white text-base leading-none">
                OBSIDIAN<span className="text-mcgreen-500">NODE</span>
              </h1>
              <span className="text-[11px] font-mono text-slate-400">Panel v3.4.0-RELEASE</span>
            </div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Server Selector */}
        <div className="p-3 border-b border-obsidian-700/60">
          <div className="relative">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-700 rounded-lg p-2.5 flex items-center justify-between text-left transition-all"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  activeServerInfo?.status === 'online' ? 'bg-mcgreen-500 animate-pulse' :
                  activeServerInfo?.status === 'starting' ? 'bg-amber-500 animate-spin' :
                  activeServerInfo?.status === 'stopping' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                }`} />
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate">
                    {activeServerInfo?.name || 'Loading Node...'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {activeServerInfo ? `${activeServerInfo.version} • ${activeServerInfo.port}` : '...'}
                  </p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Server Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-obsidian-850 border border-obsidian-700 rounded-lg shadow-2xl z-50 py-1 overflow-hidden">
                {servers.map(server => (
                  <button 
                    key={server.id}
                    onClick={() => {
                      setSelectedServerId(server.id);
                      setIsDropdownOpen(false);
                      setIsMobileMenuOpen(false);
                      showToast(`Switched active context to ${server.name}`, 'info');
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-obsidian-700 flex items-center justify-between text-slate-300 hover:text-white font-medium"
                  >
                    <span>{server.name}</span>
                    <span className={`w-2 h-2 rounded-full ${
                      server.status === 'online' ? 'bg-mcgreen-500' :
                      server.status === 'starting' || server.status === 'stopping' ? 'bg-amber-500' : 'bg-rose-500'
                    }`} />
                  </button>
                ))}
                {servers.length === 0 && (
                  <p className="text-[10px] text-slate-500 p-2 text-center">No active servers found</p>
                )}
                <div className="border-t border-obsidian-700 mt-1 pt-1 px-2">
                  <button 
                    onClick={() => {
                      showToast("Please create a folder in your 'Servers' directory to deploy a new server.", 'info');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs text-mcgreen-400 hover:text-mcgreen-500 font-medium flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Deploy New Server Slot
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {[
            { id: 'overview', label: 'Overview & Telemetry', icon: Box },
            { id: 'console', label: 'Live Console', icon: Terminal },
            { id: 'players', label: 'Players Manager', icon: Users, badge: activeServerInfo?.onlinePlayers },
            { id: 'plugins', label: 'Plugins & Mods', icon: Puzzle },
            { id: 'files', label: 'File Explorer', icon: FolderTree },
            { id: 'map', label: '3D BlueMap', icon: Globe },
            { id: 'backups', label: 'Backups & Vault', icon: HardDriveDownload },
            { id: 'settings', label: 'Server Settings', icon: Sliders }
          ].map(nav => {
            const Icon = nav.icon;
            const isActive = activeTab === nav.id;
            return (
              <button 
                key={nav.id}
                onClick={() => {
                  setActiveTab(nav.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-all ${
                  isActive 
                    ? 'bg-mcgreen-500/10 text-mcgreen-400 border border-mcgreen-500/30 font-semibold' 
                    : 'text-slate-400 hover:text-slate-100 hover:bg-obsidian-800 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  {nav.label}
                </div>
                {nav.badge !== undefined && nav.badge > 0 && (
                  <span className="bg-mcgreen-500/20 text-mcgreen-400 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                    {nav.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Hardware Footprint */}
        {isConnected && telemetry && (
          <div className="p-3 m-3 bg-obsidian-850 rounded-xl border border-obsidian-700/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-mcgreen-400" /> Host Node
              </span>
              <span className="text-[10px] bg-emerald-950 text-mcgreen-400 border border-mcgreen-500/30 px-1.5 py-0.5 rounded font-mono">
                {telemetry.hostTotalRamGb}GB Host
              </span>
            </div>
            <div className="space-y-2 text-[11px]">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Host CPU</span>
                  <span className="font-mono text-slate-200">{telemetry.hostCpuPercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-obsidian-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-mcgreen-500 rounded-full transition-all duration-500" 
                    style={{ width: `${telemetry.hostCpuPercent}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>World Size</span>
                  <span className="font-mono text-slate-200">
                    {telemetry.worldSizeFormatted ? telemetry.worldSizeFormatted : `${(telemetry.worldSizeMb !== undefined ? Number(telemetry.worldSizeMb) : 0.09).toFixed(2)} MB`}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-obsidian-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-400 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.max(10, ((telemetry.worldSizeMb || 0) / 100) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Card */}
        <div className="p-3 border-t border-obsidian-700 flex items-center justify-between bg-obsidian-900">
          <div className="flex items-center gap-2.5">
            <img 
              src="https://mc-heads.net/avatar/Steve" 
              alt="Admin Avatar" 
              className="w-8 h-8 rounded-lg border border-obsidian-600 bg-obsidian-800"
            />
            <div>
              <p className="text-xs font-semibold text-white">Owner</p>
              <p className="text-[10px] text-mcgreen-400 font-mono">Node Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-obsidian-950 min-w-0">
        
        {/* HEADER BAR */}
        <header className="py-2.5 px-3 md:px-6 bg-obsidian-900 border-b border-obsidian-700 flex flex-wrap items-center justify-between gap-2 shrink-0 font-sans">
          
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Hamburger Button for Mobile */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-700 text-slate-300"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-bold text-white tracking-tight truncate">
                  {activeServerInfo?.name || 'Select Server Slot'}
                </h2>
                {activeServerInfo && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                    activeServerInfo.status === 'online' ? 'bg-mcgreen-500/15 text-mcgreen-400 border-mcgreen-500/30' :
                    activeServerInfo.status === 'starting' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                    activeServerInfo.status === 'stopping' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                    'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      activeServerInfo.status === 'online' ? 'bg-mcgreen-500 animate-ping' :
                      activeServerInfo.status === 'starting' || activeServerInfo.status === 'stopping' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                    }`} />
                    {activeServerInfo.status.toUpperCase()}
                  </span>
                )}

                {/* Quick Server IP Copy Pill */}
                {activeServerInfo && (
                  <button
                    onClick={() => {
                      const serverIp = activeServerInfo.ip || activeServerInfo.serverIp || (activeServerInfo.id === 'Server2' ? 'mutant-shaving.tun.ply.gg' : 'wills-nederland.tun.ply.gg');
                      navigator.clipboard.writeText(serverIp);
                      showToast(`Copied ${serverIp} to clipboard!`, 'success');
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 transition-all cursor-pointer shrink-0"
                    title="Click to copy Server IP"
                  >
                    <Globe className="w-3 h-3 text-blue-400" />
                    <span>{activeServerInfo.ip || activeServerInfo.serverIp || (activeServerInfo.id === 'Server2' ? 'mutant-shaving.tun.ply.gg' : 'wills-nederland.tun.ply.gg')}</span>
                    <Copy className="w-2.5 h-2.5 text-blue-400 opacity-80" />
                  </button>
                )}

                {/* Small Auto-Shutdown Timer Badge with Hover Tooltip */}
                {activeServerInfo?.status === 'online' && (
                  <div 
                    className="group relative inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 cursor-help shrink-0"
                    title="15-Minute Empty Server Auto-Shutdown Timer"
                  >
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>
                      {(() => {
                        const sec = telemetry?.idleSecondsRemaining;
                        if (sec === undefined || sec === null) return '15m 00s';
                        const m = Math.floor(sec / 60);
                        const s = sec % 60;
                        return `${m}m ${s < 10 ? '0' : ''}${s}s`;
                      })()}
                    </span>

                    {/* Hover Info Tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 hidden group-hover:block z-50 w-52 p-2.5 bg-obsidian-950 text-slate-200 text-[10px] rounded-xl border border-obsidian-700 shadow-2xl font-sans text-center leading-relaxed">
                      <div className="font-bold text-amber-400 flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3" /> Auto-Shutdown Timer
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1">
                        {(telemetry?.playersCount || 0) === 0 
                          ? 'Server empty (0 players). Automatically turns off server when timer reaches 00m 00s.' 
                          : 'Timer is paused while players are active online.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Power Actions Hub */}
          {isConnected && activeServerInfo && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button 
                onClick={() => sendPowerAction('start')}
                disabled={activeServerInfo.status !== 'offline'}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  activeServerInfo.status === 'offline' 
                    ? 'bg-mcgreen-500 text-obsidian-950 hover:bg-mcgreen-600 shadow-md shadow-mcgreen-500/20 active:scale-95' 
                    : 'bg-obsidian-800 text-slate-500 cursor-not-allowed border border-obsidian-700'
                }`}
              >
                <Power className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Start</span>
              </button>
              
              <button 
                onClick={() => sendPowerAction('restart')}
                disabled={activeServerInfo.status === 'offline'}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  activeServerInfo.status !== 'offline' 
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 active:scale-95' 
                    : 'bg-obsidian-800 text-slate-500 cursor-not-allowed border border-obsidian-700'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Restart</span>
              </button>

              <button 
                onClick={() => sendPowerAction('stop')}
                disabled={activeServerInfo.status === 'offline' || activeServerInfo.status === 'stopping'}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  activeServerInfo.status !== 'offline' && activeServerInfo.status !== 'stopping'
                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 active:scale-95' 
                    : 'bg-obsidian-800 text-slate-500 cursor-not-allowed border border-obsidian-700'
                }`}
              >
                Stop
              </button>
            </div>
          )}
        </header>

        {/* SUBPAGE VIEW */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 pb-24 md:pb-6">
          {renderSubpage()}
        </div>

        {/* MOBILE QUICK NAVIGATION BOTTOM BAR */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-obsidian-900/95 backdrop-blur-md border-t border-obsidian-700/80 px-2 py-2 flex justify-around items-center">
          {[
            { id: 'overview', label: 'Overview', icon: Box },
            { id: 'console', label: 'Console', icon: Terminal },
            { id: 'players', label: 'Players', icon: Users },
            { id: 'plugins', label: 'Mods', icon: Puzzle },
            { id: 'files', label: 'Files', icon: FolderTree },
            { id: 'map', label: '3D BlueMap', icon: Globe },
            { id: 'settings', label: 'Settings', icon: Sliders }
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] transition-all ${
                  isActive ? 'text-mcgreen-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </main>

    </div>
  );
}
