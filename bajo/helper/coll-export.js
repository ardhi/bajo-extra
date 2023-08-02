import path from 'path'
import scramjet from 'scramjet'
import format from 'ndjson-csv-xlsx'

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
  const ext = path.extname(file)
  if (!supportedExt.includes(ext)) throw error('Unsupported format \'%s\'', ext.slice(1))
  return { file, ext }
}

async function getData ({ name, filter, count, stream }) {
  let cnt = count || 0
  const { recordFind } = this.bajoDb.helper
  for (;;) {
    const data = await recordFind(name, filter)
    if (data.length === 0) break
    cnt += data.length
    stream.pull(data)
    filter.page++
  }
  return cnt
}

function collExport (name, dest, { filter = {}, ensureDir, useHeader = true, compress, batch = 500 } = {}) {
  const { error, importPkg, getConfig } = this.bajo.helper
  const { gzipFile } = this.bajoExtra.helper
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
    getInfo(name)
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
        const writer = fs.createWriteStream(file)
        writer.on('error', reject)
        writer.on('finish', () => {
          if (!compress) return resolve({ file, count })
          gzipFile(file, true)
            .then(() => {
              resolve({ file, count })
            })
            .catch(reject)
        })
        stream = new DataStream()
        stream = stream.flatMap(items => (items))
        if (ext === '.json') stream.pipe(json.stringify()).pipe(writer)
        else if (['.ndjson', '.jsonl'].includes(ext)) stream.pipe(ndjson.stringify()).pipe(writer)
        else if (ext === '.csv') stream.pipe(csv.stringify({ headers: useHeader })).pipe(writer)
        else if (ext === '.xlsx') stream.pipe(xlsx.stringify({ header: useHeader })).pipe(writer)
        return getData.call(this, { name, filter, count, stream })
      })
      .then(cnt => {
        count = cnt
        return stream.end()
      })
      .catch(reject)
  })
}

export default collExport
