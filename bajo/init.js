const pino = require('pino')

module.exports = async function () {
  const { getConfig } = this.bajo.helper
  const gcfg = getConfig()
  const cfg = getConfig('bajoExtra')
  const log = cfg.log[gcfg.dev ? 'dev' : 'prod'] || {}
  log.level = gcfg.logLevel
  this.bajo.log = pino(log)
  this.bajo.event.emit('boot', ['bajoExtraSwitchPino', 'Switched to \'Pino\' logger by bajoExtra', 'debug'])
}