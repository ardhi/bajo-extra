import path from 'path'
import scramjet from 'scramjet'
import format from 'ndjson-csv-xlsx'
import { createGunzip } from 'zlib'

const { json, ndjson, csv, xlsx } = format
const { DataStream } = scramjet
const supportedExt = ['.json', '.jsonl', '.ndjson', '.csv', '.xlsx']

async function importFrom (source, dest, { trashOld = true, batch, progressFn, useHeader = true } = {}) {
  const { error, importPkg, getConfig } = this.bajo.helper
  if (!this.bajoDb) throw error('Bajo DB isn\'t loaded')
  const { getInfo, recordClear, recordCreate } = this.bajoDb.helper
  await getInfo(dest)
  const fs = await importPkg('fs-extra')
  const config = getConfig()
  const cfg = getConfig('bajoExtra')

  let file
  if (path.isAbsolute(source)) file = source
  else {
    file = `${config.dir.data}/import/bajoDb/${source}`
    fs.ensureDirSync(path.dirname(file))
  }
  if (!fs.existsSync(file)) throw error('Source file \'%s\' doesn\'t exist', file)
  let ext = path.extname(file)
  let decompress = false
  if (ext === '.gz') {
    ext = path.extname(path.basename(file, '.gz'))
    decompress = true
  }
  if (!supportedExt.includes(ext)) throw error('Unsupported format \'%s\'', ext.slice(1))
  if (trashOld) await recordClear(dest)
  const reader = fs.createReadStream(file)
  batch = parseInt(batch) || 100
  if (batch > cfg.stream.import.maxBatch) batch = cfg.stream.import.maxBatch
  if (batch < 0) batch = 1
  let count = 0
  const pipes = [reader]
  if (decompress) pipes.push(createGunzip())
  if (ext === '.json') pipes.push(json.parse())
  else if (['.ndjson', '.jsonl'].includes(ext)) pipes.push(ndjson.parse())
  else if (ext === '.csv') pipes.push(csv.parse({ headers: useHeader }))
  else if (ext === '.xlsx') pipes.push(xlsx.parse({ header: useHeader }))

  const stream = DataStream.pipeline(...pipes)
  let batchNo = 1
  await stream
    .batch(batch)
    .map(async items => {
      if (items.length === 0) return null
      if (progressFn) await progressFn.call(this, { batchNo, data: items })
      for (let i = 0; i < items.length; i++) {
        count++
        await recordCreate(dest, items[i])
      }
      batchNo++
      return null
    })
    .run()

  return { file, count }
}

export default importFrom
