import { apiFetch } from "../../api-fetch";
import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Send, RotateCcw } from 'lucide-react'
import { Modal } from '../../components'
import { VoiceRecorder } from './recorder'
import './voice.css'

function encode(audio: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(new Error('The recording could not be read. Please try again.'))
    reader.readAsDataURL(audio)
  })
}
export function VoiceCapture({ onClose, onSend }: { onClose: () => void; onSend: (text: string) => void }) {
  const [stage, setStage] = useState<'idle' | 'opening' | 'recording' | 'transcribing' | 'review' | 'error'>('idle')
  const [seconds, setSeconds] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const recorder = useRef<VoiceRecorder | null>(null)
  const request = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const sent = useRef(false)
  useEffect(() => {
    mounted.current = true
    recorder.current = new VoiceRecorder({
      started: () => { if (mounted.current) setStage('recording') },
      elapsed: value => { if (mounted.current) setSeconds(value) },
      error: message => { if (mounted.current) { setError(message); setStage('error') } },
      captured: audio => {
        if (!mounted.current) return
        setStage('transcribing')
        const controller = new AbortController()
        request.current = controller
        const timeout = setTimeout(() => controller.abort(), 75000)
        void (async () => {
          try {
            const base64 = await encode(audio)
            if (!mounted.current || controller.signal.aborted) return
            const response = await apiFetch('/api/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mime: audio.type, audio: base64 }), signal: controller.signal })
            const data: unknown = await response.json()
            if (!mounted.current || controller.signal.aborted) return
            const result = data as { text?: unknown; error?: unknown }
            if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Voice transcription is unavailable. Please try again.')
            if (typeof result.text !== 'string' || !result.text.trim() || result.text.length > 4000) throw new Error('No usable transcript was returned. Please try again or type your message.')
            setTranscript(result.text); setStage('review')
          } catch (problem) {
            if (mounted.current) { setError(controller.signal.aborted ? 'Transcription took too long. Please try again or type your message.' : problem instanceof Error ? problem.message : 'Voice transcription failed. Please try again.'); setStage('error') }
          } finally { clearTimeout(timeout); if (request.current === controller) request.current = null }
        })()
      },
    })
    return () => { mounted.current = false; recorder.current?.cancel(); request.current?.abort() }
  }, [])
  const close = () => { mounted.current = false; recorder.current?.cancel(); request.current?.abort(); onClose() }
  const start = () => { sent.current = false; setError(''); setTranscript(''); setSeconds(0); setStage('opening'); void recorder.current?.start() }
  return <Modal title="Tell Rep & Plate what happened" onClose={close}>
    <div className="voice-capture">
      <p>Meals, drinks, or a workout set. Record up to a minute, then check your words before sending.</p>
      <p className="voice-privacy">Your recording is sent to OpenAI for transcription. Rep & Plate doesn’t save the audio.</p>
      {error && <p className="voice-error" role="alert">{error}</p>}
      {stage === 'opening' && <p role="status">Waiting for microphone permission…</p>}
      {stage === 'recording' && <div className="voice-recording"><span className="voice-pulse" aria-hidden="true" /><strong aria-live="off">Recording · 0:{String(seconds).padStart(2, '0')} / 1:00</strong><progress value={seconds} max={60} aria-label="Recording time" /><button className="primary-button" onClick={() => recorder.current?.stop()}><Square size={17} /> Stop recording</button></div>}
      {stage === 'transcribing' && <p role="status">Turning your words into a message…</p>}
      {stage === 'review' && <><label className="voice-transcript">Review your message<textarea aria-label="Voice transcript" rows={5} maxLength={4000} value={transcript} onChange={event => setTranscript(event.target.value)} /></label><p className="voice-privacy">Check quantities, food names, weights, and reps before sending.</p><div className="voice-actions"><button className="secondary-button" onClick={start}><RotateCcw size={16} /> Record again</button><button className="primary-button" disabled={!transcript.trim()} onClick={() => { if (sent.current) return; sent.current = true; onSend(transcript.trim()); close() }}><Send size={16} /> Send message</button></div></>}
      {(stage === 'idle' || stage === 'error') && <button className="primary-button" onClick={start}><Mic size={18} /> {stage === 'error' ? 'Try recording again' : 'Start recording'}</button>}
      <button className="text-button voice-cancel" onClick={close}>Cancel</button>
    </div>
  </Modal>
}
