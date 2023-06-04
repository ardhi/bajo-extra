const pino = require('pino')

module.exports = async function () {
  const { getConfig } = this.bajo.helper
  const cfg = getConfig()
  this.bajo.log = pino(getConfig('bajoExtra').log[cfg.dev ? 'dev' : 'prod'])
}