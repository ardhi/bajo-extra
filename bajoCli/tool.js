async function tool ({ path, args = [], returnEarly }) {
  const { currentLoc } = this.bajo.helper
  const { runToolMethod } = this.bajoCli.helper
  const options = { demonize: ['shell'] }
  await runToolMethod({ path, args, dir: `${currentLoc(import.meta).dir}/tool`, options, returnEarly })
}

export default tool
