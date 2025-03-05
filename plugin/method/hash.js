import bcrypt from 'bcrypt'
import crypto from 'crypto'

async function hash (text, type = 'md5', options = {}) {
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

export default hash
