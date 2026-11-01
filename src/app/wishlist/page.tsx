import { getCatalogue } from '@/lib/data';
import { WishlistContents } from '@/components/wishlist';
export default async function WishlistPage(){const {products,error}=await getCatalogue();return <><div className="page-header"><p className="craft-eyebrow">YOUR PERSONAL COLLECTION</p><h1>Art you love.</h1><p>Keep your favourite pieces close while you find their perfect place.</p></div><div className="content">{error?<p role="alert">Your saved collection could not load. Please refresh shortly.</p>:<WishlistContents products={products}/>}</div></>;}
