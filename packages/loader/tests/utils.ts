import { Dict } from 'cosmokit'
import { Context, ForkScope, Plugin } from '@cordisjs/core'
import { FileLoader, Entry, group, Loader } from '../src'
import { Mock, mock } from 'node:test'
import { expect } from 'chai'

declare module '../src/shared' {
  interface Loader {
    mock<F extends Function>(name: string, plugin: F): Mock<F>
    expectEnable(plugin: any, config?: any): void
    expectDisable(plugin: any): void
    expectFork(id: string): ForkScope
  }
}

class MockFileLoader<T extends MockLoader = MockLoader> extends FileLoader<T> {
  mutable = true

  async read() {
    return this.loader.config
  }

  async import(name: string) {
    return this.loader.modules[name]
  }
}

export default class MockLoader extends Loader {
  public modules: Dict<Plugin.Object> = Object.create(null)
  public config: Entry.Options[] = []

  constructor(ctx: Context) {
    super(ctx, { name: 'cordis' })
    this.file = new MockFileLoader(this, 'cordis.yml')
    this.mock('cordis/group', group)
  }

  mock<F extends Function>(name: string, plugin: F) {
    return this.modules[name] = mock.fn(plugin)
  }

  expectEnable(plugin: any, config?: any) {
    const runtime = this.ctx.registry.get(plugin)
    expect(runtime).to.be.ok
    expect(runtime!.config).to.deep.equal(config)
  }

  expectDisable(plugin: any) {
    const runtime = this.ctx.registry.get(plugin)
    expect(runtime).to.be.not.ok
  }

  expectFork(id: string) {
    expect(this.entries[id]?.fork).to.be.ok
    return this.entries[id]!.fork!
  }
}
