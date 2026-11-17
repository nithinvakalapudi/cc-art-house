'use client';
import Image from 'next/image';

import Link from 'next/link';
import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Trash2 } from 'lucide-react';

export type CartItem = { id: string; slug: string; title: string; price: number; image_url: string | null; quantity: number };
type CartContextValue = { items: CartItem[]; add: (item: Omit<CartItem, 'quantity'>) => void; remove: (id: string) => void; clear: () => void };
const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'art-house-cart-v1';
const EMPTY_CART: CartItem[] = [];
let cartSnapshot: CartItem[] = [];
let cartInitialized = false;
const cartListeners = new Set<() => void>();

function publishCart(items: CartItem[]) {
  cartSnapshot = items;
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  cartListeners.forEach(listener => listener());
}
function initializeCart() {
  if (cartInitialized || typeof window === 'undefined') return;
  cartInitialized = true;
  try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); if (Array.isArray(parsed)) cartSnapshot = parsed; }
  catch { localStorage.removeItem(STORAGE_KEY); }
}
function subscribeCart(listener: () => void) { cartListeners.add(listener); initializeCart(); listener(); return () => { cartListeners.delete(listener); }; }
function getCartSnapshot() { return cartSnapshot; }
function getServerCartSnapshot() { return EMPTY_CART; }

export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = useSyncExternalStore(subscribeCart, getCartSnapshot, getServerCartSnapshot);
  const add = useCallback((item: Omit<CartItem, 'quantity'>) => {
    const current = cartSnapshot;
    const existing = current.find(row => row.id === item.id);
    if (!existing) publishCart([...current, { ...item, quantity: 1 }]);
  }, []);
  const remove = useCallback((id: string) => publishCart(cartSnapshot.filter(row => row.id !== id)), []);
  const clear = useCallback(() => publishCart([]), []);
  const value = useMemo(() => ({ items, add, remove, clear }), [items, add, remove, clear]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() { const value = useContext(CartContext); if (!value) throw new Error('CartProvider is missing'); return value; }

export function AddToCartButton({ item, className = 'craft-button' }: { item: Omit<CartItem, 'quantity'>; className?: string }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  return <button type="button" className={className} onClick={() => { add(item); setAdded(true); window.setTimeout(() => setAdded(false), 1800); }}><ShoppingBag size={17} />{added ? 'Added to your cart' : 'Add to cart'}</button>;
}

export function CartCount() { const { items } = useCart(); const count = items.length; return <Link href="/cart" aria-label={`Shopping cart, ${count} items`} className="cart-count-link"><ShoppingBag size={19}/>{count > 0 && <span>{count}</span>}</Link>; }

export function CartContents() {
  const router = useRouter();
  const { items, remove } = useCart();
  const total = items.reduce((sum, item) => sum + Number(item.price), 0);
  if (!items.length) return <div className="empty-card">Your cart is waiting for a piece you love.<p><Link className="text-link" href="/shop">Browse paintings</Link></p></div>;
  return <div className="cart-layout"><section className="cart-items" aria-label="Items in your cart">{items.map(item => <article className="cart-item" key={item.id}>
    <Link href={`/shop/${item.slug}`} className="cart-item-image">{item.image_url ? <Image width={640} height={640} src={item.image_url} alt=""/> : <span aria-hidden="true">✳</span>}</Link>
    <div className="cart-item-info"><Link href={`/shop/${item.slug}`}><strong>{item.title}</strong></Link><span>₹{Number(item.price).toLocaleString('en-IN')}</span><span className="muted">One original painting</span></div>
    <button type="button" className="cart-remove" onClick={() => remove(item.id)} aria-label={`Remove ${item.title}`}><Trash2 size={17}/></button>
  </article>)}</section><aside className="cart-summary"><h2>Order summary</h2><div className="cart-summary-row"><span>Artwork ({items.reduce((n,i)=>n+i.quantity,0)} items)</span><strong>₹{total.toLocaleString('en-IN')}</strong></div><p>Delivery cost will be confirmed by the studio before dispatch.</p><button className="button primary cart-checkout-button" onClick={() => router.push('/cart/checkout')}>Continue to delivery details</button><Link className="cart-continue" href="/shop">Continue shopping</Link></aside></div>;
}
