function isBcryptString (text) {
  // return /^\$2[ayb]\$.{56}$/.test(text)
  return /^\$2[aby]?\$\d{1,2}\$[./A-Za-z0-9]{53}$/.test(text)
}

export default isBcryptString
