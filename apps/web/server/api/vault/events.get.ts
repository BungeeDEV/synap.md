export default defineEventHandler((event) => {
  // We use h3's built-in createEventStream to handle standard SSE headers and formatting
  const stream = createEventStream(event)
  
  // Register the stream in our global pool so writes can broadcast to it
  registerVaultEventStream(stream)
  
  // Send an initial connected event so the client knows it's alive
  stream.push({
    event: 'connected',
    data: JSON.stringify({ message: 'SSE connection established' })
  })

  // Keep the connection alive
  return stream.send()
})
