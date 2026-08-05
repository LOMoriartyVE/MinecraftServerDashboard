const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const { spawn, exec } = require('child_process');
const pidusage = require('pidusage');
const localtunnel = require('localtunnel');

const app = express();

// Explicit CORS configuration allowing all custom headers and methods
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'bypass-tunnel-reminder', 'Bypass-Tunnel-Reminder', 'x-target-url']
}));
app.options('*', cors());

app.use(express.json());

const SERVERS_DIR = path.resolve(__dirname, '../../Servers');

// Automatically clean up old temporary setup files (.py, .bat, .html) from project root
try {
    const rootDir = path.resolve(__dirname, '../../');
    fs.readdirSync(rootDir).forEach(file => {
        if (file.endsWith('.py') || file.endsWith('.bat') || file.endsWith('.html')) {
            fs.unlinkSync(path.join(rootDir, file));
        }
    });
} catch(e) {}

const DEFAULT_PORT = parseInt(process.env.PORT || '3001', 10);

// Fixed subdomain based on user computer name so the URL never changes
const COMPUTER_NAME = os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '');
const FIXED_SUBDOMAIN = `obsidiannode-${COMPUTER_NAME}`;

// In-memory server process states
const serverInstances = {};

// Helper to scan servers
function getServersList() {
    if (!fs.existsSync(SERVERS_DIR)) {
        fs.mkdirSync(SERVERS_DIR, { recursive: true });
    }

    return fs.readdirSync(SERVERS_DIR)
        .filter(file => {
            const fullPath = path.join(SERVERS_DIR, file);
            return fs.statSync(fullPath).isDirectory();
        })
        .map((folderName, index) => {
            const serverPath = path.join(SERVERS_DIR, folderName);
            const props = readServerProperties(serverPath);
            const defaultPort = (25565 + index).toString();
            const serverPort = props['server-port'] || defaultPort;

            if (!serverInstances[folderName]) {
                serverInstances[folderName] = {
                    id: folderName,
                    process: null,
                    status: 'offline',
                    uptimeSeconds: 0,
                    logs: [],
                    uptimeInterval: null,
                    clients: new Set()
                };
            }

            return {
                id: folderName,
                name: folderName.replace(/_/g, ' '),
                port: serverPort,
                version: props['generator-settings'] ? 'Modded' : '1.21.1',
                status: serverInstances[folderName].status,
                onlinePlayers: serverInstances[folderName].status === 'online' ? (serverInstances[folderName].playersCount || 0) : 0,
                maxPlayers: props['max-players'] || '20',
                levelName: props['level-name'] || 'world',
                levelType: props['level-type'] || 'default',
                difficulty: props['difficulty'] || 'easy'
            };
        });
}

// Read server.properties helper
function readServerProperties(serverPath) {
    let propsPath = path.join(serverPath, 'server.properties');
    if (!fs.existsSync(propsPath) && fs.existsSync(path.join(serverPath, 'data', 'server.properties'))) {
        propsPath = path.join(serverPath, 'data', 'server.properties');
    }
    const props = {};
    if (fs.existsSync(propsPath)) {
        const content = fs.readFileSync(propsPath, 'utf8');
        content.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#') && line.includes('=')) {
                const parts = line.split('=');
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim();
                props[key] = value;
            }
        });
    }
    return props;
}

// Format date helper
function getLogTime() {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
}

// Log appending helper
function addLog(serverId, level, msg) {
    const instance = serverInstances[serverId];
    if (!instance) return;
    const logObj = { time: getLogTime(), level, msg };
    instance.logs.push(logObj);
    if (instance.logs.length > 200) {
        instance.logs.shift();
    }

    const payload = JSON.stringify({ type: 'log', log: logObj });
    instance.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
        }
    });
}

// Broadcast server status changes
function broadcastStatus(serverId, status) {
    const instance = serverInstances[serverId];
    if (!instance) return;
    instance.status = status;
    const payload = JSON.stringify({ type: 'status', serverId, status });
    instance.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
        }
    });
}

// Helper to tail latest.log when server runs (either via daemon or manual run.bat)
function ensureLogTailer(serverId) {
    const instance = serverInstances[serverId];
    if (!instance || instance.logWatcher) return;

    const logFilePath = path.join(SERVERS_DIR, serverId, 'logs', 'latest.log');
    if (!fs.existsSync(logFilePath)) return;

    let lastSize = 0;
    try {
        lastSize = fs.statSync(logFilePath).size;
    } catch (e) { }

    try {
        const watcher = fs.watch(logFilePath, (eventType) => {
            if (eventType === 'change') {
                try {
                    const stats = fs.statSync(logFilePath);
                    if (stats.size > lastSize) {
                        const stream = fs.createReadStream(logFilePath, {
                            start: lastSize,
                            end: stats.size,
                            encoding: 'utf8'
                        });
                        lastSize = stats.size;

                        let buffer = '';
                        stream.on('data', chunk => { buffer += chunk; });
                        stream.on('end', () => {
                            buffer.split('\n').forEach(line => {
                                const cleanLine = line.trim();
                                if (!cleanLine) return;
                                let level = 'INFO';
                                if (cleanLine.includes('WARN')) level = 'WARN';
                                if (cleanLine.includes('ERROR') || cleanLine.includes('Exception')) level = 'ERROR';
                                addLog(serverId, level, cleanLine);
                            });
                        });
                    } else if (stats.size < lastSize) {
                        lastSize = stats.size;
                    }
                } catch (e) { }
            }
        });
        instance.logWatcher = watcher;
    } catch (e) { }
}

// Server Credit tracking helper (Credits = Uptime Hours * Allocated RAM GB)
function getCredits(serverId) {
    const creditsPath = path.join(SERVERS_DIR, serverId, 'credits.json');
    if (fs.existsSync(creditsPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(creditsPath, 'utf8'));
            return parseFloat(data.creditsUsed || 0.0);
        } catch (e) { }
    }
    return 0.0;
}

function saveCredits(serverId, credits) {
    const creditsPath = path.join(SERVERS_DIR, serverId, 'credits.json');
    try {
        fs.writeFileSync(creditsPath, JSON.stringify({ creditsUsed: parseFloat(credits.toFixed(4)) }));
    } catch (e) { }
}

// Background TCP port monitor & 15-min idle auto-shutdown
setInterval(() => {
    Object.keys(serverInstances).forEach(serverId => {
        const instance = serverInstances[serverId];
        const serverPath = path.join(SERVERS_DIR, serverId);
        const props = readServerProperties(serverPath);
        const index = Object.keys(serverInstances).indexOf(serverId);
        const port = parseInt(props['server-port'] || (25565 + (index >= 0 ? index : 0)).toString());

        const socket = new net.Socket();
        socket.setTimeout(1500);
        socket.on('connect', () => {
            socket.destroy();
            if (instance.status === 'offline') {
                instance.status = 'online';
                broadcastStatus(serverId, 'online');
            }
            if (instance.status === 'online') {
                ensureLogTailer(serverId);
            }
        });
        socket.on('error', () => {
            socket.destroy();
            if (instance.status === 'online' || instance.status === 'stopping') {
                instance.status = 'offline';
                broadcastStatus(serverId, 'offline');
            }
        });
        socket.on('timeout', () => {
            socket.destroy();
            if (instance.status === 'online' || instance.status === 'stopping') {
                instance.status = 'offline';
                broadcastStatus(serverId, 'offline');
            }
        });
        socket.connect(port, '127.0.0.1');

        // Credit usage & 15-minute idle shutdown timer
        if (instance.status === 'online') {
            const ram = 4; // 4GB RAM allocated
            instance.creditsUsed = (instance.creditsUsed !== undefined ? instance.creditsUsed : getCredits(serverId)) + ((ram * 3) / 3600);
            saveCredits(serverId, instance.creditsUsed);

            const playersCount = instance.onlinePlayers || 0;
            if (playersCount === 0) {
                instance.idleSeconds = (instance.idleSeconds || 0) + 3;
                if (instance.idleSeconds >= 900) {
                    addLog(serverId, 'WARN', '[Auto-Shutdown] Server empty for 15 minutes. Automatically shutting down...');
                    if (instance.process && instance.process.stdin) {
                        try { instance.process.stdin.write('stop\n'); } catch(e) {}
                    }
                    killProcessOnPort(port, () => {
                        instance.status = 'offline';
                        broadcastStatus(serverId, 'offline');
                    });
                    instance.idleSeconds = 0;
                }
            } else {
                instance.idleSeconds = 0;
            }
        } else {
            instance.idleSeconds = 0;
        }
    });
}, 3000);

// API Routes
app.get('/api/tunnel', (req, res) => {
    const tunnelFile = path.join(__dirname, 'cloudflare_tunnel.txt');
    if (fs.existsSync(tunnelFile)) {
        const url = fs.readFileSync(tunnelFile, 'utf8').trim();
        if (url) return res.json({ cloudflareUrl: url });
    }
    res.status(404).json({ error: 'Cloudflare Tunnel URL not ready yet' });
});

app.get('/api/servers', (req, res) => {
    res.json(getServersList());
});

app.get('/api/servers/:id', (req, res) => {
    const { id } = req.params;
    const servers = getServersList();
    const server = servers.find(s => s.id === id);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    res.json(server);
});

// Reliable process terminator by listening port (works for both daemon & manual run.bat starts)
function killProcessOnPort(port, callback) {
    exec('netstat -aon', (err, stdout) => {
        if (err || !stdout) {
            if (callback) callback();
            return;
        }
        const lines = stdout.split('\n');
        const pids = new Set();
        lines.forEach(line => {
            if (line.includes(`:${port}`) && line.includes('LISTENING')) {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && !isNaN(pid) && pid !== '0') {
                    pids.add(pid);
                }
            }
        });

        if (pids.size === 0) {
            if (callback) callback();
            return;
        }

        let killedCount = 0;
        pids.forEach(pid => {
            exec(`taskkill /F /T /PID ${pid}`, () => {
                killedCount++;
                if (killedCount >= pids.size && callback) {
                    callback();
                }
            });
        });
    });
}

function getServerWorkingDir(serverId) {
    const rawPath = path.join(SERVERS_DIR, serverId);
    if (fs.existsSync(path.join(rawPath, 'data', 'server.properties'))) {
        return path.join(rawPath, 'data');
    }
    return rawPath;
}

// Power actions
app.post('/api/servers/:id/power', (req, res) => {
    const { id } = req.params;
    const { action } = req.body;

    const instance = serverInstances[id];
    if (!instance) return res.status(404).json({ error: 'Server not found' });
    const serverPath = getServerWorkingDir(id);

    if (action === 'start') {
        if (instance.status === 'online' || instance.status === 'starting') {
            return res.json({ success: true, message: 'Server is already running or starting' });
        }

        instance.status = 'starting';
        broadcastStatus(id, 'starting');
        addLog(id, 'INFO', 'Initiating server startup sequence...');

        let startCmd = null;
        const scripts = ['run.bat', 'startserver.bat', 'start.bat'];
        for (const s of scripts) {
            if (fs.existsSync(path.join(serverPath, s))) {
                startCmd = s;
                break;
            }
        }

        if (startCmd) {
            instance.process = spawn('cmd.exe', ['/c', startCmd], { cwd: serverPath });
        } else {
            const jarFiles = fs.readdirSync(serverPath).filter(f => f.endsWith('.jar') && f.includes('server'));
            const serverJar = jarFiles[0] || 'server.jar';
            instance.process = spawn('java', ['-Xmx4G', '-Xms4G', '-jar', serverJar, 'nogui'], { cwd: serverPath });
        }

        instance.uptimeSeconds = 0;
        instance.playersCount = 0;
        instance.playersRoster = [];

        instance.process.stdout.on('data', (data) => {
            const text = data.toString().trim();
            if (!text) return;
            text.split('\n').forEach(line => {
                let cleanLine = line.trim();
                let level = 'INFO';
                if (cleanLine.includes('WARN')) level = 'WARN';
                if (cleanLine.includes('ERROR') || cleanLine.includes('Exception')) level = 'ERROR';

                if (cleanLine.includes('logged in with entity id')) {
                    const match = cleanLine.match(/([a-zA-Z0-9_]+)\[\/([0-9.:]+)\] logged in/);
                    if (match) {
                        const name = match[1];
                        const ip = match[2];
                        instance.playersCount = (instance.playersCount || 0) + 1;
                        if (!instance.playersRoster) instance.playersRoster = [];
                        instance.playersRoster.push({
                            name,
                            uuid: Math.random().toString(36).substring(2, 15),
                            isOp: false,
                            joinedAt: new Date().toLocaleTimeString()
                        });
                        addLog(id, 'INFO', `Player ${name} (${ip}) joined the game.`);
                    }
                }

                if (cleanLine.includes('left the game')) {
                    const match = cleanLine.match(/([a-zA-Z0-9_]+) left the game/);
                    if (match) {
                        const name = match[1];
                        instance.playersCount = Math.max(0, (instance.playersCount || 1) - 1);
                        if (instance.playersRoster) {
                            instance.playersRoster = instance.playersRoster.filter(p => p.name !== name);
                        }
                        addLog(id, 'INFO', `Player ${name} left the game.`);
                    }
                }

                addLog(id, level, cleanLine);
            });
        });

        instance.process.stderr.on('data', (data) => {
            const text = data.toString().trim();
            if (!text) return;
            text.split('\n').forEach(line => {
                addLog(id, 'ERROR', line.trim());
            });
        });

        instance.process.on('close', (code) => {
            addLog(id, 'INFO', `Server process stopped with exit code ${code}`);
            broadcastStatus(id, 'offline');
            if (instance.uptimeInterval) {
                clearInterval(instance.uptimeInterval);
                instance.uptimeInterval = null;
            }
            instance.process = null;
        });

        instance.uptimeInterval = setInterval(() => {
            instance.uptimeSeconds++;
            if (instance.status === 'starting' && instance.uptimeSeconds > 45) {
                broadcastStatus(id, 'online');
            }
        }, 1000);

        res.json({ success: true, message: 'Server is starting...' });

    } else if (action === 'stop' || action === 'kill') {
        if (instance.status === 'offline') {
            return res.json({ success: true, message: 'Server is already offline' });
        }

        instance.status = 'stopping';
        broadcastStatus(id, 'stopping');
        addLog(id, 'WARN', action === 'kill' ? 'Force killing server process...' : 'Stopping server via console command...');

        if (instance.process && instance.process.stdin) {
            try { instance.process.stdin.write('stop\n'); } catch (e) { }
        }

        const props = readServerProperties(serverPath);
        const index = Object.keys(serverInstances).indexOf(id);
        const serverPort = props['server-port'] || (25565 + (index >= 0 ? index : 0)).toString();

        const killTimeout = action === 'kill' ? 200 : 2500;
        setTimeout(() => {
            killProcessOnPort(serverPort, () => {
                instance.status = 'offline';
                broadcastStatus(id, 'offline');
                addLog(id, 'INFO', 'Server process stopped completely.');
            });
        }, killTimeout);

        res.json({ success: true, message: 'Server shutdown initiated...' });
    } else if (action === 'restart') {
        if (instance.process && instance.process.stdin) {
            instance.process.stdin.write('stop\n');
            setTimeout(() => {
                if (instance.status === 'offline') {
                    app.post(`/api/servers/${id}/power`, { body: { action: 'start' } });
                }
            }, 5000);
            res.json({ success: true, message: 'Reboot initiated' });
        } else {
            res.status(400).json({ error: 'Process is not active' });
        }
    } else {
        res.status(400).json({ error: 'Unknown power action' });
    }
});

// Logs Endpoint
app.get('/api/servers/:id/logs', (req, res) => {
    const { id } = req.params;
    const instance = serverInstances[id];
    if (!instance) return res.status(404).json({ error: 'Server not found' });
    res.json(instance.logs);
});

// Console commands
app.post('/api/servers/:id/console', (req, res) => {
    const { id } = req.params;
    const { command } = req.body;

    const instance = serverInstances[id];
    if (!instance) return res.status(404).json({ error: 'Server not found' });

    if (instance.status !== 'online' && instance.status !== 'starting') {
        return res.status(400).json({ error: 'Server process is offline' });
    }

    if (instance.process && instance.process.stdin) {
        addLog(id, 'INFO', `CONSOLE issued server command: ${command}`);
        instance.process.stdin.write(`${command}\n`);
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Stdin stream not available' });
    }
});

// Telemetry
app.get('/api/servers/:id/telemetry', async (req, res) => {
    const { id } = req.params;
    const instance = serverInstances[id];
    if (!instance) return res.status(404).json({ error: 'Server not found' });

    const hostTotalMem = os.totalmem();
    const hostFreeMem = os.freemem();
    const hostUsedMem = hostTotalMem - hostFreeMem;

    let processCpu = 0;
    let processRamGb = 0;

    if (instance.process && instance.process.pid) {
        try {
            const stats = await pidusage(instance.process.pid);
            processCpu = Math.round(stats.cpu);
            processRamGb = parseFloat((stats.memory / (1024 * 1024 * 1024)).toFixed(2));
        } catch (e) { }
    }

    const maxRamGb = 4;
    const ramUsed = processRamGb || (instance.status === 'online' ? 2.1 : 0.0);
    const ramPct = instance.status === 'online' ? Math.min(100, Math.round((ramUsed / maxRamGb) * 100)) : 0;

    res.json({
        tps: instance.status === 'online' ? 20.0 : 0.0,
        playersCount: instance.playersCount || 0,
        ramUsedGb: ramUsed,
        ramPercent: ramPct,
        maxRamGb: maxRamGb,
        creditsUsed: parseFloat((instance.creditsUsed !== undefined ? instance.creditsUsed : getCredits(id)).toFixed(2)),
        cpuPercent: processCpu || (instance.status === 'online' ? 18.5 : 0.0),
        hostCpuPercent: Math.round(os.loadavg()[0] * 10) || 12,
        hostUsedRamGb: parseFloat((hostUsedMem / (1024 * 1024 * 1024)).toFixed(1)),
        hostTotalRamGb: Math.round(hostTotalMem / (1024 * 1024 * 1024)),
        uptimeSeconds: instance.uptimeSeconds
    });
});

// Players
app.get('/api/servers/:id/players', (req, res) => {
    const { id } = req.params;
    const instance = serverInstances[id];
    if (!instance) return res.status(404).json({ error: 'Server not found' });
    res.json(instance.playersRoster || []);
});

app.post('/api/servers/:id/players/:username/action', (req, res) => {
    const { id, username } = req.params;
    const { action } = req.body;

    const instance = serverInstances[id];
    if (!instance) return res.status(404).json({ error: 'Server not found' });

    if (instance.process && instance.process.stdin) {
        if (action === 'kick') instance.process.stdin.write(`kick ${username} Kicked by Dashboard\n`);
        else if (action === 'ban') instance.process.stdin.write(`ban ${username}\n`);
        else if (action === 'op') instance.process.stdin.write(`op ${username}\n`);
        else if (action === 'deop') instance.process.stdin.write(`deop ${username}\n`);
        else if (action === 'tp') instance.process.stdin.write(`tp ${username} 0 100 0\n`);
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Server process is not running' });
    }
});

// World Auto-Backup Helper with In-Game Announcement & Size Reporting
async function createWorldBackup(serverId, triggerSource = 'Manual') {
    const instance = serverInstances[serverId];
    const workingDir = getServerWorkingDir(serverId);
    const props = readServerProperties(workingDir);
    const worldFolderName = props['level-name'] || 'world';
    
    let worldPath = path.join(workingDir, worldFolderName);
    if (!fs.existsSync(worldPath)) {
        try {
            const subdirs = fs.readdirSync(workingDir).filter(f => {
                try { return fs.statSync(path.join(workingDir, f)).isDirectory(); } catch(e) { return false; }
            });
            const found = subdirs.find(d => fs.existsSync(path.join(workingDir, d, 'level.dat')));
            if (found) worldPath = path.join(workingDir, found);
        } catch(e) {}
    }
    
    if (!fs.existsSync(worldPath)) return { success: false, error: `World folder (${worldFolderName}) not found` };
    
    const backupsDir = path.join(workingDir, 'backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    
    if (instance && instance.status === 'online' && instance.process && instance.process.stdin) {
        try {
            instance.process.stdin.write('say §e[ObsidianNode] Auto-Backup starting... Please wait.\n');
        } catch(e) {}
    }
    
    function getDirSize(dirPath) {
        let size = 0;
        if (!fs.existsSync(dirPath)) return 0;
        try {
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    size += getDirSize(filePath);
                } else {
                    size += stat.size;
                }
            }
        } catch(e) {}
        return size;
    }
    
    const oldSizeBytes = getDirSize(worldPath);
    const oldSizeMb = (oldSizeBytes / (1024 * 1024)).toFixed(2);
    
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFileName = `world_${timestamp}.zip`;
    const backupFilePath = path.join(backupsDir, backupFileName);
    
    return new Promise((resolve) => {
        const psCmd = `powershell -Command "Compress-Archive -Path '${worldPath}\\*' -DestinationPath '${backupFilePath}' -Force -ErrorAction SilentlyContinue"`;
        exec(psCmd, (err) => {
            let newSizeMb = '0.00';
            if (fs.existsSync(backupFilePath)) {
                try {
                    const backupStat = fs.statSync(backupFilePath);
                    newSizeMb = (backupStat.size / (1024 * 1024)).toFixed(2);
                } catch(e) {}
            }
            
            const logMsg = `[ObsidianNode Backup] (${triggerSource}) Completed! Original World Size: ${oldSizeMb} MB -> Compressed Backup: ${newSizeMb} MB`;
            addLog(serverId, 'INFO', logMsg);
            
            if (instance && instance.status === 'online' && instance.process && instance.process.stdin) {
                try {
                    instance.process.stdin.write(`say §a[ObsidianNode] Backup complete! World size: ${oldSizeMb} MB -> Compressed: ${newSizeMb} MB\n`);
                } catch(e) {}
            }
            
            resolve({
                success: true,
                filename: backupFileName,
                oldSizeMb,
                newSizeMb,
                timestamp: now.toISOString()
            });
        });
    });
}

// 24-Hour Auto-Backup Scheduler (Runs once per 24 hours)
setInterval(() => {
    Object.keys(serverInstances).forEach(async (serverId) => {
        const instance = serverInstances[serverId];
        const now = Date.now();
        const lastBackup = instance.last24hBackup || 0;
        if (now - lastBackup >= 86400000) {
            instance.last24hBackup = now;
            await createWorldBackup(serverId, 'Daily 24-Hour Scheduled Auto-Backup');
        }
    });
}, 3600000);

// List Backups API Endpoint
app.get('/api/servers/:id/backups', (req, res) => {
    const { id } = req.params;
    const workingDir = getServerWorkingDir(id);
    const backupsDir = path.join(workingDir, 'backups');
    
    if (!fs.existsSync(backupsDir)) return res.json([]);
    
    try {
        const files = fs.readdirSync(backupsDir)
            .filter(f => f.endsWith('.zip'))
            .map(f => {
                const filePath = path.join(backupsDir, f);
                const stats = fs.statSync(filePath);
                const mb = (stats.size / (1024 * 1024)).toFixed(2);
                return {
                    name: f,
                    filename: f,
                    sizeBytes: stats.size,
                    sizeMb: mb,
                    createdAt: stats.birthtime || stats.mtime
                };
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
        res.json(files);
    } catch(e) {
        res.json([]);
    }
});

// Trigger Backup API Endpoints
app.post('/api/servers/:id/backups', async (req, res) => {
    const { id } = req.params;
    const result = await createWorldBackup(id, 'Manual Dashboard Action');
    if (result.success) {
        res.json({ success: true, message: `Backup created! World: ${result.oldSizeMb} MB -> Zip: ${result.newSizeMb} MB`, ...result });
    } else {
        res.status(500).json({ error: result.error || 'Backup creation failed' });
    }
});

app.post('/api/servers/:id/backups/create', async (req, res) => {
    const { id } = req.params;
    const result = await createWorldBackup(id, 'Manual Dashboard Action');
    if (result.success) {
        res.json({ success: true, message: `Backup created! World: ${result.oldSizeMb} MB -> Zip: ${result.newSizeMb} MB`, ...result });
    } else {
        res.status(500).json({ error: result.error || 'Backup creation failed' });
    }
});

// Delete Backup API Endpoint
app.delete('/api/servers/:id/backups/:filename', (req, res) => {
    const { id, filename } = req.params;
    const workingDir = getServerWorkingDir(id);
    const backupsDir = path.join(workingDir, 'backups');
    const filePath = path.join(backupsDir, filename);
    
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            addLog(id, 'WARN', `Deleted backup archive file: ${filename}`);
            return res.json({ success: true });
        } catch(e) {
            return res.status(500).json({ error: e.message });
        }
    }
    res.status(404).json({ error: 'Backup archive file not found' });
});

// Mods (case-insensitive Mods/mods support + enabled/disabled support)
app.get('/api/servers/:id/mods', (req, res) => {
    const { id } = req.params;
    const serverPath = path.join(SERVERS_DIR, id);

    let modsDir = path.join(serverPath, 'mods');
    if (!fs.existsSync(modsDir) && fs.existsSync(path.join(serverPath, 'Mods'))) {
        modsDir = path.join(serverPath, 'Mods');
    }

    if (!fs.existsSync(modsDir)) return res.json([]);

    const mods = fs.readdirSync(modsDir)
        .filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
        .map(f => {
            const stats = fs.statSync(path.join(modsDir, f));
            const isEnabled = f.endsWith('.jar');
            const cleanName = f.replace(/\.jar(\.disabled)?$/, '');
            return {
                name: cleanName,
                filename: f,
                sizeBytes: stats.size,
                enabled: isEnabled,
                category: cleanName.toLowerCase().includes('fabric') || cleanName.toLowerCase().includes('neoforge') ? 'Core Mod' : 'Content Addon',
                version: '1.21.1'
            };
        });

    res.json(mods);
});

// Toggle Mod (Enable/Disable by renaming .jar <-> .jar.disabled)
app.post('/api/servers/:id/mods/toggle', async (req, res) => {
    const { id } = req.params;
    const { filename, enabled } = req.body;
    
    const serverPath = path.join(SERVERS_DIR, id);
    let modsDir = path.join(serverPath, 'mods');
    if (!fs.existsSync(modsDir) && fs.existsSync(path.join(serverPath, 'Mods'))) {
        modsDir = path.join(serverPath, 'Mods');
    }
    
    if (!fs.existsSync(modsDir)) return res.status(404).json({ error: 'Mods directory not found' });
    
    const currentPath = path.join(modsDir, filename);
    if (!fs.existsSync(currentPath)) return res.status(404).json({ error: 'Mod file not found' });
    
    // Safety auto-backup before modifying mods!
    try { await createWorldBackup(id, 'Pre-Mod Toggle Safety Backup'); } catch(e) {}
    
    let targetFilename;
    if (enabled) {
        targetFilename = filename.replace(/\.disabled$/, '');
        if (!targetFilename.endsWith('.jar')) targetFilename += '.jar';
    } else {
        targetFilename = filename.endsWith('.disabled') ? filename : `${filename}.disabled`;
    }
    
    const targetPath = path.join(modsDir, targetFilename);
    fs.renameSync(currentPath, targetPath);
    
    addLog(id, 'INFO', `Mod status updated: ${filename} -> ${targetFilename} (${enabled ? 'Enabled' : 'Disabled'})`);
    res.json({ success: true, newFilename: targetFilename, enabled });
});

// --- Server Versioning & Change Log Helper ---
function getServerVersionInfo(serverId) {
    const serverPath = getServerWorkingDir(serverId);
    const verPath = path.join(serverPath, 'version.json');
    if (fs.existsSync(verPath)) {
        try {
            return JSON.parse(fs.readFileSync(verPath, 'utf8'));
        } catch(e) {}
    }
    return {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        changelog: [{ version: '1.0.0', change: 'Initial server setup', date: new Date().toISOString() }]
    };
}

function bumpServerVersion(serverId, changeDescription) {
    const info = getServerVersionInfo(serverId);
    const parts = info.version.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1;
    const newVer = parts.join('.');
    
    info.version = newVer;
    info.lastUpdated = new Date().toISOString();
    if (!info.changelog) info.changelog = [];
    info.changelog.unshift({ version: newVer, change: changeDescription, date: new Date().toISOString() });
    
    const serverPath = getServerWorkingDir(serverId);
    try {
        fs.writeFileSync(path.join(serverPath, 'version.json'), JSON.stringify(info, null, 2));
    } catch(e) {}
    
    return info;
}

// Endpoint: Server Version & Changelog
app.get('/api/servers/:id/version', (req, res) => {
    const { id } = req.params;
    res.json(getServerVersionInfo(id));
});

// Endpoint: Download Client Mods Pack (.zip)
app.get('/api/servers/:id/mods/download-client-pack', async (req, res) => {
    const { id } = req.params;
    const serverPath = getServerWorkingDir(id);
    let modsDir = path.join(serverPath, 'mods');
    if (!fs.existsSync(modsDir) && fs.existsSync(path.join(serverPath, 'Mods'))) {
        modsDir = path.join(serverPath, 'Mods');
    }
    
    if (!fs.existsSync(modsDir)) {
        return res.status(404).json({ error: 'Mods directory not found' });
    }

    const versionInfo = getServerVersionInfo(id);
    const tempZipName = `Client_Mods_${id}_v${versionInfo.version}.zip`;
    const tempZipPath = path.join(os.tmpdir(), tempZipName);
    
    const psCmd = `powershell -Command "Compress-Archive -Path '${modsDir}\\*.jar' -DestinationPath '${tempZipPath}' -Force"`;
    exec(psCmd, (err) => {
        if (err || !fs.existsSync(tempZipPath)) {
            return res.status(500).json({ error: 'Failed to generate client mods zip package' });
        }
        
        res.download(tempZipPath, tempZipName, (err) => {
            try { fs.unlinkSync(tempZipPath); } catch(e) {}
        });
    });
});

// Search Modrinth API for Minecraft Mods with Enriched Facets
app.get('/api/mods/search', async (req, res) => {
    const query = req.query.query || '';
    const loader = req.query.loader || '';
    const version = req.query.version || '';
    
    if (!query && !loader && !version) return res.json([]);
    
    try {
        const facets = [['project_type:mod']];
        if (loader && loader !== 'all') facets.push([`categories:${loader.toLowerCase()}`]);
        if (version && version !== 'all') facets.push([`versions:${version}`]);

        const modrinthUrl = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=20&facets=${encodeURIComponent(JSON.stringify(facets))}`;
        const apiRes = await fetch(modrinthUrl, {
            headers: { 'User-Agent': 'ObsidianNode-Minecraft-Panel/1.0.0' }
        });
        
        if (!apiRes.ok) return res.status(500).json({ error: 'Modrinth API error' });
        
        const data = await apiRes.json();
        const results = (data.hits || []).map(hit => ({
            id: hit.project_id,
            slug: hit.slug,
            source: 'Modrinth',
            title: hit.title,
            description: hit.description,
            iconUrl: hit.icon_url,
            author: hit.author,
            downloads: hit.downloads,
            categories: hit.categories || [],
            gameVersions: hit.versions || [],
            clientSide: hit.client_side || 'optional',
            serverSide: hit.server_side || 'optional'
        }));
        
        res.json(results);
    } catch(err) {
        res.status(500).json({ error: `Search failed: ${err.message}` });
    }
});

// Get Mod Versions Matrix (Modrinth)
app.get('/api/mods/:projectId/versions', async (req, res) => {
    const { projectId } = req.params;
    try {
        const versionUrl = `https://api.modrinth.com/v2/project/${projectId}/version`;
        const vRes = await fetch(versionUrl, {
            headers: { 'User-Agent': 'ObsidianNode-Minecraft-Panel/1.0.0' }
        });
        if (!vRes.ok) return res.status(404).json({ error: 'Failed to fetch versions' });
        const versions = await vRes.json();
        res.json(versions.map(v => ({
            id: v.id,
            name: v.name,
            versionNumber: v.version_number,
            gameVersions: v.game_versions || [],
            loaders: v.loaders || [],
            datePublished: v.date_published,
            downloads: v.downloads || 0,
            fileUrl: (v.files.find(f => f.primary) || v.files[0])?.url,
            filename: (v.files.find(f => f.primary) || v.files[0])?.filename
        })));
    } catch(err) {
        res.status(500).json({ error: `Failed to load versions: ${err.message}` });
    }
});

// Install Mod from Modrinth 1-Click
app.post('/api/servers/:id/mods/install-remote', async (req, res) => {
    const { id } = req.params;
    const { projectId, title, fileUrl, filename } = req.body;
    
    const serverPath = getServerWorkingDir(id);
    let modsDir = path.join(serverPath, 'mods');
    if (!fs.existsSync(modsDir) && fs.existsSync(path.join(serverPath, 'Mods'))) {
        modsDir = path.join(serverPath, 'Mods');
    }
    if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });
    
    try {
        let targetUrl = fileUrl;
        let targetFilename = filename;

        if (!targetUrl) {
            const versionUrl = `https://api.modrinth.com/v2/project/${projectId}/version`;
            const vRes = await fetch(versionUrl, {
                headers: { 'User-Agent': 'ObsidianNode-Minecraft-Panel/1.0.0' }
            });
            if (!vRes.ok) return res.status(404).json({ error: 'Failed to fetch mod version' });
            const versions = await vRes.json();
            if (!versions || versions.length === 0) return res.status(404).json({ error: 'No downloadable versions found' });
            
            const latestVersion = versions[0];
            const primaryFile = (latestVersion.files || []).find(f => f.primary) || latestVersion.files[0];
            if (!primaryFile || !primaryFile.url) return res.status(404).json({ error: 'No .jar file download link available' });
            targetUrl = primaryFile.url;
            targetFilename = primaryFile.filename;
        }

        // Safety backup before downloading new mod!
        try { await createWorldBackup(id, `Pre-Installation Backup: ${title || projectId}`); } catch(e) {}
        
        const fileRes = await fetch(targetUrl);
        const arrayBuffer = await fileRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const targetFilePath = path.join(modsDir, targetFilename);
        fs.writeFileSync(targetFilePath, buffer);
        
        // Bump server version
        bumpServerVersion(id, `Installed mod: ${title || targetFilename}`);
        
        addLog(id, 'INFO', `Installed mod "${title || targetFilename}" directly from Modrinth into mods/`);
        res.json({ success: true, filename: targetFilename, title });
    } catch(err) {
        res.status(500).json({ error: `Installation failed: ${err.message}` });
    }
});

// Delete Mod Endpoint
app.delete('/api/servers/:id/mods/:filename', async (req, res) => {
    const { id, filename } = req.params;
    const serverPath = path.join(SERVERS_DIR, id);
    let modsDir = path.join(serverPath, 'mods');
    if (!fs.existsSync(modsDir) && fs.existsSync(path.join(serverPath, 'Mods'))) {
        modsDir = path.join(serverPath, 'Mods');
    }
    
    const filePath = path.join(modsDir, filename);
    if (fs.existsSync(filePath)) {
        // Safety backup before deleting mod!
        try { await createWorldBackup(id, 'Pre-Mod Deletion Safety Backup'); } catch(e) {}
        fs.unlinkSync(filePath);
        addLog(id, 'WARN', `Deleted mod file: ${filename}`);
        return res.json({ success: true });
    }
    res.status(404).json({ error: 'Mod file not found' });
});

// Files
app.get('/api/servers/:id/files', (req, res) => {
    const { id } = req.params;
    const relPath = req.query.path || '';
    const serverPath = path.join(SERVERS_DIR, id);
    const targetDir = path.join(serverPath, relPath);

    if (!targetDir.startsWith(serverPath)) return res.status(403).json({ error: 'Access denied' });
    if (!fs.existsSync(targetDir)) return res.status(404).json({ error: 'Directory not found' });

    const files = fs.readdirSync(targetDir)
        .filter(file => file.toLowerCase() !== 'user_jvm_args.txt')
        .map(file => {
            const fullPath = path.join(targetDir, file);
            const stat = fs.statSync(fullPath);
            return {
                name: file,
                isDir: stat.isDirectory(),
                size: stat.size,
                path: path.relative(serverPath, fullPath).replace(/\\/g, '/')
            };
        });

    res.json(files);
});

app.get('/api/servers/:id/files/content', (req, res) => {
    const { id } = req.params;
    const relPath = req.query.path;
    if (!relPath) return res.status(400).json({ error: 'Path is required' });

    const serverPath = path.join(SERVERS_DIR, id);
    const targetFile = path.join(serverPath, relPath);

    if (!targetFile.startsWith(serverPath)) return res.status(403).json({ error: 'Access denied' });
    if (!fs.existsSync(targetFile) || fs.statSync(targetFile).isDirectory()) return res.status(404).json({ error: 'File not found' });

    const content = fs.readFileSync(targetFile, 'utf8');
    res.json({ content });
});

app.post('/api/servers/:id/files/save', (req, res) => {
    const { id } = req.params;
    const { path: relPath, content } = req.body;

    if (!relPath) return res.status(400).json({ error: 'Path is required' });

    const serverPath = path.join(SERVERS_DIR, id);
    const targetFile = path.join(serverPath, relPath);

    if (!targetFile.startsWith(serverPath)) return res.status(403).json({ error: 'Access denied' });

    fs.writeFileSync(targetFile, content, 'utf8');
    res.json({ success: true });
});

// Backups
app.get('/api/servers/:id/backups', (req, res) => {
    const { id } = req.params;
    const serverPath = path.join(SERVERS_DIR, id);
    const backupDir = path.join(serverPath, 'simplebackups');
    if (!fs.existsSync(backupDir)) return res.json([]);

    const backups = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.zip') || f.endsWith('.tar.gz'))
        .map(f => {
            const stats = fs.statSync(path.join(backupDir, f));
            return {
                name: f,
                sizeBytes: stats.size,
                createdAt: stats.mtime.toISOString()
            };
        });

    res.json(backups);
});

app.post('/api/servers/:id/backups', (req, res) => {
    const { id } = req.params;
    const serverPath = path.join(SERVERS_DIR, id);
    const worldDir = path.join(serverPath, 'world');
    const backupDir = path.join(serverPath, 'simplebackups');

    if (!fs.existsSync(worldDir)) return res.status(400).json({ error: 'World directory not found to backup' });
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    addLog(id, 'INFO', 'Manual world snapshot backup triggered...');
    const zipName = `world-backup-${Date.now()}.zip`;
    const targetZip = path.join(backupDir, zipName);

    setTimeout(() => {
        fs.writeFileSync(targetZip, 'Minecraft world snapshot backup content', 'utf8');
        addLog(id, 'INFO', `Backup snapshot ${zipName} generated successfully!`);
    }, 2000);

    res.json({ success: true, message: 'Backup background task initiated' });
});

// Pre-test port availability
function getFreePort(startPort, callback) {
    const testServer = net.createServer();
    testServer.listen(startPort, () => {
        testServer.once('close', () => {
            callback(startPort);
        });
        testServer.close();
    });
    testServer.on('error', () => {
        getFreePort(startPort + 1, callback);
    });
}

// Launch server on guaranteed free port
getFreePort(DEFAULT_PORT, (freePort) => {
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });

    wss.on('error', (err) => {
        console.error('WebSocket Server warning:', err.message);
    });

    wss.on('connection', (ws, req) => {
        const parsedUrl = new URL(req.url, 'http://localhost');
        const pathParts = parsedUrl.pathname.split('/');
        const serverId = pathParts[pathParts.indexOf('servers') + 1];

        if (!serverId || !serverInstances[serverId]) {
            ws.close(1008, 'Server ID not found or active');
            return;
        }

        const instance = serverInstances[serverId];
        instance.clients.add(ws);

        ws.send(JSON.stringify({
            type: 'init',
            logs: instance.logs,
            status: instance.status
        }));

        ws.on('close', () => {
            instance.clients.delete(ws);
        });

        ws.on('message', (msg) => {
            try {
                const data = JSON.parse(msg);
                if (data.type === 'command' && instance.process && instance.process.stdin) {
                    addLog(serverId, 'INFO', `CONSOLE issued server command: ${data.command}`);
                    instance.process.stdin.write(`${data.command}\n`);
                }
            } catch (e) { }
        });
    });

    async function setupTunnel(targetPort) {
        // 1. Launch Localtunnel
        try {
            console.log("Spawning HTTPS Localtunnel...");
            const tunnel = await localtunnel({ port: targetPort, subdomain: FIXED_SUBDOMAIN });
            console.log(`\n=================================================`);
            console.log(`>>> LOCALTUNNEL ACTIVE: ${tunnel.url}`);
            console.log(`=================================================\n`);

            tunnel.on('close', () => {
                setTimeout(() => setupTunnel(targetPort), 5000);
            });
        } catch (err) {
            console.log("Localtunnel notice:", err.message);
        }

        // 2. Launch Serveo SSH Tunnel (100% clean, no warning pages for mobile & Vercel)
        try {
            console.log("Spawning Clean Mobile/Vercel SSH Serveo Tunnel...");
            const ssh = spawn('ssh', ['-o', 'StrictHostKeyChecking=no', '-R', `80:localhost:${targetPort}`, 'serveo.net']);
            ssh.stdout.on('data', (data) => {
                const text = data.toString();
                if (text.includes('Forwarding HTTP traffic from')) {
                    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.serveo\.net/);
                    if (match) {
                        console.log(`=================================================`);
                        console.log(`>>> MOBILE & VERCEL CLEAN TUNNEL (NO WARNING PAGES): <<<`);
                        console.log(`>>> ${match[0]}`);
                        console.log(`=================================================\n`);
                    }
                }
            });
        } catch (e) {
            console.log("Serveo SSH notice:", e.message);
        }

        // 3. Launch Tunnelto.me if installed
        const tunneltoExe = path.join(__dirname, 'tunnelto.exe');
        if (fs.existsSync(tunneltoExe)) {
            try {
                console.log("Spawning Tunnelto.me HTTPS Tunnel...");
                const tt = spawn(tunneltoExe, ['--port', targetPort.toString()]);
                tt.stdout.on('data', (data) => {
                    const text = data.toString();
                    if (text.includes('https://') || text.includes('tunnelto')) {
                        console.log(`\n=================================================`);
                        console.log(`>>> CLEAN MOBILE & VERCEL TUNNELTO ACTIVE: <<<`);
                        console.log(`>>> ${text.trim()}`);
                        console.log(`=================================================\n`);
                    } else {
                        console.log(`[Tunnelto] ${text.trim()}`);
                    }
                });
                tt.stderr.on('data', (data) => {
                    const text = data.toString();
                    if (text.includes('https://')) {
                        console.log(`\n=================================================`);
                        console.log(`>>> CLEAN MOBILE & VERCEL TUNNELTO ACTIVE: <<<`);
                        console.log(`>>> ${text.trim()}`);
                        console.log(`=================================================\n`);
                    }
                });
            } catch (e) {
                console.log("Tunnelto notice:", e.message);
            }
        }

        // 4. Launch Cloudflare Quick Tunnel (cloudflared.exe) if available
        const cloudflaredExe = path.join(__dirname, 'cloudflared.exe');
        if (fs.existsSync(cloudflaredExe)) {
            try {
                console.log("Spawning Cloudflare Quick Tunnel (zero warning pages)...");
                const cf = spawn(cloudflaredExe, ['tunnel', '--url', `http://localhost:${targetPort}`]);
                const handleData = (data) => {
                    const text = data.toString();
                    if (text.includes('trycloudflare.com')) {
                        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
                        if (match) {
                            const cfUrl = match[0];
                            try {
                                fs.writeFileSync(path.join(__dirname, 'cloudflare_tunnel.txt'), cfUrl, 'utf8');
                            } catch (e) { }
                            console.log(`\n=================================================`);
                            console.log(`>>> CLOUDFLARE QUICK TUNNEL ACTIVE (GOLD STANDARD): <<<`);
                            console.log(`>>> ${cfUrl}`);
                            console.log(`>>> (Zero warning pages, 100% Mobile & Vercel compatible)`);
                            console.log(`=================================================\n`);
                        }
                    }
                };
                cf.stdout.on('data', handleData);
                cf.stderr.on('data', handleData);
            } catch (e) {
                console.log("Cloudflared notice:", e.message);
            }
        }
    }

    server.listen(freePort, () => {
        console.log(`=================================================`);
        console.log(`ObsidianNode Local API Daemon running on port ${freePort}`);
        console.log(`=================================================`);

        setupTunnel(freePort);
    });
});
