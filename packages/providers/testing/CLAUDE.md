# @open-harness/provider-testing

Shared testing utilities for provider implementations.

## Purpose

Provides contract tests and helpers for validating provider node implementations. Ensures all providers conform to the `NodeTypeDefinition` interface and behave consistently.

## Key Files

- **`src/index.ts`** - Exports testing utilities and contracts

## Usage

Provider implementations use this package to validate their node implementations against the standard contract.

## Dependencies

- `@open-harness/sdk` - For `NodeTypeDefinition` interface and types
