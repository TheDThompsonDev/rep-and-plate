type Detection = { rawValue: string; format?: string };
type Detector = { detect(source: HTMLVideoElement | HTMLImageElement): Promise<Detection[]> };
type DetectorClass = { new(options: {formats: string[]}): Detector; getSupportedFormats?: () => Promise<string[]> };
const formats = ['ean_13', 'ean_8', 'upc_a', 'itf'];

async function fallbackReader() {
  const [{ BrowserMultiFormatOneDReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  // UPC-E needs expansion before GTIN matching; never mistake its eight digits for EAN-8.
  return new BrowserMultiFormatOneDReader(new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.ITF]]]));
}

async function nativeDetector(): Promise<Detector | null> {
  const Constructor = (globalThis as typeof globalThis & {BarcodeDetector?: DetectorClass}).BarcodeDetector;
  if (!Constructor) return null;
  try {
    const supported = await Constructor.getSupportedFormats?.();
    const usable = supported ? formats.filter((format) => supported.includes(format)) : formats;
    return usable.length ? new Constructor({ formats: usable }) : null;
  } catch { return null; }
}

/** Own one stream at a time. The caller stops it immediately on detection or dismissal. */
export async function startBarcodeCamera(video: HTMLVideoElement, onCode: (code: string) => void, signal: AbortSignal) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera scanning is unavailable here. Upload a barcode photo or enter its numbers.');
  const stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}}, audio: false});
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controls: {stop: () => void} | undefined;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    controls?.stop();
    stream.getTracks().forEach((track) => track.stop());
    if (video.srcObject === stream) video.srcObject = null;
    signal.removeEventListener('abort', stop);
  };
  signal.addEventListener('abort', stop, {once: true});
  if (signal.aborted) { stop(); return stop; }
  try {
    const detector = await nativeDetector();
    if (stopped) return stop;
    if (detector) {
      video.srcObject = stream;
      await video.play();
      const scan = async () => {
        if (stopped) return;
        try {
          const results = await detector.detect(video);
          if (!stopped && results[0]?.rawValue) { onCode(results[0].rawValue); return; }
        } catch { /* A not-yet-ready frame is retried. */ }
        if (!stopped) timer = setTimeout(scan, 250);
      };
      void scan();
    } else {
      const reader = await fallbackReader();
      if (stopped) return stop;
      controls = await reader.decodeFromStream(stream, video, (result) => {
        if (!stopped && result) onCode(result.getText());
      });
      if (stopped) controls.stop();
    }
    return stop;
  } catch (error) { stop(); throw error; }
}

export async function readBarcodePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > 12 * 1024 * 1024) throw new Error('Choose an image smaller than 12 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const detector = await nativeDetector();
    if (detector) {
      const result = await detector.detect(image).catch(() => []);
      if (result[0]?.rawValue) return result[0].rawValue;
    }
    return (await (await fallbackReader()).decodeFromImageElement(image)).getText();
  } finally { URL.revokeObjectURL(url); }
}
