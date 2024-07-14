async function handler (rec, bulk) {
  const { isFunction, set } = this.app.bajo.lib._
  const { recordCreate, recordFind, recordUpdate } = this.app.bajoDb
  const save = bulk.save ?? {}
  const current = save.current ?? {}
  let existing
  let record
  let method
  save.checkUnique = save.checkUnique ?? 'id'
  if (['unique', 'upsert'].includes(save.mode)) {
    const query = isFunction(save.checkUnique) ? await save.checkUnique.call(this, rec, save) : set({}, save.checkUnique, rec[save.checkUnique])
    const resp = await recordFind(save.coll, { query, limit: 1 }, { noCache: true })
    if (resp.length > 0) existing = resp[0]
  }
  if (existing) {
    if (save.mode === 'upsert') {
      const body = save.updateConverter ? await save.updateConverter.call(this, rec, save) : rec
      try {
        record = await recordUpdate(save.coll, existing.id, body)
        method = 'updated'
      } catch (err) {
        console.error(err)
        method = 'error'
      }
    } else {
      method = 'skipped'
    }
  } else {
    try {
      record = await recordCreate(save.coll, rec)
      method = 'created'
    } catch (err) {
      console.error(err)
      method = 'error'
    }
  }
  if (record && current.coll && current.query) {
    const query = await current.query.call(this, { body: rec, record, opts: save })
    const recs = await recordFind(current.coll, { query }, { noCache: true })
    const rc = current.converter ? await current.converter.call(this, { body: rec, record, opts: save }) : rec
    if (rc) {
      if (recs.length > 0) {
        const id = recs[0].id
        await recordUpdate(current.coll, id, rc)
      } else {
        await recordCreate(current.coll, rc)
      }
    }
  }
  return method
}

async function fetchAndSave ({ url, bulk, save = {}, opts = {} } = {}) {
  const { startPlugin } = this.bajo
  const { merge } = this.bajo.lib._
  merge(bulk, { handler, save })
  await startPlugin('bajoDb')

  await this.fetchBulk(url, bulk, opts)
}

export default fetchAndSave
