// taken from: https://stackoverflow.com/a/41439945
function countFileLines (file) {
  const { fs } = this.app.bajo.lib
  return new Promise((resolve, reject) => {
    let lineCount = 0
    fs.createReadStream(file)
      .on('data', (buffer) => {
        let idx = -1
        lineCount--
        do {
          idx = buffer.indexOf(10, idx + 1)
          lineCount++
        } while (idx !== -1)
      })
      .on('end', () => {
        resolve(lineCount)
      })
      .on('error', reject)
  })
}

export default countFileLines
