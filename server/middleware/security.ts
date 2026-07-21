import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

// Content Security Policy configuration
export const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    fontSrc: ["'self'", "data:"],
    imgSrc: ["'self'", "data:", "blob:"],
    // The active RT/PT runtime is accountless and same-origin. Do not grant
    // production renderer connectivity to arbitrary third-party tenants.
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    frameAncestors: ["'none'"],
  },
};

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? cspConfig : false,
  crossOriginEmbedderPolicy: false,
});

// CORS configuration
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Non-browser clients do not send Origin; Host binding is enforced separately.
    if (!origin) return callback(null, true);

    let normalizedOrigin: string;
    try {
      normalizedOrigin = new URL(origin).origin;
    } catch {
      return callback(new Error('Invalid request origin'));
    }

    const allowedOrigins = new Set(
      (process.env.CORS_ORIGINS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
        .map(value => {
          try {
            return new URL(value).origin;
          } catch {
            return '';
          }
        })
        .filter(Boolean)
    );

    // The supported standalone browser/PWA is hard-bound to loopback. Allow
    // its own origin in production without broadening access to remote sites.
    const localPort = /^\d{1,5}$/u.test(String(process.env.PORT || '5000'))
      ? String(process.env.PORT || '5000')
      : '5000';
    [
      `http://127.0.0.1:${localPort}`,
      `http://localhost:${localPort}`,
      `http://[::1]:${localPort}`,
    ].forEach(value => allowedOrigins.add(value));

    if (process.env.NODE_ENV !== 'production') {
      [
        'http://localhost:3000', 
        'http://localhost:5000', 
        'http://localhost:5173', 
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8080'
      ].forEach(value => allowedOrigins.add(value));
    }

    if (allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_ALL_ORIGINS === 'true') {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-org-id'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400, // 24 hours
};

// Request sanitization middleware
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction) => {
  // Remove any potentially dangerous fields from body
  if (req.body) {
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    dangerousKeys.forEach(key => {
      delete req.body[key];
    });
  }

  // Limit request body size (this should also be done at nginx level)
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
    return res.status(413).json({ error: 'Request body too large' });
  }

  next();
};
