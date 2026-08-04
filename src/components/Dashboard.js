'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Terminal, Users, Puzzle, FolderTree, HardDriveDownload, 
  Sliders, ChevronDown, PlusCircle, Cpu, LogOut, CheckCircle, 
  AlertTriangle, AlertOctagon, Info, Bell, Power
} from 'lucide-react';

import Overview from './Overview';
import Console from './Console';
import Players from './Players';
import Plugins from './Plugins';
import Files from './Files';
import Backups from './Backups';
import Settings from './Settings';

export default function Dashboard() {
  // Navigation & Settings State
  const [activeTab, setActiveTab] = useState('overview');
  const [daemonUrl, setDaemonUrl] = useState('http://localhost:3001');
  const [connectionMode, setConnectionMode] = useState('direct'); // 'direct' or 'proxy'
  const [isConnected, setIsConnected] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Servers & Active Server
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [activeServer, setActiveServer] = useState(null);
  
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
    if (savedUrl) setDaemonUrl(savedUrl);
    
    const savedMode = localStorage.getItem('obsidian_connection_mode');
    if (savedMode) {
      setConnectionMode(savedMode);
    } else if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
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

  // General Fetch Client that supports Proxy or Direct calls
  const apiFetch = async (endpoint, options = {}) => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    let url;
    const headers = new Headers(options.headers || {});
    headers.set('bypass-tunnel-reminder', 'true');
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    
    if (connectionMode === 'proxy') {
      url = `/api/proxy${cleanEndpoint}`;
      headers.set('x-target-url', daemonUrl);
    } else {
      url = `${daemonUrl}${cleanEndpoint}`;
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
      setIsConnected(false);
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
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-obsidian-950 text-slate-300">
          <div className="max-w-md w-full glass-panel p-6 rounded-2xl text-center space-y-4 border border-rose-500/25">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Daemon Offline</h3>
              <p className="text-xs text-slate-400 mt-1">
                Could not connect to the local ObsidianNode daemon. Please ensure the local API daemon is running on your PC.
              </p>
            </div>
            <div className="bg-obsidian-900 border border-obsidian-700 rounded-xl p-3 text-left space-y-2 text-xs">
              <p className="font-semibold text-slate-200">Troubleshooting Steps:</p>
              <ol className="list-decimal pl-4 space-y-1.5 text-slate-400">
                <li>Double-click <code className="text-mcgreen-400 font-mono">run-daemon.bat</code> in your server directory.</li>
                <li>Copy the generated <code className="text-mcgreen-400 font-mono">https://*.loca.lt</code> URL from the terminal logs.</li>
                <li>Enter the tunnel URL in the settings tab below.</li>
              </ol>
            </div>
            <button 
              onClick={() => setActiveTab('settings')}
              className="w-full bg-mcgreen-500 hover:bg-mcgreen-600 text-obsidian-950 font-bold py-2 rounded-xl text-xs border border-mcgreen-500 transition-colors shadow-lg shadow-mcgreen-500/20"
            >
              Configure Settings
            </button>
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
            showToast={showToast}
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
      default:
        return <div className="text-center text-xs text-slate-400 p-12">Page not found</div>;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden text-slate-200">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-obsidian-900 border-r border-obsidian-700 flex flex-col z-20 shrink-0">
        
        {/* Brand & Server Switcher */}
        <div className="p-4 border-b border-obsidian-700">
          <div className="flex items-center gap-3 mb-4">
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

          {/* Active Server Selector */}
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
            { id: 'backups', label: 'Backups & Vault', icon: HardDriveDownload },
            { id: 'settings', label: 'Server Settings', icon: Sliders }
          ].map(nav => {
            const Icon = nav.icon;
            const isActive = activeTab === nav.id;
            return (
              <button 
                key={nav.id}
                onClick={() => setActiveTab(nav.id)}
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
                  <span>Host Memory</span>
                  <span className="font-mono text-slate-200">
                    {telemetry.hostUsedRamGb} / {telemetry.hostTotalRamGb} GB
                  </span>
                </div>
                <div className="w-full h-1.5 bg-obsidian-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                    style={{ width: `${(telemetry.hostUsedRamGb / telemetry.hostTotalRamGb) * 100}%` }}
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
          <button 
            onClick={() => showToast('Session logged out (Simulation)', 'info')} 
            className="text-slate-400 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-obsidian-800"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-obsidian-950">
        
        {/* HEADER BAR */}
        <header className="h-16 bg-obsidian-900 border-b border-obsidian-700 px-6 flex items-center justify-between shrink-0 font-sans">
          
          {/* Active Server Power & Title Status */}
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  {activeServerInfo?.name || 'Select Server Slot'}
                </h2>
                {activeServerInfo && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
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
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                <span className="font-mono text-slate-300">
                  Address: {activeServerInfo ? `mutant-shaving.tun.ply.gg:${activeServerInfo.port}` : 'None'}
                </span>
                {activeServerInfo?.status === 'online' && telemetry && (
                  <>
                    <span>•</span>
                    <span>Uptime: <strong className="text-slate-200 font-mono">
                      {Math.floor(telemetry.uptimeSeconds / 3600)}h {Math.floor((telemetry.uptimeSeconds % 3600) / 60)}m {telemetry.uptimeSeconds % 60}s
                    </strong></span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick Power Actions Hub */}
          {isConnected && activeServerInfo && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => sendPowerAction('start')}
                disabled={activeServerInfo.status !== 'offline'}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeServerInfo.status === 'offline' 
                    ? 'bg-mcgreen-500 text-obsidian-950 hover:bg-mcgreen-600 shadow-md shadow-mcgreen-500/20 active:scale-95' 
                    : 'bg-obsidian-800 text-slate-500 cursor-not-allowed border border-obsidian-700'
                }`}
              >
                <Power className="w-3.5 h-3.5" /> Start
              </button>
              
              <button 
                onClick={() => sendPowerAction('restart')}
                disabled={activeServerInfo.status === 'offline'}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeServerInfo.status !== 'offline' 
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 active:scale-95' 
                    : 'bg-obsidian-800 text-slate-500 cursor-not-allowed border border-obsidian-700'
                }`}
              >
                Restart
              </button>

              <button 
                onClick={() => sendPowerAction('stop')}
                disabled={activeServerInfo.status === 'offline' || activeServerInfo.status === 'stopping'}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeServerInfo.status !== 'offline' && activeServerInfo.status !== 'stopping'
                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 active:scale-95' 
                    : 'bg-obsidian-800 text-slate-500 cursor-not-allowed border border-obsidian-700'
                }`}
              >
                Stop
              </button>

              <button 
                onClick={() => {
                  if (confirm('Are you sure you want to kill the server process? Unsaved data may be lost.')) {
                    sendPowerAction('kill');
                  }
                }}
                disabled={activeServerInfo.status === 'offline'}
                className={`p-2 rounded-lg transition-all ${
                  activeServerInfo.status !== 'offline'
                    ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30'
                    : 'text-slate-600 cursor-not-allowed'
                }`}
                title="Force Kill Process"
              >
                Kill
              </button>

              <div className="h-6 w-px bg-obsidian-700 mx-1" />

              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 rounded-lg bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-700 text-slate-300 hover:text-white relative transition-all"
                >
                  <Bell className="w-4 h-4" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-mcgreen-500 rounded-full ring-2 ring-obsidian-900" />
                  )}
                </button>

                {/* Notifications Drawer */}
                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-obsidian-850 border border-obsidian-700 rounded-xl shadow-2xl z-50 p-3 space-y-2">
                    <div className="flex justify-between items-center pb-2 border-b border-obsidian-700">
                      <span className="text-xs font-bold text-white">Notifications</span>
                      <button onClick={() => setNotifications([])} className="text-[10px] text-mcgreen-400 hover:underline">Clear all</button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {notifications.map(n => (
                        <div key={n.id} className="p-2 bg-obsidian-800/60 rounded-lg text-xs border border-obsidian-700">
                          <div className="flex items-center justify-between text-mcgreen-400 font-semibold mb-0.5">
                            <span className="flex items-center gap-1">{n.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{n.time}</span>
                          </div>
                          <p className="text-slate-300 text-[11px]">{n.desc}</p>
                        </div>
                      ))}
                      {notifications.length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-2">No pending notifications</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </header>

        {/* SUBPAGE CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {renderSubpage()}
        </div>

      </main>

      {/* TOAST CONTAINER */}
      {toast.visible && (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
          <div className={`pointer-events-auto px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md transition-all duration-300 transform translate-y-0 ${
            toast.type === 'success' ? 'border-mcgreen-500/40 text-mcgreen-400 bg-obsidian-900/95' :
            toast.type === 'warn' ? 'border-amber-500/40 text-amber-400 bg-obsidian-900/95' :
            toast.type === 'error' ? 'border-rose-500/40 text-rose-400 bg-obsidian-900/95' :
            'border-mcgreen-500/30 text-mcgreen-400 bg-obsidian-900/90'
          }`}>
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
            {toast.type === 'warn' && <AlertTriangle className="w-4 h-4 shrink-0" />}
            {toast.type === 'error' && <AlertOctagon className="w-4 h-4 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

    </div>
  );
}
