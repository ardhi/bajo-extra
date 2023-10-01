import Path from 'path'

function makeProgress (spinner) {
  return async function ({ batchNo, batchTotal, data } = {}) {
    if (batchTotal === 0) return
    spinner.setText('Batch %d of %d (%d records)', batchNo, batchTotal, data.length)
  }
}

async function exportTo (path, args) {
  const { importPkg, print, dayjs, getConfig, importModule } = this.bajo.helper
  const { isEmpty, map } = await importPkg('lodash-es')
  const [input, select] = await importPkg('bajo-cli:@inquirer/input',
    'bajo-cli:@inquirer/select')
  if (!this.bajoDb) print.fatal('Bajo DB isn\'t loaded')
  const schemas = map(this.bajoDb.schemas, 'name')
  if (isEmpty(schemas)) print.fatal('No schema found!')
  let [repo, dest, query] = args
  if (isEmpty(repo)) {
    repo = await select({
      message: print.__('Please choose repository:'),
      choices: map(schemas, s => ({ value: s }))
    })
  }
  if (isEmpty(dest)) {
    dest = await input({
      message: print.__('Please enter destination file:'),
      default: `${repo}-${dayjs().format('YYYYMMDD')}.ndjson`,
      validate: (item) => !isEmpty(item)
    })
  }
  if (isEmpty(query)) {
    query = await input({
      message: print.__('Please enter a query (if any):')
    })
  }
  const spinner = print.bora('Exporting...').start()
  const progressFn = makeProgress.call(this, spinner)
  const cfg = getConfig('bajoDb', { full: true })
  const { batch } = getConfig()
  const start = await importModule(`${cfg.dir.pkg}/bajo/start.js`)
  const { connection } = await this.bajoDb.helper.getInfo(repo)
  await start.call(this, connection.name)
  try {
    const filter = { query }
    const result = await this.bajoExtra.helper.exportTo(repo, dest, { filter, batch, progressFn })
    spinner.succeed('%d records successfully exported to \'%s\'', result.count, Path.resolve(result.file))
  } catch (err) {
    console.log(err)
    spinner.fatal('Error: %s', err.message)
  }
}

export default exportTo
