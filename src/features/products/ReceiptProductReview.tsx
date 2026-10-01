import { apiFetch } from "../../api-fetch";
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Search, ExternalLink, Check } from 'lucide-react'
import { Modal } from '../../components'
import type { GroceryItem } from '../../ai-contract'
import { nutritionForServing, type FoodProduct } from './contracts'
import { productSearchResultSchema, type ProductSearchResult } from './search-contract'
import './receipt-product.css'
import {packageServings} from './quantities'
const ProductScanner=lazy(()=>import('../scanner/ProductScanner'));

export type ReceiptProductReviewProps = { item: GroceryItem; onClose: () => void; onManual?:()=>void; onApply: (product: FoodProduct, servingsPurchased: number | null) => void }
const numberText = (value: number | null, unit: string) => value === null ? 'Unknown' : `${Math.round(value * 100) / 100}${unit}`
export default function ReceiptProductReview({ item, onClose, onManual, onApply }: ReceiptProductReviewProps) {
  const [query, setQuery] = useState((item.name || item.receiptText).slice(0, 160))
  const [result, setResult] = useState<ProductSearchResult | null>(()=>item.productCandidates?.length ? {status:'candidates',products:item.productCandidates,message:'Possible USDA matches from your receipt description. None has been selected. Check the brand, package and serving, or refine the search.'} : null)
  const [selected, setSelected] = useState<FoodProduct | null>(null)
  const [quantity, setQuantity] = useState('')
  const [packages,setPackages]=useState('')
  const [perPackage,setPerPackage]=useState('')
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [scanning,setScanning]=useState(false)
  const request = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const applied = useRef(false)
  useEffect(() => () => { generation.current++; request.current?.abort() }, [])
  const close = () => { generation.current++; request.current?.abort(); onClose() }
  const resetChoice = () => { setSelected(null); setChecked(false); setQuantity('');setPackages('');setPerPackage(''); applied.current = false }
  async function search() {
    if (query.trim().length < 2 || query.trim().length > 160) { setError('Enter at least two characters from the product name or brand.'); return }
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    const run = ++generation.current
    const timeout = setTimeout(() => controller.abort(), 22000)
    setBusy(true); setError(''); setResult(null); resetChoice()
    try {
      const response = await apiFetch('/api/products/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: query.trim() }), signal: controller.signal })
      const body: unknown = await response.json()
      if (run !== generation.current) return
      if (!response.ok) throw new Error(typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : 'Product search is unavailable. Please try again.')
      const parsed = productSearchResultSchema.safeParse(body)
      if (!parsed.success) throw new Error('Product search returned incomplete details. Please retry or check the package label.')
      setResult(parsed.data)
    } catch (cause) { if (run === generation.current) setError(controller.signal.aborted ? 'Product search took too long. Please try again.' : cause instanceof Error ? cause.message : 'Product search could not finish.') }
    finally { clearTimeout(timeout); if (run === generation.current) setBusy(false) }
  }
  const perServing = selected ? nutritionForServing(selected) : null
  const validQuantity = quantity.trim() === '' || (Number.isFinite(Number(quantity)) && Number(quantity) > 0 && Number(quantity) <= 10000)
  if(scanning)return <Suspense fallback={<Modal title="Scan this receipt item" onClose={()=>setScanning(false)}><p>Opening scanner…</p></Modal>}><ProductScanner onClose={()=>setScanning(false)} onProduct={()=>{}} onLabel={()=>{setScanning(false);if(onManual)onManual();else setError('Use the package label to edit this item if USDA has no matching product. Choose Keep current details, then Edit details.');}} onSelect={product=>{setScanning(false);setSelected(product);setResult({status:'candidates',products:[product],message:'Barcode matched. Check the label and total servings purchased before saving.'});setQuantity('');setChecked(false);applied.current=false;}}/></Suspense>
  return <Modal title="Find this receipt item" onClose={close}>
    <div className="receipt-product-review">
      <div className="receipt-original"><span>On your receipt</span><strong>{item.receiptText || item.name}</strong><small>{item.quantity}</small></div>
      <p>Receipt names are often shortened. Search with the full product name or brand, then compare your package.</p>
      <button className="button secondary" disabled={busy} onClick={()=>setScanning(true)}>Scan this package barcode</button>
      {onManual&&<button className="button secondary" onClick={()=>{generation.current++;request.current?.abort();onManual();}}>Enter package details manually</button>}
      <form className="receipt-product-search" onSubmit={event => { event.preventDefault(); void search() }}>
        <label>Product name or receipt description<input value={query} maxLength={160} onChange={event => { setQuery(event.target.value); setResult(null); resetChoice(); generation.current++; request.current?.abort(); setBusy(false) }} /></label>
        <button type="submit" className="primary-button" disabled={busy || query.trim().length < 2}><Search size={17} /> {busy ? 'Searching…' : 'Search USDA'}</button>
      </form>
      {busy && <p role="status">Looking for possible products in USDA…</p>}
      {error && <p role="alert" className="receipt-product-notice">{error}</p>}
      {result && <p className="receipt-product-notice" role="status">{result.message}</p>}
      {result && result.products.length > 0 && <fieldset className="receipt-product-options"><legend>Choose a possible product</legend>{result.products.map(product => <label className={`receipt-product-option ${selected?.id === product.id ? 'selected' : ''}`} key={product.id}>
        <input type="radio" name="receipt-product" value={product.id} checked={selected?.id === product.id} onChange={() => { setSelected(product); setQuantity(''); setChecked(false); applied.current = false }} />
        <span><strong>{product.name}</strong><small>{product.brand || 'Brand unavailable'}</small><small>{product.serving.label} · {product.basis === 'serving' ? 'Nutrition per serving' : `Nutrition per ${product.basis === '100g' ? '100 g' : '100 mL'}`}</small><small>{numberText(product.nutrition.calories, ' kcal')} · Protein {numberText(product.nutrition.protein, ' g')}</small></span>
      </label>)}</fieldset>}
      {selected && <section className="receipt-product-details" aria-label="Review selected product">
        <h3>{selected.name}</h3><p>{selected.brand || 'Brand unavailable'}</p><p>Barcode {selected.gtin}</p>
        <p><strong>{selected.serving.label}</strong></p>
        <p className="receipt-product-basis">{selected.basis === 'serving' ? 'Values per labeled serving' : `Values per ${selected.basis === '100g' ? '100 grams' : '100 milliliters'}`}</p>
        <dl>{(['calories', 'protein', 'carbs', 'fat'] as const).map(key => <div key={key}><dt>{key === 'calories' ? 'Calories' : key[0].toUpperCase() + key.slice(1)}</dt><dd>{numberText(selected.nutrition[key], key === 'calories' ? ' kcal' : ' g')}</dd></div>)}</dl>
        {selected.basis !== 'serving' && perServing && <p className="receipt-product-converted">For one labeled serving: <strong>{numberText(perServing.calories, ' kcal')}</strong> · {numberText(perServing.protein, ' g')} protein · {numberText(perServing.carbs, ' g')} carbs · {numberText(perServing.fat, ' g')} fat.</p>}
        {!perServing && <p className="receipt-product-notice">Some nutrition or serving details are missing. This item will still need review; missing values won’t become zero.</p>}
        {selected.source.url?.startsWith('https://fdc.nal.usda.gov/') && <a href={selected.source.url} target="_blank" rel="noopener noreferrer">View USDA source <ExternalLink size={14} /></a>}
        {selected.ingredients && <details><summary>Ingredients</summary><p>{selected.ingredients}</p></details>}
        <label className="receipt-product-quantity">Total labeled servings purchased<input type="number" min="0.01" max="10000" step="any" value={quantity} onChange={event => { setQuantity(event.target.value); setChecked(false) }} placeholder="Leave blank if unknown" /></label>
        <small>Count servings across the whole purchase, not packages. Leave blank if you haven’t checked; the old quantity won’t be assumed.</small>
        <details><summary>Calculate servings from packages</summary><p>Read servings per container from the label. For example, 2 packages × 5 servings = 10 labeled servings.</p><label>Packages purchased<input type="number" min="0.01" step="any" value={packages} onChange={event=>setPackages(event.target.value)}/></label><label>Servings per package<input type="number" min="0.01" step="any" value={perPackage} onChange={event=>setPerPackage(event.target.value)}/></label><button type="button" disabled={packageServings(packages,perPackage)===null} onClick={()=>{const total=packageServings(packages,perPackage);if(total!==null){setQuantity(String(total));setChecked(false);}}}>Use calculated total{packageServings(packages,perPackage)!==null?`: ${packageServings(packages,perPackage)} servings`:''}</button></details>
        {!validQuantity && <p role="alert">Enter a positive number up to 10,000, or leave it blank.</p>}
        <label className="receipt-product-confirm"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} /><span>I checked the product, serving and purchased amount against my package.</span></label>
        <button className="primary-button" disabled={!checked || !validQuantity || busy} onClick={() => {
          if (!checked || !validQuantity || applied.current) return
          applied.current = true; setError('')
          try { onApply(selected, quantity.trim() === '' ? null : Number(quantity)) }
          catch (cause) { applied.current = false; setError(cause instanceof Error ? cause.message : 'These product details could not be applied. Please check the serving and try again.') }
        }}><Check size={17} /> Use this product</button>
        <small>This updates the grocery item. It does not log food as eaten.</small>
      </section>}
      <button className="text-button receipt-product-cancel" onClick={close}>Keep current details</button>
    </div>
  </Modal>
}
