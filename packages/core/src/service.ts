import { Awaitable, defineProperty } from 'cosmokit'
import { Context } from './context.ts'
import { createCallable, joinPrototype, symbols, Tracker } from './utils.ts'

export abstract class Service<C extends Context = Context> {
  static readonly invoke: unique symbol = symbols.invoke as any
  static readonly extend: unique symbol = symbols.extend as any
  static readonly tracker: unique symbol = symbols.tracker as any
  static readonly provide: unique symbol = symbols.provide as any
  static readonly immediate: unique symbol = symbols.immediate as any

  protected start(): Awaitable<void> {}
  protected stop(): Awaitable<void> {}
  protected fork?(ctx: C, config: any): void

  public name!: string

  constructor(protected ctx: C, name: string) {
    name ??= this.constructor['provide'] as string

    let self = this
    const tracker: Tracker = {
      associate: name,
      property: 'ctx',
    }
    if (self[symbols.invoke]) {
      self = createCallable(name, joinPrototype(Object.getPrototypeOf(this), Function.prototype), tracker)
    }
    self.ctx = ctx
    self.name = name
    self.config = config
    defineProperty(self, symbols.tracker, tracker)

    self.ctx.provide(name)
    self.ctx.runtime.name = name
    if (immediate) {
      if (_ctx) self[symbols.expose] = name
      else self.ctx.set(name, self)
    }

    self.ctx.on('ready', async () => {
      // await until next tick because derived class has not been initialized yet
      await Promise.resolve()
      await self.start()
      if (!immediate) self.ctx.set(name!, self)
    })

    self.ctx.on('dispose', () => self.stop())
    return self
  }

  protected [symbols.filter](ctx: Context) {
    return ctx[symbols.isolate][this.name] === this.ctx[symbols.isolate][this.name]
  }

  protected [symbols.extend](props?: any) {
    let self: any
    if (this[Service.invoke]) {
      self = createCallable(this.name, this, this[symbols.tracker])
    } else {
      self = Object.create(this)
    }
    return Object.assign(self, props)
  }

  static [Symbol.hasInstance](instance: any) {
    let constructor = instance.constructor
    while (constructor) {
      // constructor may be a proxy
      constructor = constructor.prototype?.constructor
      if (constructor === this) return true
      constructor = Object.getPrototypeOf(constructor)
    }
    return false
  }
}
