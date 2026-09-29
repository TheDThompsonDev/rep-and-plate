import { useRef, useState } from 'react';
import { Camera, ImagePlus } from 'lucide-react';
import { Modal } from '../../components';
import { normalizeGTIN, productSchema, type FoodProduct } from '../products/contracts';
import '../scanner/scanner.css';

export type LabelCaptureProps = {
  gtin: string;
  onClose: () => void;
  onConfirm: (product: FoodProduct) => void;
  onExtract?: (imageDataUrl: string) => Promise<FoodProduct>;
};
const keys = ['calories', 'protein', 'carbs', 'fat'] as const;

async function labelPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > 12 * 1024 * 1024) throw new Error('Choose a photo smaller than 12 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const scale = Math.min(1, 2000 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This photo could not be opened.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}

export default function LabelCapture({gtin, onClose, onConfirm, onExtract}: LabelCaptureProps) {
  const [image, setImage] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [serving, setServing] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('g');
  const [basis, setBasis] = useState<FoodProduct['basis']>('serving');
  const [values, setValues] = useState<Record<typeof keys[number], string>>({calories:'',protein:'',carbs:'',fat:''});
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const locked = useRef(false);
  const committed = useRef(false);

  async function upload(photo: File | undefined) {
    if (!photo || locked.current) return;
    locked.current = true; setBusy(true); setError(''); setChecked(false); setNotice('');
    try {
      const data = await labelPhoto(photo); setImage(data);
      if (onExtract) {
        const product = productSchema.parse(await onExtract(data));
        setName(product.name); setBrand(product.brand); setIngredients(product.ingredients);
        setServing(product.serving.label); setAmount(product.serving.amount?.toString() ?? ''); setUnit(product.serving.unit || 'g'); setBasis(product.basis);
        setValues(Object.fromEntries(keys.map((key) => [key, product.nutrition[key]?.toString() ?? ''])) as typeof values);
        setNotice('Label read. Check every value against the photo, especially the serving and nutrition column.');
      } else setNotice('Enter the values printed on your package. Leave anything unreadable blank.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The label could not be read. You can enter its values below.'); }
    finally {locked.current = false; setBusy(false);}
  }
  function change() { setChecked(false); setError(''); }
  function save() {
    const barcode = normalizeGTIN(gtin);
    if (!checked || busy || committed.current) return;
    if (!barcode) {setError('Return to the scanner and check the barcode first.'); return;}
    const invalid = keys.some((key) => values[key] !== '' && (!Number.isFinite(Number(values[key])) || Number(values[key]) < 0 || Number(values[key]) > 20000));
    if (!name.trim() || !serving.trim() || invalid || (amount !== '' && (!Number.isFinite(Number(amount)) || Number(amount) <= 0))) {setError('Add the product name and serving, and check that the numbers are valid. Unknown nutrition can stay blank.'); return;}
    const now = new Date().toISOString();
    const product = productSchema.safeParse({id: `label-${barcode}`, gtin: barcode, name: name.trim(), brand: brand.trim(), ingredients: ingredients.trim(), serving: {label: serving.trim(), amount: amount ? Number(amount) : null, unit}, basis,
      nutrition: Object.fromEntries(keys.map((key) => [key, values[key].trim() === '' ? null : Number(values[key])])),
      source: {provider:'label',id:barcode,url:null,fetchedAt:now,updatedAt:now,release:null},verification:'user-confirmed',version:now});
    if (!product.success) {setError('Some details are too long or incomplete. Check the label fields.'); return;}
    committed.current = true; onConfirm(product.data);
  }

  return <Modal title="Check your nutrition label" onClose={onClose}>
    <div className="fuel-scanner fuel-label-capture">
      <p className="fuel-label-intro">Your package is the best reference. Confirm its details to remember this barcode for you.</p>
      <p className="fuel-label-code">Barcode {gtin}</p>
      <div className="fuel-scan-tools"><button type="button" disabled={busy} onClick={() => camera.current?.click()}><Camera size={18}/>Take a photo</button><button type="button" disabled={busy} onClick={() => file.current?.click()}><ImagePlus size={18}/>Upload label</button></div>
      <input ref={camera} hidden type="file" capture="environment" accept="image/*" aria-label="Take nutrition label photo" onChange={(event) => {void upload(event.target.files?.[0]); event.target.value = '';}}/>
      <input ref={file} hidden type="file" accept="image/*" aria-label="Upload nutrition label" onChange={(event) => {void upload(event.target.files?.[0]); event.target.value = '';}}/>
      {image && <a href={image} target="_blank" rel="noopener noreferrer" className="fuel-label-preview"><img src={image} alt="Your nutrition label for comparison"/><span>Open photo to check small print</span></a>}
      <div aria-live="polite">{busy && <p className="fuel-scan-status">Reading the label…</p>}{notice && <p className="fuel-scan-status">{notice}</p>}{error && <p className="fuel-scan-error" role="alert">{error}</p>}</div>
      <form onSubmit={(event) => {event.preventDefault(); save();}}>
        <fieldset disabled={busy} className="fuel-label-fields" onChange={change}>
          <legend>Package details</legend>
          <label>Product name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={300} required/></label>
          <label>Brand<input value={brand} onChange={(event) => setBrand(event.target.value)} maxLength={200}/></label>
          <label>Serving shown on label<input value={serving} onChange={(event) => setServing(event.target.value)} placeholder="e.g. 1 cup (240 mL)" maxLength={300} required/></label>
          <div className="fuel-label-pair"><label>Serving amount<input type="number" min="0.01" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Optional"/></label><label>Serving unit<select value={unit} onChange={(event) => setUnit(event.target.value)}>{!['g','ml','oz','fl oz','piece'].includes(unit) && <option value={unit}>{unit}</option>}<option value="g">grams</option><option value="ml">milliliters</option><option value="oz">ounces</option><option value="fl oz">fluid ounces</option><option value="piece">pieces</option></select></label></div>
          <label>Nutrition column<select value={basis} onChange={(event) => setBasis(event.target.value as FoodProduct['basis'])}><option value="serving">Per serving</option><option value="100g">Per 100 grams</option><option value="100ml">Per 100 milliliters</option></select></label>
          <p className="fuel-scan-footnote">Enter calories in kcal, not kJ. Match one column on the label. Leave unreadable values blank; zero means the label says zero.</p>
          <div className="fuel-label-pair">{keys.map((key) => <label key={key}>{key === 'calories' ? 'Calories (kcal)' : `${key[0].toUpperCase()}${key.slice(1)} (g)`}<input type="number" min="0" max="20000" step="any" value={values[key]} placeholder="Unknown" onChange={(event) => setValues({...values, [key]: event.target.value})}/></label>)}</div>
          <label>Ingredients<textarea value={ingredients} onChange={(event) => setIngredients(event.target.value)} maxLength={12000} rows={3}/></label>
        </fieldset>
        <label className="fuel-label-confirm"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} disabled={busy}/><span>I checked this product, serving, and nutrition against my package.</span></label>
        <button className="fuel-label-save" disabled={!checked || busy}>Save my label</button>
      </form>
      <p className="fuel-scan-footnote">Saved privately on this device. This does not add groceries or log a meal.</p>
    </div>
  </Modal>;
}
