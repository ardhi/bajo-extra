function isMd5 (text) {
  // return /^\$2[ayb]\$.{56}$/.test(text)
  return /^[a-f0-9]{32}$/i.test(text)
}

export default isMd5
