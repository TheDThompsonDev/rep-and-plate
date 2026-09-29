import { afterEach, describe, expect, it, vi } from 'vitest';
import { startBarcodeCamera } from './camera';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('barcode camera lifecycle', () => {
  it('stops tracks if permission resolves after the scanner has closed', async () => {
    const stop = vi.fn();
    let resolve!: (value: MediaStream) => void;
    const stream = {getTracks: () => [{stop}]} as unknown as MediaStream;
    vi.stubGlobal('navigator', {mediaDevices: {getUserMedia: () => new Promise<MediaStream>((done) => {resolve = done;})}});
    const controller = new AbortController();
    const video = {srcObject: null} as HTMLVideoElement;
    const pending = startBarcodeCamera(video, vi.fn(), controller.signal);
    controller.abort(); resolve(stream); await pending;
    expect(stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });

  it('handles one decoded frame and releases the stream when cancelled', async () => {
    vi.useFakeTimers();
    const stop = vi.fn();
    const stream = {getTracks: () => [{stop}]} as unknown as MediaStream;
    const detect = vi.fn().mockResolvedValue([{rawValue: '012345678905'}]);
    vi.stubGlobal('navigator', {mediaDevices: {getUserMedia: async () => stream}});
    vi.stubGlobal('BarcodeDetector', class {
      static async getSupportedFormats() {return ['ean_13', 'upc_a'];}
      detect = detect;
    });
    const controller = new AbortController();
    const onCode = vi.fn(() => controller.abort());
    const video = {srcObject: null, play: async () => {}} as unknown as HTMLVideoElement;
    await startBarcodeCamera(video, onCode, controller.signal);
    await vi.advanceTimersByTimeAsync(2000);
    expect(onCode).toHaveBeenCalledExactlyOnceWith('012345678905');
    expect(detect).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });

  it('gives a usable fallback message without camera support', async () => {
    vi.stubGlobal('navigator', {});
    await expect(startBarcodeCamera({} as HTMLVideoElement, vi.fn(), new AbortController().signal)).rejects.toThrow('Upload a barcode photo');
  });
});
