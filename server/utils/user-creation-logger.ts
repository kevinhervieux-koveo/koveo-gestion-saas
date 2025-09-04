/**
 * User creation logging utility for monitoring and debugging.
 * Helps track user creation events and identify potential issues.
 */

export interface UserCreationEvent {
  userId?: string;
  email: string;
  role: string;
  method: 'invitation' | 'direct';
  success: boolean;
  error?: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Logs user creation events for monitoring and debugging
 */
export function logUserCreation(event: UserCreationEvent): void {
  const logData = {
    event: 'user_creation',
    userId: event.userId,
    email: event.email.toLowerCase(),
    role: event.role,
    method: event.method,
    success: event.success,
    error: event.error,
    timestamp: event.timestamp.toISOString(),
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
  };

  if (event.success) {
    console.log('✅ User creation successful:', JSON.stringify(logData));
  } else {
    console.error('❌ User creation failed:', JSON.stringify(logData));
  }

  // In production, this could also send to monitoring services
  // like DataDog, New Relic, or custom logging endpoints
}
