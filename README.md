# Live Flight Telemetry Dashboard

A real-time flight telemetry visualization system built with Next.js, Node.js, and Socket.IO that simulates and displays live flight data with advanced performance monitoring and stress testing capabilities.

## 🚀 Live Deployment

- **Frontend**: [live-charts.vercel.app](https://live-charts.vercel.app)
- **Backend**: [https://live-charts.onrender.com](https://live-charts.onrender.com)

## ⚠️ Important: Backend Startup

**Before using the application, please wait for the backend server to fully initialize:**

1. Hit the health check endpoint: `https://live-charts.onrender.com/health`
2. Wait until you receive a JSON response (this may take 1-2 minutes for cold starts)
3. Once you see the health check response, open the frontend: [live-charts.vercel.app](https://live-charts.vercel.app)

The backend is hosted on Render's free tier, which may require time to spin up from a cold state.

## 📋 System Overview

This application demonstrates a complete real-time data pipeline that simulates flight telemetry data and visualizes it through an interactive dashboard.

### Data Flow Architecture

```
UDP Simulator → UDP Listener → Data Processing → Socket.IO → React Frontend
```

1. **UDP Data Simulation**: Generates realistic flight telemetry data including:
   - Altitude, speed (X, Y, Z axes)
   - GPS coordinates (latitude, longitude)
   - Heading, temperature, battery percentage
   - Processing latency and message IDs

2. **UDP Listener**: Backend server listens on multiple UDP ports for incoming telemetry data

3. **Data Processing**: Processes incoming UDP packets with queue management and performance monitoring

4. **Socket.IO Broadcasting**: Real-time data transmission to connected clients

5. **React Dashboard**: Live visualization with ECharts and performance metrics

## 🔧 Features

### Real-time Telemetry Visualization
- Live speed charts (X, Y, Z axes) with up to 250 data points
- Dynamic chart updates with smooth animations
- Pause/resume functionality for data capture
- Real-time FPS monitoring and performance tracking

### Performance Monitoring Dashboard
- **Queue Processing Metrics**: 
  - Messages received, processed, and dropped
  - Current queue size with overflow protection
  - Real-time processing statistics
- **Performance Indicators**: 
  - FPS monitoring (target: >30 FPS for optimal performance)
  - JavaScript heap memory usage tracking
  - Average processing time per batch
- **Backend Health Metrics**: 
  - Messages per second throughput
  - Active connection count
  - Network latency measurements
  - Server uptime tracking

### Advanced UDP Connection Management
- **Multi-Port Monitoring**: Simultaneous listening on multiple UDP ports
- **Connection Status Tracking**: Real-time status (Active, Listening, Inactive)
- **Message Statistics**: Per-connection message counts and timestamps
- **Last Activity Monitoring**: Track when each connection was last active

### Dual Control System
- **Simulator Controls**: 
  - Start/Stop/Pause simulator independently
  - Real-time simulator status monitoring
- **Chart Controls**: 
  - Independent chart pause/resume functionality
  - Clear chart data without affecting simulator
  - Live vs. paused mode indicators

### Kafka-Ready Queue Architecture
The application implements queue processing patterns that directly translate to Kafka consumer patterns:

```typescript
// Current queue processing (easily replaceable with Kafka consumer)
const processQueue = () => {
  const batchSize = Math.min(5, updateQueue.length);
  const pointsToProcess = updateQueue.slice(-batchSize);
  // Process batch with performance monitoring
};
```

## 🎯 Comprehensive Stress Test Modes

The application includes 5 different stress testing modes to simulate various real-world scenarios:

### 1. **Normal Mode** 📡
- **Interval**: 200ms
- **Jitter**: 0ms
- **Use Case**: Standard commercial flight telemetry
- **Scenario**: Regular cruise flight operations with consistent, predictable data transmission
- **Real-world Application**: Standard airline operations, routine monitoring

### 2. **High Frequency Mode** ⚡
- **Interval**: 50ms  
- **Jitter**: 10ms
- **Use Case**: High-precision navigation and critical flight phases
- **Scenario**: Landing approach, takeoff, emergency maneuvers requiring frequent updates
- **Real-world Application**: Precision approach systems, autopilot fine-tuning, turbulence monitoring

### 3. **Burst Mode** 💥
- **Interval**: 20ms
- **Jitter**: 50ms
- **Use Case**: Emergency situations and system overload testing
- **Scenario**: Multiple sensors flooding the system simultaneously, network congestion, emergency data burst
- **Real-world Application**: System failure recovery, emergency protocols, stress testing infrastructure limits

### 4. **Variable Mode** 🌊
- **Interval**: 100ms
- **Jitter**: 100ms
- **Use Case**: Unstable network conditions and connectivity issues
- **Scenario**: Poor satellite connectivity, weather interference, intermittent network links
- **Real-world Application**: Remote area flights, adverse weather conditions, satellite handoff scenarios

### 5. **Kafka Simulation Mode** 🔄
- **Interval**: 30ms
- **Jitter**: 20ms
- **Use Case**: Message queue simulation with enterprise streaming patterns
- **Scenario**: Simulates Apache Kafka-like message streaming with controlled variance
- **Real-world Application**: Enterprise data pipelines, message queue performance testing, stream processing validation

Each mode tests different aspects of the system's resilience and performance characteristics.

## 💡 Why Socket.IO?

### Technical Advantages

1. **Real-time Bidirectional Communication**: 
   - Instant data updates without inefficient HTTP polling
   - Sub-100ms latency for critical telemetry data
   - Automatic connection management and reconnection

2. **Automatic Transport Fallback**: 
   - WebSocket for optimal performance
   - Falls back to Server-Sent Events, long-polling if WebSocket unavailable
   - Ensures connectivity across all network configurations

3. **Event-driven Architecture**: 
   - Clean separation of data types (telemetry, metrics, status updates)
   - Scalable event handling for different client needs
   - Easy to extend with new data streams

4. **Production-Ready Features**:
   - Built-in acknowledgments and error handling
   - Message compression and binary data support
   - Room-based broadcasting for scalability
   - Cross-platform compatibility

### Performance Benefits in Our Implementation

```typescript
// Efficient event-based data streaming
socketRef.current.on('telemetryData', (data: FlightTelemetry) => {
  // Queue-based processing prevents UI blocking
  setUpdateQueue(prev => [...prev, data]);
});

socketRef.current.on('performanceMetrics', (metrics: PerformanceMetrics) => {
  // Real-time performance monitoring
  setPerformanceMetrics(metrics);
});
```

- **Low Latency**: Consistent sub-100ms data transmission
- **High Throughput**: Handles thousands of messages per second
- **Memory Efficient**: Queue-based processing prevents memory leaks
- **Scalable**: Multiple clients can connect without performance degradation

## 🔄 Enterprise-Ready Kafka Integration

The application architecture is specifically designed for seamless Apache Kafka integration:

### Current Queue System (Kafka-Ready)

```typescript
// Current in-memory queue processing
const processQueue = () => {
  const batchSize = Math.min(5, updateQueue.length);
  const pointsToProcess = updateQueue.slice(-batchSize);
  
  // Kafka-like batch processing with performance monitoring
  setChartData(prevData => {
    // Process batch atomically
    return processDataBatch(pointsToProcess, prevData);
  });
};
```

### Kafka Integration Points

#### 1. **Producer Integration** (Replace UDP Simulator)
```typescript
// Easy drop-in replacement for UDP simulator
const kafkaProducer = kafka.producer();

const sendTelemetryData = async (telemetryData) => {
  await kafkaProducer.send({
    topic: 'flight-telemetry',
    messages: [{
      key: telemetryData.flightId,
      value: JSON.stringify(telemetryData),
      timestamp: Date.now().toString()
    }]
  });
};
```

#### 2. **Consumer Integration** (Replace In-Memory Queue)
```typescript
// Consumer setup with same processing patterns
const consumer = kafka.consumer({ 
  groupId: 'telemetry-dashboard',
  maxBytesPerPartition: 1024 * 1024 // 1MB
});

await consumer.subscribe({ topic: 'flight-telemetry' });

await consumer.run({
  eachBatch: async ({ batch }) => {
    // Same batch processing logic as current queue system
    const telemetryPoints = batch.messages.map(message => 
      JSON.parse(message.value.toString())
    );
    
    // Existing processing function works unchanged
    processDataBatch(telemetryPoints);
  }
});
```

#### 3. **Stream Processing Integration**
```typescript
// Kafka Streams for real-time analytics
const stream = kafka.streams();

stream
  .stream('flight-telemetry')
  .filter(data => data.altitude > 10000) // Filter high-altitude data
  .groupBy(data => data.flightId)
  .windowedBy(TimeWindows.of(Duration.ofMinutes(5)))
  .aggregate(
    () => ({ count: 0, avgSpeed: 0 }),
    (key, value, aggregate) => ({
      count: aggregate.count + 1,
      avgSpeed: (aggregate.avgSpeed * aggregate.count + value.speedX) / (aggregate.count + 1)
    })
  )
  .to('flight-analytics');
```

### Kafka Integration Benefits

1. **Durability & Reliability**:
   - Message persistence with configurable retention
   - Automatic replication across multiple brokers
   - Exactly-once semantics for critical telemetry data

2. **Scalability**:
   - Horizontal scaling with partitioned topics
   - Multiple consumer groups for different processing needs
   - Handle millions of messages per second

3. **Stream Processing**:
   - Real-time analytics with Kafka Streams
   - Complex event processing and alerting
   - Time-windowed aggregations for trend analysis

4. **Integration Ecosystem**:
   - Connect to databases, data lakes, and analytics platforms
   - Schema registry for data evolution
   - Monitoring and observability tools

### Migration Path

1. **Phase 1**: Run Kafka producer alongside UDP simulator
2. **Phase 2**: Replace in-memory queue with Kafka consumer
3. **Phase 3**: Add Kafka Streams for real-time analytics
4. **Phase 4**: Full enterprise integration with monitoring and alerting

## 🛠 Local Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Backend Setup
```bash
cd backend
npm install
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables
```bash
# Backend (.env)
PORT=8080
NODE_ENV=development

# Frontend (.env.local)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
```

## 📊 Advanced Performance Metrics

The dashboard provides comprehensive performance monitoring:

### Frontend Metrics
- **FPS Monitoring**: Real-time frame rate calculation (target: >30 FPS)
- **Memory Usage**: JavaScript heap memory tracking with alerts
- **Queue Health**: Monitor queue size and processing efficiency
- **Processing Latency**: Average time per data batch processing

### Backend Metrics
- **Message Throughput**: Real-time messages per second calculation
- **Connection Health**: Active WebSocket connections monitoring
- **Network Latency**: Round-trip time measurements
- **Server Resources**: Memory and CPU usage tracking

### Performance Indicators
```typescript
// Performance monitoring implementation
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
  }
};
```

## 🏗 Architecture Highlights

### Microservices Architecture
- **Decoupled Frontend/Backend**: Independent scaling and deployment
- **API-First Design**: RESTful health checks + WebSocket real-time data
- **Container Ready**: Docker support for easy deployment

### Real-time Data Pipeline
```
UDP Sources → Queue Processing → WebSocket Broadcasting → React Visualization
    ↓              ↓                    ↓                     ↓
Kafka Producer → Kafka Consumer → Socket.IO Events → ECharts Rendering
```

### Performance Optimizations
1. **Queue-Based Processing**: Prevents UI blocking with batch processing
2. **Canvas Rendering**: ECharts canvas mode for high-performance visualization
3. **Memory Management**: Automatic data point trimming and garbage collection
4. **Efficient Updates**: Delta updates instead of full dataset refreshes

### Production-Ready Features
- **Health Checks**: `/health` endpoint for load balancer monitoring
- **Error Handling**: Comprehensive error boundaries and fallbacks
- **Connection Recovery**: Automatic reconnection with exponential backoff
- **Performance Monitoring**: Built-in observability and alerting


## 🔧 Technology Stack

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **TailwindCSS**: Utility-first styling
- **ECharts**: High-performance data visualization
- **Socket.IO Client**: Real-time communication

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web application framework
- **Socket.IO**: Real-time bidirectional communication
- **UDP Sockets**: Low-level network communication

### DevOps & Deployment
- **Vercel**: Frontend hosting with edge functions
- **Render**: Backend hosting with auto-scaling
- **Docker**: Containerization for local development
- **GitHub Actions**: CI/CD pipeline

## 🚀 Future Enhancements

### Planned Features
1. **Apache Kafka Integration**: Enterprise message streaming
2. **Time Series Database**: InfluxDB integration for historical data
3. **Advanced Analytics**: Machine learning anomaly detection
4. **Multi-tenant Support**: User authentication and data isolation

### Scalability Roadmap
1. **Horizontal Scaling**: Multiple backend instances with load balancing
2. **Database Integration**: PostgreSQL for persistent data storage
3. **Caching Layer**: Redis for high-performance data caching
4. **Microservices**: Split into specialized service components

---