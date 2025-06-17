import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { createGzip, createGunzip } from 'zlib'
import path from 'path'
import { fetch, Agent } from 'undici'
import { Readable } from 'stream'
import numbro from 'numbro'
import { ShortCrypt } from 'short-crypt'

async function fetching ({ url, opts, bulk, spin }) {
  const { setImmediate, print } = this.app.bajo
  const { isEmpty, isFunction, has } = this.lib._
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

async function handler (rec, bulk) {
  const { isFunction, set } = this.lib._
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

async function factory (pkgName) {
  const me = this

  return class BajoExtra extends this.lib.BajoPlugin {
    constructor () {
      super(pkgName, me.app)
      this.alias = 'extra'
      this.config = {
        secret: 'hxKY8Eh63Op9js6ovU25qmq2DmCE9dIB',
        fetch: {
          agent: {
            autoSelectFamilyAttemptTimeout: 1000,
            autoSelectFamily: true
          }
        }
      }
    }

    formatByte = (value, opts = {}) => {
      opts.output = 'byte'
      opts.base = 'binary'
      opts.mantissa = opts.mantissa ?? opts.scale ?? 2
      opts.spaceSeparated = opts.spaceSeparated ?? true
      return numbro(value).format(opts)
    }

    formatFloat = (value, opts = {}) => {
      opts.mantissa = opts.mantissa ?? opts.scale ?? 2
      opts.thousandSeparated = opts.thousandSeparated ?? true
      return numbro(value).format(opts)
    }

    formatInteger = (value, opts = {}) => {
      opts.mantissa = 0
      opts.thousandSeparated = opts.thousandSeparated ?? true
      return numbro(value).format(opts)
    }

    formatPercentage = (value, opts = {}) => {
      opts.output = 'percent'
      opts.mantissa = opts.mantissa ?? opts.scale ?? 2
      opts.spaceSeparated = opts.spaceSeparated ?? true
      return numbro(value).format(opts)
    }

    // taken from: https://stackoverflow.com/a/41439945
    countFileLines = async (file) => {
      const { fs } = this.lib
      return new Promise((resolve, reject) => {
        let lineCount = 0
        fs.createReadStream(file)
          .on('data', (buffer) => {
            let idx = -1
            lineCount--
            do {
              idx = buffer.indexOf(10, idx + 1)
              lineCount++
            } while (idx !== -1)
          })
          .on('end', () => {
            resolve(lineCount)
          })
          .on('error', reject)
      })
    }

    download = async (url, opts = {}, extra = {}) => {
      const { getPluginDataDir, importPkg, generateId } = this.app.bajo
      const { fs } = this.lib
      const { isFunction, merge } = this.lib._
      if (typeof opts === 'string') extra = { dir: opts }
      const increment = await importPkg('bajo:add-filename-increment')
      if (!extra.dir) {
        extra.dir = `${getPluginDataDir('bajoExtra')}/download`
        fs.ensureDirSync(extra.dir)
      }
      if (!fs.existsSync(extra.dir)) throw this.error('dlDirNotExists%s', extra.dir)
      if (extra.randomFileName) {
        const ext = path.extname(url)
        extra.fileName = `${generateId()}${ext}`
      }
      if (!extra.fileName) extra.fileName = path.basename(url)
      const file = path.resolve(increment(`${extra.dir}/${extra.fileName}`, { fs: true }))
      const writer = fs.createWriteStream(file)
      const { headers, body, ok, status } = await fetch(url, opts, merge({}, extra, { rawResponse: true }))
      if (!ok) {
        fs.removeSync(file)
        throw this.error('gettingStatus%s', status)
      }
      const total = headers['content-length'] ?? 0
      const data = Readable.fromWeb(body)
      let length = 0
      data.on('data', chunk => {
        length += chunk.length
        if (isFunction(extra.progressFn)) extra.progressFn.call(this, length, total)
        else if (extra.spin) {
          extra.spinText = extra.spinText ?? 'downloading'
          if (total === 0) extra.spin.setText(`${extra.spinText} %s`, this.formatByte(length))
          else extra.spin.setText(`${extra.spinText} %s of %s (%s)`, this.formatByte(length), this.formatByte(total), this.formatPercentage(length / total))
        }
      })
      data.pipe(writer)

      return new Promise((resolve, reject) => {
        writer.on('error', reject)
        writer.on('finish', () => {
          resolve(file)
        })
      })
    }

    fetchAndSave = async ({ url, bulk, save = {}, opts = {} } = {}) => {
      const { startPlugin } = this.bajo
      const { merge } = this.bajo.lib._
      merge(bulk, { handler, save })
      await startPlugin('dobo')
      await this.fetchBulk(url, bulk, opts)
    }

    fetchBulk = async (url, bulk = {}, opts = {}) => {
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

    fetchUrl = async (url, opts = {}, extra = {}) => {
      const { isSet } = this.lib.aneka
      const { fs } = this.lib
      const { isEmpty, has, isArray, isPlainObject, isString, cloneDeep, merge } = this.lib._
      if (isPlainObject(url)) {
        extra = cloneDeep(opts)
        opts = cloneDeep(url)
        url = opts.url
        delete opts.url
      }
      if (opts.method) opts.method = opts.method.toUpperCase()
      if (opts.auth) {
        opts.headers.Authorization = `Basic ${Buffer.from(`${opts.auth.username}:${opts.auth.password}`).toString('base64')}`
        delete opts.auth
      }
      const query = merge({}, opts.query, opts.params ?? {})
      for (const q in query) {
        if (!isSet(query[q])) delete query[q]
      }
      if (!isEmpty(query)) opts.query = query
      delete opts.params
      if (!has(extra, 'cacheBuster')) extra.cacheBuster = true
      if (extra.cacheBuster) opts.query[extra.cacheBusterKey ?? '_'] = Date.now()
      if (this.config.fetch.agent || extra.agent) {
        opts.dispatcher = new Agent(extra.agent ?? this.config.fetch.agent)
      }
      if (opts.body && extra.formData) {
        const formData = new FormData()
        for (const key in opts.body) {
          let fname
          let val = opts.body[key]
          if (!isSet(val)) continue
          if (isString(val) && val.startsWith('file:///')) {
            fname = path.basename(val)
            val = new Blob([fs.readFileSync(val.slice(8))])
          } else if (isPlainObject(val) || isArray(val)) val = JSON.stringify(val)
          if (fname) formData.append(key, val, fname)
          else formData.append(key, val)
        }
        opts.body = formData
      }
      if (opts.query) {
        // todo: what if url already contain query string?
        const query = new URLSearchParams(opts.query)
        url += '?' + query
      }
      opts.headers = opts.headers ?? {}
      if (this.config.fetch.userAgent) opts.headers['User-Agent'] = this.config.fetch.userAgent
      const resp = await fetch(url, opts)
      if (extra.rawResponse) return resp
      return await resp.json()
    }

    gunzip = async (file, deleteOld) => {
      await this.gzip(file, deleteOld, true)
    }

    gzip = async (file, deleteOld, expand) => {
      const { fs } = this.lib
      return new Promise((resolve, reject) => {
        const newFile = expand ? file.slice(0, file.length - 3) : (file + '.gz')
        const reader = fs.createReadStream(file)
        const writer = fs.createWriteStream(newFile)
        const method = expand ? createGunzip() : createGzip()
        reader.pipe(method).pipe(writer)
        writer.on('error', reject)
        writer.on('finish', err => {
          if (err) return reject(err)
          if (deleteOld) fs.unlinkSync(file)
          resolve()
        })
      })
    }

    hash = async (text, type = 'md5', options = {}) => {
      options.digest = options.digest ?? 'hex'
      options.salt = options.hash ?? 10
      if (typeof text !== 'string') text = JSON.stringify(text)
      if (type === 'bcrypt') return await bcrypt.hash(text, options.salt)
      if (type === 'short') {
        type = 'shake256'
        options.outputLength = 6
      }
      return crypto.createHash(type, options).update(text).digest(options.digest)
    }

    isBcrypt = (text) => {
      // return /^\$2[ayb]\$.{56}$/.test(text)
      return /^\$2[aby]?\$\d{1,2}\$[./A-Za-z0-9]{53}$/.test(text)
    }

    isMd5 = (text) => {
      return /^[a-f0-9]{32}$/i.test(text)
    }

    encrypt = async (text, { type = 'short', subType = 'qr' } = {}) => {
      const short = (item) => {
        const sc = new ShortCrypt(this.config.secret)
        const method = subType === 'qr' ? 'encryptToQRCodeAlphanumeric' : 'encryptToURLComponent'
        return sc[method](item)
      }
      switch (type) {
        case 'short': return short(text)
      }
      throw this.error('invalid%s%s', this.print.write('encryption type'), type)
    }

    decrypt = async (cipher, { type = 'short', subType = 'qr' } = {}) => {
      const short = (item) => {
        const sc = new ShortCrypt(this.config.secret)
        const method = subType === 'qr' ? 'decryptToQRCodeAlphanumeric' : 'decryptToURLComponent'
        return sc[method](item)
      }
      switch (type) {
        case 'short': return short(cipher)
      }
      throw this.error('invalid%s%s', this.print.write('decryption type'), type)
    }

    randomRange = (min, max, alpha) => {
      const num = Math.floor(Math.random() * (max - min + 1) + min)
      if (!alpha) return num
      return String.fromCharCode(96 + num)
    }
  }
}

export default factory
