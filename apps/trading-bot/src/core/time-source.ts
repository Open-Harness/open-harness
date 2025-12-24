/**
 * Time Source Abstraction
 * Enables seamless switching between real-time and mock time for backtesting
 */

export interface TimeSource {
	now(): number;
	sleep(ms: number): Promise<void>;
}

export class RealTimeSource implements TimeSource {
	now(): number {
		return Date.now();
	}

	async sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

export class MockTimeSource implements TimeSource {
	private currentTime: number;

	constructor(startTime: number = Date.now()) {
		this.currentTime = startTime;
	}

	now(): number {
		return this.currentTime;
	}

	advance(ms: number): void {
		this.currentTime += ms;
	}

	setTime(timestamp: number): void {
		this.currentTime = timestamp;
	}

	async sleep(ms: number): Promise<void> {
		// No-op in backtest mode - time is controlled by caller
		this.advance(ms);
	}
}
