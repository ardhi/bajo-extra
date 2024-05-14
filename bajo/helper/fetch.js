import path from 'path'
import { fetch, Agent } from 'undici'

async function fetchUrl (url, opts = {}, extra = {}) {
  const { getConfig, isSet, fs } = this.bajo.helper
  const { has, isArray, isPlainObject, isString, cloneDeep, isEmpty, merge } = this.bajo.helper._
  const cfg = getConfig('bajoExtra')
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
  if (!isEmpty(cfg.fetch.agent)) {
    opts.dispatcher = new Agent(cfg.fetch.agent)
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
  const resp = await fetch(url, opts)
  if (extra.rawResponse) return resp
  return await resp.json()
}

export default fetchUrl
