import type { AppData, ID } from '../types'
import { uid } from './utils'

/**
 * Section a point should land in, given the stream it comes from.
 * Falls back to a dedicated "Altro" section (created on demand) so nothing
 * silently ends up under the first heading of the agenda.
 */
export function sectionForStream(d: AppData, streamId?: ID): ID | undefined {
  if (streamId) {
    const match = d.syncAgenda.find(
      (s) => s.kind === 'stream' && s.streamId === streamId,
    )
    if (match) return match.id
  }
  let other = d.syncAgenda.find((s) => s.label.trim().toLowerCase() === 'altro')
  if (!other) {
    other = {
      id: uid(),
      label: 'Altro',
      kind: 'free',
      order: d.syncAgenda.length,
    }
    d.syncAgenda.push(other)
  }
  return other.id
}
