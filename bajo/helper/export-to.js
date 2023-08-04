import path from 'path'
import scramjet from 'scramjet'
import format from 'ndjson-csv-xlsx'
import { createGzip } from 'zlib'

const { json, ndjson, csv, xlsx } = format
const { DataStream } = scramjet

const supportedExt = ['.json', '.jsonl', '.ndjson', '.csv', '.xlsx']

async function getFile (dest, ensureDir) {
  const { importPkg, getConfig, error } = this.bajo.helper
  const fs = await importPkg('fs-extra')
  const config = getConfig()
  let file
  if (path.isAbsolute(dest)) file = dest
  else {
    file = `${config.dir.data}/export/bajoDb/${dest}`
    fs.ensureDirSync(path.dirname(file))
  }
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) {
    if (ensureDir) fs.ensureDirSync(dir)
    else throw error('Directory \'%s\' doesn\'t exist', dir)
  }
  let compress = false
  let ext = path.extname(file)
  if (ext === '.gz') {
    compress = true
    ext = path.extname(path.basename(file).replace('.gz', ''))
    // file = file.slice(0, file.length - 3)
  }
  if (!supportedExt.includes(ext)) throw error('Unsupported format \'%s\'', ext.slice(1))
  return { file, ext, compress }
}

async function getData ({ source, filter, count, stream, progressFn }) {
  let cnt = count || 0
  const { recordFind } = this.bajoDb.helper
  for (;;) {
    const { data, pages, page } = await recordFind(source, filter, { dataOnly: false })
    if (data.length === 0) break
    cnt += data.length
    stream.pull(data)
    if (progressFn) await progressFn.call(this, { batchTotal: pages, batchNo: page, data })
    filter.page++
  }
  return cnt
}

function exportTo (source, dest, { filter = {}, ensureDir, useHeader = true, batch = 500, progressFn } = {}) {
  const { error, importPkg, getConfig } = this.bajo.helper
  const cfg = getConfig('bajoExtra')
  if (!this.bajoDb) throw error('Bajo DB isn\'t loaded')
  filter.page = 1
  batch = parseInt(batch) || 500
  if (batch > cfg.stream.export.maxBatch) batch = cfg.stream.export.maxBatch
  if (batch < 0) batch = 1
  filter.limit = batch

  return new Promise((resolve, reject) => {
    const { getInfo } = this.bajoDb.helper
    let count = 0
    let fs
    let file
    let ext
    let stream
    let compress
    getInfo(source)
      .then(() => {
        return importPkg('fs-extra')
      })
      .then(res => {
        fs = res
        return getFile.call(this, dest, ensureDir)
      })
      .then(res => {
        file = res.file
        ext = res.ext
        compress = res.compress
        const writer = fs.createWriteStream(file)
        writer.on('error', reject)
        writer.on('finish', () => {
          resolve({ file, count })
        })
        stream = new DataStream()
        stream = stream.flatMap(items => (items))
        let cstream
        if (ext === '.json') cstream = stream.pipe(json.stringify())
        else if (['.ndjson', '.jsonl'].includes(ext)) cstream = stream.pipe(ndjson.stringify())
        else if (ext === '.csv') cstream = stream.pipe(csv.stringify({ headers: useHeader }))
        else if (ext === '.xlsx') cstream = stream.pipe(xlsx.stringify({ header: useHeader }))
        if (compress) cstream.pipe(createGzip()).pipe(writer)
        return getData.call(this, { source, filter, count, stream, progressFn })
      })
      .then(cnt => {
        count = cnt
        return stream.end()
      })
      .then(() => {
        resolve({ count, file })
      })
      .catch(reject)
  })
}

export default exportTo
