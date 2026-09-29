const maxBytes = 5.5 * 1024 * 1024
type RecorderRuntime = {
  getUserMedia: () => Promise<MediaStream>
  supported: (mime: string) => boolean
  create: (stream: MediaStream, mime: string) => MediaRecorder
}
type Callbacks = { started: () => void; elapsed: (seconds: number) => void; captured: (audio: Blob) => void; error: (message: string) => void }
export const browserRecorderRuntime = (): RecorderRuntime | null => {
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null
  return { getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: true }), supported: mime => MediaRecorder.isTypeSupported(mime), create: (stream, mime) => new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 96000 }) }
}

export class VoiceRecorder {
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private limit: ReturnType<typeof setTimeout> | null = null
  private generation = 0
  constructor(private callbacks: Callbacks, private runtime: RecorderRuntime | null = browserRecorderRuntime()) {}
  private stopTracks() { this.stream?.getTracks().forEach(track => track.stop()); this.stream = null }
  private stopTimers() { if (this.timer) clearInterval(this.timer); if (this.limit) clearTimeout(this.limit); this.timer = null; this.limit = null }
  async start() {
    this.cancel()
    const generation = this.generation
    if (!this.runtime) { this.callbacks.error('Voice recording is unavailable in this browser. You can type your message instead.'); return }
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find(value => this.runtime!.supported(value))
    if (!mime) { this.callbacks.error('This browser does not support a compatible audio format. You can type instead.'); return }
    try {
      const stream = await this.runtime.getUserMedia()
      if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return }
      this.stream = stream
      const recorder = this.runtime.create(stream, mime)
      this.recorder = recorder
      const chunks: Blob[] = []
      let bytes = 0
      recorder.ondataavailable = event => {
        if (generation !== this.generation) return
        bytes += event.data.size
        if (bytes > maxBytes) { this.cancel(); this.callbacks.error('That recording is too large. Please record a shorter message.'); return }
        if (event.data.size) chunks.push(event.data)
      }
      recorder.onerror = () => { this.cancel(); this.callbacks.error('The microphone stopped unexpectedly. Please try again.') }
      recorder.onstop = () => {
        this.stopTracks(); this.stopTimers()
        if (generation !== this.generation) return
        this.recorder = null
        const audio = new Blob(chunks, { type: recorder.mimeType || mime })
        if (!audio.size) { this.callbacks.error('No audio was recorded. Please try again.'); return }
        this.callbacks.captured(audio)
      }
      recorder.start(1000)
      this.callbacks.started()
      const startedAt = Date.now()
      this.timer = setInterval(() => this.callbacks.elapsed(Math.min(60, Math.floor((Date.now() - startedAt) / 1000))), 250)
      this.limit = setTimeout(() => this.stop(), 60000)
    } catch (error) {
      if (generation !== this.generation) return
      this.stopTracks(); this.stopTimers()
      this.callbacks.error((error as { name?: string }).name === 'NotAllowedError'
        ? 'Microphone access was not allowed. Enable it in your browser or type your message.'
        : 'The microphone could not be opened. Check your microphone or type your message.')
    }
  }
  stop() {
    this.stopTimers()
    if (this.recorder?.state === 'recording') this.recorder.stop()
    this.stopTracks()
  }
  cancel() {
    this.generation++
    this.stopTimers()
    if (this.recorder) {
      this.recorder.ondataavailable = null; this.recorder.onstop = null; this.recorder.onerror = null
      if (this.recorder.state !== 'inactive') this.recorder.stop()
    }
    this.recorder = null
    this.stopTracks()
  }
}
