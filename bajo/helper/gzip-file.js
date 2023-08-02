import { createGzip } from 'zlib'

function gzipFile (file, deleteOld) {
  return new Promise((resolve, reject) => {
    const { importPkg } = this.bajo.helper
    importPkg('fs-extra')
      .then(fs => {
        const newFile = file + '.gz'
        const reader = fs.createReadStream(file)
        const writer = fs.createWriteStream(newFile)
        const gzip = createGzip()
        reader.pipe(gzip).pipe(writer)
        writer.on('error', reject)
        writer.on('finish', err => {
          if (err) return reject(err)
          if (deleteOld) fs.unlinkSync(file)
          resolve()
        })
      })
  })
}

export default gzipFile
