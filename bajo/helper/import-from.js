import path from 'path'
import scramjet from 'scramjet'
import format from '../../lib/ndjson-csv-xlsx.js'
import { createGunzip } from 'zlib'

const { json, ndjson, csv, xlsx } = format
const { DataStream } = scramjet
const supportedExt = ['.json', '.jsonl', '.ndjson', '.csv', '.xlsx']

async function importFrom (source, dest, { trashOld = true, batch = 1, progressFn, converterFn, useHeader = true, fileType, createOpts = {} } = {}, opts = {}) {
  const { error, importPkg, getConfig, getPluginDataDir, secToHms } = this.bajo.helper
  if (!this.bajoDb) throw error('Bajo DB isn\'t loaded')
  const { getInfo, recordClear, recordCreate } = this.bajoDb.helper
  await getInfo(dest)
  const { merge } = await importPkg('lodash-es')
  const fs = await importPkg('fs-extra')
  const cfg = getConfig('bajoExtra')

  let file
  if (path.isAbsolute(source)) file = source
  else {
    file = `${getPluginDataDir('bajoExtra')}/import/${source}`
    fs.ensureDirSync(path.dirname(file))
  }
  if (!fs.existsSync(file)) throw error('Source file \'%s\' doesn\'t exist', file)
  let ext = fileType ? `.${fileType}` : path.extname(file)
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
  if (ext === '.json') pipes.push(json.parse(opts))
  else if (['.ndjson', '.jsonl'].includes(ext)) pipes.push(ndjson.parse(opts))
  else if (ext === '.csv') pipes.push(csv.parse(merge({ headers: useHeader }, opts)))
  else if (ext === '.xlsx') pipes.push(xlsx.parse(merge({ header: useHeader }, opts)))

  const stream = DataStream.pipeline(...pipes)
  let batchNo = 1
  await stream
    .batch(batch)
    .map(async items => {
      if (items.length === 0) return null
      const start = Date.now()
      for (let item of items) {
        count++
        item = converterFn ? await converterFn.call(this, item) : item
        await recordCreate(dest, item, createOpts)
      }
      const diff = Date.now() - start
      if (progressFn) await progressFn.call(this, { batchNo, data: items, time: secToHms(diff, true), timeMsec: diff })
      batchNo++
    })
    .run()

  return { file, count }
}

export default importFrom
