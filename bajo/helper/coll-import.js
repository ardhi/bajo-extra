import path from 'path'
import scramjet from 'scramjet'
import format from 'ndjson-csv-xlsx'
const { json, ndjson, csv, xlsx } = format

const { DataStream } = scramjet

const supportedExt = ['.json', '.jsonl', '.ndjson', '.csv', '.xlsx']

async function collImport (name, source, { trashOld = true, batch, ignoreParseError = true, useHeader = true } = {}) {
  const { error, importPkg, getConfig } = this.bajo.helper
  if (!this.bajoDb) throw error('Bajo DB isn\'t loaded')
  const { getInfo, recordClear, recordCreate } = this.bajoDb.helper
  await getInfo(name)
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
  const ext = path.extname(file)
  if (!supportedExt.includes(ext)) throw error('Unsupported format \'%s\'', ext.slice(1))
  if (trashOld) await recordClear(name)
  const reader = fs.createReadStream(file)
  reader.on('error', err => {
    throw err
  })
  batch = parseInt(batch) || 100
  if (batch > cfg.stream.import.maxBatch) batch = cfg.stream.import.maxBatch
  if (batch < 0) batch = 1
  let count = 0
  let stream
  if (ext === '.json') stream = DataStream.pipeline(reader, json.parse())
  else if (['.ndjson', '.jsonl'].includes(ext)) stream = DataStream.pipeline(reader, ndjson.parse())
  else if (ext === '.csv') stream = DataStream.pipeline(reader, csv.parse({ headers: useHeader }))
  else if (ext === '.xlsx') stream = DataStream.pipeline(reader, xlsx.parse({ header: useHeader }))

  await stream
    .batch(batch)
    .map(async items => {
      if (items.length === 0) return null
      for (let i = 0; i < items.length; i++) {
        count++
        await recordCreate(name, items[i])
      }
      return null
    })
    .run()

  return { file, count }
}

export default collImport
