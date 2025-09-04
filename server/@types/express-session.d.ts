import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    userRole?: string;
    role?: string;
    user?: any;
    testValue?: string;
    store?: any;
  }
}