import yaml from 'js-yaml'
import toml from 'toml'

const yamlHandler = function (file) {
  const { fs } = this.bajo.helper
  return yaml.load(fs.readFileSync(file, 'utf8'))
}

const tomlHandler = function (file) {
  const { fs } = this.bajo.helper
  return toml.parse(fs.readFileSync(file, 'utf8'))
}

export default {
  '.yaml': yamlHandler,
  '.yml': yamlHandler,
  '.toml': tomlHandler
}
