async function batching ({ source = {}, converter, coll, current = {}, options = {}, spin } = {}) {
  const { setImmediate, importPkg, print } = this.bajo.helper
  const { isEmpty, isFunction, set } = await importPkg('lodash-es')
  const { fetch } = this.bajoExtra.helper
  const { recordCreate, recordFind, recordUpdate, validationErrorMessage } = this.bajoDb.helper
  const resp = await fetch(source.url, source.options ?? {})
  if (isEmpty(resp)) spin.fatal('No result from server, aborted!')
  if (source.abort) {
    const aborted = await source.abort.call(this, resp)
    if (aborted) spin.fatal(aborted)
  }
  let count = 0
  const stat = { created: 0, updated: 0, skipped: 0, error: 0 }
  const iterator = isFunction(source.iterator) ? await source.iterator.call(this, resp) : resp[source.iterator]
  if (iterator.length === 0) {
    print.warn('No records to process, abort')
    return 0
  }
  spin.setText('Got %d records, processing...', iterator.length)
  for (let r of iterator) {
    await setImmediate()
    if (converter) r = await converter.call(this, r, options)
    if (isEmpty(r)) {
      stat.skipped++
      continue
    }
    try {
      let existing
      let record
      let method
      options.checkUnique = options.checkUnique ?? 'id'
      if (['unique', 'upsert'].includes(options.mode)) {
        const query = isFunction(options.checkUnique) ? await options.checkUnique.call(this, r, options) : set({}, options.checkUnique, r[options.checkUnique])
        const resp = await recordFind(coll, { query, limit: 1 }, { skipCache: true })
        if (resp.length > 0) existing = resp[0]
      }
      if (existing) {
        if (options.mode === 'upsert') {
          const body = options.updateConverter ? await options.updateConverter.call(this, r, options) : r
          record = await recordUpdate(coll, existing.id, body)
          method = 'updated'
          stat.updated++
        } else {
          stat.skipped++
          print.warn(`[${spin.getElapsed()}] Record %s exists, skipped`, JSON.stringify(r))
          method = 'skipped'
        }
      } else {
        stat.created++
        record = await recordCreate(coll, r)
        method = 'created'
      }
      if (record && current.coll && current.query) {
        const query = await current.query.call(this, { body: r, record, options })
        const recs = await recordFind(current.coll, { query }, { skipCache: true })
        const rc = current.converter ? await current.converter.call(this, { body: r, record, options }) : r
        if (rc) {
          if (recs.length > 0) {
            const id = recs[0].id
            await recordUpdate(current.coll, id, rc)
          } else {
            await recordCreate(current.coll, rc)
          }
        }
      }
      if (options.printCount && options.printCount < count && (count % options.printCount === 0)) print.succeed('[%s] Processed %d/%d', spin.getElapsed(), count, iterator.length)
      else if (!spin.opts.isLog) spin.setText('Record %d/%d...', count, iterator.length, method)
      count++
    } catch (err) {
      console.log(err)
      spin.setText(validationErrorMessage(err) + ', continue')
    }
  }
  print.succeed('[%s] %d/%d records processed', spin.getElapsed(), count, iterator.length)
  print.succeed('[%s] Created: %d, Updated: %d, Skipped: %d', spin.getElapsed(), stat.created, stat.updated, stat.skipped)
  return iterator.length
}

async function fetchAndSave ({ source = {}, converter, coll, current = {}, options = {} } = {}) {
  const { print, spinner } = this.bajo.helper
  source.options = source.options ?? {}
  source.options.params = source.options.params ?? {}
  if (options.batch) {
    print.info('Batch starting')
    const spin = spinner({ showCounter: true }).start('Fetching starts...')
    let step = 1
    for (;;) {
      print.info('[%s] Fetch batch #%d', spin.getElapsed(), step)
      const newSource = await options.batch.call(this, source)
      if (newSource) source = newSource
      const length = await batching.call(this, { source, converter, coll, current, options, spin })
      if (length === 0) {
        print.info('All done!')
        break
      }
      step++
    }
  } else {
    const spin = spinner({ showCounter: true }).start('Fetching starts...')
    await batching.call(this, { source, converter, coll, current, options, spin })
  }
}

export default fetchAndSave
