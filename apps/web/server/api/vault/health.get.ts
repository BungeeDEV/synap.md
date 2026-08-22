export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  return getVaultHealthReport(getDb(), config.vaultPath)
})
