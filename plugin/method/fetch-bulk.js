async function fetching ({ url, opts, bulk, spin }) {
  const { setImmediate, print } = this.app.bajo
  const { isEmpty, isFunction, has } = this.app.bajo.lib._
  const { validationErrorMessage } = this.app.bajoDb
  const resp = await this.fetch(url, opts ?? {})
  if (isEmpty(resp)) {
    spin.fatal('noServerResponse')
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
  if (bulk.printCount === true) bulk.printCount = 100
  const data = isFunction(bulk.dataKey) ? await bulk.dataKey.call(this, resp) : resp[bulk.dataKey]
  if (data.length === 0) {
    print.warn('noRecordToProcess')
    return 0
  }
  spin.setText('gotRecordsProcessing%d', data.length)
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
      else if (!spin.opts.isLog) spin.setText('rec%d%d', count, data.length)
      count++
    } catch (err) {
      console.log(err)
      spin.setText(validationErrorMessage(err) + ', continue')
    }
  }
  print.succeed('recProcessed%s%d%d', spin.getElapsed(), count, data.length)
  if (!bulk.noStat) print.succeed('createdUpdatedSkipped%s%d%d%d', spin.getElapsed(), stat.created, stat.updated, stat.skipped)
  return data.length
}

async function fetchBulk (url, bulk = {}, opts = {}) {
  const { isFunction } = this.bajo.lib._
  opts.params = opts.params ?? {}
  bulk.maxStep = bulk.maxStep ?? 0
  if (!isFunction(bulk.handler)) throw this.error('handlerMustBeProvided')
  if (isFunction(bulk.paramsIncFn)) {
    this.print.info('bulkFetchStarting')
    const spin = this.print.spinner({ showCounter: true }).start('fetchingStarts')
    let step = 1
    for (;;) {
      this.print.info('batch%s%d', spin.getElapsed(), step)
      const newOpts = await bulk.paramsIncFn.call(this, { url, bulk, opts })
      if (newOpts) opts = newOpts
      const length = await fetching.call(this, { url, bulk, opts, spin })
      if (length === 0 || (bulk.maxStep > 0 && step >= bulk.maxStep)) {
        this.print.info('allDone')
        break
      }
      step++
    }
  } else {
    const spin = this.print.spinner({ showCounter: true }).start('fetchingStarts')
    await fetching.call(this, { url, bulk, opts, spin })
  }
}

export default fetchBulk
