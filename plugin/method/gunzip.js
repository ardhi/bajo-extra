import gzip from './gzip.js'

async function gunzip (file, deleteOld) {
  await gzip.call(this, file, deleteOld, true)
}

export default gunzip
