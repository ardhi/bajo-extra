import bcrypt from 'bcrypt'
import crypto from 'crypto'

async function hash (text, type = 'md5', { digest = 'hex', salt = 10 } = {}) {
  if (typeof text !== 'string') text = JSON.stringify(text)
  if (type === 'bcrypt') return await bcrypt.hash(text, salt)
  return crypto.createHash(type).update(text).digest(digest)
}

export default hash
