import axios from 'axios'

async function fetch (url, opts = {}, ext = {}) {
  const { importPkg } = this.bajo.helper
  const { has, isPlainObject, cloneDeep } = await importPkg('lodash-es')
  if (isPlainObject(url)) {
    ext = cloneDeep(opts)
    opts = cloneDeep(url)
  } else opts.url = url
  opts.params = opts.params || {}
  if (!has(ext, 'cacheBuster')) ext.cacheBuster = true
  if (ext.cacheBuster) opts.params[ext.cacheBusterKey || '_'] = Date.now()
  const resp = await axios(opts)
  if (ext.rawResponse) return resp
  return resp.data
}

export default fetch
