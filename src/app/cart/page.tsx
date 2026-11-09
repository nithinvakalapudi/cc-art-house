import GuestDeliveryQuote from '@/components/guest-delivery-quote';
import { CartContents } from '@/components/cart-store';
export default function Cart(){return <><div className="page-header"><p className="craft-eyebrow">YOUR SELECTION</p><h1>Your cart</h1><p>Each original is one of a kind. Delivery will be confirmed by the studio.</p></div><div className="content cart-content"><GuestDeliveryQuote/><CartContents/></div></>}
