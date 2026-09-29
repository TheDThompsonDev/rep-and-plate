import { readBrowserRecords } from "./record-fixture";
import { test, expect, type Page } from "./app-fixture"

type VoiceState = { requested: number; started: number; stopped: number; release?: () => void }
async function fakeMicrophone(page: Page, mode: 'working' | 'denied' | 'unsupported' | 'pending' = 'working') {
  await page.addInitScript((mode) => {
    const state: VoiceState = { requested: 0, started: 0, stopped: 0 }
    const host = window as typeof window & { __voice: VoiceState }
    host.__voice = state
    const stream = { getTracks: () => [{ stop: () => { state.stopped++ } }] }
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: () => {
        state.requested++
        if (mode === 'denied') return Promise.reject(new DOMException('Denied for test', 'NotAllowedError'))
        if (mode === 'pending') return new Promise(resolve => { state.release = () => resolve(stream) })
        return Promise.resolve(stream)
      },
    } })
    class Recorder {
      static isTypeSupported() { return true }
      state = 'inactive'
      mimeType = 'audio/webm'
      ondataavailable: ((event: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      onerror: (() => void) | null = null
      start() { this.state = 'recording'; state.started++ }
      stop() {
        this.state = 'inactive'
        this.ondataavailable?.({ data: new Blob(['synthetic voice fixture'], { type: this.mimeType }) })
        this.onstop?.()
      }
    }
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: mode === 'unsupported' ? undefined : Recorder })
  }, mode)
}
const microphone = (page: Page) => page.evaluate(() => (window as typeof window & { __voice: VoiceState }).__voice)
const stored = (page: Page) => readBrowserRecords(page)
const openVoice = async (page: Page) => {
  await page.getByRole('button', { name: 'Use voice', exact: true }).first().click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Tell Rep & Plate what happened' })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/status', route => route.fulfill({ json: { available: true, jev: true, usda: true, model: 'test-model' } }))
  await page.route('**/api/chat', route => route.abort())
  await page.route('**/api/voice', route => route.abort())
})

test('Voice is reviewed and edited before one Chat request is sent', async ({ page }) => {
  await fakeMicrophone(page)
  const requests: { text: string }[] = []
  const audio: { mime: string; audio: string }[] = []
  await page.route('**/api/voice', route => {
    audio.push(route.request().postDataJSON())
    return route.fulfill({ json: { text: 'I drank coffee with whole milk.' } })
  })
  await page.route('**/api/chat', route => {
    const request = route.request().postDataJSON()
    requests.push(request)
    return route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ type: 'result', result: {
      requestId: request.requestId, reply: 'Thanks. I received your edited voice message.', decision: 'conversation',
      receipt: null, meal: null, sources: [], warnings: [],
    } }) + '\n' })
  })
  await page.goto('/')
  await openVoice(page)
  expect((await microphone(page)).requested).toBe(0)
  await page.getByRole('button', { name: 'Start recording', exact: true }).click()
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click()
  const field = page.getByRole('textbox', { name: 'Voice transcript' })
  await expect(field).toHaveValue('I drank coffee with whole milk.')
  expect(requests).toHaveLength(0)
  const edited = 'I drank coffee with half a cup of whole milk and no syrup.'
  await field.fill(edited)
  await page.getByRole('dialog').getByRole('button', { name: 'Send message', exact: true }).click()
  await expect(page.getByText('Thanks. I received your edited voice message.', { exact: true })).toBeVisible()
  expect(requests).toHaveLength(1)
  expect(requests[0].text).toBe(edited)
  expect(audio).toHaveLength(1)
  expect(audio[0].mime).toBe('audio/webm')
  expect(audio[0].audio).toBe(Buffer.from('synthetic voice fixture').toString('base64'))
  expect((await microphone(page)).stopped).toBe(1)
  expect((await stored(page)).messages.filter((message: { role: string; text: string }) => message.role === 'user' && message.text === edited)).toHaveLength(1)
})

test('Cancelling voice releases the microphone without transcribing or sending', async ({ page }) => {
  await fakeMicrophone(page)
  let calls = 0
  await page.route('**/api/voice', route => { calls++; return route.abort() })
  await page.route('**/api/chat', route => { calls++; return route.abort() })
  await page.goto('/')
  const before = (await stored(page)).messages.length
  await openVoice(page)
  await page.getByRole('button', { name: 'Start recording', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await microphone(page)).stopped).toBe(1)
  expect(calls).toBe(0)
  expect((await stored(page)).messages).toHaveLength(before)
})

test('Microphone access granted after cancellation is immediately released', async ({ page }) => {
  await fakeMicrophone(page, 'pending')
  await page.goto('/')
  await openVoice(page)
  await page.getByRole('button', { name: 'Start recording', exact: true }).click()
  await expect(page.getByText('Waiting for microphone permission…')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.evaluate(() => (window as typeof window & { __voice: VoiceState }).__voice.release?.())
  await expect.poll(async () => (await microphone(page)).stopped).toBe(1)
  expect((await microphone(page)).started).toBe(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

for (const mode of ['denied', 'unsupported'] as const) {
  test(`${mode} microphone leaves the typed Chat composer available`, async ({ page }) => {
    await fakeMicrophone(page, mode)
    await page.goto('/')
    await openVoice(page)
    await page.getByRole('button', { name: 'Start recording', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(mode === 'denied' ? 'not allowed' : 'unavailable')
    expect((await microphone(page)).started).toBe(0)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByRole('textbox', { name: 'Message Rep & Plate' }).fill('I can still type my message.')
    await expect(page.getByRole('textbox', { name: 'Message Rep & Plate' })).toHaveValue('I can still type my message.')
  })
}

test('Reviewed voice reps update the active workout once without calling Chat AI', async ({ page }) => {
  await fakeMicrophone(page)
  let chatCalls = 0
  await page.route('**/api/chat', route => { chatCalls++; return route.abort() })
  await page.route('**/api/voice', route => route.fulfill({ json: { text: 'Got 8' } }))
  await page.goto('/#workouts')
  await page.getByRole('button', { name: 'Start workout', exact: true }).click()
  await openVoice(page)
  await page.getByRole('button', { name: 'Start recording', exact: true }).click()
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Voice transcript' })).toHaveValue('Got 8')
  await page.getByRole('textbox', { name: 'Voice transcript' }).fill('Got 7')
  await page.getByRole('dialog').getByRole('button', { name: 'Send message', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const state = await stored(page)
  expect(state.workout.exercises[0].sets[0]).toBe(7)
  expect(state.workout.exercises[0].sets.filter((reps: number | null) => reps !== null)).toHaveLength(1)
  expect(state.workout.conversation.filter((message: { role: string; text: string }) => message.role === 'user' && message.text === 'Got 7')).toHaveLength(1)
  expect(chatCalls).toBe(0)
})
