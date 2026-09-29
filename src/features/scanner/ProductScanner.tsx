import { apiFetch } from "../../api-fetch";
import { useEffect, useRef, useState } from 'react';
import { Barcode, Camera, ImagePlus, CircleDot, ShoppingBasket, Utensils, ExternalLink } from 'lucide-react';
import { Modal } from '../../components';
import { normalizeGTIN, nutritionForServing, productLookupSchema, type FoodProduct, type ProductLookup } from '../products/contracts';
import { readBarcodePhoto, startBarcodeCamera } from './camera';
import './scanner.css';

export type ProductScannerProps = {
  onSelect?: (product: FoodProduct) => void;
  onClose: () => void;
  onProduct: (product: FoodProduct, action: 'grocery' | 'meal', servings: number) => void;
  onLabel: (gtin: string) => void;
  lookupOverride?: (gtin: string) => FoodProduct | undefined;
  initialBarcode?: string;
};

export default function ProductScanner({onClose, onProduct, onLabel, onSelect, lookupOverride, initialBarcode = ''}: ProductScannerProps) {
  const [barcode, setBarcode] = useState(initialBarcode);
  const [result, setResult] = useState<ProductLookup | null>(null);
  const [selected, setSelected] = useState<FoodProduct | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const cameraController = useRef<AbortController | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const operation = useRef(0);
  const locked = useRef(false);
  const committed = useRef(false);
  const stopCamera = () => { cameraController.current?.abort(); cameraController.current = null; setCamera(false); };
  useEffect(() => () => {
    operation.current++;
    cameraController.current?.abort();
    requestController.current?.abort();
  }, []);

  async function lookup(value: string) {
    if (locked.current) return;
    stopCamera();
    const gtin = normalizeGTIN(value);
    setBarcode(value);
    setSelected(null);
    setResult(null);
    if (!gtin) { setError('Check the numbers under the barcode, including the last digit. Use a UPC, EAN, or GTIN barcode.'); return; }
    const original = value.trim().replace(/[ -]/g, '');
    const privateProduct = lookupOverride?.(gtin);
    if (!privateProduct && ((original.length === 12 && original.startsWith('2')) || (original.length === 13 && /^2[0-9]/.test(original)) || /^002|^02/.test(gtin))) {
      setError('This looks like a store-specific or variable-weight barcode. Use the package label to confirm this item.');
      setResult({status: 'not-found', products: [], message: 'Store-specific barcode'});
      return;
    }
    setError(''); setBusy(true); locked.current = true;
    const token = ++operation.current;
    const controller = new AbortController();
    requestController.current?.abort(); requestController.current = controller;
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      let response: ProductLookup;
      if (privateProduct) response = {status: 'found', products: [privateProduct], message: 'Your confirmed label'};
      else {
        const http = await apiFetch('/api/products/lookup', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({barcode: gtin}), signal: controller.signal});
        response = productLookupSchema.parse(await http.json());
      }
      if (token !== operation.current) return;
      setResult(response);
      if (response.status === 'found' && response.products.length === 1) setSelected(response.products[0]);
    } catch {
      if (token === operation.current) setError('The lookup could not finish. Try again, or use the nutrition label.');
    } finally {
      clearTimeout(timeout);
      if (token === operation.current) {setBusy(false); locked.current = false;}
    }
  }

  async function openCamera() {
    if (locked.current) return;
    setError(''); setCamera(true);
    const controller = new AbortController(); cameraController.current?.abort(); cameraController.current = controller;
    // The video remains mounted so a permission prompt cannot race its creation.
    try {
      if (video.current) await startBarcodeCamera(video.current, (code) => { if (!controller.signal.aborted) void lookup(code); }, controller.signal);
    } catch (cause) {
      if (controller.signal.aborted) return;
      stopCamera();
      setError(cause instanceof DOMException && cause.name === 'NotAllowedError' ? 'Camera access was declined. You can upload a photo or enter the barcode below.' : 'The camera could not start. You can upload a photo or enter the barcode below.');
    }
  }

  async function uploadPhoto(image: File | undefined) {
    if (!image || locked.current) return;
    stopCamera(); setBusy(true); locked.current = true; setError('');
    const token = ++operation.current;
    try {
      const code = await readBarcodePhoto(image);
      if (token !== operation.current) return;
      locked.current = false; setBusy(false);
      await lookup(code);
    } catch {
      if (token === operation.current) {setError('I couldn’t read that barcode. Try a clear, close-up photo or enter the numbers.'); setBusy(false); locked.current = false;}
    }
  }

  const perServing = selected ? nutritionForServing(selected) : null;
  const count = Number(quantity);
  const validQuantity = Number.isFinite(count) && count > 0 && count <= 1000;
  const validCode = normalizeGTIN(barcode);
  function commit(action: 'grocery' | 'meal') {
    if (!selected || !validQuantity || committed.current || (action === 'meal' && !perServing)) return;
    committed.current = true; stopCamera(); onProduct(selected, action, count);
  }

  return <Modal title="Scan a food barcode" onClose={onClose}>
    <div className="fuel-scanner">
      <div className="fuel-scanner-intro"><span><Barcode size={27}/></span><p>Find your food. Check the serving.<br/><strong>You decide what to track.</strong></p></div>
      <div className="fuel-scan-camera" hidden={!camera}>
        <video ref={video} muted playsInline aria-label="Live barcode camera"/>
        <span className="fuel-scan-guide" aria-hidden="true"/>
        <p>Hold the barcode inside the frame.</p>
        <button type="button" onClick={stopCamera}>Stop camera</button>
      </div>
      <div className="fuel-scan-tools"><button onClick={() => void openCamera()} disabled={busy || camera}><Camera size={18}/>Use camera</button><button onClick={() => file.current?.click()} disabled={busy}><ImagePlus size={18}/>Barcode photo</button></div>
      <input ref={file} hidden type="file" accept="image/*" aria-label="Upload barcode photo" onChange={(event) => {void uploadPhoto(event.target.files?.[0]); event.target.value = '';}}/>
      <form className="fuel-scan-entry" onSubmit={(event) => {event.preventDefault(); void lookup(barcode);}}>
        <label htmlFor="fuel-barcode">Or enter the barcode numbers</label>
        <div><input id="fuel-barcode" inputMode="numeric" autoComplete="off" value={barcode} maxLength={30} placeholder="UPC / EAN / GTIN" disabled={busy} onChange={(event) => {setBarcode(event.target.value); setSelected(null); setResult(null); setError('');}}/><button disabled={busy || !barcode.trim()}>Look up</button></div>
      </form>
      <div aria-live="polite">{busy && <p className="fuel-scan-status">Finding your food…</p>}{error && <p role="alert" className="fuel-scan-error">{error}</p>}</div>
      {result && !selected && <div className="fuel-scan-results">
        <p>{result.message}</p>
        {result.products.length > 0 && <><h3>Which package do you have?</h3><p>Compare the brand, serving, and ingredients before choosing.</p>{result.products.map((product) => <button className="fuel-product-choice" key={product.id} onClick={() => {setSelected(product); setQuantity('1');}}><strong>{product.name}</strong><span>{product.brand || 'Brand not listed'} · {product.serving.label || 'Serving not listed'}</span><small>{product.source.updatedAt ? `Source updated ${product.source.updatedAt.slice(0,10)}` : 'Update date unavailable'}</small></button>)}</>}
      </div>}
      {selected && <section className="fuel-product-review" aria-label="Review food product">
        <span className="fuel-product-eyebrow"><CircleDot size={15}/>{selected.verification === 'user-confirmed' ? 'Your confirmed label' : 'USDA food record'}</span>
        <h3>{selected.name}</h3><p>{selected.brand || 'Brand not listed'}</p>
        <p><strong>Serving:</strong> {selected.serving.label || 'Not provided'}{selected.serving.amount ? ` (${selected.serving.amount} ${selected.serving.unit})` : ''}</p>
        <div className="fuel-product-macros">{(['calories','protein','carbs','fat'] as const).map((key) => <div key={key}><strong>{selected.nutrition[key] ?? '—'}{key === 'calories' ? '' : 'g'}</strong><span>{key}</span></div>)}</div>
        <p className="fuel-product-basis">Values per {selected.basis === 'serving' ? 'serving' : selected.basis === '100g' ? '100 grams' : '100 milliliters'}. A dash means unknown.</p>
        {selected.ingredients && <details><summary>Ingredients</summary><p>{selected.ingredients}</p></details>}
        {selected.source.url?.startsWith('https://') && <a className="fuel-product-source" href={selected.source.url} target="_blank" rel="noopener noreferrer">View nutrition source <ExternalLink size={13}/></a>}
        <small>Retrieved {new Date(selected.source.fetchedAt).toLocaleDateString()}{selected.source.updatedAt ? ` · Updated ${selected.source.updatedAt.slice(0,10)}` : ''}</small>
        {!onSelect&&<label className="fuel-scan-quantity">Number of servings<input aria-label="Number of servings" type="number" min="0.01" max="1000" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)}/></label>}
        {!onSelect && perServing && validQuantity && <p className="fuel-product-total">{Math.round(perServing.calories * count)} cal · {Math.round(perServing.protein * count * 10)/10}g protein for {count} serving{count === 1 ? '' : 's'}</p>}
        {!perServing && <p className="fuel-scan-error">Some nutrition or serving information is missing. Confirm the package label before logging this as food eaten.</p>}
        {onSelect?<div className="fuel-product-actions"><button onClick={()=>{stopCamera();onSelect(selected);}}>Review this receipt match</button></div>:<div className="fuel-product-actions"><button disabled={!validQuantity} onClick={() => commit('grocery')}><ShoppingBasket size={17}/>Add to groceries</button><button disabled={!validQuantity || !perServing} onClick={() => commit('meal')}><Utensils size={17}/>Log what I ate</button></div>}
        <p className="fuel-scan-footnote">{onSelect?'Next, confirm the purchased quantity. This does not create a second purchase.':'Adding groceries does not add calories to your day.'}</p>
        {result && result.products.length > 1 && <button className="fuel-label-link" onClick={() => setSelected(null)}>Choose another package</button>}
      </section>}
      {validCode && !busy && <button className="fuel-label-link" onClick={() => {stopCamera(); onLabel(validCode);}}>{selected ? 'Label looks different? Add your correction' : 'Use a nutrition label instead'}</button>}
    </div>
  </Modal>;
}
