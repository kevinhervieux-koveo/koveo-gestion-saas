import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPillarSchema, insertWorkspaceStatusSchema, insertQualityMetricSchema, insertFrameworkConfigSchema, insertUserSchema, insertOrganizationSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Development Pillars API
  app.get("/api/pillars", async (req, res) => {
    try {
      const pillars = await storage.getPillars();
      res.json(pillars);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pillars" });
    }
  });

  app.get("/api/pillars/:id", async (req, res) => {
    try {
      const pillar = await storage.getPillar(req.params.id);
      if (!pillar) {
        return res.status(404).json({ message: "Pillar not found" });
      }
      res.json(pillar);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pillar" });
    }
  });

  app.post("/api/pillars", async (req, res) => {
    try {
      const validatedData = insertPillarSchema.parse(req.body);
      const pillar = await storage.createPillar(validatedData);
      res.status(201).json(pillar);
    } catch (error) {
      res.status(400).json({ message: "Invalid pillar data" });
    }
  });

  app.patch("/api/pillars/:id", async (req, res) => {
    try {
      const pillar = await storage.updatePillar(req.params.id, req.body);
      if (!pillar) {
        return res.status(404).json({ message: "Pillar not found" });
      }
      res.json(pillar);
    } catch (error) {
      res.status(500).json({ message: "Failed to update pillar" });
    }
  });

  // Workspace Status API
  app.get("/api/workspace-status", async (req, res) => {
    try {
      const statuses = await storage.getWorkspaceStatuses();
      res.json(statuses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch workspace status" });
    }
  });

  app.get("/api/workspace-status/:component", async (req, res) => {
    try {
      const status = await storage.getWorkspaceStatus(req.params.component);
      if (!status) {
        return res.status(404).json({ message: "Workspace status not found" });
      }
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch workspace status" });
    }
  });

  app.post("/api/workspace-status", async (req, res) => {
    try {
      const validatedData = insertWorkspaceStatusSchema.parse(req.body);
      const status = await storage.createWorkspaceStatus(validatedData);
      res.status(201).json(status);
    } catch (error) {
      res.status(400).json({ message: "Invalid workspace status data" });
    }
  });

  app.patch("/api/workspace-status/:component", async (req, res) => {
    try {
      const { status } = req.body;
      const updatedStatus = await storage.updateWorkspaceStatus(req.params.component, status);
      if (!updatedStatus) {
        return res.status(404).json({ message: "Workspace status not found" });
      }
      res.json(updatedStatus);
    } catch (error) {
      res.status(500).json({ message: "Failed to update workspace status" });
    }
  });

  // Quality Metrics API
  app.get("/api/quality-metrics", async (req, res) => {
    try {
      const metrics = await storage.getQualityMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quality metrics" });
    }
  });

  app.post("/api/quality-metrics", async (req, res) => {
    try {
      const validatedData = insertQualityMetricSchema.parse(req.body);
      const metric = await storage.createQualityMetric(validatedData);
      res.status(201).json(metric);
    } catch (error) {
      res.status(400).json({ message: "Invalid quality metric data" });
    }
  });

  // Framework Configuration API
  app.get("/api/framework-config", async (req, res) => {
    try {
      const configs = await storage.getFrameworkConfigs();
      res.json(configs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch framework configuration" });
    }
  });

  app.get("/api/framework-config/:key", async (req, res) => {
    try {
      const config = await storage.getFrameworkConfig(req.params.key);
      if (!config) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  app.post("/api/framework-config", async (req, res) => {
    try {
      const validatedData = insertFrameworkConfigSchema.parse(req.body);
      const config = await storage.setFrameworkConfig(validatedData);
      res.status(201).json(config);
    } catch (error) {
      res.status(400).json({ message: "Invalid configuration data" });
    }
  });

  // Progress tracking endpoint for initialization
  app.post("/api/progress/update", async (req, res) => {
    try {
      const { step, progress } = req.body;
      
      // This could be expanded to track actual progress
      // For now, we'll just return a success response
      
      res.json({ 
        success: true, 
        step, 
        progress,
        message: "Progress updated successfully" 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update progress" });
    }
  });

  // Improvement Suggestions API (under /pillars namespace)
  app.get("/api/pillars/suggestions", async (req, res) => {
    try {
      const suggestions = await storage.getTopImprovementSuggestions(5);
      res.json(suggestions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch improvement suggestions" });
    }
  });

  app.post("/api/pillars/suggestions/:id/acknowledge", async (req, res) => {
    try {
      const suggestion = await storage.updateSuggestionStatus(req.params.id, 'Acknowledged');
      if (!suggestion) {
        return res.status(404).json({ message: "Suggestion not found" });
      }
      res.json(suggestion);
    } catch (error) {
      res.status(500).json({ message: "Failed to update suggestion status" });
    }
  });

  app.post("/api/pillars/suggestions/:id/complete", async (req, res) => {
    try {
      const suggestion = await storage.updateSuggestionStatus(req.params.id, 'Done');
      if (!suggestion) {
        return res.status(404).json({ message: "Suggestion not found" });
      }
      res.json(suggestion);
    } catch (error) {
      res.status(500).json({ message: "Failed to update suggestion status" });
    }
  });

  // Users API
  app.get("/api/users", async (req, res) => {
    try {
      // This would be implemented with proper pagination and filtering
      res.json({ message: "Users endpoint - TODO: Implement based on documentation" });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Remove password from response
      const { password, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(validatedData);
      // Remove password from response
      const { password, ...userResponse } = user;
      res.status(201).json(userResponse);
    } catch (error) {
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  // Organizations API
  app.get("/api/organizations", async (req, res) => {
    try {
      // This would be implemented with proper pagination and filtering
      res.json({ message: "Organizations endpoint - TODO: Implement based on documentation" });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });

  app.get("/api/organizations/:id", async (req, res) => {
    try {
      // This would use storage.getOrganization when implemented
      res.json({ message: "Organization details - TODO: Implement based on documentation" });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch organization" });
    }
  });

  app.post("/api/organizations", async (req, res) => {
    try {
      const validatedData = insertOrganizationSchema.parse(req.body);
      // This would use storage.createOrganization when implemented
      res.status(201).json({ message: "Organization created - TODO: Implement based on documentation" });
    } catch (error) {
      res.status(400).json({ message: "Invalid organization data" });
    }
  });

  // Initialize QA Pillar endpoint
  app.post("/api/pillars/initialize-qa", async (req, res) => {
    try {
      // Update the QA pillar status to 'in-progress'
      const qaPillar = Array.from((storage as any).pillars.values())
        .find((p: any) => p.name.includes("QA")) as any;
      
      if (qaPillar?.id) {
        const updated = await storage.updatePillar(qaPillar.id, { 
          status: 'in-progress',
          updatedAt: new Date()
        });
        
        // Also update workspace status
        await storage.updateWorkspaceStatus("Pillar Framework", "in-progress");
        
        res.json({ 
          success: true, 
          pillar: updated,
          message: "QA Pillar initialization started" 
        });
      } else {
        res.status(404).json({ message: "QA Pillar not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to initialize QA pillar" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
