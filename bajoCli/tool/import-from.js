import Path from 'path'

function makeProgress (spinner) {
  return async function ({ batchNo, data } = {}) {
    spinner.setText('Batch %d (%d records)', batchNo, data.length)
  }
}

async function importFrom ({ path, args, returnEarly }) {
  const { importPkg, print, importModule, getConfig } = this.bajo.helper
  const { isEmpty, map } = await importPkg('lodash-es')
  const [input, select, confirm] = await importPkg('bajo-cli:@inquirer/input',
    'bajo-cli:@inquirer/select', 'bajo-cli:@inquirer/confirm')
  if (!this.bajoDb) {
    print.fail('Bajo DB isn\'t loaded', { exit: !returnEarly })
    if (returnEarly) return
  }
  const schemas = map(this.bajoDb.schemas, 'name')
  if (isEmpty(schemas)) {
    print.fail('No schema found!', { exit: !returnEarly })
    if (returnEarly) return
  }
  let [dest, coll] = args
  if (isEmpty(dest)) {
    dest = await input({
      message: print.__('Please enter source file:'),
      validate: (item) => !isEmpty(item)
    })
  }
  if (isEmpty(coll)) {
    coll = await select({
      message: print.__('Please choose collection:'),
      choices: map(schemas, s => ({ value: s }))
    })
  }
  const answer = await confirm({
    message: print.__('You\'re about to replace ALL records with the new ones. Are you really sure?'),
    default: false
  })
  if (!answer) {
    print.fail('Aborted!', { exit: !returnEarly })
    if (returnEarly) return
  }
  const spinner = print.bora('Importing...').start()
  const progressFn = makeProgress.call(this, spinner)
  const cfg = getConfig('bajoDb', { full: true })
  const { batch } = getConfig()
  const start = await importModule(`${cfg.dir.pkg}/bajo/start.js`)
  const { connection } = await this.bajoDb.helper.getInfo(coll)
  await start.call(this, connection.name)
  try {
    const result = await this.bajoExtra.helper.importFrom(dest, coll, { batch, progressFn })
    spinner.succeed('%d records successfully imported from \'%s\'', result.count, Path.resolve(result.file))
  } catch (err) {
    spinner.fail('Error: %s', err.message, { exit: !returnEarly })
  }
}

export default importFrom
