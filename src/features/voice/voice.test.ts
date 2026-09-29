import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { VoiceRecorder } from './recorder'
import { createVoiceApi, decodeAudio } from '../../../server/voice.ts'

afterEach(() => vi.useRealTimers())
function recorderFixture(getUserMedia?: () => Promise<MediaStream>) {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] } as unknown as MediaStream
  const callbacks = { started: vi.fn(), elapsed: vi.fn(), captured: vi.fn(), error: vi.fn() }
  const media = {
    state: 'inactive', mimeType: 'audio/webm',
    onstop: null as (() => void) | null,
    onerror: null as (() => void) | null,
    ondataavailable: null as ((event: { data: Blob }) => void) | null,
    start: vi.fn(function () { media.state = 'recording' }),
    stop: vi.fn(function () { media.state = 'inactive'; media.ondataavailable?.({ data: new Blob(['synthetic audio']) }); media.onstop?.() }),
  }
  const runtime = { getUserMedia: getUserMedia ?? vi.fn().mockResolvedValue(stream), supported: () => true, create: () => media as unknown as MediaRecorder }
  return { recorder: new VoiceRecorder(callbacks, runtime), media, callbacks, stream, track }
}
describe('voice recording lifecycle', () => {
  it('releases microphone on stop and captures only one bounded recording', async () => {
    vi.useFakeTimers()
    const f = recorderFixture()
    await f.recorder.start()
    expect(f.callbacks.started).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(60000)
    expect(f.track.stop).toHaveBeenCalledOnce()
    expect(f.callbacks.captured).toHaveBeenCalledOnce()
    expect(f.media.state).toBe('inactive')
    vi.advanceTimersByTime(60000)
    expect(f.callbacks.captured).toHaveBeenCalledOnce()
  })
  it('cancellation drops audio and closes tracks without sending a capture', async () => {
    const f = recorderFixture()
    await f.recorder.start(); f.recorder.cancel()
    expect(f.track.stop).toHaveBeenCalledOnce()
    expect(f.callbacks.captured).not.toHaveBeenCalled()
  })
  it('closes a microphone granted after the dialog was cancelled', async () => {
    let grant!: (stream: MediaStream) => void
    const f = recorderFixture(() => new Promise(resolve => { grant = resolve }))
    const start = f.recorder.start()
    f.recorder.cancel(); grant(f.stream); await start
    expect(f.track.stop).toHaveBeenCalledOnce()
    expect(f.media.start).not.toHaveBeenCalled()
  })
  it('shows permission and unsupported-browser errors without starting a recorder', async () => {
    const f = recorderFixture(() => Promise.reject(Object.assign(new Error('Denied'), { name: 'NotAllowedError' })))
    await f.recorder.start()
    expect(f.callbacks.error).toHaveBeenCalledWith(expect.stringContaining('not allowed'))
    expect(f.media.start).not.toHaveBeenCalled()
    await new VoiceRecorder(f.callbacks, null).start()
    expect(f.callbacks.error).toHaveBeenLastCalledWith(expect.stringContaining('unavailable'))
  })
})

describe('voice API', () => {
  it('rejects non-audio content and malformed base64', () => {
    expect(decodeAudio({ mime: 'text/html', audio: 'YWJj' })).toBeNull()
    expect(decodeAudio({ mime: 'audio/webm', audio: 'not base64' })).toBeNull()
    expect(decodeAudio({ mime: 'audio/webm', audio: 'AB==' })).toBeNull()
    expect(decodeAudio({ mime: 'audio/webm;codecs=opus', audio: 'YWJj' })?.extension).toBe('webm')
  })
  it('returns only a transcript and redacts upstream failures; no automatic chat action', async () => {
    const transcribe = vi.fn().mockResolvedValueOnce('I had chai with whole milk.').mockRejectedValueOnce(new Error('sensitive-provider-detail'))
    const api = createVoiceApi({ openaiKey: 'synthetic-key', model: 'fixture', jevModel: 'fixture' }, transcribe)
    const server = createServer((req, res) => void api(req, res))
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as { port: number }
    const url = `http://127.0.0.1:${address.port}/api/voice`
    const send = (body: unknown, origin?: string) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) })
    try {
      const audio = { mime: 'audio/webm', audio: 'YWJj' }
      expect((await send(audio, 'https://unrelated.example')).status).toBe(403)
      expect((await send({ mime: 'audio/webm', audio: 'broken' })).status).toBe(400)
      const first = await send(audio)
      expect(await first.json()).toEqual({ text: 'I had chai with whole milk.' })
      const second = await send(audio)
      expect(second.status).toBe(503)
      expect(await second.text()).not.toContain('sensitive-provider-detail')
      expect(transcribe).toHaveBeenCalledTimes(2)
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
  })
})
