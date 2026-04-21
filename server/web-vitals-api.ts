/**
 * Enhanced Web Vitals API for Quebec Property Management SaaS
 * Collects and analyzes client-side performance metrics
 */

import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// In-memory storage for Web Vitals (in production, use a database)
interface WebVitalMetric {
  id: string;
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  url: string;
  userAgent: string;
  sessionId?: string;
  userId?: string;
}

const webVitalsData: WebVitalMetric[] = [];
const MAX_METRICS = 10000; // Keep last 10k metrics

// Web Vitals submission schema
const webVitalSchema = z.object({
  name: z.enum(['CLS', 'FID', 'LCP', 'FCP', 'TTFB', 'INP']),
  value: z.number().nonnegative(),
  id: z.string(),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  timestamp: z.number(),
  url: z.string().url(),
  userAgent: z.string(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
});

/**
 * Submits Web Vitals metrics from client
 */
router.post('/api/performance/web-vitals', async (req, res) => {
  try {
    const metric = webVitalSchema.parse(req.body);
    
    // Store the metric
    webVitalsData.push(metric);
    
    // Keep only the latest metrics to prevent memory issues
    if (webVitalsData.length > MAX_METRICS) {
      webVitalsData.shift();
    }
    
    // Log concerning metrics
    if (metric.rating === 'poor') {
      console.warn(`🚨 Poor Web Vital detected: ${metric.name} = ${metric.value} on ${metric.url}`);
    }
    
    res.json({ 
      success: true, 
      message: 'Web Vital recorded successfully',
      metric: {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
      }
    });
    
  } catch (error) {
    console.error('Failed to record Web Vital:', error);
    res.status(400).json({ 
      error: 'Invalid Web Vital data',
      details: error instanceof z.ZodError ? error.issues : (error as Error).message
    });
  }
});

/**
 * Gets Web Vitals analytics and trends
 */
router.get('/api/performance/web-vitals/analytics', async (req, res) => {
  try {
    const timeRange = req.query.timeRange as string || '1h';
    const url = req.query.url as string;
    
    // Calculate time threshold
    const now = Date.now();
    const timeThresholds = {
      '1h': now - (60 * 60 * 1000),
      '24h': now - (24 * 60 * 60 * 1000),
      '7d': now - (7 * 24 * 60 * 60 * 1000),
      '30d': now - (30 * 24 * 60 * 60 * 1000),
    };
    
    const threshold = timeThresholds[timeRange as keyof typeof timeThresholds] || timeThresholds['1h'];
    
    // Filter metrics
    let filteredMetrics = webVitalsData.filter(metric => metric.timestamp >= threshold);
    
    if (url) {
      filteredMetrics = filteredMetrics.filter(metric => metric.url === url);
    }
    
    // Calculate analytics
    const analytics = {
      overview: calculateOverview(filteredMetrics),
      trends: calculateTrends(filteredMetrics),
      distribution: calculateDistribution(filteredMetrics),
      recommendations: generateRecommendations(filteredMetrics),
      timeRange,
      totalMetrics: filteredMetrics.length,
    };
    
    res.json(analytics);
    
  } catch (error) {
    console.error('Failed to get Web Vitals analytics:', error);
    res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
});

/**
 * Gets real-time Web Vitals summary
 */
router.get('/api/performance/web-vitals/summary', async (req, res) => {
  try {
    // Get metrics from last 5 minutes
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentMetrics = webVitalsData.filter(metric => metric.timestamp >= fiveMinutesAgo);
    
    const summary = {
      activeUsers: new Set(recentMetrics.map(m => m.sessionId || m.userAgent)).size,
      metrics: {
        CLS: calculateMetricSummary(recentMetrics.filter(m => m.name === 'CLS')),
        FID: calculateMetricSummary(recentMetrics.filter(m => m.name === 'FID')),
        LCP: calculateMetricSummary(recentMetrics.filter(m => m.name === 'LCP')),
        FCP: calculateMetricSummary(recentMetrics.filter(m => m.name === 'FCP')),
        TTFB: calculateMetricSummary(recentMetrics.filter(m => m.name === 'TTFB')),
      },
      overallScore: calculateOverallScore(recentMetrics),
      alertsCount: recentMetrics.filter(m => m.rating === 'poor').length,
      timestamp: new Date().toISOString(),
    };
    
    res.json(summary);
    
  } catch (error) {
    console.error('Failed to get Web Vitals summary:', error);
    res.status(500).json({ error: 'Failed to retrieve summary' });
  }
});

/**
 * Gets performance alerts and issues
 */
router.get('/api/performance/web-vitals/alerts', async (req, res) => {
  try {
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    const recentMetrics = webVitalsData.filter(metric => metric.timestamp >= thirtyMinutesAgo);
    
    const alerts = [];
    
    // Check for poor Core Web Vitals
    const poorMetrics = recentMetrics.filter(m => m.rating === 'poor');
    if (poorMetrics.length > 0) {
      const groupedByMetric = groupBy(poorMetrics, 'name');
      
      Object.entries(groupedByMetric).forEach(([metricName, metrics]) => {
        if (metrics.length > 5) { // More than 5 poor instances
          alerts.push({
            type: 'poor_metric',
            severity: 'high',
            metric: metricName,
            count: metrics.length,
            message: `${metricName} showing poor performance (${metrics.length} occurrences)`,
            recommendation: getMetricRecommendation(metricName),
            timestamp: Date.now(),
          });
        }
      });
    }
    
    // Check for degradation trends
    const hourAgo = Date.now() - (60 * 60 * 1000);
    const previousHourMetrics = webVitalsData.filter(
      m => m.timestamp >= hourAgo && m.timestamp < thirtyMinutesAgo
    );
    
    ['CLS', 'FID', 'LCP'].forEach(metricName => {
      const recent = recentMetrics.filter(m => m.name === metricName);
      const previous = previousHourMetrics.filter(m => m.name === metricName);
      
      if (recent.length > 0 && previous.length > 0) {
        const recentAvg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
        const previousAvg = previous.reduce((sum, m) => sum + m.value, 0) / previous.length;
        
        const degradation = ((recentAvg - previousAvg) / previousAvg) * 100;
        
        if (degradation > 20) { // 20% degradation
          alerts.push({
            type: 'performance_degradation',
            severity: 'medium',
            metric: metricName,
            degradation: `${degradation.toFixed(1)}%`,
            message: `${metricName} performance degraded by ${degradation.toFixed(1)}%`,
            recommendation: `Investigate recent changes that might affect ${metricName}`,
            timestamp: Date.now(),
          });
        }
      }
    });
    
    res.json({
      alerts: alerts.sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity as keyof typeof severityOrder] - severityOrder[a.severity as keyof typeof severityOrder];
      }),
      count: alerts.length,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Failed to get performance alerts:', error);
    res.status(500).json({ error: 'Failed to retrieve alerts' });
  }
});

// Helper functions

function calculateOverview(metrics: WebVitalMetric[]) {
  const byMetric = groupBy(metrics, 'name');
  const overview: Record<string, any> = {};
  
  Object.entries(byMetric).forEach(([name, values]) => {
    const ratings = groupBy(values, 'rating');
    overview[name] = {
      total: values.length,
      average: values.reduce((sum, m) => sum + m.value, 0) / values.length,
      ratings: {
        good: ratings.good?.length || 0,
        'needs-improvement': ratings['needs-improvement']?.length || 0,
        poor: ratings.poor?.length || 0,
      },
    };
  });
  
  return overview;
}

function calculateTrends(metrics: WebVitalMetric[]) {
  // Group by 10-minute intervals
  const intervals = new Map<number, WebVitalMetric[]>();
  const intervalSize = 10 * 60 * 1000; // 10 minutes
  
  metrics.forEach(metric => {
    const interval = Math.floor(metric.timestamp / intervalSize) * intervalSize;
    if (!intervals.has(interval)) {
      intervals.set(interval, []);
    }
    intervals.get(interval)!.push(metric);
  });
  
  const trends = Array.from(intervals.entries())
    .sort(([a], [b]) => a - b)
    .map(([timestamp, intervalMetrics]) => {
      const byMetric = groupBy(intervalMetrics, 'name');
      const data: Record<string, number> = { timestamp };
      
      Object.entries(byMetric).forEach(([name, values]) => {
        data[name] = values.reduce((sum, m) => sum + m.value, 0) / values.length;
      });
      
      return data;
    });
  
  return trends;
}

function calculateDistribution(metrics: WebVitalMetric[]) {
  const distribution = groupBy(metrics, 'rating');
  return {
    good: distribution.good?.length || 0,
    'needs-improvement': distribution['needs-improvement']?.length || 0,
    poor: distribution.poor?.length || 0,
  };
}

function generateRecommendations(metrics: WebVitalMetric[]) {
  const recommendations = [];
  const byMetric = groupBy(metrics, 'name');
  
  Object.entries(byMetric).forEach(([name, values]) => {
    const poorCount = values.filter(m => m.rating === 'poor').length;
    const poorPercentage = (poorCount / values.length) * 100;
    
    if (poorPercentage > 10) {
      recommendations.push({
        metric: name,
        severity: poorPercentage > 25 ? 'high' : 'medium',
        message: `${poorPercentage.toFixed(1)}% of ${name} measurements are poor`,
        recommendation: getMetricRecommendation(name),
      });
    }
  });
  
  return recommendations;
}

function calculateMetricSummary(metrics: WebVitalMetric[]) {
  if (metrics.length === 0) {
    return null;
  }
  
  const values = metrics.map(m => m.value);
  const ratings = groupBy(metrics, 'rating');
  
  return {
    count: metrics.length,
    average: values.reduce((sum, v) => sum + v, 0) / values.length,
    median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)],
    p75: values.sort((a, b) => a - b)[Math.floor(values.length * 0.75)],
    p95: values.sort((a, b) => a - b)[Math.floor(values.length * 0.95)],
    ratings: {
      good: ratings.good?.length || 0,
      'needs-improvement': ratings['needs-improvement']?.length || 0,
      poor: ratings.poor?.length || 0,
    },
  };
}

function calculateOverallScore(metrics: WebVitalMetric[]) {
  if (metrics.length === 0) return 100;
  
  const coreMetrics = ['CLS', 'FID', 'LCP'];
  const scores = coreMetrics.map(metricName => {
    const metricData = metrics.filter(m => m.name === metricName);
    if (metricData.length === 0) return 100;
    
    const goodCount = metricData.filter(m => m.rating === 'good').length;
    return (goodCount / metricData.length) * 100;
  });
  
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function getMetricRecommendation(metricName: string): string {
  const recommendations = {
    CLS: 'Set explicit dimensions for images and videos, preload fonts, avoid inserting content above existing content',
    FID: 'Reduce JavaScript execution time, break up long tasks, use web workers for heavy computations',
    LCP: 'Optimize images, preload critical resources, improve server response time, use CDN',
    FCP: 'Reduce blocking resources, optimize critical rendering path, use resource hints',
    TTFB: 'Optimize server response time, use CDN, implement caching strategies',
  };
  
  return recommendations[metricName as keyof typeof recommendations] || 'Investigate performance bottlenecks';
}

function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const group = String(item[key]);
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

export { router as webVitalsRouter };