async function download (...args) {
  const [url] = args
  const spinText = 'Downloading file...'
  const spin = this.print.spinner({ showCounter: true }).start(spinText)

  let dest
  try {
    dest = await this.download(url, undefined, { spin, spinText })
  } catch (err) {
    spin.fatal('Error: %s', err.message)
  }
  spin.succeed('File saved as \'%s\'', dest)
}

export default download
