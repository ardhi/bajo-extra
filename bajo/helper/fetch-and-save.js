async function fetchAndSave ({ source = {}, converter, coll, current = {}, options = {} } = {}) {
  const { setImmediate, importPkg, spinner, print } = this.bajo.helper
  const { isEmpty, isFunction } = await importPkg('lodash-es')
  const { fetch } = this.bajoExtra.helper
  const { recordCreate, recordFind, recordUpdate, validationErrorMessage } = this.bajoDb.helper
  const spin = spinner({ showCounter: true }).start('Fetching starts...')
  const resp = await fetch(source.url, source.options ?? {})
  if (isEmpty(resp)) spin.fatal('No result from server, aborted!')
  if (source.abort) {
    const aborted = await source.abort.call(this, resp)
    if (aborted) spin.fatal(aborted)
  }
  let count = 0
  const iterator = isFunction(source.iterator) ? await source.iterator.call(this, resp) : resp[source.iterator]
  spin.setText('Got %d records, processing...', iterator.length)
  for (let r of iterator) {
    await setImmediate()
    if (converter) r = await converter.call(this, r, options)
    if (isEmpty(r)) continue
    try {
      await recordCreate(coll, r)
      if (current.coll && current.query) {
        const query = await current.query.call(this, r)
        const recs = await recordFind(current.coll, { query }, { skipCache: true })
        const rc = current.converter ? await current.converter.call(this, r, options) : r
        if (rc) {
          if (recs.length > 0) {
            const id = recs[0].id
            await recordUpdate(current.coll, id, rc)
          } else {
            await recordCreate(current.coll, rc)
          }
        }
      }
      if (options.printCount && (count % options.printCount === 0)) print.succeed(`[${spin.getElapsed()}] Batch line %d/%d`, count, iterator.length)
      else if (!spin.opts.isLog) spin.setText('Record %d/%d...', count, iterator.length)
      count++
    } catch (err) {
      console.log(err)
      spin.setText(validationErrorMessage(err) + ', continue')
    }
  }
  spin.info(`${count}/${iterator.length} records processed`)
  spin.succeed('Done!')
}

export default fetchAndSave
