import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: boolean;
    memory: boolean;
    diskSpace: boolean;
  };
  metrics?: {
    responseTime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    activeConnections: number;
  };
}

// Track active connections
let activeConnections = 0;

// Track response times for performance monitoring
const responseTimeHistory: number[] = [];
const maxHistorySize = 100;

// Request tracking middleware
export const requestTracking = (req: Request, res: Response, next: NextFunction) => {
  // Skip tracking for static assets and HMR in development to reduce overhead
  const isDev = process.env.NODE_ENV !== 'production';
  const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i.test(req.path);
  const isViteHMR = req.path.includes('/@vite') || req.path.includes('/@fs') || req.path.includes('node_modules');
  
  if (isDev && (isStaticAsset || isViteHMR)) {
    return next();
  }

  activeConnections++;
  const startTime = performance.now();

  // Log request details (for debugging)
  const requestId = Math.random().toString(36).substring(7);
  (req as Request & { requestId: string }).requestId = requestId;

  res.on('finish', () => {
    activeConnections--;
    const duration = performance.now() - startTime;
    
    // Track response time
    responseTimeHistory.push(duration);
    if (responseTimeHistory.length > maxHistorySize) {
      responseTimeHistory.shift();
    }

    // Log slow requests (only for API routes - Vite assets can be slow during development)
    if (duration > 1000 && req.path.startsWith('/api')) {
      console.warn(`Slow request detected: ${req.method} ${req.path} took ${duration.toFixed(2)}ms`);
    }
  });

  next();
};

// Health check endpoint
export const healthCheck = async (req: Request, res: Response) => {
  try {
    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: false,
        memory: false,
        diskSpace: false,
      },
    };

    // Check database connectivity
    try {
      const { db } = await import('../db');
      const result = await db.execute('SELECT 1');
      health.checks.database = true;
    } catch (error) {
      health.checks.database = false;
      health.status = 'degraded';
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const memoryThreshold = 1024 * 1024 * 1024; // 1GB
    health.checks.memory = memUsage.heapUsed < memoryThreshold;
    if (!health.checks.memory) {
      health.status = 'degraded';
    }

    // Check disk space (simplified - in production use proper disk checking)
    health.checks.diskSpace = true; // Assume OK for now

    // Add detailed metrics if requested
    if (req.query.detailed === 'true') {
      const avgResponseTime = responseTimeHistory.length > 0
        ? responseTimeHistory.reduce((a, b) => a + b, 0) / responseTimeHistory.length
        : 0;

      health.metrics = {
        responseTime: avgResponseTime,
        memoryUsage: memUsage,
        cpuUsage: process.cpuUsage(),
        activeConnections,
      };
    }

    // Determine overall health status
    const allChecks = Object.values(health.checks);
    if (allChecks.every(check => check === true)) {
      health.status = 'healthy';
    } else if (allChecks.some(check => check === true)) {
      health.status = 'degraded';
    } else {
      health.status = 'unhealthy';
    }

    // Set appropriate HTTP status code
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
};

// Liveness probe (simple check if service is alive)
export const livenessProbe = (req: Request, res: Response) => {
  res.status(200).json({ alive: true });
};

// Readiness probe (check if service is ready to accept requests)
export const readinessProbe = async (req: Request, res: Response) => {
  try {
    // Check database connection
    const { db } = await import('../db');
    await db.execute('SELECT 1');
    
    res.status(200).json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false, error: 'Database not ready' });
  }
};

// Metrics endpoint (for monitoring tools like Prometheus)
export const metricsEndpoint = (req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  const avgResponseTime = responseTimeHistory.length > 0
    ? responseTimeHistory.reduce((a, b) => a + b, 0) / responseTimeHistory.length
    : 0;

  const metrics = [
    `# HELP process_uptime_seconds Process uptime in seconds`,
    `# TYPE process_uptime_seconds gauge`,
    `process_uptime_seconds ${process.uptime()}`,
    '',
    `# HELP nodejs_heap_size_used_bytes Process heap size used in bytes`,
    `# TYPE nodejs_heap_size_used_bytes gauge`,
    `nodejs_heap_size_used_bytes ${memUsage.heapUsed}`,
    '',
    `# HELP nodejs_heap_size_total_bytes Process heap size total in bytes`,
    `# TYPE nodejs_heap_size_total_bytes gauge`,
    `nodejs_heap_size_total_bytes ${memUsage.heapTotal}`,
    '',
    `# HELP http_active_connections Number of active HTTP connections`,
    `# TYPE http_active_connections gauge`,
    `http_active_connections ${activeConnections}`,
    '',
    `# HELP http_average_response_time_ms Average HTTP response time in milliseconds`,
    `# TYPE http_average_response_time_ms gauge`,
    `http_average_response_time_ms ${avgResponseTime.toFixed(2)}`,
    '',
    `# HELP nodejs_cpu_user_seconds_total CPU user time in seconds`,
    `# TYPE nodejs_cpu_user_seconds_total counter`,
    `nodejs_cpu_user_seconds_total ${cpuUsage.user / 1000000}`,
    '',
    `# HELP nodejs_cpu_system_seconds_total CPU system time in seconds`,
    `# TYPE nodejs_cpu_system_seconds_total counter`,
    `nodejs_cpu_system_seconds_total ${cpuUsage.system / 1000000}`,
  ].join('\n');

  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics);
};
