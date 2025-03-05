import path from 'path'
import { fetch, Agent } from 'undici'

async function fetchUrl (url, opts = {}, extra = {}) {
  const { isSet } = this.app.bajo
  const { fs } = this.app.bajo.lib
  const { has, isArray, isPlainObject, isString, cloneDeep, merge } = this.app.bajo.lib._
  if (isPlainObject(url)) {
    extra = cloneDeep(opts)
    opts = cloneDeep(url)
    url = opts.url
    delete opts.url
  }
  if (opts.method) opts.method = opts.method.toUpperCase()
  if (opts.auth) {
    opts.headers.Authorization = `Basic ${Buffer.from(`${opts.auth.username}:${opts.auth.password}`).toString('base64')}`
    delete opts.auth
  }
  opts.query = merge({}, opts.query, opts.params ?? {})
  delete opts.params
  if (!has(extra, 'cacheBuster')) extra.cacheBuster = true
  if (extra.cacheBuster) opts.query[extra.cacheBusterKey ?? '_'] = Date.now()
  if (this.config.fetch.agent || extra.agent) {
    opts.dispatcher = new Agent(extra.agent ?? this.config.fetch.agent)
  }
  if (opts.body && extra.formData) {
    const formData = new FormData()
    for (const key in opts.body) {
      let fname
      let val = opts.body[key]
      if (!isSet(val)) continue
      if (isString(val) && val.startsWith('file:///')) {
        fname = path.basename(val)
        val = new Blob([fs.readFileSync(val.slice(8))])
      } else if (isPlainObject(val) || isArray(val)) val = JSON.stringify(val)
      if (fname) formData.append(key, val, fname)
      else formData.append(key, val)
    }
    opts.body = formData
  }
  if (opts.query) {
    // todo: what if url already contain query string?
    const query = new URLSearchParams(opts.query)
    url += '?' + query
  }
  const resp = await fetch(url, opts)
  if (extra.rawResponse) return resp
  return await resp.json()
}

export default fetchUrl
