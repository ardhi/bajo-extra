async function fetchAndSave ({ source = {}, converter, coll, current = {}, options = {} } = {}) {
  const { print, setImmediate } = this.bajo.helper
  const { fetch } = this.bajoExtra.helper
  const { recordCreate, recordFind, recordUpdate, validationErrorMessage } = this.bajoDb.helper
  const spinner = print.bora('Fetching starts...', { showCounter: true, showDatetime: true }).start()
  const resp = await fetch(source.url, source.options ?? {})
  let count = 0
  spinner.setText('Got %d records, processing...', resp.response.length)
  for (let r of resp.response) {
    await setImmediate()
    if (converter) r = await converter.call(this, r, options)
    try {
      await recordCreate(coll, r)
      if (current.coll && current.query) {
        const recs = await recordFind(current.coll, current.query)
        if (recs.length > 0) {
          const id = recs[0].id
          await recordUpdate(current.coll, id, r)
        } else {
          await recordCreate(current.coll, r)
        }
      }
      if (options.printCount && (count % options.printCount === 0)) print.succeed('Batch tag %d/%d OK', count, resp.response.length, { showDatetime: true })
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
