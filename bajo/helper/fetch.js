import axios from 'axios'
import http from 'http'
import https from 'https'

async function fetch (url, opts = {}, ext = {}) {
  const { getConfig } = this.bajo.helper
  const { has, isPlainObject, cloneDeep, isEmpty } = this.bajo.helper._
  const cfg = getConfig('bajoExtra')
  if (isPlainObject(url)) {
    ext = cloneDeep(opts)
    opts = cloneDeep(url)
  } else opts.url = url
  opts.params = opts.params ?? {}
  if (!has(ext, 'cacheBuster')) ext.cacheBuster = true
  if (ext.cacheBuster) opts.params[ext.cacheBusterKey ?? '_'] = Date.now()
  if (!isEmpty(cfg.fetch.agent)) {
    opts.httpAgent = opts.httpAgent ?? new http.Agent(cfg.fetch.agent)
    opts.httpsAgent = opts.httpsAgent ?? new https.Agent(cfg.fetch.agent)
  }
  const resp = await axios(opts)
  if (ext.rawResponse) return resp
  return resp.data
}

export default fetch
