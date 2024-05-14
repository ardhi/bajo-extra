async function download ({ path, args }) {
  const { spinner } = this.bajo.helper
  const { download } = this.bajoExtra.helper
  const url = args[0]
  const spinText = 'Downloading file...'
  const spin = spinner({ showCounter: true }).start(spinText)

  let dest
  try {
    dest = await download(url, null, { spin, spinText })
  } catch (err) {
    spin.fatal('Error: %s', err.message)
  }
  spin.succeed('File saved as \'%s\'', dest)
}

export default download
