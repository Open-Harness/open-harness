#!/usr/bin/env node

/**
 * Telemetry Discovery Script
 * 
 * Analyzes a codebase to gather information for telemetry strategy design.
 * Run with: node discover.mjs <project-root>
 * 
 * Output: JSON discovery results to stdout
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename, extname } from 'path';

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt'];

function walkDir(dir, callback, depth = 0, maxDepth = 10) {
  if (depth > maxDepth) return;
  
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      if (IGNORE_DIRS.includes(file) || file.startsWith('.')) continue;
      
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        walkDir(fullPath, callback, depth + 1, maxDepth);
      } else if (stat.isFile()) {
        callback(fullPath);
      }
    }
  } catch (e) {
    // Permission denied or other error
  }
}

function findPackageJsons(root) {
  const packages = [];
  walkDir(root, (file) => {
    if (basename(file) === 'package.json') {
      try {
        const content = JSON.parse(readFileSync(file, 'utf-8'));
        packages.push({
          path: file,
          name: content.name,
          dependencies: Object.keys(content.dependencies || {}),
          devDependencies: Object.keys(content.devDependencies || {}),
        });
      } catch (e) {}
    }
  });
  return packages;
}

function detectFramework(deps) {
  const allDeps = [...deps.dependencies, ...deps.devDependencies];
  
  if (allDeps.includes('fastify')) return 'fastify';
  if (allDeps.includes('express')) return 'express';
  if (allDeps.includes('hono')) return 'hono';
  if (allDeps.includes('koa')) return 'koa';
  if (allDeps.includes('@nestjs/core')) return 'nestjs';
  if (allDeps.includes('next')) return 'next';
  return null;
}

function detectInfrastructure(deps) {
  const allDeps = [...deps.dependencies, ...deps.devDependencies];
  const infra = [];
  
  // Databases
  if (allDeps.includes('@prisma/client') || allDeps.includes('prisma')) {
    infra.push({ type: 'database', client: 'prisma' });
  }
  if (allDeps.includes('drizzle-orm')) {
    infra.push({ type: 'database', client: 'drizzle' });
  }
  if (allDeps.includes('pg')) {
    infra.push({ type: 'database', client: 'pg' });
  }
  if (allDeps.includes('mysql2')) {
    infra.push({ type: 'database', client: 'mysql2' });
  }
  if (allDeps.includes('mongoose')) {
    infra.push({ type: 'database', client: 'mongoose' });
  }
  
  // Cache
  if (allDeps.includes('ioredis') || allDeps.includes('redis')) {
    infra.push({ type: 'cache', client: 'redis' });
  }
  
  // Queues
  if (allDeps.includes('bullmq') || allDeps.includes('bull')) {
    infra.push({ type: 'queue', client: 'bullmq' });
  }
  if (allDeps.includes('kafkajs')) {
    infra.push({ type: 'queue', client: 'kafka' });
  }
  if (allDeps.includes('amqplib')) {
    infra.push({ type: 'queue', client: 'rabbitmq' });
  }
  
  // HTTP clients
  if (allDeps.includes('axios')) {
    infra.push({ type: 'http', client: 'axios' });
  }
  
  // Storage
  if (allDeps.includes('@aws-sdk/client-s3')) {
    infra.push({ type: 'storage', client: 's3' });
  }
  
  return infra;
}

function detectLogging(deps) {
  const allDeps = [...deps.dependencies, ...deps.devDependencies];
  
  const loggers = [];
  if (allDeps.includes('pino')) loggers.push('pino');
  if (allDeps.includes('winston')) loggers.push('winston');
  if (allDeps.includes('bunyan')) loggers.push('bunyan');
  
  return loggers;
}

function countLogStatements(root) {
  const counts = {
    console: { log: 0, warn: 0, error: 0, info: 0, debug: 0 },
    logger: { info: 0, warn: 0, error: 0, debug: 0 },
  };
  
  const patterns = {
    consoleLog: /console\.log\(/g,
    consoleWarn: /console\.warn\(/g,
    consoleError: /console\.error\(/g,
    consoleInfo: /console\.info\(/g,
    consoleDebug: /console\.debug\(/g,
    loggerInfo: /logger\.(info|log)\(/g,
    loggerWarn: /logger\.warn\(/g,
    loggerError: /logger\.error\(/g,
    loggerDebug: /logger\.debug\(/g,
  };
  
  walkDir(root, (file) => {
    const ext = extname(file);
    if (!['.ts', '.js', '.tsx', '.jsx', '.mjs', '.mts'].includes(ext)) return;
    
    try {
      const content = readFileSync(file, 'utf-8');
      
      counts.console.log += (content.match(patterns.consoleLog) || []).length;
      counts.console.warn += (content.match(patterns.consoleWarn) || []).length;
      counts.console.error += (content.match(patterns.consoleError) || []).length;
      counts.console.info += (content.match(patterns.consoleInfo) || []).length;
      counts.console.debug += (content.match(patterns.consoleDebug) || []).length;
      
      counts.logger.info += (content.match(patterns.loggerInfo) || []).length;
      counts.logger.warn += (content.match(patterns.loggerWarn) || []).length;
      counts.logger.error += (content.match(patterns.loggerError) || []).length;
      counts.logger.debug += (content.match(patterns.loggerDebug) || []).length;
    } catch (e) {}
  });
  
  return counts;
}

function findRoutes(root) {
  const routes = [];
  const routePatterns = [
    // Express/Fastify style
    /\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    // Decorator style (NestJS)
    /@(Get|Post|Put|Patch|Delete)\s*\(\s*['"`]?([^'"`\)]+)?['"`]?\s*\)/gi,
  ];
  
  walkDir(root, (file) => {
    const ext = extname(file);
    if (!['.ts', '.js'].includes(ext)) return;
    
    try {
      const content = readFileSync(file, 'utf-8');
      
      for (const pattern of routePatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          routes.push({
            method: match[1].toUpperCase(),
            path: match[2] || '/',
            file,
          });
        }
      }
    } catch (e) {}
  });
  
  return routes;
}

// Main
const root = process.argv[2] || '.';

const packages = findPackageJsons(root);
const mainPkg = packages.find(p => !p.path.includes('node_modules')) || packages[0];

if (!mainPkg) {
  console.error('No package.json found');
  process.exit(1);
}

const discovery = {
  project: mainPkg.name,
  packages: packages.length,
  framework: detectFramework(mainPkg),
  infrastructure: detectInfrastructure(mainPkg),
  loggers: detectLogging(mainPkg),
  logStatements: countLogStatements(root),
  routes: findRoutes(root).slice(0, 50), // Limit to 50
};

// Calculate structured percentage
const totalConsole = Object.values(discovery.logStatements.console).reduce((a, b) => a + b, 0);
const totalLogger = Object.values(discovery.logStatements.logger).reduce((a, b) => a + b, 0);
const total = totalConsole + totalLogger;
discovery.structuredPercent = total > 0 ? Math.round((totalLogger / total) * 100) : 0;

console.log(JSON.stringify(discovery, null, 2));
