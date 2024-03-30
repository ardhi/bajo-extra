async function fetching ({ url, opts, bulk, spin }) {
  const { setImmediate, importPkg, print } = this.bajo.helper
  const { isEmpty, isFunction, has } = await importPkg('lodash-es')
  const { validationErrorMessage } = this.bajoDb.helper
  const { fetch } = this.bajoExtra.helper
  const resp = await fetch(url, opts ?? {})
  if (isEmpty(resp)) {
    spin.fatal('No result from server, aborted!')
    return -1
  }
  if (bulk.abort) {
    const aborted = await bulk.abort.call(this, resp)
    if (aborted) {
      spin.fatal(aborted)
      return -1
    }
  }
  let count = 0
  const stat = { created: 0, updated: 0, skipped: 0, error: 0 }
  bulk.dataKey = bulk.dataKey ?? 'data'
  const data = isFunction(bulk.dataKey) ? await bulk.dataKey.call(this, resp) : resp[bulk.dataKey]
  if (data.length === 0) {
    print.warn('No records to process, abort')
    return 0
  }
  spin.setText('Got %d records, processing...', data.length)
  for (let r of data) {
    await setImmediate()
    if (bulk.converter) r = await bulk.converter.call(this, r, bulk)
    if (isEmpty(r)) {
      stat.skipped++
      continue
    }
    try {
      const result = await bulk.handler.call(this, r, bulk)
      if (result && has(stat, result)) stat[result]++
      if (bulk.printCount && bulk.printCount < count && (count % bulk.printCount === 0)) print.succeed('[%s] Processed %d/%d', spin.getElapsed(), count, data.length)
      else if (!spin.opts.isLog) spin.setText('Record %d/%d...', count, data.length)
      count++
    } catch (err) {
      console.log(err)
      spin.setText(validationErrorMessage(err) + ', continue')
    }
  }
  print.succeed('[%s] %d/%d records processed', spin.getElapsed(), count, data.length)
  print.succeed('[%s] Created: %d, Updated: %d, Skipped: %d', spin.getElapsed(), stat.created, stat.updated, stat.skipped)
  return data.length
}

async function fetchBulk (url, bulk = {}, opts = {}) {
  const { print, spinner, importPkg, error } = this.bajo.helper
  const { isFunction } = await importPkg('lodash-es')
  opts.params = opts.params ?? {}
  bulk.maxStep = bulk.maxStep ?? 0
  if (!isFunction(bulk.handler)) throw error('A function handler must be provided')
  if (bulk.paramsIncFn && isFunction(bulk.ParamsFn)) {
    print.info('Bulk fetch starting')
    const spin = spinner({ showCounter: true }).start('Fetching starts...')
    let step = 1
    for (;;) {
      print.info('[%s] Batch #%d', spin.getElapsed(), step)
      const newOpts = await bulk.paramsIncFn.call(this, { url, bulk, opts })
      if (newOpts) opts = newOpts
      const length = await fetching.call(this, { url, bulk, opts, spin })
      if (length === 0 || (bulk.maxStep > 0 && step >= bulk.maxStep)) {
        print.info('All done!')
        break
      }
      step++
    }
  } else {
    const spin = spinner({ showCounter: true }).start('Fetching starts...')
    await fetching.call(this, { url, bulk, opts, spin })
  }
}

export default fetchBulk
