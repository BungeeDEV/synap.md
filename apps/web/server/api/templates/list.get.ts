export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  return listTemplates(config.vaultPath)
})
