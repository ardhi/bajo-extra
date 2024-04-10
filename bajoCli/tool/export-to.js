import Path from 'path'

const batch = 100

function makeProgress (spin) {
  return async function ({ batchNo, data, batchStart, batchEnd } = {}) {
    const { secToHms } = this.bajo.helper
    if (data.length === 0) return
    spin.setText('Batch #%d (%s)', batchNo, secToHms(batchEnd.toTime() - batchStart.toTime(), true))
  }
}

async function exportTo ({ path, args }) {
  const { importPkg, print, dayjs, getConfig, importModule, spinner } = this.bajo.helper
  const { isEmpty, map } = await importPkg('lodash-es')
  const [input, select] = await importPkg('bajo-cli:@inquirer/input',
    'bajo-cli:@inquirer/select')
  const config = getConfig()
  if (!this.bajoDb) return print.fail('Bajo DB isn\'t loaded', { exit: config.tool })
  const schemas = map(this.bajoDb.schemas, 'name')
  if (isEmpty(schemas)) return print.fail('No schema found!', { exit: config.tool })
  let [coll, dest, query] = args
  if (isEmpty(coll)) {
    coll = await select({
      message: print.__('Please choose collection:'),
      choices: map(schemas, s => ({ value: s }))
    })
  }
  if (isEmpty(dest)) {
    dest = await input({
      message: print.__('Please enter destination file:'),
      default: `${coll}-${dayjs().format('YYYYMMDD')}.ndjson`,
      validate: (item) => !isEmpty(item)
    })
  }
  if (isEmpty(query)) {
    query = await input({
      message: print.__('Please enter a query (if any):')
    })
  }
  const spin = spinner().start('Exporting...')
  const progressFn = makeProgress.call(this, spin)
  const cfg = getConfig('bajoDb', { full: true })
  const start = await importModule(`${cfg.dir.pkg}/bajo/start.js`)
  const { connection } = await this.bajoDb.helper.getInfo(coll)
  await start.call(this, connection.name)
  try {
    const filter = { query }
    const result = await this.bajoExtra.helper.exportTo(coll, dest, { filter, batch, progressFn })
    spin.succeed('%d records successfully exported to \'%s\'', result.count, Path.resolve(result.file))
  } catch (err) {
    console.log(err)
    spin.fail('Error: %s', err.message, { exit: config.tool })
  }
}

export default exportTo
