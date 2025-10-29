import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import * as dgram from 'dgram';
import { networkInterfaces } from 'os';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Add middleware to parse JSON
app.use(express.json());

const PORT = process.env.PORT || 8000;
const UDP_PORT = 8080;

interface FlightTelemetry {
    timestamp: string;
    altitude: number;
    speedX: number;
    speedY: number;
    speedZ: number;
    heading: number;
    latitude: number;
    longitude: number;
    temperature: number;
    battery_percentage: number;
}

interface UDPConnection {
    id: string;
    address: string;
    port: number;
    status: 'active' | 'inactive' | 'listening';
    lastActivity: string;
    messagesReceived: number;
}

interface SimulatorControl {
    isRunning: boolean;
    isPaused: boolean;
    intervalId?: NodeJS.Timeout;
}

// Performance monitoring for Kafka readiness
interface PerformanceMetrics {
    messagesReceived: number;
    messagesSent: number;
    avgLatency: number;
    connectionsCount: number;
    memoryUsage: number;
    startTime: number;
}

let performanceMetrics: PerformanceMetrics = {
    messagesReceived: 0,
    messagesSent: 0,
    avgLatency: 0,
    connectionsCount: 0,
    memoryUsage: 0,
    startTime: Date.now()
};

// UDP connections tracking
let udpConnections: Map<string, UDPConnection> = new Map();
let simulatorControl: SimulatorControl = {
    isRunning: false,
    isPaused: false
};

// Stress test configurations for real-world simulation
const STRESS_TEST_MODES = {
    normal: { interval: 200, jitter: 0 },
    high_frequency: { interval: 50, jitter: 10 },
    burst: { interval: 20, jitter: 50 },
    variable: { interval: 100, jitter: 100 },
    kafka_simulation: { interval: 30, jitter: 20 }
};

let currentStressMode: keyof typeof STRESS_TEST_MODES = 'normal';

const udpServer = dgram.createSocket('udp4');

udpServer.on('message', (msg, rinfo) => {
    const receiveTime = Date.now();
    const connectionId = `${rinfo.address}:${rinfo.port}`;
    
    try {
        const telemetryData: FlightTelemetry = JSON.parse(msg.toString());
        performanceMetrics.messagesReceived++;
        
        // Update connection tracking
        const existingConnection = udpConnections.get(connectionId);
        const updatedConnection: UDPConnection = {
            id: connectionId,
            address: rinfo.address,
            port: rinfo.port,
            status: 'active',
            lastActivity: new Date().toISOString(),
            messagesReceived: existingConnection ? existingConnection.messagesReceived + 1 : 1
        };
        udpConnections.set(connectionId, updatedConnection);
        
        // Calculate latency (simulated processing time)
        const processingLatency = Date.now() - receiveTime;
        performanceMetrics.avgLatency = 
            (performanceMetrics.avgLatency + processingLatency) / 2;
        
        console.log(`Received UDP message from ${rinfo.address}:${rinfo.port} - Latency: ${processingLatency}ms`);
        
        // Kafka-ready: Send individual messages (not batched)
        io.emit("telemetryData", {
            ...telemetryData,
            processingLatency,
            messageId: performanceMetrics.messagesReceived,
            sourceConnection: connectionId
        });
        
        performanceMetrics.messagesSent++;
        
    } catch (error) {
        console.error('Error parsing UDP message:', error);
    }
});

udpServer.on('listening', () => {
    const address = udpServer.address();
    console.log(`UDP Server listening on ${address?.address}:${address?.port}`);
    
    // Add server as a listening connection
    udpConnections.set('server', {
        id: 'server',
        address: address?.address || '0.0.0.0',
        port: address?.port || UDP_PORT,
        status: 'listening',
        lastActivity: new Date().toISOString(),
        messagesReceived: 0
    });
});

// Get available network interfaces
function getNetworkInterfaces() {
    const interfaces = networkInterfaces();
    const availableInterfaces: any[] = [];
    
    Object.keys(interfaces).forEach(name => {
        interfaces[name]?.forEach(iface => {
            if (!iface.internal && iface.family === 'IPv4') {
                availableInterfaces.push({
                    name,
                    address: iface.address,
                    netmask: iface.netmask,
                    mac: iface.mac
                });
            }
        });
    });
    
    return availableInterfaces;
}

function generateRealisticTelemetryData(): FlightTelemetry {
    const baseSpeed = 450 + Math.sin(Date.now() / 10000) * 100;
    const turbulence = (Math.random() - 0.5) * 50;
    
    return {
        timestamp: new Date().toISOString(),
        altitude: 35000 + Math.sin(Date.now() / 20000) * 5000 + (Math.random() - 0.5) * 1000,
        speedX: baseSpeed + turbulence + (Math.random() - 0.5) * 30,
        speedY: baseSpeed * 0.8 + turbulence + (Math.random() - 0.5) * 25,
        speedZ: baseSpeed * 0.6 + turbulence + (Math.random() - 0.5) * 20,
        heading: (Date.now() / 1000) % 360,
        latitude: 40.7128 + Math.sin(Date.now() / 50000) * 0.1,
        longitude: -74.0060 + Math.cos(Date.now() / 50000) * 0.1,
        battery_percentage: Math.max(0, 100 - (Date.now() - performanceMetrics.startTime) / 100000),
        temperature: 15 + Math.sin(Date.now() / 30000) * 10 + (Math.random() - 0.5) * 5
    };
}

function startUDPSimulator() {
    if (simulatorControl.isRunning) return;
    
    const client = dgram.createSocket('udp4');
    simulatorControl.isRunning = true;
    simulatorControl.isPaused = false;
    
    const sendData = () => {
        if (!simulatorControl.isRunning || simulatorControl.isPaused) return;
        
        const config = STRESS_TEST_MODES[currentStressMode];
        const jitter = Math.random() * config.jitter;
        const actualInterval = config.interval + jitter;
        
        const telemetryData = generateRealisticTelemetryData();
        const message = Buffer.from(JSON.stringify(telemetryData));
        
        client.send(message, UDP_PORT, 'localhost', (err) => {
            if (err) {
                console.error('Error sending UDP message:', err);
            }
        });
        
        simulatorControl.intervalId = setTimeout(sendData, actualInterval);
    };
    
    sendData();
}

function stopUDPSimulator() {
    simulatorControl.isRunning = false;
    simulatorControl.isPaused = false;
    if (simulatorControl.intervalId) {
        clearTimeout(simulatorControl.intervalId);
    }
}

function pauseUDPSimulator() {
    simulatorControl.isPaused = true;
}

function resumeUDPSimulator() {
    if (simulatorControl.isRunning) {
        simulatorControl.isPaused = false;
        startUDPSimulator(); // Restart the sending loop
    }
}

// API Endpoints

// Get UDP connections endpoint
app.get("/udp/connections", (req, res) => {
    const connections = Array.from(udpConnections.values());
    const networkIntfs = getNetworkInterfaces();
    
    res.json({
        connections,
        networkInterfaces: networkIntfs,
        serverInfo: {
            port: UDP_PORT,
            availableAddresses: networkIntfs.map(intf => `${intf.address}:${UDP_PORT}`)
        }
    });
});

// Simulator control endpoints
app.post("/simulator/start", (req, res) => {
    startUDPSimulator();
    res.json({ 
        success: true, 
        status: 'started',
        isRunning: simulatorControl.isRunning,
        isPaused: simulatorControl.isPaused
    });
});

app.post("/simulator/stop", (req, res) => {
    stopUDPSimulator();
    res.json({ 
        success: true, 
        status: 'stopped',
        isRunning: simulatorControl.isRunning,
        isPaused: simulatorControl.isPaused
    });
});

app.post("/simulator/pause", (req, res) => {
    pauseUDPSimulator();
    res.json({ 
        success: true, 
        status: 'paused',
        isRunning: simulatorControl.isRunning,
        isPaused: simulatorControl.isPaused
    });
});

app.post("/simulator/resume", (req, res) => {
    resumeUDPSimulator();
    res.json({ 
        success: true, 
        status: 'resumed',
        isRunning: simulatorControl.isRunning,
        isPaused: simulatorControl.isPaused
    });
});

// Get simulator status
app.get("/simulator/status", (req, res) => {
    res.json({
        isRunning: simulatorControl.isRunning,
        isPaused: simulatorControl.isPaused,
        currentMode: currentStressMode,
        config: STRESS_TEST_MODES[currentStressMode]
    });
});

// Performance monitoring endpoint
app.get("/metrics", (req, res) => {
    const uptime = Date.now() - performanceMetrics.startTime;
    const messagesPerSecond = performanceMetrics.messagesReceived / (uptime / 1000);
    
    res.json({
        ...performanceMetrics,
        uptime,
        messagesPerSecond: Math.round(messagesPerSecond * 100) / 100,
        memoryUsage: process.memoryUsage(),
        currentStressMode,
        simulatorStatus: {
            isRunning: simulatorControl.isRunning,
            isPaused: simulatorControl.isPaused
        }
    });
});

// Stress test mode endpoint
app.post("/stress-mode/:mode", (req, res) => {
    const mode = req.params.mode as keyof typeof STRESS_TEST_MODES;
    if (STRESS_TEST_MODES[mode]) {
        currentStressMode = mode;
        res.json({ 
            success: true, 
            mode, 
            config: STRESS_TEST_MODES[mode] 
        });
    } else {
        res.status(400).json({ 
            error: "Invalid stress mode", 
            availableModes: Object.keys(STRESS_TEST_MODES) 
        });
    }
});

app.get("/health", (req, res) => {
    res.json({ 
        status: "Server is running", 
        timestamp: new Date().toISOString(),
        performance: performanceMetrics,
        kafkaReady: true,
        simulator: {
            isRunning: simulatorControl.isRunning,
            isPaused: simulatorControl.isPaused
        }
    });
});

io.on("connection", (socket) => {
    performanceMetrics.connectionsCount++;
    console.log(`Client Connected: ${socket.id} - Total connections: ${performanceMetrics.connectionsCount}`);

    // Send current performance metrics and connections to new client
    socket.emit("performanceMetrics", performanceMetrics);
    socket.emit("udpConnections", Array.from(udpConnections.values()));
    socket.emit("simulatorStatus", {
        isRunning: simulatorControl.isRunning,
        isPaused: simulatorControl.isPaused
    });

    socket.on("disconnect", () => {
        performanceMetrics.connectionsCount--;
        console.log(`Client Disconnected: ${socket.id} - Total connections: ${performanceMetrics.connectionsCount}`);
    });
    
    // Allow clients to change stress test mode
    socket.on("changeStressMode", (mode: keyof typeof STRESS_TEST_MODES) => {
        if (STRESS_TEST_MODES[mode]) {
            currentStressMode = mode;
            io.emit("stressModeChanged", { mode, config: STRESS_TEST_MODES[mode] });
        }
    });

    // Simulator controls via socket
    socket.on("simulatorStart", () => {
        startUDPSimulator();
        io.emit("simulatorStatus", { isRunning: simulatorControl.isRunning, isPaused: simulatorControl.isPaused });
    });

    socket.on("simulatorStop", () => {
        stopUDPSimulator();
        io.emit("simulatorStatus", { isRunning: simulatorControl.isRunning, isPaused: simulatorControl.isPaused });
    });

    socket.on("simulatorPause", () => {
        pauseUDPSimulator();
        io.emit("simulatorStatus", { isRunning: simulatorControl.isRunning, isPaused: simulatorControl.isPaused });
    });

    socket.on("simulatorResume", () => {
        resumeUDPSimulator();
        io.emit("simulatorStatus", { isRunning: simulatorControl.isRunning, isPaused: simulatorControl.isPaused });
    });
});

// Performance monitoring loop
setInterval(() => {
    const memUsage = process.memoryUsage();
    performanceMetrics.memoryUsage = memUsage.heapUsed;
    
    // Broadcast performance metrics and connections to all clients
    io.emit("performanceUpdate", performanceMetrics);
    io.emit("udpConnections", Array.from(udpConnections.values()));
    
    // Clean up inactive connections (older than 30 seconds)
    const thirtySecondsAgo = Date.now() - 30000;
    for (const [key, connection] of udpConnections) {
        if (connection.status !== 'listening' && 
            new Date(connection.lastActivity).getTime() < thirtySecondsAgo) {
            connection.status = 'inactive';
        }
    }
}, 5000); // Every 5 seconds

udpServer.bind(UDP_PORT);

setTimeout(() => {
    startUDPSimulator();
    console.log(`Started UDP Telemetry Simulator: ${new Date().toISOString()}`);
    console.log(`Initial stress mode: ${currentStressMode}`);
}, 2000);

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`WebSocket server is running (Kafka-ready architecture)`);
    console.log(`Performance metrics available at: http://localhost:${PORT}/metrics`);
    console.log(`UDP connections info at: http://localhost:${PORT}/udp/connections`);
});