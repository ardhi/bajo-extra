async function fetchAndSave ({ source = {}, converter, coll, current = {}, options = {} } = {}) {
  const { print, setImmediate, importPkg } = this.bajo.helper
  const { isEmpty, isFunction } = await importPkg('lodash-es')
  const { fetch } = this.bajoExtra.helper
  const { recordCreate, recordFind, recordUpdate, validationErrorMessage } = this.bajoDb.helper
  const spinner = print.bora('Fetching starts...', { showCounter: true, showDatetime: true }).start()
  const resp = await fetch(source.url, source.options ?? {})
  if (isEmpty(resp)) spinner.fatal('No result from server, aborted!')
  if (source.abort) {
    const aborted = await source.abort.call(this, resp)
    if (aborted) spinner.fatal(aborted)
  }
  let count = 0
  spinner.setText('Got %d records, processing...', resp.response.length)
  const iterator = isFunction(source.dataKey) ? await source.dataKey.call(this, resp) : resp[source.dataKey]
  for (let r of iterator) {
    await setImmediate()
    if (converter) r = await converter.call(this, r, options)
    try {
      await recordCreate(coll, r)
      if (current.coll && current.query) {
        const query = await current.query.call(this, r)
        const recs = await recordFind(current.coll, { query })
        const rc = current.converter ? await current.converter.call(this, r, options) : r
        if (recs.length > 0) {
          const id = recs[0].id
          await recordUpdate(current.coll, id, rc)
        } else {
          await recordCreate(current.coll, rc)
        }
      }
      if (options.printCount && (count % options.printCount === 0)) print.succeed(`[${spinner.getElapsed()}] Batch line %d/%d`, count, resp.response.length, { showDatetime: true })
      else spinner.setText('Record %d/%d...', count, resp.response.length)
      count++
    } catch (err) {
      console.log(err)
      spinner.setText(validationErrorMessage(err) + ', continue')
    }
  }
  spinner.info(`${count}/${resp.response.length} records processed`)
  spinner.succeed('Done!')
}

export default fetchAndSave
