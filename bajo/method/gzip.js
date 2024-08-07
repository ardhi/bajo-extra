import { createGzip, createGunzip } from 'zlib'

function gzip (file, deleteOld, expand) {
  const { fs } = this.app.bajo.lib
  return new Promise((resolve, reject) => {
    const newFile = expand ? file.slice(0, file.length - 3) : (file + '.gz')
    const reader = fs.createReadStream(file)
    const writer = fs.createWriteStream(newFile)
    const method = expand ? createGunzip() : createGzip()
    reader.pipe(method).pipe(writer)
    writer.on('error', reject)
    writer.on('finish', err => {
      if (err) return reject(err)
      if (deleteOld) fs.unlinkSync(file)
      resolve()
    })
  })
}

export default gzip
