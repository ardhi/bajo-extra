const toml = require('./toml')

module.exports = function (file) {
  const { fs } = this.bajo.helper
  return toml.parse(fs.readFileSync(file, 'utf8'))
}
