declare global {
  namespace Express {
    interface Request {
      domain?: string;
      isKoveoProduction?: boolean;
    }
  }
}

export {};