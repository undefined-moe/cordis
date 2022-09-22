import { Context } from '../src'
import { expect } from 'chai'
import * as jest from 'jest-mock'
import { Dict, noop } from 'cosmokit'
import { event } from './shared'

describe('Disposables', () => {
  it('fork.dispose', () => {
    const plugin = (ctx: Context) => {
      ctx.on(event, callback)
      ctx.plugin((ctx) => {
        ctx.on(event, callback)
        ctx.plugin((ctx) => {
          ctx.on(event, callback)
        })
      })
    }

    const root = new Context()
    const callback = jest.fn()
    root.on(event, callback)
    const fork = root.plugin(plugin)

    // 4 handlers by now
    expect(callback.mock.calls).to.have.length(0)
    expect(root.registry.size).to.equal(4)
    root.emit(event)
    expect(callback.mock.calls).to.have.length(4)

    // only 1 handler left
    callback.mockClear()
    fork.dispose()
    expect(root.registry.size).to.equal(1)
    root.emit(event)
    expect(callback.mock.calls).to.have.length(1)
  })

  it('memory leak test', async () => {
    function plugin(ctx: Context) {
      ctx.on('ready', noop)
      ctx.on(event, noop)
      ctx.on('dispose', noop)
    }

    function getHookSnapshot() {
      const result: Dict<number> = {}
      for (const [name, callbacks] of Object.entries(root.events._hooks)) {
        if (callbacks.length) result[name] = callbacks.length
      }
      return result
    }

    const root = new Context()
    const before = getHookSnapshot()
    root.plugin(plugin)
    const after = getHookSnapshot()
    root.dispose(plugin)
    expect(before).to.deep.equal(getHookSnapshot())
    root.plugin(plugin)
    expect(after).to.deep.equal(getHookSnapshot())
  })

  it('dispose event', () => {
    const root = new Context()
    const callback = jest.fn(noop)
    const plugin = (ctx: Context) => {
      ctx.on('dispose', callback)
    }

    root.plugin(plugin)
    expect(callback.mock.calls).to.have.length(0)
    expect(root.dispose(plugin)).to.be.ok
    expect(callback.mock.calls).to.have.length(1)
    // callback should only be called once
    expect(root.dispose(plugin)).to.be.not.ok
    expect(callback.mock.calls).to.have.length(1)
  })

  it('root dispose', async () => {
    const root = new Context()
    const callback = jest.fn(noop)
    const { length } = root.state.disposables

    root.on('ready', callback)
    expect(callback.mock.calls).to.have.length(0)

    await root.start()
    expect(callback.mock.calls).to.have.length(1)

    root.on('ready', callback)
    expect(callback.mock.calls).to.have.length(2)

    await root.stop()

    await root.start()
    expect(callback.mock.calls).to.have.length(2)
    expect(root.state.disposables.length).to.equal(length)
  })
})
