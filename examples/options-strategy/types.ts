/**
 * Type definitions for Options Strategy Demonstrator
 */

export type OptionType = "call" | "put" | "stock";
export type OptionAction = "buy" | "sell";
export type StrategyType = "directional" | "income" | "volatility";
export type MarketDirection = "bullish" | "bearish" | "neutral";
export type MarketStrength = "strong" | "moderate" | "weak";
export type Timeframe = "short_term" | "medium_term" | "long_term";
export type IVRegime = "high_iv" | "normal_iv" | "low_iv";
export type RiskTolerance = "conservative" | "moderate" | "aggressive";

/**
 * Single option leg in a multi-leg strategy
 */
export type OptionLeg = {
	type: OptionType;
	strike: number;
	action: OptionAction;
	quantity: number;
	premium: number; // Per contract
};

/**
 * Volatility analysis result
 */
export type VolatilityEnvironment = {
	impliedVol: number; // IV percentage
	historicalVol: number; // HV percentage
	ivRank: number; // 0-100 percentile
	regime: IVRegime;
	analysis: string; // Text explanation
};

/**
 * Market outlook assessment
 */
export type MarketOutlook = {
	direction: MarketDirection;
	strength: MarketStrength;
	timeframe: Timeframe;
	confidence: number; // 0-100
	reasoning: string;
};

/**
 * Strategy recommendation
 */
export type StrategyRecommendation = {
	name: string;
	type: StrategyType;
	rationale: string;
	suitability: number; // 0-100 match score
};

/**
 * Greeks for a trade setup
 */
export type Greeks = {
	delta: number; // Directional exposure
	theta: number; // Time decay ($/day)
	vega: number; // Volatility sensitivity ($/1% IV change)
};

/**
 * Complete trade setup with all details
 */
export type TradeSetup = {
	strategy: string;
	legs: OptionLeg[];
	maxRisk: number;
	maxProfit: number;
	breakEven: number[];
	probabilityOfProfit: number; // 0-100
	greeks: Greeks;
	explanation: string;
};

/**
 * Risk assessment result
 */
export type RiskReview = {
	approved: boolean;
	concerns: string[];
	capitalRequired: number;
	riskRewardRatio: number;
	recommendation: string;
};

/**
 * Main workflow state
 */
export type OptionsWorkflowState = {
	// Input parameters
	underlying: string;
	currentPrice: number;
	accountSize: number;
	riskTolerance: RiskTolerance;
	daysToExpiration: number;

	// Analysis results (populated by agents)
	volatilityEnvironment: VolatilityEnvironment | null;
	marketOutlook: MarketOutlook | null;
	recommendedStrategy: StrategyRecommendation | null;
	tradeSetup: TradeSetup | null;
	riskReview: RiskReview | null;
};

/**
 * Options chain data structure
 */
export type OptionsChainEntry = {
	strike: number;
	call: {
		bid: number;
		ask: number;
	};
	put: {
		bid: number;
		ask: number;
	};
};
