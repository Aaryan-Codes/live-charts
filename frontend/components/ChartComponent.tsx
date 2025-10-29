'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import io, { Socket } from 'socket.io-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { GrAssistListening } from 'react-icons/gr';
import { BiQuestionMark } from 'react-icons/bi';
import { FaCircle, FaPlay, FaPause, FaStop, FaTrash } from 'react-icons/fa';
import { MdSpeed, MdMemory, MdRocket } from 'react-icons/md';
import { IoMdThunderstorm } from 'react-icons/io';
import { RiSlowDownLine } from 'react-icons/ri';

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
  processingLatency?: number;
  messageId?: number;
  sourceConnection?: string;
}

interface ChartData {
  timestamps: string[];
  speedX: number[];
  speedY: number[];
  speedZ: number[];
}

interface ProcessingStats {
  received: number;
  processed: number;
  dropped: number;
  queueSize: number;
  fps: number;
  memoryUsage: number;
  avgProcessingTime: number;
}

interface PerformanceMetrics {
  messagesReceived: number;
  messagesSent: number;
  avgLatency: number;
  connectionsCount: number;
  memoryUsage: number;
  startTime: number;
}

interface UDPConnection {
  id: string;
  address: string;
  port: number;
  status: 'active' | 'inactive' | 'listening';
  lastActivity: string;
  messagesReceived: number;
}

interface SimulatorStatus {
  isRunning: boolean;
  isPaused: boolean;
}

const STRESS_TEST_MODES = {
  normal: { interval: 200, jitter: 0, label: 'Normal' },
  high_frequency: { interval: 50, jitter: 10, label: 'High Freq' },
  burst: { interval: 20, jitter: 50, label: 'Burst' },
  variable: { interval: 100, jitter: 100, label: 'Variable' },
  kafka_simulation: { interval: 30, jitter: 20, label: 'Kafka Sim' }
};

const SpeedChart: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData>({
    timestamps: [],
    speedX: [],
    speedY: [],
    speedZ: [],
  });
  
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [chartPaused, setChartPaused] = useState<boolean>(false);
  
  // Kafka-ready queue processing state
  const [updateQueue, setUpdateQueue] = useState<FlightTelemetry[]>([]);
  const [processingStats, setProcessingStats] = useState<ProcessingStats>({
    received: 0,
    processed: 0,
    dropped: 0,
    queueSize: 0,
    fps: 0,
    memoryUsage: 0,
    avgProcessingTime: 0
  });
  
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [currentStressMode, setCurrentStressMode] = useState<string>('normal');
  const [udpConnections, setUdpConnections] = useState<UDPConnection[]>([]);
  const [simulatorStatus, setSimulatorStatus] = useState<SimulatorStatus>({
    isRunning: false,
    isPaused: false
  });
  
  const socketRef = useRef<any | null>(null);
  const chartRef = useRef<any>(null);
  const maxDataPoints = 250;
  const maxQueueSize = 50;
  
  // Performance monitoring refs
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());
  const processingTimesRef = useRef<number[]>([]);

  // Kafka-ready queue processor (mimics Kafka consumer pattern)
  useEffect(() => {
    if (chartPaused) return;

    const processQueue = () => {
      const startTime = performance.now();
      
      if (updateQueue.length > 0) {
        const batchSize = Math.min(5, updateQueue.length);
        const pointsToProcess = updateQueue.slice(-batchSize);
        const droppedCount = updateQueue.length - batchSize;
        
        setChartData(prevData => {
          let newTimestamps = [...prevData.timestamps];
          let newSpeedX = [...prevData.speedX];
          let newSpeedY = [...prevData.speedY]; 
          let newSpeedZ = [...prevData.speedZ];
          
          pointsToProcess.forEach(data => {
            newTimestamps.push(new Date(data.timestamp).toLocaleTimeString());
            newSpeedX.push(data.speedX);
            newSpeedY.push(data.speedY);
            newSpeedZ.push(data.speedZ);
          });
          
          return {
            timestamps: newTimestamps.slice(-maxDataPoints),
            speedX: newSpeedX.slice(-maxDataPoints),
            speedY: newSpeedY.slice(-maxDataPoints),
            speedZ: newSpeedZ.slice(-maxDataPoints)
          };
        });
        
        const processingTime = performance.now() - startTime;
        processingTimesRef.current.push(processingTime);
        if (processingTimesRef.current.length > 10) {
          processingTimesRef.current.shift();
        }
        
        setProcessingStats(prev => ({
          received: prev.received,
          processed: prev.processed + pointsToProcess.length,
          dropped: prev.dropped + droppedCount,
          queueSize: 0,
          fps: prev.fps,
          memoryUsage: prev.memoryUsage,
          avgProcessingTime: processingTimesRef.current.reduce((a, b) => a + b, 0) / processingTimesRef.current.length
        }));
        
        setUpdateQueue([]);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    };

    const getProcessingInterval = () => {
      if (updateQueue.length > 30) return 50;
      if (updateQueue.length > 15) return 75;
      return 100;
    };

    const intervalId = setInterval(processQueue, getProcessingInterval());
    return () => clearInterval(intervalId);
  }, [updateQueue.length, chartPaused]);

  // Performance monitoring
  useEffect(() => {
    const measurePerformance = () => {
      const now = performance.now();
      frameCountRef.current++;
      
      if (now - lastFrameTimeRef.current >= 1000) {
        const fps = frameCountRef.current;
        const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
        
        setProcessingStats(prev => ({
          ...prev,
          fps,
          memoryUsage: Math.round(memoryUsage / 1024 / 1024 * 100) / 100
        }));
        
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }
      
      requestAnimationFrame(measurePerformance);
    };
    
    measurePerformance();
  }, []);

  useEffect(() => {
    socketRef.current = io('https://live-charts.onrender.com');

    socketRef.current.on('connect', () => {
      console.log('Connected to server');
      setConnectionStatus('connected');
    });

    socketRef.current.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socketRef.current.on('telemetryData', (data: FlightTelemetry) => {
      if (chartPaused) return;
      
      setUpdateQueue(prev => {
        const newQueue = [...prev, data];
        const trimmedQueue = newQueue.length > maxQueueSize ? newQueue.slice(-maxQueueSize) : newQueue;
        
        setProcessingStats(prevStats => ({
          ...prevStats,
          received: prevStats.received + 1,
          queueSize: trimmedQueue.length,
          dropped: prevStats.dropped + (newQueue.length > maxQueueSize ? 1 : 0)
        }));
        
        return trimmedQueue;
      });
    });

    socketRef.current.on('performanceMetrics', (metrics: PerformanceMetrics) => {
      setPerformanceMetrics(metrics);
    });

    socketRef.current.on('performanceUpdate', (metrics: PerformanceMetrics) => {
      setPerformanceMetrics(metrics);
    });

    socketRef.current.on('stressModeChanged', (data: { mode: string }) => {
      setCurrentStressMode(data.mode);
    });

    socketRef.current.on('udpConnections', (connections: UDPConnection[]) => {
      setUdpConnections(connections);
    });

    socketRef.current.on('simulatorStatus', (status: SimulatorStatus) => {
      setSimulatorStatus(status);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [chartPaused]);

  const changeStressMode = useCallback((mode: keyof typeof STRESS_TEST_MODES) => {
    if (socketRef.current) {
      socketRef.current.emit('changeStressMode', mode);
      setCurrentStressMode(mode);
    }
  }, []);

  const handleSimulatorStart = () => {
    socketRef.current?.emit('simulatorStart');
  };

  const handleSimulatorStop = () => {
    socketRef.current?.emit('simulatorStop');
  };

  const handleSimulatorPause = () => {
    socketRef.current?.emit('simulatorPause');
  };

  const handleSimulatorResume = () => {
    socketRef.current?.emit('simulatorResume');
  };

  const handleChartStart = () => {
    setChartPaused(false);
  };

  const handleChartPause = () => {
    setChartPaused(true);
  };

  const handleChartClear = () => {
    setChartData({
      timestamps: [],
      speedX: [],
      speedY: [],
      speedZ: []
    });
    setUpdateQueue([]);
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge className="bg-green-500 hover:bg-green-600"><FaCircle className="mr-1" /> Connected</Badge>;
      case 'connecting':
        return <Badge variant="secondary"><FaCircle className="mr-1" /> Connecting...</Badge>;
      case 'disconnected':
        return <Badge variant="destructive"><FaCircle className="mr-1" /> Disconnected</Badge>;
    }
  };

  const getPerformanceBadge = () => {
    if (processingStats.fps > 30) return <Badge className="bg-green-500"><MdRocket className="mr-1" /> {processingStats.fps} FPS</Badge>;
    if (processingStats.fps > 15) return <Badge className="bg-yellow-500"><IoMdThunderstorm className="mr-1" /> {processingStats.fps} FPS</Badge>;
    return <Badge className="bg-red-500"><RiSlowDownLine className="mr-1" /> {processingStats.fps} FPS</Badge>;
  };

  const getConnectionStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500"><FaCircle className="mr-1" /> Active</Badge>;
      case 'listening':
        return <Badge className="bg-blue-500 flex items-center"><GrAssistListening className='w-6 h-6' /><p>Listening</p> </Badge>;
      case 'inactive':
        return <Badge variant="secondary"><FaCircle className="mr-1" /> Inactive</Badge>;
      default:
        return <Badge variant="outline"><BiQuestionMark/> Unknown</Badge>;
    }
  };

  // ... existing getOption function remains the same ...
  const getOption = () => ({
    title: {
      text: `Flight Speed Telemetry ${chartPaused ? '(PAUSED)' : '(LIVE)'}`,
      left: 'center',
      textStyle: {
        color: chartPaused ? '#fbbf24' : '#fff',
        fontSize: 18,
        fontWeight: 'bold'
      }
    },
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      },
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: '#333',
      textStyle: {
        color: '#fff'
      }
    },
    legend: {
      data: ['Speed X', 'Speed Y', 'Speed Z'],
      top: '12%',
      textStyle: {
        color: '#fff'
      }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '25%'
    },
    xAxis: {
      type: 'category',
      data: chartData.timestamps,
      axisLabel: {
        color: '#94a3b8',
        rotate: 45,
        fontSize: 10,
        interval: 'auto'
      },
      axisLine: {
        lineStyle: {
          color: '#334155'
        }
      }
    },
    yAxis: {
      type: 'value',
      name: 'Speed (knots)',
      nameTextStyle: {
        color: '#94a3b8'
      },
      axisLabel: {
        color: '#94a3b8'
      },
      axisLine: {
        lineStyle: {
          color: '#334155'
        }
      },
      splitLine: {
        lineStyle: {
          color: '#1e293b'
        }
      }
    },
    series: [
      {
        name: 'Speed X',
        type: 'line',
        data: chartData.speedX,
        smooth: true,
        lineStyle: {
          color: '#ef4444',
          width: 2
        },
        itemStyle: {
          color: '#ef4444'
        },
        animation: false,
        symbol: 'none'
      },
      {
        name: 'Speed Y',
        type: 'line',
        data: chartData.speedY,
        smooth: true,
        lineStyle: {
          color: '#10b981',
          width: 2
        },
        itemStyle: {
          color: '#10b981'
        },
        animation: false,
        symbol: 'none'
      },
      {
        name: 'Speed Z',
        type: 'line',
        data: chartData.speedZ,
        smooth: true,
        lineStyle: {
          color: '#3b82f6',
          width: 2
        },
        itemStyle: {
          color: '#3b82f6'
        },
        animation: false,
        symbol: 'none'
      }
    ]
  });

  return (
    <div className="space-y-4">
      {/* UDP Connections Dashboard */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">UDP Connections</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {udpConnections.map((connection) => (
              <div key={connection.id} className="bg-slate-800 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-mono text-sm">
                    {connection.address}:{connection.port}
                  </span>
                  {getConnectionStatusBadge(connection.status)}
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <div>Messages: {connection.messagesReceived}</div>
                  <div>Last Activity: {new Date(connection.lastActivity).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </CardHeader>
      </Card>

      {/* Simulator & Chart Controls */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Controls</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-slate-400 text-sm">Simulator Controls</span>
              <div className="flex space-x-2">
                <Button 
                  onClick={handleSimulatorStart}
                  disabled={simulatorStatus.isRunning && !simulatorStatus.isPaused}
                  className="bg-green-600 hover:bg-green-700"
                  size="sm"
                >
                  <FaPlay className="mr-1" /> Start
                </Button>
                <Button 
                  onClick={simulatorStatus.isPaused ? handleSimulatorResume : handleSimulatorPause}
                  disabled={!simulatorStatus.isRunning}
                  className="bg-yellow-600 hover:bg-yellow-700"
                  size="sm"
                >
                  {simulatorStatus.isPaused ? <FaPlay className="mr-1" /> : <FaPause className="mr-1" />} {simulatorStatus.isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button 
                  onClick={handleSimulatorStop}
                  disabled={!simulatorStatus.isRunning}
                  className="bg-red-600 hover:bg-red-700"
                  size="sm"
                >
                  <FaStop className="mr-1" /> Stop
                </Button>
              </div>
              <div className="text-xs text-slate-400">
                Status: {simulatorStatus.isRunning ? (simulatorStatus.isPaused ? 'Paused' : 'Running') : 'Stopped'}
              </div>
            </div>
            
            <div className="space-y-2">
              <span className="text-slate-400 text-sm">Chart Controls</span>
              <div className="flex space-x-2">
                <Button 
                  onClick={handleChartStart}
                  disabled={!chartPaused}
                  className="bg-green-600 hover:bg-green-700"
                  size="sm"
                >
                  <FaPlay className="mr-1" /> Start
                </Button>
                <Button 
                  onClick={handleChartPause}
                  disabled={chartPaused}
                  className="bg-yellow-600 hover:bg-yellow-700"
                  size="sm"
                >
                  <FaPause className="mr-1" /> Pause
                </Button>
                <Button 
                  onClick={handleChartClear}
                  className="bg-red-600 hover:bg-red-700"
                  size="sm"
                >
                  <FaTrash className="mr-1" /> Clear
                </Button>
              </div>
              <div className="text-xs text-slate-400">
                Status: {chartPaused ? 'Paused' : 'Live'}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Performance Dashboard - existing code */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Performance Monitor</CardTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-slate-400">Queue Processing</span>
              <div className="text-white font-mono">
                Received: {processingStats.received}<br/>
                Processed: {processingStats.processed}<br/>
                Dropped: {processingStats.dropped}<br/>
                Queue: {processingStats.queueSize}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400">Performance</span>
              <div className="text-white font-mono">
                FPS: {processingStats.fps}<br/>
                Memory: {processingStats.memoryUsage}MB<br/>
                Avg Process: {Math.round(processingStats.avgProcessingTime * 100) / 100}ms
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400">Backend Metrics</span>
              <div className="text-white font-mono">
                {performanceMetrics ? (
                  <>
                    Msg/sec: {Math.round((performanceMetrics.messagesReceived / ((Date.now() - performanceMetrics.startTime) / 1000)) * 100) / 100}<br/>
                    Connections: {performanceMetrics.connectionsCount}<br/>
                    Avg Latency: {Math.round(performanceMetrics.avgLatency * 100) / 100}ms
                  </>
                ) : 'Loading...'}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400">Stress Test Mode</span>
              <div className="space-y-2">
                <Badge className="bg-blue-500">{STRESS_TEST_MODES[currentStressMode as keyof typeof STRESS_TEST_MODES]?.label || currentStressMode}</Badge>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(STRESS_TEST_MODES).map(([key, config]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={currentStressMode === key ? "default" : "outline"}
                      onClick={() => changeStressMode(key as keyof typeof STRESS_TEST_MODES)}
                      className="text-xs"
                    >
                      {config.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Chart */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-xl">Real-time Speed Telemetry</CardTitle>
              <CardDescription className="text-slate-400">
                Live flight speed data (X, Y, Z axes) - {chartPaused ? 'PAUSED' : 'STREAMING'}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusBadge()}
              {getPerformanceBadge()}
              {chartPaused && <Badge className="bg-yellow-500"><FaPause className="mr-1" /> PAUSED</Badge>}
            </div>
          </div>
          <Separator className="bg-slate-700" />
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>Data Points: {chartData.timestamps.length}/{maxDataPoints}</span>
            <span>Queue Size: {processingStats.queueSize}/{maxQueueSize}</span>
            {lastUpdate && <span>Last Update: {lastUpdate}</span>}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-96 w-full">
            <ReactECharts
              ref={chartRef}
              option={getOption()}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SpeedChart;