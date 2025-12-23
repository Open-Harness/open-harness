/**
 * Dependency Injection Container
 * SDK-native container with factory registration and lazy initialization
 */

import { TimeSource, RealTimeSource } from './time-source'
import { TradingDatabase } from './database'

export interface ContainerConfig {
  timeSource?: TimeSource
  database?: TradingDatabase
  isMock?: boolean
}

type Factory<T> = () => T
type ServiceKey = string | symbol

export class Container {
  private factories = new Map<ServiceKey, Factory<any>>()
  private instances = new Map<ServiceKey, any>()
  private config: ContainerConfig

  constructor(config: ContainerConfig = {}) {
    this.config = {
      timeSource: config.timeSource ?? new RealTimeSource(),
      database: config.database,
      isMock: config.isMock ?? false,
    }

    // Register core services
    this.registerFactory('timeSource', () => this.config.timeSource!)
    this.registerFactory('database', () => {
      if (!this.config.database) {
        this.config.database = new TradingDatabase()
        this.config.database.initialize()
      }
      return this.config.database
    })
  }

  registerFactory<T>(key: ServiceKey, factory: Factory<T>): void {
    this.factories.set(key, factory)
    this.instances.delete(key) // Clear cached instance
  }

  register<T>(key: ServiceKey, instance: T): void {
    this.instances.set(key, instance)
  }

  get<T>(key: ServiceKey): T {
    // Return cached instance if available
    if (this.instances.has(key)) {
      return this.instances.get(key) as T
    }

    // Create from factory and cache
    const factory = this.factories.get(key)
    if (!factory) {
      throw new Error(`No factory registered for key: ${String(key)}`)
    }

    const instance = factory()
    this.instances.set(key, instance)
    return instance as T
  }

  has(key: ServiceKey): boolean {
    return this.factories.has(key) || this.instances.has(key)
  }

  get isMock(): boolean {
    return this.config.isMock ?? false
  }

  get timeSource(): TimeSource {
    return this.get<TimeSource>('timeSource')
  }

  get database(): TradingDatabase {
    return this.get<TradingDatabase>('database')
  }
}

// Default container instance
export const container = new Container()
