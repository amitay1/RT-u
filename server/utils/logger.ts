import winston from 'winston';
import path from 'path';

type LogContext = Record<string, unknown>;

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston about our colors
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}${info.stack ? '\n' + info.stack : ''}`,
  ),
);

// Define which transports to use based on environment
const transports: winston.transport[] = [];

// Always log to console
transports.push(
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? format : consoleFormat,
  }),
);

// In production, also log to files
if (process.env.NODE_ENV === 'production') {
  // Log all levels to combined.log
  transports.push(
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      format,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  );

  // Log only errors to error.log
  transports.push(
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      format,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  );
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan HTTP logger
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Utility functions for structured logging
export const logError = (error: Error, context?: LogContext) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    ...context,
  });
};

export const logWarning = (message: string, context?: LogContext) => {
  logger.warn({
    message,
    ...context,
  });
};

export const logInfo = (message: string, context?: LogContext) => {
  logger.info({
    message,
    ...context,
  });
};

export const logDebug = (message: string, context?: LogContext) => {
  logger.debug({
    message,
    ...context,
  });
};

export const logHttp = (message: string, context?: LogContext) => {
  logger.http({
    message,
    ...context,
  });
};

// Audit logging for sensitive operations
export const logAudit = (action: string, userId: string, orgId: string, details?: LogContext) => {
  logger.info({
    type: 'AUDIT',
    action,
    userId,
    orgId,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Performance logging
export const logPerformance = (operation: string, duration: number, context?: LogContext) => {
  const level = duration > 1000 ? 'warn' : 'info';
  logger.log(level, {
    type: 'PERFORMANCE',
    operation,
    duration,
    ...context,
  });
};

export default logger;
