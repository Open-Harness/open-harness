/**
 * Rate Limiter for API requests
 * Implements IP-based rate limiting with configurable limits
 */

/**
 * Configuration options for the RateLimiter
 */
export interface RateLimiterConfig {
  /** Maximum number of requests per minute per IP */
  requestsPerMinute: number;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Seconds until the client can make another request (if blocked) */
  retryAfter?: number;
  /** Current number of requests in the time window */
  currentRequests: number;
  /** Maximum allowed requests */
  limit: number;
}

/**
 * RateLimiter class that tracks and enforces rate limits by client IP
 */
export class RateLimiter {
  private readonly config: RateLimiterConfig;
  private readonly requests: Map<string, number[]>;
  private readonly windowMs: number;

  /**
   * Create a new RateLimiter instance
   * @param config Configuration options including requests per minute
   */
  constructor(config: RateLimiterConfig) {
    this.config = { ...config };
    this.requests = new Map();
    // Convert requests per minute to milliseconds window
    this.windowMs = 60 * 1000; // 1 minute in milliseconds

    // Validate configuration
    if (config.requestsPerMinute <= 0) {
      throw new Error('requestsPerMinute must be a positive number');
    }
  }

  /**
   * Check if a request from the given IP is allowed
   * @param clientIp The client IP address
   * @returns RateLimitResult indicating if request is allowed and retry information
   */
  public checkLimit(clientIp: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this IP
    const ipRequests = this.requests.get(clientIp) || [];

    // Filter to only requests within the current window
    const requestsInWindow = ipRequests.filter(timestamp => timestamp > windowStart);

    const allowed = requestsInWindow.length < this.config.requestsPerMinute;
    let retryAfter: number | undefined;

    if (!allowed && requestsInWindow.length > 0) {
      // Calculate when the oldest request in the window will expire
      const oldestRequest = Math.min(...requestsInWindow);
      retryAfter = Math.ceil((oldestRequest + this.windowMs - now) / 1000);
    }

    return {
      allowed,
      retryAfter,
      currentRequests: requestsInWindow.length,
      limit: this.config.requestsPerMinute
    };
  }

  /**
   * Record a new request from the given IP
   * @param clientIp The client IP address
   */
  public recordRequest(clientIp: string): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this IP
    const ipRequests = this.requests.get(clientIp) || [];

    // Filter to only requests within the current window and add the new request
    const updatedRequests = ipRequests
      .filter(timestamp => timestamp > windowStart)
      .concat(now);

    this.requests.set(clientIp, updatedRequests);
  }

  /**
   * Get current request count for an IP
   * @param clientIp The client IP address
   * @returns Current number of requests in the time window
   */
  public getCurrentRequests(clientIp: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const ipRequests = this.requests.get(clientIp) || [];
    return ipRequests.filter(timestamp => timestamp > windowStart).length;
  }

  /**
   * Clear all recorded requests (useful for testing)
   */
  public reset(): void {
    this.requests.clear();
  }

  /**
   * Get configuration
   * @returns Current configuration
   */
  public getConfig(): Readonly<RateLimiterConfig> {
    return { ...this.config };
  }

  /**
   * Clean up old requests to prevent memory leaks
   * This should be called periodically in production
   */
  public cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    this.requests.forEach((timestamps, ip) => {
      const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);

      if (validTimestamps.length === 0) {
        this.requests.delete(ip);
      } else {
        this.requests.set(ip, validTimestamps);
      }
    });
  }
}