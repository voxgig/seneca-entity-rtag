/* Copyright (c) 2019 voxgig and other contributors, MIT License */
'use strict'

module.exports = entity_rtag
module.exports.defaults = {
  rtaglen: 17,
  annotate: true
}
module.exports.errors = {
}

function entity_rtag(options) {
  const seneca = this
  const Joi = seneca.util.Joi
  const rtag = seneca.util.Nid({length:options.rtaglen})
  
  const HIT = 1
  const MISS = 2
  
  seneca
    .message('role:entity,cmd:save', cmd_save_rtag)
    .message('role:cache,resolve:rtag', resolve_rtag)


  
  Object.assign(cmd_save_rtag, {
    desc: 'Override role:entity,cmd:save to rtag field.',
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

    const id = space+'~'+key+'~'+rtag
    var data = null
    var cache_entry = await seneca.entity('sys/cache').load$(id)

    if(cache_entry) {
      data = cache_entry.data
      
      // TODO: need a general entity hydration util as also needed by transport
      if(data.entity$) {
        data = seneca.entity(data)
      }

      if(options.annotate) {
        data.rtag$ = HIT
      }
      
      return data
    }
    else {
      data = await resolver.call(seneca)
      
      if(data && false !== data.cache$) {
        cache_entry = await seneca.entity('sys/cache').make$({
          id$:id,data:data,when:Date.now()
        }).save$()
      }

      if(options.annotate) {
        data.rtag$ = MISS
      }
      
      return data
    }
  }

}
