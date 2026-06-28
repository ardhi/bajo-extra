import crypto from 'crypto'
import { createGzip, createGunzip } from 'zlib'
import path from 'path'
import { Readable } from 'stream'
import numbro from 'numbro'
import sharp from 'sharp'

/**
 * Plugin factory.
 *
 * **Never** call this function directly!!! It's only-meant to be called by the {@link https://ardhi.github.io/bajo|Bajo framework} during plugin initialization.
 *
 * @param {string} pkgName - NPM package name
 * @returns {class} BajoExtra
 */
async function factory (pkgName) {
  const me = this

  /**
   * BajoExtra class definition.
   *
   * @class
   */
  class BajoExtra extends this.app.baseClass.Base {
    /**
     * Constructor
     */
    constructor () {
      super(pkgName, me.app)
      /**
       * @property {object} config - Configuration object
       * @property {string} config.secret - Secret key for encryption/decryption
       * @property {object} config.fetch - Fetch configuration
       * @property {object} config.thumbnail - Thumbnail configuration
       */
      this.config = {
        secret: 'hxKY8Eh63Op9js6ovU25qmq2DmCE9dIB', // random hard coded, should be overridden by user config
        fetch: {
          agent: {
            autoSelectFamilyAttemptTimeout: 1000,
            autoSelectFamily: true
          }
        },
        thumbnail: {
          inputFormats: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.tiff', '.svg'],
          outputFormats: ['.png']
        }
      }
    }

    /**
     * Private method to fetch data from a URL and save it, with optional bulk processing.
     *
     * @private
     * @async
     * @method
     * @param {object} options - Options object
     * @param {string} options.url - URL to fetch data from
     * @param {object} options.bulk - Bulk processing options
     * @param {object} options.opts - Fetch options
     * @param {object} options.spin - Spinner object
     * @returns {Promise<number>} - Number of records processed
     */
    _fetching = async (options = {}) => {
      const { url, bulk, opts, spin } = options
      const { setImmediate, print } = this.app.bajo
      const { isEmpty, isFunction, has } = this.app.lib._
      const { validationErrorMessage } = this.app.bajoDb
      const resp = await this.fetchUrl(url, opts ?? {})
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

    /**
     * Format a value as bytes.
     *
     * @method
     * @param {number} value - The value to format.
     * @param {object} opts - Formatting options.
     * @returns {string} - Formatted byte string.
     */
    formatByte = (value, opts = {}) => {
      opts.output = 'byte'
      opts.base = 'binary'
      opts.mantissa = opts.mantissa ?? opts.scale ?? 2
      opts.spaceSeparated = opts.spaceSeparated ?? true
      return numbro(value).format(opts)
    }

    /**
     * Format a value as a floating-point number.
     *
     * @method
     * @param {number} value - The value to format.
     * @param {object} opts - Formatting options.
     * @returns {string} - Formatted floating-point string.
     */
    formatFloat = (value, opts = {}) => {
      opts.mantissa = opts.mantissa ?? opts.scale ?? 2
      opts.thousandSeparated = opts.thousandSeparated ?? true
      return numbro(value).format(opts)
    }

    /**
     * Format a value as an integer.
     *
     * @method
     * @param {number} value - The value to format.
     * @param {object} opts - Formatting options.
     * @returns {string} - Formatted integer string.
     */
    formatInteger = (value, opts = {}) => {
      opts.mantissa = 0
      opts.thousandSeparated = opts.thousandSeparated ?? true
      return numbro(value).format(opts)
    }

    /**
     * Format a value as a percentage.
     *
     * @method
     * @param {number} value - The value to format.
     * @param {object} opts - Formatting options.
     * @returns {string} - Formatted percentage string.
     */
    formatPercentage = (value, opts = {}) => {
      opts.output = 'percent'
      opts.mantissa = opts.mantissa ?? opts.scale ?? 2
      opts.spaceSeparated = opts.spaceSeparated ?? true
      return numbro(value).format(opts)
    }

    /**
     * Count the number of lines in a file.
     *
     * @async
     * @method
     * @param {string} file - The path to the file.
     * @returns {Promise<number>} - The number of lines in the file.
     * @see {@link https://stackoverflow.com/a/41439945|StackOverflow}
     */
    countFileLines = async (file) => {
      const { fs } = this.app.lib
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

    /**
     * Download a file from a URL.
     *
     * @async
     * @method
     * @param {string} url - The URL to download the file from.
     * @param {object} opts - Fetch options.
     * @param {object} extra - Extra options for downloading.
     * @returns {Promise<string>} - The path to the downloaded file.
     */
    download = async (url, opts = {}, extra = {}) => {
      const { importPkg } = this.app.bajo
      const { generateId } = this.app.lib.aneka
      const { fetch } = await importPkg('bajoExtra:undici')
      const { fs } = this.app.lib
      const { isFunction, merge } = this.app.lib._
      if (typeof opts === 'string') extra = { dir: opts }
      const increment = await importPkg('bajo:add-filename-increment')
      if (!extra.dir) {
        extra.dir = `${this.app.getPluginDataDir('bajoExtra')}/download`
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

    /**
     * Fetch data from a URL and save it using the specified options.
     *
     * @async
     * @method
     * @param {object} options - The options for fetching and saving data.
     * @param {string} options.url - The URL to fetch data from.
     * @param {object} options.bulk - Bulk operation options.
     * @param {object} options.save - Save options.
     * @param {object} options.opts - Fetch options.
     */
    fetchAndSave = async (options) => {
      const { url, bulk, save = {}, opts = {} } = options
      if (!this.app.dobo) throw this.error('unknownPluginOrNotLoaded%s', 'dobo')
      bulk.save = save
      bulk.handler = async (rec, bulk) => {
        const { isFunction, set } = this.app.lib._
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

      await this.app.startPlugin('dobo')
      await this.fetchBulk(url, bulk, opts)
    }

    /**
     * Fetch data from a URL in bulk, processing it in steps and applying a handler function to each item.
     *
     * @async
     * @method
     * @param {string} url - The URL to fetch data from.
     * @param {object} bulk - Bulk operation options.
     * @param {object} opts - Fetch options.
     */
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
          const length = await this._fetching({ url, bulk, opts, spin })
          if (length === 0 || (bulk.maxStep > 0 && step >= bulk.maxStep)) {
            this.print.info('allDone')
            break
          }
          step++
        }
      } else {
        const spin = this.print.spinner({ showCounter: true }).start('fetchingStarts')
        await this._fetching({ url, bulk, opts, spin })
      }
    }

    /**
     * Download a file/resource from a URL.
     *
     * @async
     * @method
     * @param {string} url - The URL to download the file from.
     * @param {object} [opts={}] - Fetch options. See {@link https://undici.nodejs.org//api/Client|Undici Client options} for available options.
     * @param {object} [opts.method='GET'] - HTTP method to use for the request. Defaults to ```'GET'```.
     * @param {object} [opts.auth] - Basic authentication credentials.
     * @param {string} [opts.auth.username] - Username for basic authentication.
     * @param {string} [opts.auth.password] - Password for basic authentication.
     * @param {object} [opts.query] - Query parameters to append to the URL.
     * @param {object} [opts.params] - Alias for ```opts.query```. Query parameters to append to the URL.
     * @param {object} [opts.headers] - HTTP headers to include in the request.
     * @param {object} [opts.body] - Request body to send with the request.
     * @param {boolean} [extra.formData=false] - If true, sends the request body as multipart/form-data. Defaults to ```false```.
     * @param {object} [extra={}] - Extra options for downloading.
     * @param {boolean} [extra.cacheBuster=true] - If true, appends a cache-busting query parameter to the URL. Defaults to ```true```.
     * @param {string} [extra.cacheBusterKey='_'] - The query parameter key to use for cache-busting. Defaults to ```'_'```.
     * @param {object} [extra.agent] - Custom agent options for the fetch request. If provided, overrides the default agent configuration.
     * @param {boolean} [extra.rawResponse=false] - If true, returns the raw response object instead of parsing it as JSON. Defaults to ```false```.
     * @returns {Promise<Object>} - The response object.
     */
    fetchUrl = async (url, opts = {}, extra = {}) => {
      const { importPkg } = this.app.bajo
      const { fetch, Agent } = await importPkg('bajoExtra:undici')
      const { isSet } = this.app.lib.aneka
      const { fs } = this.app.lib
      const { isEmpty, has, isArray, isPlainObject, isString, cloneDeep, merge } = this.app.lib._
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
      opts.query = opts.query ?? {}
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

    /**
     * Gunzip a file, optionally deleting the original file after extraction.
     *
     * @async
     * @method
     * @param {string} file - The path to the file to be gunzipped.
     * @param {boolean} [deleteOld=false] - If true, deletes the original file after extraction. Defaults to false.
     * @returns {Promise<void>} - Resolves when the gunzip operation is complete.
     */
    gunzip = async (file, deleteOld) => {
      await this.gzip(file, deleteOld, true)
    }

    /**
     * Gzip or gunzip a file, optionally deleting the original file after the operation.
     *
     * @async
     * @method
     * @param {string} file - The path to the file to be gzipped or gunzipped.
     * @param {boolean} [deleteOld=false] - If true, deletes the original file after the operation. Defaults to ```false```.
     * @param {boolean} [expand=false] - If true, gunzips the file. If false, gzips the file. Defaults to ```false```.
     * @returns {Promise<void>} - Resolves when the gzip or gunzip operation is complete.
     */
    gzip = async (file, deleteOld, expand) => {
      const { fs } = this.app.lib
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

    /**
     * Hash a given text or object using the specified algorithm and options.
     *
     * @async
     * @method
     * @param {string|object} input - The text or object to be hashed.
     * @param {string} [type='md5'] - The hashing algorithm to use. Defaults to 'md5'. Set to 'bcrypt' for bcrypt hashing or 'short' for a short hash.
     * @param {object} [options={}] - Additional options for the hashing algorithm.
     * @param {string} [options.digest='hex'] - The output encoding for the hash. Defaults to 'hex'.
     * @param {number} [options.salt=10] - The salt rounds for bcrypt hashing. Defaults to 10.
     * @returns {Promise<string>} - The resulting hash.
     */
    hash = async (input, type = 'md5', options = {}) => {
      const { importPkg } = this.app.bajo
      const bcrypt = await importPkg('bajoExtra:bcrypt')
      options.digest = options.digest ?? 'hex'
      options.salt = options.salt ?? 10
      if (typeof input !== 'string') input = JSON.stringify(input)
      if (type === 'bcrypt') return await bcrypt.hash(input, options.salt)
      if (type === 'short') {
        type = 'shake256'
        options.outputLength = 6
      }
      return crypto.createHash(type, options).update(input).digest(options.digest)
    }

    /**
     * Check if a given text is a bcrypt hash.
     *
     * @method
     * @param {string} text - The text to be checked.
     * @returns {boolean} - True if the text is a bcrypt hash, false otherwise.
     */
    isBcrypt = (text) => {
      // return /^\$2[ayb]\$.{56}$/.test(text)
      return /^\$2[aby]?\$\d{1,2}\$[./A-Za-z0-9]{53}$/.test(text)
    }

    /**
     * Check if a given text is an MD5 hash.
     *
     * @method
     * @param {string} text - The text to be checked.
     * @returns {boolean} - True if the text is an MD5 hash, false otherwise.
     */
    isMd5 = (text) => {
      return /^[a-f0-9]{32}$/i.test(text)
    }

    /**
     * Check if a given text is a SHA-256 hash.
     *
     * @method
     * @param {string} text - The text to be checked.
     * @returns {boolean} - True if the text is a SHA-256 hash, false otherwise.
     */
    isSha256 = (text) => {
      return /^[a-f0-9]{64}$/i.test(text)
    }

    /**
     * Check if a given text is an HTML link.
     *
     * @method
     * @param {string} text - The text to be checked.
     * @returns {boolean} - True if the text is an HTML link, false otherwise.
     */
    isHtmlLink = (text) => {
      return /<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi.test(text)
    }

    /**
     * Encrypt a given text using the specified encryption type and options.
     *
     * @async
     * @method
     * @param {string} text - The text to be encrypted.
     * @param {Object} [options={}] - The encryption options.
     * @param {string} [options.type='short'] - The encryption type. Defaults to 'short'.
     * @param {string} [options.subType='qr'] - The encryption sub-type. Defaults to 'qr'.
     * @returns {Promise<string>} - The encrypted text.
     */
    encrypt = async (text, options = {}) => {
      const { type = 'short', subType = 'qr' } = options
      const { importPkg } = this.app.bajo
      const { ShortCrypt } = await importPkg('bajoExtra:short-crypt')
      const short = (item) => {
        const sc = new ShortCrypt(this.config.secret)
        const method = subType === 'qr' ? 'encryptToQRCodeAlphanumeric' : 'encryptToURLComponent'
        return sc[method](item)
      }
      switch (type) {
        case 'short': return short(text)
      }
      throw this.error('invalid%s%s', this.t('encryption type'), type)
    }

    /**
     * Decrypt a given cipher using the specified decryption type and options.
     *
     * @async
     * @method
     * @param {string} cipher - The cipher to be decrypted.
     * @param {Object} [options={}] - The decryption options.
     * @param {string} [options.type='short'] - The decryption type. Defaults to 'short'.
     * @param {string} [options.subType='qr'] - The decryption sub-type. Defaults to 'qr'.
     * @returns {Promise<string>} - The decrypted text.
     */
    decrypt = async (cipher, options = {}) => {
      const { type = 'short', subType = 'qr' } = options
      const { importPkg } = this.app.bajo
      const { ShortCrypt } = await importPkg('bajoExtra:short-crypt')
      const short = (item) => {
        const sc = new ShortCrypt(this.config.secret)
        const method = subType === 'qr' ? 'decryptToQRCodeAlphanumeric' : 'decryptToURLComponent'
        return sc[method](item)
      }
      switch (type) {
        case 'short': return short(cipher)
      }
      throw this.error('invalid%s%s', this.t('decryption type'), type)
    }

    /**
     * Generate a random number or letter within a specified range.
     *
     * @method
     * @param {number} min - The minimum value of the range.
     * @param {number} max - The maximum value of the range.
     * @param {boolean} [alpha=false] - Whether to return a letter instead of a number.
     * @returns {number|string} - The generated random number or letter.
     */
    randomRange = (min, max, alpha) => {
      const num = Math.floor(Math.random() * (max - min + 1) + min)
      if (!alpha) return num
      return String.fromCharCode(96 + num)
    }

    /**
     * Get the dimensions for a given thumbnail size name.
     *
     * @method
     * @param {string} name - The name of the thumbnail size (e.g., 's', 'm', 'l', or '<width>x<height>').
     * @returns {number[]} - The width and height of the thumbnail.
     */
    thumbnailSizes = name => {
      switch (name) {
        case 's': return [36, 36]
        case 'm': return [100, 100]
        case 'l': return [250, 250]
        default: {
          const [w, h] = name.split('x').map(s => parseInt(s))
          if (!w || !h) return [0, 0]
          return [w, h]
        }
      }
    }

    /**
     * Create a thumbnail for a given image file.
     *
     * @async
     * @method
     * @param {string} file - The path to the image file.
     * @param {Object} [options={}] - The options for creating the thumbnail.
     * @param {string} [options.dir] - The directory to save the thumbnail. Defaults to the same directory as the file.
     * @param {boolean} [options.silent=true] - Whether to silently ignore errors. Defaults to true.
     * @param {string|string[]} [options.size] - The size(s) of the thumbnail. Defaults to the configured sizes.
     * @param {string|string[]} [options.format] - The format(s) of the thumbnail. Defaults to the configured output formats.
     * @param {Object} [options.opts={}] - Additional options for the sharp library.
     * @returns {Promise<void>}
     */
    createThumbnail = async (file, options = {}) => {
      const { fs } = this.app.lib
      const { isString } = this.app.lib._
      let {
        dir = path.dirname(file),
        silent = true,
        size = this.config.thumbnail.sizes,
        format = this.config.thumbnail.outputFormats,
        opts = {}
      } = options
      if (isString(size)) size = [size]
      if (isString(format)) format = [format]
      const ext = path.extname(file)

      if (!this.config.thumbnail.inputFormats.includes(ext)) {
        if (silent) return
        throw this.error('tnUnsupportedFormat%s%s', file, this.config.thumbnail.inputFormats)
      }
      const base = path.basename(file, ext)
      fs.ensureDirSync(dir)
      for (const s of size) {
        const [w, h] = this.thumbnailSizes(s)
        if (w === 0 || h === 0) {
          if (silent) continue
          throw this.error('tnInvalidSize%s%s', file, [...size, '<width>x<height>'])
        }
        for (const to of format) {
          const dest = `${dir}/${base}-${s}${to}`
          try {
            await sharp(file)
              .resize(w, h, opts)
              .toFile(dest)
          } catch (err) {
            if (silent) continue
            throw err
          }
        }
      }
    }
  }

  return BajoExtra
}

export default factory
