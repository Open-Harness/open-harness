/**
 * Time Travel Simulation API
 *
 * This module provides the main time travel simulation functionality,
 * creating an educational experience that simulates temporal travel
 * while maintaining logical consistency.
 */

/**
 * Represents the result of a time travel simulation
 */
export interface TimeTravelResponse {
  /** Success status of the time travel attempt */
  success: boolean;
  /** Target destination date */
  destination: Date;
  /** Current simulated time after travel */
  currentTime: Date;
  /** Contextual information about the destination time period */
  context: TemporalContext;
  /** Any errors or warnings encountered */
  message?: string;
  /** Duration of the time travel simulation in milliseconds */
  duration: number;
}

/**
 * Contextual information about a specific time period
 */
export interface TemporalContext {
  /** Historical or projected year */
  year: number;
  /** Notable events occurring around this time */
  events: string[];
  /** Technological state of the era */
  technology: string[];
  /** Cultural and social context */
  culture: string[];
  /** Geographic or political state */
  geography: string[];
}

/**
 * Configuration options for time travel simulation
 */
export interface TimeTravelOptions {
  /** Enable detailed simulation context (default: true) */
  detailedContext?: boolean;
  /** Maximum allowed simulation duration in ms (default: 1000) */
  maxDuration?: number;
  /** Enable educational content in responses (default: true) */
  educationalMode?: boolean;
}

/**
 * Custom error class for time travel related errors
 */
export class TimeTravelError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TimeTravelError';
  }
}

/**
 * Main time travel simulation function
 *
 * Accepts a destination date and returns a simulation response that provides
 * contextual information about the target time period. This creates an educational
 * experience simulating temporal travel.
 *
 * @param destination - The target date to travel to
 * @param options - Optional configuration for the simulation
 * @returns Promise resolving to simulation response with temporal context
 * @throws TimeTravelError when destination is invalid or simulation fails
 */
export async function timeTravel(
  destination: Date,
  options: TimeTravelOptions = {}
): Promise<TimeTravelResponse> {
  const startTime = Date.now();

  // Apply default options
  const config: Required<TimeTravelOptions> = {
    detailedContext: true,
    maxDuration: 1000,
    educationalMode: true,
    ...options
  };

  try {
    // Basic input validation
    validateDateInput(destination);

    // Simulate time travel duration (educational delay)
    const simulationDuration = Math.min(
      Math.random() * 800 + 200, // Random 200-1000ms
      config.maxDuration
    );

    await new Promise(resolve => setTimeout(resolve, simulationDuration));

    // Generate basic temporal context (will be enhanced in T003)
    const context = generateBasicTemporalContext(destination);

    const response: TimeTravelResponse = {
      success: true,
      destination: new Date(destination),
      currentTime: new Date(destination),
      context,
      message: `Successfully traveled to ${destination.toLocaleDateString()}`,
      duration: Date.now() - startTime
    };

    return response;

  } catch (error) {
    if (error instanceof TimeTravelError) {
      throw error;
    }

    // Handle unexpected errors
    throw new TimeTravelError(
      `Time travel simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'SIMULATION_ERROR'
    );
  }
}

/**
 * Validates the input date parameter with comprehensive bounds checking
 *
 * @param date - Date to validate
 * @throws TimeTravelError if date is invalid
 */
function validateDateInput(date: Date): void {
  // Check if date is a valid Date object
  if (!(date instanceof Date)) {
    throw new TimeTravelError(
      'Destination must be a valid Date object. Please provide a Date instance.',
      'INVALID_DATE_TYPE'
    );
  }

  // Check if date is not NaN (invalid date)
  if (isNaN(date.getTime())) {
    throw new TimeTravelError(
      'Destination date is invalid or malformed. Please check your date format and values.',
      'INVALID_DATE_VALUE'
    );
  }

  // Check for edge cases with extreme timestamps
  const timestamp = date.getTime();
  if (timestamp < -62135596800000) { // Before year 1 CE
    throw new TimeTravelError(
      'Time travel to dates before year 1 CE is not supported by our simulation.',
      'DATE_TOO_ANCIENT'
    );
  }

  if (timestamp > 32503680000000) { // After year 3000 CE
    throw new TimeTravelError(
      'Time travel beyond year 3000 CE exceeds our future projection capabilities.',
      'DATE_TOO_DISTANT_FUTURE'
    );
  }

  // Enhanced bounds checking with more specific ranges
  const year = date.getFullYear();
  const currentYear = new Date().getFullYear();

  // Define reasonable simulation bounds
  const MIN_PAST_YEAR = 1000;
  const MAX_FUTURE_YEAR = currentYear + 500; // 500 years into future
  const FAR_FUTURE_LIMIT = 3000;

  // Handle past dates beyond reasonable bounds
  if (year < MIN_PAST_YEAR) {
    throw new TimeTravelError(
      `Travel to year ${year} is beyond our historical simulation capabilities. ` +
      `Please choose a date from ${MIN_PAST_YEAR} CE or later.`,
      'PAST_DATE_OUT_OF_BOUNDS'
    );
  }

  // Handle near future dates (within reasonable projection range)
  if (year > currentYear && year <= MAX_FUTURE_YEAR) {
    // Future dates within reasonable projection range are allowed
    return;
  }

  // Handle far future dates with warning
  if (year > MAX_FUTURE_YEAR && year <= FAR_FUTURE_LIMIT) {
    throw new TimeTravelError(
      `Travel to year ${year} is in the far future beyond reliable predictions. ` +
      `Our simulation may be less accurate for dates beyond ${MAX_FUTURE_YEAR}. ` +
      `Consider choosing a nearer future date for better simulation quality.`,
      'FAR_FUTURE_WARNING'
    );
  }

  // Handle dates beyond all reasonable bounds
  if (year > FAR_FUTURE_LIMIT) {
    throw new TimeTravelError(
      `Year ${year} exceeds our maximum simulation range. ` +
      `Please choose a date before ${FAR_FUTURE_LIMIT} CE.`,
      'FUTURE_DATE_OUT_OF_BOUNDS'
    );
  }

  // Additional edge case: Check for invalid dates that might pass basic checks
  // but represent problematic scenarios
  const month = date.getMonth();
  const day = date.getDate();

  // Validate February 29th on non-leap years
  if (month === 1 && day === 29 && !isLeapYear(year)) {
    throw new TimeTravelError(
      `February 29, ${year} is invalid because ${year} is not a leap year. ` +
      `Please choose a valid date.`,
      'INVALID_LEAP_DATE'
    );
  }

  // Check for other impossible dates (this should be rare with Date constructor,
  // but can happen with invalid date manipulations)
  if (day > getDaysInMonth(month, year)) {
    throw new TimeTravelError(
      `Day ${day} is invalid for ${getMonthName(month)} ${year}. ` +
      `Please choose a valid date.`,
      'INVALID_DAY_FOR_MONTH'
    );
  }
}

/**
 * Generates basic temporal context for a given date
 * This is a simplified version that will be enhanced in T003
 *
 * @param date - Target date
 * @returns Basic temporal context information
 */
function generateBasicTemporalContext(date: Date): TemporalContext {
  const year = date.getFullYear();

  // Basic context generation - placeholder for enhanced version in T003
  const context: TemporalContext = {
    year,
    events: [`Historical events from ${year}`],
    technology: [`Technology available in ${year}`],
    culture: [`Cultural context of ${year}`],
    geography: [`Geographic state in ${year}`]
  };

  // Add era-based basic information
  if (year < 1500) {
    context.events.push("Medieval or ancient period");
    context.technology.push("Pre-industrial technology");
  } else if (year < 1800) {
    context.events.push("Early modern period");
    context.technology.push("Early industrial developments");
  } else if (year < 1900) {
    context.events.push("Industrial revolution era");
    context.technology.push("Steam power and mechanization");
  } else if (year < 2000) {
    context.events.push("Modern era");
    context.technology.push("Electronic and digital revolution");
  } else if (year <= new Date().getFullYear()) {
    context.events.push("Contemporary period");
    context.technology.push("Internet and mobile technology");
  } else {
    context.events.push("Future projection");
    context.technology.push("Speculative future technology");
  }

  return context;
}

/**
 * Utility function to check if a date represents the past
 *
 * @param date - Date to check
 * @returns True if date is in the past
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Utility function to check if a date represents the future
 *
 * @param date - Date to check
 * @returns True if date is in the future
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Utility function to calculate time difference in years
 *
 * @param from - Start date
 * @param to - End date
 * @returns Difference in years
 */
export function calculateYearDifference(from: Date, to: Date): number {
  return to.getFullYear() - from.getFullYear();
}

/**
 * Checks if a given year is a leap year
 *
 * @param year - Year to check
 * @returns True if the year is a leap year
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Gets the number of days in a specific month and year
 *
 * @param month - Month (0-based index, 0 = January)
 * @param year - Year
 * @returns Number of days in the month
 */
function getDaysInMonth(month: number, year: number): number {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (month === 1 && isLeapYear(year)) {
    return 29; // February in leap year
  }

  return daysInMonth[month] || 31;
}

/**
 * Gets the name of a month from its 0-based index
 *
 * @param month - Month index (0-based, 0 = January)
 * @returns Month name
 */
function getMonthName(month: number): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return monthNames[month] || 'Unknown';
}