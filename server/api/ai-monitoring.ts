import { Request, Response } from 'express';
import { db } from '../db';
import { 
  aiInteractions, 
  aiInsights, 
  aiMetrics,
  type InsertAIInteraction,
  type InsertAIInsight,
  type InsertAIMetrics 
} from '@shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

/**
 * Get AI metrics for dashboard display.
 * Returns aggregated metrics for AI performance monitoring.
 */
export async function getAIMetrics(req: Request, res: Response) {
  try {
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get or create today's metrics
    let [metrics] = await db
      .select()
      .from(aiMetrics)
      .where(eq(aiMetrics.date, today.toISOString().split('T')[0]))
      .limit(1);

    if (!metrics) {
      // Calculate metrics from interactions
      const interactions = await db
        .select()
        .from(aiInteractions)
        .where(gte(aiInteractions.timestamp, today));

      const insights = await db
        .select()
        .from(aiInsights);

      const totalInteractions = interactions.length;
      const successfulInteractions = interactions.filter(i => i.status === 'success').length;
      const successRate = totalInteractions > 0 ? (successfulInteractions / totalInteractions) * 100 : 0;
      const avgResponseTime = totalInteractions > 0 
        ? interactions.reduce((sum, i) => sum + i.duration, 0) / totalInteractions 
        : 0;

      const categories = [...new Set(interactions.map(i => i.category))];
      const improvementsSuggested = insights.filter(i => i.status === 'new').length;
      const improvementsImplemented = insights.filter(i => i.status === 'completed').length;
      
      // Calculate AI efficiency based on success rate and implementation rate
      const implementationRate = improvementsSuggested > 0 
        ? (improvementsImplemented / improvementsSuggested) * 100 
        : 0;
      const aiEfficiency = (successRate * 0.6 + implementationRate * 0.4);

      // Create new metrics record
      const newMetrics: InsertAIMetrics = {
        date: today.toISOString().split('T')[0],
        totalInteractions,
        successRate: successRate.toFixed(2),
        avgResponseTime: Math.round(avgResponseTime),
        improvementsSuggested,
        improvementsImplemented,
        categoriesAnalyzed: categories,
        lastAnalysis: new Date(),
        aiEfficiency: aiEfficiency.toFixed(2),
      };

      [metrics] = await db
        .insert(aiMetrics)
        .values(newMetrics)
        .returning();
    }

    res.json({
      totalInteractions: metrics.totalInteractions || 0,
      successRate: parseFloat(metrics.successRate || '0'),
      avgResponseTime: metrics.avgResponseTime || 0,
      improvementsSuggested: metrics.improvementsSuggested || 0,
      improvementsImplemented: metrics.improvementsImplemented || 0,
      categoriesAnalyzed: metrics.categoriesAnalyzed || [],
      lastAnalysis: metrics.lastAnalysis || new Date(),
      aiEfficiency: parseFloat(metrics.aiEfficiency || '0'),
    });
  } catch (error) {
    console.error('Error fetching AI metrics:', error);
    res.status(500).json({ error: 'Failed to fetch AI metrics' });
  }
}

/**
 * Get recent AI interactions.
 * Returns the latest AI agent interactions for monitoring.
 */
export async function getAIInteractions(req: Request, res: Response) {
  try {
    const interactions = await db
      .select()
      .from(aiInteractions)
      .orderBy(desc(aiInteractions.timestamp))
      .limit(50);

    res.json(interactions);
  } catch (error) {
    console.error('Error fetching AI interactions:', error);
    res.status(500).json({ error: 'Failed to fetch AI interactions' });
  }
}

/**
 * Get AI-generated insights.
 * Returns improvement recommendations from AI analysis.
 */
export async function getAIInsights(req: Request, res: Response) {
  try {
    const insights = await db
      .select()
      .from(aiInsights)
      .orderBy(desc(aiInsights.createdAt))
      .limit(20);

    res.json(insights);
  } catch (error) {
    console.error('Error fetching AI insights:', error);
    res.status(500).json({ error: 'Failed to fetch AI insights' });
  }
}

/**
 * Trigger AI analysis.
 * Simulates running an AI analysis of the application.
 */
export async function triggerAIAnalysis(req: Request, res: Response) {
  try {
    // Record the interaction
    const interaction: InsertAIInteraction = {
      action: 'Full System Analysis',
      category: 'Replit App',
      duration: Math.floor(Math.random() * 3000) + 1000, // Simulate 1-4 second analysis
      status: 'success',
      improvement: 'Analyzing application for improvement opportunities',
      impact: 'high',
      metadata: {
        triggeredBy: 'manual',
        timestamp: new Date().toISOString(),
      },
    };

    await db.insert(aiInteractions).values(interaction);

    // Generate sample insights based on common improvement areas
    const sampleInsights: InsertAIInsight[] = [
      {
        type: 'performance',
        title: 'Optimize Database Queries',
        description: 'Several database queries are running without proper indexing, causing slow response times.',
        recommendation: 'Add indexes to frequently queried columns and implement query result caching for common requests.',
        priority: 'high',
        status: 'new',
      },
      {
        type: 'quality',
        title: 'Increase Test Coverage',
        description: 'Current test coverage is below recommended threshold. Critical business logic lacks comprehensive testing.',
        recommendation: 'Add unit tests for authentication flows and business logic components to reach 80% coverage.',
        priority: 'medium',
        status: 'new',
      },
      {
        type: 'security',
        title: 'Implement Rate Limiting',
        description: 'API endpoints lack rate limiting, exposing the application to potential abuse.',
        recommendation: 'Implement rate limiting middleware with appropriate thresholds for each endpoint category.',
        priority: 'high',
        status: 'new',
      },
      {
        type: 'ux',
        title: 'Improve Mobile Responsiveness',
        description: 'Several dashboard components do not render optimally on mobile devices.',
        recommendation: 'Implement responsive design patterns for tables and complex dashboard widgets.',
        priority: 'medium',
        status: 'new',
      },
      {
        type: 'efficiency',
        title: 'Bundle Size Optimization',
        description: 'Frontend bundle size exceeds recommended limits, affecting initial load performance.',
        recommendation: 'Implement code splitting and lazy loading for non-critical components.',
        priority: 'low',
        status: 'new',
      },
    ];

    // Insert a random subset of insights
    const numberOfInsights = Math.floor(Math.random() * 3) + 2; // 2-4 insights
    const selectedInsights = sampleInsights
      .sort(() => Math.random() - 0.5)
      .slice(0, numberOfInsights);

    await db.insert(aiInsights).values(selectedInsights);

    // Update metrics
    await updateAIMetrics();

    res.json({ 
      message: 'AI analysis triggered successfully',
      insightsGenerated: numberOfInsights 
    });
  } catch (error) {
    console.error('Error triggering AI analysis:', error);
    res.status(500).json({ error: 'Failed to trigger AI analysis' });
  }
}

/**
 * Apply an AI suggestion.
 * Marks an insight as applied/implemented.
 */
export async function applyAISuggestion(req: Request, res: Response) {
  try {
    const { insightId } = req.params;

    // Update the insight status
    const [updatedInsight] = await db
      .update(aiInsights)
      .set({
        status: 'completed',
        implementedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiInsights.id, insightId))
      .returning();

    if (!updatedInsight) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    // Record the interaction
    const interaction: InsertAIInteraction = {
      action: `Applied suggestion: ${updatedInsight.title}`,
      category: 'Replit App',
      duration: Math.floor(Math.random() * 500) + 100,
      status: 'success',
      improvement: updatedInsight.recommendation,
      impact: updatedInsight.priority as 'high' | 'medium' | 'low',
      metadata: {
        insightId: updatedInsight.id,
        type: updatedInsight.type,
      },
    };

    await db.insert(aiInteractions).values(interaction);

    // Update metrics
    await updateAIMetrics();

    res.json({ 
      message: 'Suggestion applied successfully',
      insight: updatedInsight 
    });
  } catch (error) {
    console.error('Error applying AI suggestion:', error);
    res.status(500).json({ error: 'Failed to apply AI suggestion' });
  }
}

/**
 * Helper function to update AI metrics.
 */
async function updateAIMetrics() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Get today's interactions
  const interactions = await db
    .select()
    .from(aiInteractions)
    .where(gte(aiInteractions.timestamp, today));

  // Get all insights
  const insights = await db
    .select()
    .from(aiInsights);

  const totalInteractions = interactions.length;
  const successfulInteractions = interactions.filter(i => i.status === 'success').length;
  const successRate = totalInteractions > 0 ? (successfulInteractions / totalInteractions) * 100 : 0;
  const avgResponseTime = totalInteractions > 0 
    ? interactions.reduce((sum, i) => sum + i.duration, 0) / totalInteractions 
    : 0;

  const categories = [...new Set(interactions.map(i => i.category))];
  const improvementsSuggested = insights.length;
  const improvementsImplemented = insights.filter(i => i.status === 'completed').length;
  
  const implementationRate = improvementsSuggested > 0 
    ? (improvementsImplemented / improvementsSuggested) * 100 
    : 0;
  const aiEfficiency = (successRate * 0.6 + implementationRate * 0.4);

  // Update or insert metrics
  await db
    .insert(aiMetrics)
    .values({
      date: todayStr,
      totalInteractions,
      successRate: successRate.toFixed(2),
      avgResponseTime: Math.round(avgResponseTime),
      improvementsSuggested,
      improvementsImplemented,
      categoriesAnalyzed: categories,
      lastAnalysis: new Date(),
      aiEfficiency: aiEfficiency.toFixed(2),
    })
    .onConflictDoUpdate({
      target: aiMetrics.date,
      set: {
        totalInteractions,
        successRate: successRate.toFixed(2),
        avgResponseTime: Math.round(avgResponseTime),
        improvementsSuggested,
        improvementsImplemented,
        categoriesAnalyzed: categories,
        lastAnalysis: new Date(),
        aiEfficiency: aiEfficiency.toFixed(2),
        updatedAt: new Date(),
      },
    });
}

/**
 * Record an AI interaction.
 * Used to track AI agent activities.
 */
export async function recordAIInteraction(req: Request, res: Response) {
  try {
    const interaction: InsertAIInteraction = req.body;
    
    const [newInteraction] = await db
      .insert(aiInteractions)
      .values(interaction)
      .returning();

    // Update metrics after recording interaction
    await updateAIMetrics();

    res.json(newInteraction);
  } catch (error) {
    console.error('Error recording AI interaction:', error);
    res.status(500).json({ error: 'Failed to record AI interaction' });
  }
}