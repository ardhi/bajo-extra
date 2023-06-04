const yaml = require('js-yaml')

module.exports = function (file) {
  const { fs } = this.bajo.helper
  return yaml.load(fs.readFileSync(file, 'utf8'))
}
