import path from 'path'

async function download (url, opts = {}) {
  const { fs, getPluginDataDir, importPkg, error, generateId } = this.bajo.helper
  const { fetch, formatByte, formatPercentage } = this.bajoExtra.helper
  const { isFunction } = this.bajo.helper._
  if (typeof opts === 'string') opts = { dir: opts }
  const increment = await importPkg('add-filename-increment')
  if (!opts.dir) {
    opts.dir = `${getPluginDataDir('bajoExtra')}/download`
    fs.ensureDirSync(opts.dir)
  }
  const fetchOpts = opts.fetchOpts ?? {}
  if (!fs.existsSync(opts.dir)) throw error('Download dir \'%s\' doesn\'t exists', opts.dir)
  if (opts.randomFileName) {
    const ext = path.extname(url)
    opts.fileName = `${generateId()}${ext}`
  }
  if (!opts.fileName) opts.fileName = path.basename(url)
  const file = path.resolve(increment(`${opts.dir}/${opts.fileName}`, { fs: true }))
  const writer = fs.createWriteStream(file)
  fetchOpts.responseType = 'stream'
  const { headers, data } = await fetch(url, fetchOpts, { rawResponse: true })
  const total = headers['content-length'] ?? 0
  let length = 0
  data.on('data', chunk => {
    length += chunk.length
    if (isFunction(opts.progressFn)) opts.progressFn.call(this, length, total)
    else if (opts.spin) {
      opts.spinText = opts.spinText ?? 'Downloading...'
      if (total === 0) opts.spin.setText(`${opts.spinText} %s`, formatByte(length))
      else opts.spin.setText(`${opts.spinText} %s of %s (%s)`, formatByte(length), formatByte(total), formatPercentage(length / total))
    }
  })
  data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on('error', reject)
    writer.on('finish', () => {
      resolve(file)
    })
  })
}

export default download
