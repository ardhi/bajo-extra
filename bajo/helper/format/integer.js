import numbro from 'numbro'

function integer (value, opts = {}) {
  opts.mantissa = 0
  opts.thousandSeparated = opts.thousandSeparated ?? true
  return numbro(value).format(opts)
}

export default integer
