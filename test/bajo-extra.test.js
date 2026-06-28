/* global describe, it, beforeEach */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect } from 'chai'

import factory from '../index.js'

const createTempRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bajo-extra-test-'))

describe('BajoExtra', () => {
  let app
  let BajoExtra
  let extra

  beforeEach(async () => {
    app = {
      lib: {
        fs,
        _: {
          isString: (value) => typeof value === 'string'
        }
      },
      baseClass: {
        Base: class Base {
          constructor (pkgName, appRef) {
            this.pkgName = pkgName
            this.app = appRef
          }

          t (text) {
            return text
          }

          error (msg, ...params) {
            let text = msg
            for (const p of params) text = text.replace('%s', p)
            return new Error(text)
          }
        }
      },
      bajo: {
        importPkg: async (name) => {
          if (name === 'bajoExtra:bcrypt') {
            return {
              hash: async (input, salt) => `bcrypt:${salt}:${input}`
            }
          }
          if (name === 'bajoExtra:short-crypt') {
            class ShortCrypt {
              encryptToQRCodeAlphanumeric (item) {
                return `qr:${item}`
              }

              encryptToURLComponent (item) {
                return `url:${encodeURIComponent(item)}`
              }

              decryptToQRCodeAlphanumeric (item) {
                return item.replace(/^qr:/, '')
              }

              decryptToURLComponent (item) {
                return decodeURIComponent(item.replace(/^url:/, ''))
              }
            }
            return { ShortCrypt }
          }
          throw new Error(`Unknown import package: ${name}`)
        }
      }
    }

    BajoExtra = await factory.call({ app }, 'bajo-extra')
    extra = new BajoExtra()
  })

  it('initializes default configuration', () => {
    expect(extra.config.secret).to.be.a('string')
    expect(extra.config.fetch.agent.autoSelectFamily).to.equal(true)
    expect(extra.config.thumbnail.outputFormats).to.deep.equal(['.png'])
  })

  it('hash supports md5 and bcrypt modes', async () => {
    const md5 = await extra.hash('abc')
    const bcrypt = await extra.hash('hello', 'bcrypt', { salt: 12 })

    expect(md5).to.equal('900150983cd24fb0d6963f7d28e17f72')
    expect(bcrypt).to.equal('bcrypt:12:hello')
  })

  it('hash supports short mode with fixed output length', async () => {
    const value = await extra.hash({ id: 1 }, 'short', { digest: 'hex' })

    expect(value).to.have.lengthOf(12)
    expect(/^[a-f0-9]+$/i.test(value)).to.equal(true)
  })

  it('detects hash and html-link formats', () => {
    expect(extra.isMd5('900150983cd24fb0d6963f7d28e17f72')).to.equal(true)
    expect(extra.isMd5('not-md5')).to.equal(false)
    expect(extra.isSha256('a'.repeat(64))).to.equal(true)
    expect(extra.isSha256('a'.repeat(63))).to.equal(false)
    expect(extra.isBcrypt('$2b$10$123456789012345678901uYxJt6P5sQJ5AZt0.pOEtpJR/YWZLxK.')).to.equal(true)
    expect(extra.isHtmlLink('<a href="https://example.com">Site</a>')).to.equal(true)
    expect(extra.isHtmlLink('https://example.com')).to.equal(false)
  })

  it('encrypt and decrypt support short qr and url sub types', async () => {
    const qr = await extra.encrypt('hello', { type: 'short', subType: 'qr' })
    const text1 = await extra.decrypt(qr, { type: 'short', subType: 'qr' })

    const url = await extra.encrypt('hello world?', { type: 'short', subType: 'url' })
    const text2 = await extra.decrypt(url, { type: 'short', subType: 'url' })

    expect(qr).to.equal('qr:hello')
    expect(text1).to.equal('hello')
    expect(url).to.equal('url:hello%20world%3F')
    expect(text2).to.equal('hello world?')
  })

  it('encrypt throws for unsupported type', async () => {
    try {
      await extra.encrypt('hello', { type: 'bad' })
      expect.fail('Expected encrypt to throw')
    } catch (err) {
      expect(err.message).to.equal('invalidencryption typebad')
    }
  })

  it('thumbnailSizes resolves presets and custom values', () => {
    expect(extra.thumbnailSizes('s')).to.deep.equal([36, 36])
    expect(extra.thumbnailSizes('m')).to.deep.equal([100, 100])
    expect(extra.thumbnailSizes('l')).to.deep.equal([250, 250])
    expect(extra.thumbnailSizes('300x200')).to.deep.equal([300, 200])
    expect(extra.thumbnailSizes('invalid')).to.deep.equal([0, 0])
  })

  it('randomRange returns value in range and alpha mode returns letters', () => {
    const oldRandom = Math.random

    Math.random = () => 0
    expect(extra.randomRange(1, 5, false)).to.equal(1)
    expect(extra.randomRange(1, 5, true)).to.equal('a')

    Math.random = () => 0.999999
    expect(extra.randomRange(1, 5, false)).to.equal(5)
    expect(extra.randomRange(1, 5, true)).to.equal('e')

    Math.random = oldRandom
  })

  it('gzip and gunzip compress and restore files', async () => {
    const root = createTempRoot()
    const file = path.join(root, 'sample.txt')
    fs.writeFileSync(file, 'line-1\nline-2\nline-3', 'utf8')

    await extra.gzip(file, true)

    const gz = `${file}.gz`
    expect(fs.existsSync(file)).to.equal(false)
    expect(fs.existsSync(gz)).to.equal(true)

    await extra.gunzip(gz, true)

    expect(fs.existsSync(file)).to.equal(true)
    expect(fs.existsSync(gz)).to.equal(false)
    expect(fs.readFileSync(file, 'utf8')).to.equal('line-1\nline-2\nline-3')

    fs.rmSync(root, { recursive: true, force: true })
  })

  it('countFileLines counts line breaks', async () => {
    const root = createTempRoot()
    const file = path.join(root, 'count.txt')
    fs.writeFileSync(file, 'a\nb\nc\n', 'utf8')

    const lines = await extra.countFileLines(file)

    expect(lines).to.equal(3)
    fs.rmSync(root, { recursive: true, force: true })
  })
})
