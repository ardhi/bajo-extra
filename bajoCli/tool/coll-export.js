async function collExport (path, args) {
  const { importPkg, print, importModule, getConfig } = this.bajo.helper
  const { isEmpty, map } = await importPkg('lodash-es')
  const [input, select] = await importPkg('bajo-cli:@inquirer/input',
    'bajo-cli:@inquirer/select')
  if (!this.bajoDb) print.fatal('Bajo DB isn\'t loaded')
  const schemas = map(this.bajoDb.schemas, 'name')
  if (isEmpty(schemas)) print.fatal('No schema found!')
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
      validate: (item) => !isEmpty(item)
    })
  }
  if (isEmpty(query)) {
    query = await input({
      message: print.__('Please enter a query (if any):')
    })
  }
  const spinner = print.bora('Exporting...').start()
  const cfg = getConfig('bajoDb', { full: true })
  const { compress, batch } = getConfig()
  const start = await importModule(`${cfg.dir}/bajo/start.js`)
  const { connection } = await this.bajoDb.helper.getInfo(coll)
  await start.call(this, connection.name)
  try {
    const filter = { query }
    const result = await this.bajoExtra.helper.collExport(coll, dest, { filter, compress, batch })
    spinner.succeed('%d records successfully exported to \'%s\'', result.count, result.file)
  } catch (err) {
    spinner.fatal('Error: %s', err.message)
  }
}

export default collExport
