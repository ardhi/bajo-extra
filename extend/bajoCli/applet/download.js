async function download (...args) {
  const [url] = args
  const spinText = this.t('downloading%s', this.t('file'))
  const spin = this.print.spinner({ showCounter: true }).start(spinText)

  let dest
  try {
    dest = await this.download(url, undefined, { spin, spinText })
  } catch (err) {
    spin.fatal('error%s', err.message)
  }
  spin.succeed('savedAs%s%s', this.t('file'), dest)
}

export default download
