/* Copyright (c) 2019 voxgig and other contributors, MIT License */
'use strict'

const Util = require('util')

const Lab = require('lab')
const Code = require('code')
const lab = (exports.lab = Lab.script())
const expect = Code.expect

const PluginValidator = require('seneca-plugin-validator')
const Seneca = require('seneca')
const Plugin = require('..')

lab.test(
  'validate',
  Util.promisify(function(x, fin) {
    PluginValidator(Plugin, module)(fin)
  })
)

lab.test('plugin-load', async () => {
  return await seneca_instance().ready()
})

lab.test('happy', async () => {
  var si = seneca_instance()
  var foo_a = await si.entity('foo', { a: 1 }).save$()
  expect(foo_a).contains({ a: 1 })
  expect(foo_a.rtag.length).equal(
    si.find_plugin('entity_rtag').defaults.rtaglen
  )

  var first = foo_a.rtag

  var foo_b = await foo_a.save$()
  var second = foo_b.rtag

  expect(first).not.equal(second)

  // NOTE: Seneca entity updates in situ
  expect(foo_a.rtag).equal(foo_b.rtag)
})

lab.test('resolve', async () => {
  var si = seneca_instance()

  var HIT = 1
  var MISS = 2

  function make_resolver(foo_id) {
    return async function resolver() {
      var foo = await si.entity('foo').load$(foo_id)
      var bar = await si.entity('bar').load$(foo.bar_id)
      var out = { foo: foo, bar: bar }

      if (foo.test_no_cache) {
        out.rtag_cache$ = false
      }

      return out
    }
  }

  var bar0 = await si
    .entity('bar')
    .make$({ b: 1 })
    .save$()
  var foo0 = await si
    .entity('foo')
    .make$({ handle: 'foo0', a: 1, bar_id: bar0.id })
    .save$()

  var out0 = await si.post('role:cache,resolve:rtag,space:test0', {
    key: foo0.handle,
    rtag: foo0.rtag,
    resolver: make_resolver(foo0.id)
  })

  expect(out0.foo.a).equal(1)
  expect(out0.bar.b).equal(1)
  expect(out0.rtag$).equal(MISS)

  var out1 = await si.post('role:cache,resolve:rtag,space:test0', {
    key: foo0.handle,
    rtag: foo0.rtag,
    resolver: make_resolver(foo0.id)
  })

  expect(out1.foo.a).equal(1)
  expect(out1.bar.b).equal(1)
  expect(out1.rtag$).equal(HIT)

  bar0.b = 2
  await bar0.save$()
  await foo0.save$() // kicks rtag

  var out2 = await si.post('role:cache,resolve:rtag,space:test0', {
    key: foo0.handle,
    rtag: foo0.rtag,
    resolver: make_resolver(foo0.id)
  })

  expect(out2.foo.a).equal(1)
  expect(out2.bar.b).equal(2)
  expect(out2.rtag$).equal(MISS)

  var out3 = await si.post('role:cache,resolve:rtag,space:test0', {
    key: foo0.handle,
    rtag: foo0.rtag,
    resolver: make_resolver(foo0.id)
  })

  expect(out3.foo.a).equal(1)
  expect(out3.bar.b).equal(2)
  expect(out3.rtag$).equal(HIT)

  var out4 = await si.post('role:cache,resolve:rtag,space:test0', {
    key: foo0.handle,
    rtag: foo0.rtag,
    resolver: make_resolver(foo0.id)
  })

  expect(out4.foo.a).equal(1)
  expect(out4.bar.b).equal(2)
  expect(out4.rtag$).equal(HIT)

  foo0.test_no_cache = true
  await foo0.save$() // kicks rtag

  var out5 = await si.post('role:cache,resolve:rtag,space:test0', {
    key: foo0.handle,
    rtag: foo0.rtag,
    resolver: make_resolver(foo0.id)
  })

  expect(out5.foo.a).equal(1)
  expect(out5.bar.b).equal(2)
  expect(out5.rtag$).equal(MISS)

  // Still a MISS as we turned off caching with rtag_cache$:false
  var out6 = await si.post('role:cache,resolve:rtag,space:test0', {
    key: foo0.handle,
    rtag: foo0.rtag,
    resolver: make_resolver(foo0.id)
  })

  expect(out6.foo.a).equal(1)
  expect(out6.bar.b).equal(2)
  expect(out6.rtag$).equal(MISS)

  var stats = await si.post('role:cache,stats:rtag')
  expect(stats).equal({
    hit: 3,
    miss: 4,
    space: { test0: { hit: 3, miss: 4 } }
  })
})

lab.test('resolve-entity', async () => {
  var si = seneca_instance()

  var HIT = 1
  var MISS = 2

  function make_resolver(foo_id) {
    return async function resolver() {
      var foo = await si.entity('foo').load$(foo_id)
      var bar = await si.entity('bar').load$(foo.bar_id)
      return bar
    }
  }

  var bar0 = await si
    .entity('bar')
    .make$({ b: 1 })
    .save$()
  var foo0 = await si
    .entity('foo')
    .make$({ handle: 'foo0', a: 1, bar_id: bar0.id })
    .save$()

  var out0 = await si.post('role:cache,resolve:rtag,space:test0', {
    key: foo0.handle,
    rtag: foo0.rtag,
    resolver: make_resolver(foo0.id)
  })

  expect(out0.b).equal(1)
  expect(out0.rtag$).equal(MISS)

  var out1 = await si.post('role:cache,resolve:rtag,space:test0', {
    key: foo0.handle,
    rtag: foo0.rtag,
    resolver: make_resolver(foo0.id)
  })

  expect(out1.b).equal(1)
  expect(out1.rtag$).equal(HIT)

  bar0.b = 2
  await bar0.save$()
  await foo0.save$() // kicks rtag

  var out2 = await si.post('role:cache,resolve:rtag,space:test0', {
    key: foo0.handle,
    rtag: foo0.rtag,
    resolver: make_resolver(foo0.id)
  })

  expect(out2.b).equal(2)
  expect(out2.rtag$).equal(MISS)

  var out3 = await si.post('role:cache,resolve:rtag,space:test0', {
    key: foo0.handle,
    rtag: foo0.rtag,
    resolver: make_resolver(foo0.id)
  })

  expect(out3.b).equal(2)
  expect(out3.rtag$).equal(HIT)

  var out4 = await si.post('role:cache,resolve:rtag,space:test0', {
    key: foo0.handle,
    rtag: foo0.rtag,
    resolver: make_resolver(foo0.id)
  })

  expect(out4.b).equal(2)
  expect(out4.rtag$).equal(HIT)

  var stats = await si.post('role:cache,stats:rtag')
  expect(stats).equal({
    hit: 3,
    miss: 2,
    space: { test0: { hit: 3, miss: 2 } }
  })
})

function seneca_instance(config, plugin_options) {
  return Seneca(config, { legacy: { transport: false } })
    .test()
    .use('promisify')
    .use('entity')
    .use(Plugin, plugin_options)
}
