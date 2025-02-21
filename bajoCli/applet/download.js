async function download (...args) {
  const [url] = args
  const spinText = this.print.write('downloading%s', this.print.write('file'))
  const spin = this.print.spinner({ showCounter: true }).start(spinText)

  let dest
  try {
    dest = await this.download(url, undefined, { spin, spinText })
  } catch (err) {
    spin.fatal('error%s', err.message)
  }
  spin.succeed('savedAs%s%s', this.print.write('file'), dest)
}

export default download
