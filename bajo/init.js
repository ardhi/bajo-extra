const pino = require('pino')

module.exports = async function () {
  const { getConfig, logLevels, _, isSet } = this.bajo.helper
  const gcfg = getConfig()
  const cfg = getConfig('bajoExtra')
  const opts = cfg.log[gcfg.dev ? 'dev' : 'prod'] || {}
  opts.level = gcfg.log.level
  const log = pino(opts)
  const logger = {}
  _.forOwn(logLevels, (v, k) => {
    logger[k] = ({ data, msg, args }) => {
      const params = _.isEmpty(data) ? [msg, ...args] : [data, msg, ...args]
      log[k](...params)
    }
  })
  this.bajoExtra.logger = logger

  this.bajo.event.emit('boot', ['bajoExtraSwitchPino', 'Switched to \'Pino\' logger by bajoExtra', 'debug'])
}