const yaml = require('js-yaml')
const toml = require('toml')

const yamlHandler = function (file) {
  const { fs } = this.bajo.helper
  return yaml.load(fs.readFileSync(file, 'utf8'))
}

const tomlHandler = function (file) {
  const { fs } = this.bajo.helper
  return toml.parse(fs.readFileSync(file, 'utf8'))
}

module.exports = {
  '.yaml': yamlHandler,
  '.yml': yamlHandler,
  '.toml': tomlHandler
}
