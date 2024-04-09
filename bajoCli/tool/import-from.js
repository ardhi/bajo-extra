import Path from 'path'

function makeProgress (spin) {
  return async function ({ batchNo, data } = {}) {
    spin.setText('Batch %d (%d records)', batchNo, data.length)
  }
}

async function importFrom ({ path, args }) {
  const { importPkg, print, importModule, getConfig, spinner } = this.bajo.helper
  const { isEmpty, map } = await importPkg('lodash-es')
  const [input, select, confirm] = await importPkg('bajo-cli:@inquirer/input',
    'bajo-cli:@inquirer/select', 'bajo-cli:@inquirer/confirm')
  const config = getConfig()
  if (!this.bajoDb) return print.fail('Bajo DB isn\'t loaded', { exit: config.tool })
  const schemas = map(this.bajoDb.schemas, 'name')
  if (isEmpty(schemas)) return print.fail('No schema found!', { exit: config.tool })
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
  if (!answer) return print.fail('Aborted!', { exit: config.tool })
  const spin = spinner({ showCounter: true }).start('Importing...')
  const progressFn = makeProgress.call(this, spin)
  const cfg = getConfig('bajoDb', { full: true })
  const { batch } = getConfig()
  const start = await importModule(`${cfg.dir.pkg}/bajo/start.js`)
  const { connection } = await this.bajoDb.helper.getInfo(coll)
  await start.call(this, connection.name)
  try {
    const result = await this.bajoExtra.helper.importFrom(dest, coll, { batch, progressFn })
    spin.succeed('%d records successfully imported from \'%s\'', result.count, Path.resolve(result.file))
  } catch (err) {
    spin.fail('Error: %s', err.message, { exit: config.tool })
  }
}

export default importFrom
