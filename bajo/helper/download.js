import path from 'path'
import { Readable } from 'node:stream'

async function download (url, opts = {}, extra = {}) {
  const { fs, getPluginDataDir, importPkg, error, generateId } = this.bajo.helper
  const { fetch, formatByte, formatPercentage } = this.bajoExtra.helper
  const { isFunction, merge } = this.bajo.helper._
  if (typeof opts === 'string') extra = { dir: opts }
  const increment = await importPkg('add-filename-increment')
  if (!extra.dir) {
    extra.dir = `${getPluginDataDir('bajoExtra')}/download`
    fs.ensureDirSync(extra.dir)
  }
  if (!fs.existsSync(extra.dir)) throw error('Download dir \'%s\' doesn\'t exists', extra.dir)
  if (extra.randomFileName) {
    const ext = path.extname(url)
    extra.fileName = `${generateId()}${ext}`
  }
  if (!extra.fileName) extra.fileName = path.basename(url)
  const file = path.resolve(increment(`${extra.dir}/${extra.fileName}`, { fs: true }))
  const writer = fs.createWriteStream(file)
  const { headers, body, ok, status } = await fetch(url, opts, merge({}, extra, { rawResponse: true }))
  if (!ok) {
    fs.removeSync(file)
    throw error('Getting %s status', status)
  }
  const total = headers['content-length'] ?? 0
  const data = Readable.fromWeb(body)
  let length = 0
  data.on('data', chunk => {
    length += chunk.length
    if (isFunction(extra.progressFn)) extra.progressFn.call(this, length, total)
    else if (extra.spin) {
      extra.spinText = extra.spinText ?? 'Downloading...'
      if (total === 0) extra.spin.setText(`${extra.spinText} %s`, formatByte(length))
      else extra.spin.setText(`${extra.spinText} %s of %s (%s)`, formatByte(length), formatByte(total), formatPercentage(length / total))
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
