#!/usr/bin/env bun
/**
 * Trading CLI - Command Line Interface
 * Entry point for all trading bot operations
 */

import { CCXTWrapper } from "./src/ccxt/ccxt-wrapper";
import { MockCCXT } from "./src/ccxt/mock-ccxt";
import { Container } from "./src/core/container";
import { TradingDatabase } from "./src/core/database";
import { MockTimeSource, RealTimeSource } from "./src/core/time-source";
import { MarketService } from "./src/services/market-service";
import { OrderService } from "./src/services/order-service";
import { RiskService } from "./src/services/risk-service";
import { SnapshotStorage } from "./src/snapshotting/snapshot-storage";
import { TradingWorkflow } from "./src/workflow/trading-workflow";

const HELP = `
trading-cli - Agentic Trading Bot CLI

USAGE:
  trading-cli <command> [options]

COMMANDS:
  install              Set up database and config

  market candles       Fetch OHLCV candles
  market indicators    Calculate technical indicators

  account balance      Show account balance
  account positions    Show open positions
  account exposure     Show total exposure

  orders place-market  Place a market order
  orders cancel        Cancel an order
  orders close-all     Close all positions

  risk validate-order  Validate order against risk rules
  risk validate-dca    Validate DCA addition

  monitor position     Monitor position state
  monitor pnl          Show unrealized PnL

  snapshot capture     Capture current state
  snapshot list        List all snapshots
  snapshot restore     Restore a snapshot

  backtest run         Run backtest on historical data

  workflow start       Start continuous trading workflow
  workflow single      Run single workflow cycle

OPTIONS:
  --help               Show this help message
  --dry-run            Simulate without executing trades
  --mock               Use mock exchange (for testing)
  --symbol <symbol>    Trading pair (default: BTC/USDT)

EXAMPLES:
  trading-cli install
  trading-cli market candles BTC/USDT 1h --limit 100
  trading-cli workflow start --dry-run
  trading-cli backtest run --start 2024-01-01 --end 2024-12-31
`;

async function main() {
	const args = process.argv.slice(2);

	if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
		console.log(HELP);
		process.exit(0);
	}

	const command = args[0];
	const subcommand = args[1];

	// Parse common options
	const isMock = args.includes("--mock");
	const isDryRun = args.includes("--dry-run");
	const symbolIndex = args.indexOf("--symbol");
	const symbol = symbolIndex !== -1 ? args[symbolIndex + 1] : "BTC/USDT";

	// Initialize container
	const timeSource = isMock ? new MockTimeSource() : new RealTimeSource();
	const db = new TradingDatabase({ path: "~/.trading/trading.db" });
	const container = new Container({ timeSource, database: db, isMock });

	// Initialize CCXT
	const ccxt = isMock
		? new MockCCXT()
		: new CCXTWrapper({
				exchangeId: "binance",
				apiKey: process.env.BINANCE_API_KEY,
				secret: process.env.BINANCE_SECRET,
				sandbox: isDryRun,
			});

	// Initialize services
	const marketService = new MarketService(ccxt, db, timeSource);
	const orderService = new OrderService(ccxt, db, timeSource);
	const riskService = new RiskService(ccxt, db, timeSource);
	const snapshotStorage = new SnapshotStorage(db, timeSource);

	try {
		switch (command) {
			case "install":
				await handleInstall(db);
				break;

			case "market":
				await handleMarket(subcommand, args, marketService, symbol);
				break;

			case "account":
				await handleAccount(subcommand, ccxt);
				break;

			case "orders":
				await handleOrders(subcommand, args, orderService, riskService, symbol, isDryRun);
				break;

			case "risk":
				await handleRisk(subcommand, args, riskService, marketService, symbol);
				break;

			case "snapshot":
				await handleSnapshot(subcommand, args, snapshotStorage);
				break;

			case "workflow":
				await handleWorkflow(subcommand, container, marketService, orderService, riskService, symbol);
				break;

			case "backtest":
				console.log("Backtest command - to be implemented");
				break;

			default:
				console.error(`Unknown command: ${command}`);
				console.log(HELP);
				process.exit(1);
		}
	} finally {
		db.close();
	}
}

async function handleInstall(db: TradingDatabase) {
	console.log("Installing trading-cli...");
	db.initialize();
	console.log("✅ Database initialized");
	console.log("📍 Database: ~/.trading/trading.db");
	console.log("✅ trading-cli installed!");
}

async function handleMarket(subcommand: string, args: string[], marketService: MarketService, symbol: string) {
	switch (subcommand) {
		case "candles": {
			const sym = args[2] || symbol;
			const timeframe = args[3] || "1h";
			const limitIndex = args.indexOf("--limit");
			const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : 100;

			const candles = await marketService.fetchCandles(sym, timeframe, limit);
			console.log(JSON.stringify(candles, null, 2));
			break;
		}

		case "indicators": {
			const sym = args[2] || symbol;
			const indicators = await marketService.calculateIndicators(sym, "1h", {
				rsi: true,
				bollingerBands: true,
			});
			console.log(JSON.stringify(indicators, null, 2));
			break;
		}

		default:
			console.error(`Unknown market subcommand: ${subcommand}`);
	}
}

async function handleAccount(subcommand: string, ccxt: any) {
	switch (subcommand) {
		case "balance": {
			const balance = await ccxt.fetchBalance();
			console.log(JSON.stringify(balance, null, 2));
			break;
		}

		case "positions": {
			const positions = await ccxt.fetchPositions();
			console.log(JSON.stringify(positions, null, 2));
			break;
		}

		case "exposure": {
			const positions = await ccxt.fetchPositions();
			const exposure = positions.reduce((sum: number, p: any) => sum + p.contracts * p.markPrice, 0);
			console.log(`Total exposure: $${exposure.toFixed(2)}`);
			break;
		}

		default:
			console.error(`Unknown account subcommand: ${subcommand}`);
	}
}

async function handleOrders(
	subcommand: string,
	args: string[],
	orderService: OrderService,
	_riskService: RiskService,
	symbol: string,
	isDryRun: boolean,
) {
	switch (subcommand) {
		case "place-market": {
			const sym = args[2] || symbol;
			const side = args[3] as "long" | "short";
			const size = parseFloat(args[4]);

			if (isDryRun) {
				console.log(`[DRY RUN] Would place ${side} order for ${size} ${sym}`);
				return;
			}

			const result = await orderService.placeOrder({ symbol: sym, side, size });
			console.log(JSON.stringify(result, null, 2));
			break;
		}

		case "cancel": {
			const orderId = args[2];
			const sym = args[3] || symbol;

			if (isDryRun) {
				console.log(`[DRY RUN] Would cancel order ${orderId}`);
				return;
			}

			const result = await orderService.cancelOrder(orderId, sym);
			console.log(JSON.stringify(result, null, 2));
			break;
		}

		case "close-all": {
			const sym = args[2] || symbol;

			if (isDryRun) {
				console.log(`[DRY RUN] Would close all positions for ${sym}`);
				return;
			}

			const result = await orderService.closePosition(sym);
			console.log(JSON.stringify(result, null, 2));
			break;
		}

		default:
			console.error(`Unknown orders subcommand: ${subcommand}`);
	}
}

async function handleRisk(
	subcommand: string,
	args: string[],
	riskService: RiskService,
	marketService: MarketService,
	symbol: string,
) {
	switch (subcommand) {
		case "validate-order": {
			const sym = args[2] || symbol;
			const side = args[3] as "long" | "short";
			const size = parseFloat(args[4]);

			const candles = await marketService.fetchCandles(sym, "1h", 1);
			const currentPrice = candles[candles.length - 1]?.close ?? 0;

			const result = await riskService.validateOrder({
				symbol: sym,
				side,
				size,
				currentPrice,
			});
			console.log(JSON.stringify(result, null, 2));
			break;
		}

		case "validate-dca": {
			const sym = args[2] || symbol;
			const size = parseFloat(args[3]);

			const result = await riskService.validateDCA(sym, size);
			console.log(JSON.stringify(result, null, 2));
			break;
		}

		default:
			console.error(`Unknown risk subcommand: ${subcommand}`);
	}
}

async function handleSnapshot(subcommand: string, args: string[], snapshotStorage: SnapshotStorage) {
	switch (subcommand) {
		case "list": {
			const limitIndex = args.indexOf("--limit");
			const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : 10;

			const snapshots = await snapshotStorage.list({ limit });
			console.log(JSON.stringify(snapshots, null, 2));
			break;
		}

		case "restore": {
			const idIndex = args.indexOf("--id");
			if (idIndex === -1) {
				console.error("Missing --id parameter");
				return;
			}
			const id = args[idIndex + 1];

			const snapshot = await snapshotStorage.restore(id);
			if (snapshot) {
				console.log(JSON.stringify(snapshot, null, 2));
			} else {
				console.error(`Snapshot not found: ${id}`);
			}
			break;
		}

		default:
			console.error(`Unknown snapshot subcommand: ${subcommand}`);
	}
}

async function handleWorkflow(
	subcommand: string,
	container: Container,
	marketService: MarketService,
	orderService: OrderService,
	riskService: RiskService,
	symbol: string,
) {
	const workflow = new TradingWorkflow(container, marketService, orderService, riskService, symbol);

	switch (subcommand) {
		case "start":
			console.log(`Starting continuous workflow for ${symbol}...`);
			console.log("Press Ctrl+C to stop");
			await workflow.runContinuous(60000);
			break;

		case "single": {
			console.log(`Running single workflow cycle for ${symbol}...`);
			const state = await workflow.runSingleCycle();
			console.log(JSON.stringify(state, null, 2));
			break;
		}

		default:
			console.error(`Unknown workflow subcommand: ${subcommand}`);
	}
}

// Run
main().catch(console.error);
