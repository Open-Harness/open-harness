import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';

/**
 * Error codes for transport layer failures.
 * @internal
 */
export type TransportErrorCode = 'PARSE_ERROR' | 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE';

/**
 * Transport layer error with structured error codes.
 * Used to distinguish different failure modes in network operations.
 *
 * @example
 * ```ts
 * if (result.isErr()) {
 *   const err = result.error;
 *   if (err.code === 'PARSE_ERROR') {
 *     console.error('Failed to parse JSON:', err.message);
 *   }
 * }
 * ```
 */
export class TransportError extends Error {
  /**
   * @param code - Error category (PARSE_ERROR, NETWORK_ERROR, TIMEOUT, INVALID_RESPONSE)
   * @param message - Human-readable error message
   * @param originalError - The underlying error that caused this failure
   */
  constructor(
    public readonly code: TransportErrorCode,
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

/**
 * Result type alias for transport operations.
 * Represents either a successful value T or a TransportError.
 *
 * @example
 * ```ts
 * async function fetchData(): TransportResult<MyData> {
 *   return parseJSON<MyData>(jsonString);
 * }
 * ```
 * @internal
 */
export type TransportResult<T> = Result<T, TransportError>;

/**
 * Parse JSON string into Result type, converting parse errors to TransportError.
 *
 * @param text - JSON string to parse
 * @returns Result containing parsed value or TransportError with PARSE_ERROR code
 *
 * @example
 * ```ts
 * const result = parseJSON<{runId: string}>(eventData);
 * result.match(
 *   (data) => console.log(data.runId),
 *   (err) => console.error('Parse failed:', err.message)
 * );
 * ```
 */
export function parseJSON<T>(text: string): TransportResult<T> {
  try {
    const parsed = JSON.parse(text) as T;
    return ok(parsed);
  } catch (error) {
    return err(
      new TransportError(
        'PARSE_ERROR',
        `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
        error,
      ),
    );
  }
}

/**
 * Fetch with automatic TransportError wrapping for network failures.
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns Result containing Response or TransportError
 *
 * @example
 * ```ts
 * const result = await fetchWithResult('https://api.example.com/data');
 * const response = result.match(
 *   (r) => r,
 *   (err) => {
 *     if (err.code === 'NETWORK_ERROR') {
 *       // Handle network failure
 *     }
 *   }
 * );
 * ```
 * @internal
 */
export async function fetchWithResult(
  url: string,
  options?: RequestInit,
): Promise<TransportResult<Response>> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return err(
        new TransportError(
          'INVALID_RESPONSE',
          `HTTP ${response.status} ${response.statusText}${text ? `: ${text}` : ''}`,
        ),
      );
    }
    return ok(response);
  } catch (error) {
    return err(
      new TransportError(
        'NETWORK_ERROR',
        `Network request failed: ${error instanceof Error ? error.message : String(error)}`,
        error,
      ),
    );
  }
}
