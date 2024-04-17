import numbro from 'numbro'

function byte (value, opts = {}) {
  opts.output = 'byte'
  opts.base = 'binary'
  opts.mantissa = opts.mantissa ?? opts.scale ?? 2
  opts.spaceSeparated = opts.spaceSeparated ?? true
  return numbro(value).format(opts)
}

export default byte
