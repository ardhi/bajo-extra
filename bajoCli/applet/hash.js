async function hash (...args) {
  const [type, ...items] = args
  for (const item of items) {
    const hashed = await this.hash(item, type)
    console.log(`${item} -> ${hashed}`)
  }
}

export default hash
