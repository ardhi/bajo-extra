import pino from 'pino'

export default async function () {
  const { getConfig, logLevels, _, log } = this.bajo.helper
  const config = getConfig()
  const opts = getConfig('bajoExtra').log || {}
  opts.level = config.log.level
  if (_.get(opts, 'transport.target') === 'pino-pretty')
    _.set(opts, 'transport.options.translateTime', `UTC:yyyy-mm-dd'T'HH:MM:ss.l'Z'`)
  const instance = pino(opts)
  const logger = {}
  _.forOwn(logLevels, (v, k) => {
    logger[k] = ({ data, msg, args }) => {
      if (config.env === 'dev' && k.length < 5) msg = _.pad('', 5 - k.length, ' ') + msg
      const params = _.isEmpty(data) ? [msg, ...args] : [data, msg, ...args]
      instance[k](...params)
    }
  })
  this.bajoExtra.logger = logger
  log.debug(`Switched to 'Pino' logger`)
}