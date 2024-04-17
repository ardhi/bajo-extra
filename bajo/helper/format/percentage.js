import numbro from 'numbro'

function percentage (value, opts = {}) {
  opts.output = 'percent'
  opts.mantissa = opts.mantissa ?? opts.scale ?? 2
  opts.spaceSeparated = opts.spaceSeparated ?? true
  return numbro(value).format(opts)
}

export default percentage
