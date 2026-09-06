declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
        uid: string;
        email?: string;
      };
    }
  }
}

export {};
