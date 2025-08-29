import express, { type Express, Request, Response } from 'express';
import { createServer, type Server } from 'http';
import { db } from './db';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import session from 'express-session';
import connectPg from 'connect-pg-simple';

/**
 * Simplified routes for essential functionality
 * This replaces the complex routes-minimal.ts to avoid import/dependency issues
 * Uses the development database properly
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration for development database
  const PgSession = connectPg(session);
  const sessionStore = new PgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
  });

  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'dev-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: false, // Set to true in production with HTTPS
    },
  }));

  // JSON body parser middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Basic CORS headers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Essential authentication routes using the development database
  app.get('/api/auth/user', async (req: any, res: any) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ 
          error: 'Not authenticated',
          message: 'Please log in to access this resource'
        });
      }

      // Get user from development database
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, req.session.userId))
        .limit(1);

      if (!user) {
        req.session.destroy();
        return res.status(401).json({ 
          error: 'User not found',
          message: 'Please log in again'
        });
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive
      });

    } catch (error: any) {
      console.error('Get user error:', error);
      res.status(500).json({ 
        error: 'Failed to get user',
        message: 'An error occurred while retrieving user information'
      });
    }
  });

  app.post('/api/auth/login', async (req: any, res: any) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ 
          error: 'Missing credentials',
          message: 'Email and password are required'
        });
      }

      // Look up user in development database
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email.toLowerCase().trim()))
        .limit(1);

      if (!user) {
        return res.status(401).json({ 
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({ 
          error: 'Account disabled',
          message: 'Your account has been disabled. Please contact support.'
        });
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.passwordHash || '');
      if (!passwordMatch) {
        return res.status(401).json({ 
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }

      // Create session
      req.session.userId = user.id;
      req.session.userRole = user.role;

      // Update last login time
      await db
        .update(schema.users)
        .set({ lastLoginAt: new Date() })
        .where(eq(schema.users.id, user.id));

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive
        },
        message: 'Login successful'
      });

    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ 
        error: 'Login failed',
        message: 'An error occurred during login'
      });
    }
  });

  app.post('/api/auth/logout', (req: any, res: any) => {
    // Clear any session data
    if (req.session) {
      req.session.destroy();
    }
    res.json({ message: 'Logged out successfully' });
  });

  // Test route to verify API is working
  app.get('/api/test', (req, res) => {
    res.json({ 
      message: 'API is working',
      timestamp: new Date().toISOString(),
      status: 'simplified-routes-active'
    });
  });

  // Basic health check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      routes: 'simplified'
    });
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  console.log('✅ Simplified routes registered successfully');
  return httpServer;
}