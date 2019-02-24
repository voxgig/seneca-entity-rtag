/* Copyright (c) 2019 voxgig and other contributors, MIT License */
'use strict'

const Util = require('util')

module.exports = entity_rtag
module.exports.defaults = {
  rtaglen: 17,
  annotate: true,

  // TODO: mem-store should deep clone!
  clone_before_hydrate: true
}
module.exports.errors = {}

function entity_rtag(options) {
  const seneca = this
  const Joi = seneca.util.Joi
  const rtag = seneca.util.Nid({ length: options.rtaglen })

  const HIT = 1
  const MISS = 2

  const stats = {
    hit: 0,
    miss: 0,
    space: {}
  }

  seneca
    .message('role:entity,cmd:save', cmd_save_rtag)
    .message('role:cache,resolve:rtag', resolve_rtag)
    .message('role:cache,stats:rtag', stats_rtag)

  async function stats_rtag(msg) {
    return stats
  }

  Object.assign(cmd_save_rtag, {
    desc: 'Override role:entity,cmd:save to rtag field.'
  })

  async function cmd_save_rtag(msg) {
    const ent = msg.ent
    ent.rtag = rtag() // always override
    return await this.prior(msg)
  }

  Object.assign(resolve_rtag, {
    desc: 'Use rtag to load cached version of expensive result.',
    validate: {
      space: Joi.string().required(),
      key: Joi.string().required(),
      rtag: Joi.string().required(),
      resolver: Joi.func().required()
    }
  })

  async function resolve_rtag(msg) {
    const seneca = this

    const space = msg.space
    const key = msg.key
    const rtag = msg.rtag
    const resolver = msg.resolver

    const id = space + '~' + key + '~' + rtag
    var cache_entry = await seneca.entity('sys/cache').load$(id)

    if (cache_entry) {
      var entrydata = cache_entry.data
      var entryout = entrydata

      // TODO: need a general entity hydration util as also needed by transport
      if (entrydata.__entity$) {
        if (options.clone_before_hydrate) {
          entrydata = Object.assign({}, entrydata)
        }

        entrydata.entity$ = entrydata.__entity$
        delete entrydata.__entity$
        entryout = seneca.entity(entrydata)
      }

      if (options.annotate) {
        entryout.rtag$ = HIT
      }

      stats.hit++
      ;(stats.space[space] = stats.space[space] || { hit: 0, miss: 0 }).hit++

      return entryout
    } else {
      var origdata = await resolver.call(seneca)
      var cachedata = origdata

      stats.miss++
      ;(stats.space[space] = stats.space[space] || { hit: 0, miss: 0 }).miss++

      if (cachedata && false !== cachedata.rtag_cache$) {
        if (cachedata.entity$) {
          cachedata = cachedata.data$()

          // Avoid seneca-entity auto replacement of entities with id
          cachedata.__entity$ = cachedata.entity$
          delete cachedata.entity$
        }

        cache_entry = seneca.entity('sys/cache').make$({
          id$: id,
          when: Date.now()
        })

        try {
          cache_entry.data = cachedata

          // TODO: find a better way to do this

          var cache_entry_exists = await seneca.entity('sys/cache').load$(id)
          if (!cache_entry_exists) {
            await cache_entry.save$()
          }
        } catch (e) {
          // NOTE: can be safely ignored
          console.log('CACHE SAVE', e)
        }
      }

      if (options.annotate) {
        origdata.rtag$ = MISS
      }

      return origdata
    }
  }
}
