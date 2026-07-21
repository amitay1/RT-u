import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 60000); // Clean every minute

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export function createRateLimiter(options: RateLimitOptions = {}) {
  const {
    windowMs = 60000, // 1 minute default
    max = 100, // 100 requests per window
    message = 'Too many requests, please try again later.',
    keyGenerator = (req: Request) => {
      // Use IP + org_id for rate limiting
      const ip = req.headers['x-forwarded-for'] || req.ip;
      const orgId = req.orgId || 'no-org';
      return `${ip}:${orgId}`;
    },
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    if (!store[key]) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    // Reset if window expired
    if (store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    // Increment counter
    store[key].count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - store[key].count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(store[key].resetTime).toISOString());

    // Check if limit exceeded
    if (store[key].count > max) {
      res.setHeader('Retry-After', Math.ceil((store[key].resetTime - now) / 1000).toString());
      
      // Track response for conditional skipping
      const originalSend = res.send;
      res.send = function(data: unknown) {
        const statusCode = res.statusCode;
        
        // Decrement if we should skip this request type
        if ((statusCode < 400 && skipSuccessfulRequests) || 
            (statusCode >= 400 && skipFailedRequests)) {
          store[key].count--;
        }
        
        return originalSend.call(this, data);
      };
      
      return res.status(429).json({ 
        error: message,
        retryAfter: Math.ceil((store[key].resetTime - now) / 1000),
      });
    }

    // Track response for conditional skipping
    const originalSend = res.send;
    res.send = function(data: unknown) {
      const statusCode = res.statusCode;
      
      // Decrement if we should skip this request type
      if ((statusCode < 400 && skipSuccessfulRequests) || 
          (statusCode >= 400 && skipFailedRequests)) {
        store[key].count--;
      }
      
      return originalSend.call(this, data);
    };

    next();
  };
}

// Specific rate limiters for different endpoints
export const generalRateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  max: 100, // 100 requests per minute
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 auth attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.',
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  max: 60, // 60 API calls per minute
  skipSuccessfulRequests: false,
  skipFailedRequests: true, // Don't count failed requests
});

export const strictRateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  max: 10, // 10 requests per minute for sensitive operations
  message: 'Rate limit exceeded for sensitive operation.',
});
