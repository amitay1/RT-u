// Augment Express' Request type with our auth-related properties.
// This file is picked up by tsconfig.node.json (see "include").

declare namespace Express {
  // Properties injected by the mockAuth / real auth middleware
  export interface Request {
    userId?: string;
    orgId?: string | null;
  }
}

declare module 'cors' {
  import type { RequestHandler } from 'express';

  export default function cors(options?: unknown): RequestHandler;
}

declare module 'morgan' {
  import type { RequestHandler } from 'express';

  interface MorganOptions {
    stream?: { write: (message: string) => void };
  }

  export default function morgan(format: string, options?: MorganOptions): RequestHandler;
}

declare module 'compression' {
  import type { RequestHandler } from 'express';

  export default function compression(options?: unknown): RequestHandler;
}
