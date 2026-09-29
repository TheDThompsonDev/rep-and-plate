import type { IncomingMessage, ServerResponse } from 'node:http'
import OpenAI, { toFile } from 'openai'
import type { Config } from './ai.ts'

const MAX_BODY = 8 * 1024 * 1024
const types: Record<string, string> = { 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/wav': 'wav' }
export function decodeAudio(value: unknown): { bytes: Buffer; mime: string; extension: string } | null {
  if (!value || typeof value !== 'object') return null
  const data = value as { mime?: unknown; audio?: unknown }
  if (typeof data.mime !== 'string' || typeof data.audio !== 'string') return null
  const mime = data.mime.split(';')[0].trim().toLowerCase()
  if (!types[mime] || !data.audio.length || data.audio.length > MAX_BODY || data.audio.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.audio)) return null
  const bytes = Buffer.from(data.audio, 'base64')
  if (!bytes.length || bytes.length > 6 * 1024 * 1024 || bytes.toString('base64') !== data.audio) return null
  return { bytes, mime, extension: types[mime] }
}
export async function transcribeAudio(audio: NonNullable<ReturnType<typeof decodeAudio>>, key: string, signal: AbortSignal): Promise<string> {
  const client = new OpenAI({ apiKey: key, maxRetries: 0, timeout: 65000 })
  const file = await toFile(audio.bytes, `recording.${audio.extension}`, { type: audio.mime })
  const response = await client.audio.transcriptions.create({ file, model: 'gpt-4o-mini-transcribe', response_format: 'json' }, { signal })
  return response.text
}

/** Local, short-lived transcription. Raw audio is never written to disk or logs. */
export function createVoiceApi(config: Config, transcribe = transcribeAudio) {
  let active = 0
  let attempts: number[] = []
  return async (req: IncomingMessage, res: ServerResponse) => {
    const json = (status: number, value: unknown) => {
      if (res.destroyed || res.writableEnded) return
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
      res.end(JSON.stringify(value))
    }
    if (req.method !== 'POST' || (req.url ?? '').split('?')[0] !== '/api/voice') return json(404, { error: 'Not found.' })
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return json(403, { error: 'Request origin is not allowed.' })
    if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'Send an audio recording as JSON.' })
    if (!config.openaiKey) return json(503, { error: 'Voice transcription is not configured yet. You can type your message instead.' })
    attempts = attempts.filter(time => Date.now() - time < 60000)
    if (active >= 2 || attempts.length >= 10) return json(429, { error: 'Voice transcription is busy. Please wait a moment and try again.' })
    active++; attempts.push(Date.now())
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 70000)
    const disconnect = () => { if (!res.writableEnded) controller.abort() }
    res.on('close', disconnect)
    try {
      if (Number(req.headers['content-length'] ?? 0) > MAX_BODY) return json(413, { error: 'That recording is too large. Record a shorter message.' })
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > MAX_BODY) return json(413, { error: 'That recording is too large. Record a shorter message.' })
        chunks.push(Buffer.from(chunk))
      }
      let body: unknown
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
      catch { return json(400, { error: 'The recording could not be read. Please try again.' }) }
      const audio = decodeAudio(body)
      if (!audio) return json(400, { error: 'Use a short WebM, MP4, OGG, or WAV audio recording.' })
      const text = (await transcribe(audio, config.openaiKey, controller.signal)).trim()
      if (!text) return json(422, { error: 'No speech was detected. Try again or type your message.' })
      if (text.length > 4000) return json(422, { error: 'The transcript is too long. Please record a shorter message.' })
      return json(200, { text })
    } catch (error) {
      const status = (error as { status?: number })?.status
      return json(status === 429 ? 429 : 503, { error: controller.signal.aborted
        ? 'Transcription took too long. Please try again or type your message.'
        : status === 429 ? 'The voice service is at its usage limit. Please try again later.'
        : 'That recording could not be transcribed. Please try again or type your message.' })
    } finally { clearTimeout(timer); res.off('close', disconnect); active-- }
  }
}
