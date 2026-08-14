import { type EventStream } from 'h3'

// A global set to hold all active SSE connections
const activeStreams = new Set<EventStream>()

export function registerVaultEventStream(stream: EventStream) {
  activeStreams.add(stream)
  
  stream.onClosed(() => {
    activeStreams.delete(stream)
  })
}

export function broadcastVaultEvent(event: string, data: any) {
  const payload = JSON.stringify(data)
  for (const stream of activeStreams) {
    stream.push({
      event,
      data: payload
    })
  }
}
