# CLI Operating Manual

## Quick Reference

### Installation
```bash
# Install and initialize database
trading-cli install
```

### Market Data Commands

```bash
# Fetch candles
trading-cli market candles BTC/USDT 1h --limit 100

# Fetch with specific timestamp
trading-cli market candles BTC/USDT 1h --limit 100 --timestamp 1704067200000

# Calculate indicators
trading-cli market indicators BTC/USDT --rsi --bollinger --volume
```

### Account Commands

```bash
# Check balance
trading-cli account balance

# View positions
trading-cli account positions

# Check exposure
trading-cli account exposure
```

### Order Commands

```bash
# Place market order
trading-cli orders place-market BTC/USDT long 0.01

# Cancel order
trading-cli orders cancel <order-id> BTC/USDT

# Close all positions
trading-cli orders close-all BTC/USDT

# Set leverage
trading-cli execution set-leverage 5x
```

### Risk Validation

```bash
# Validate before placing
trading-cli risk validate-order --symbol BTC/USDT --side long --size 0.01

# Validate DCA addition
trading-cli risk validate-dca --symbol BTC/USDT --size 0.01
```

### Monitoring

```bash
# Position state
trading-cli monitor position BTC/USDT

# Unrealized PnL
trading-cli monitor pnl BTC/USDT

# Liquidation distance
trading-cli monitor liquidation-distance BTC/USDT
```

### Snapshotting

```bash
# Capture snapshot
trading-cli snapshot capture --name "After entry decision"

# List snapshots
trading-cli snapshot list

# Restore snapshot
trading-cli snapshot restore --id abc123

# Start conversation with snapshot
trading-cli snapshot converse --id abc123

# Zoom forward/backward
trading-cli snapshot zoom --id abc123 --offset +2h
```

### Backtesting

```bash
# Run backtest
trading-cli backtest run --start 2024-01-01 --end 2024-12-31 --symbol BTC/USDT

# Replay recorded session
trading-cli backtest replay --recording session.json --acceleration 100
```

### Workflow

```bash
# Start continuous workflow
trading-cli workflow start --symbol BTC/USDT

# Run single cycle
trading-cli workflow single --symbol BTC/USDT

# Dry run (no real orders)
trading-cli workflow start --dry-run
```

## Common Flags

| Flag | Description |
|------|-------------|
| `--help` | Show help message |
| `--dry-run` | Simulate without executing |
| `--mock` | Use mock exchange |
| `--symbol <sym>` | Trading pair (default: BTC/USDT) |
| `--limit <n>` | Limit results |
| `--id <id>` | Snapshot ID |

## Output Formats

All commands output JSON for easy parsing:

```bash
# Pretty print with jq
trading-cli account balance | jq

# Extract specific field
trading-cli market indicators BTC/USDT | jq '.rsi[-1]'
```

## Error Handling

CLI returns non-zero exit codes on errors:

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Invalid command/arguments |
| 2 | Risk validation failed |
| 3 | Order execution failed |
| 4 | Network/API error |

```bash
# Check exit code
trading-cli orders place-market BTC/USDT long 10.0
if [ $? -ne 0 ]; then
  echo "Order failed!"
fi
```
