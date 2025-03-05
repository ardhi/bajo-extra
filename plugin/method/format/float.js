import numbro from 'numbro'

function float (value, opts = {}) {
  opts.mantissa = opts.mantissa ?? opts.scale ?? 2
  opts.thousandSeparated = opts.thousandSeparated ?? true
  return numbro(value).format(opts)
}

export default float
