import { WishlistButton } from './wishlist';
import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {Card} from '@flowstack-ui/brick/card';
import {HStack} from '@flowstack-ui/brick/stack';
import {ImageContent,ImageFallback,ImageRoot} from '@flowstack-ui/brick/image';
import { discountPercent, priceLabel, type Product } from '@/lib/data';

export default function ProductCard({product}:{product:Product}){
  const discount=discountPercent(product);
  return <Card.Root className="flow-product-card" size="sm">
    <ImageRoot src={product.image_url||undefined} ratio={0.84} fit="cover" className="flow-product-image">
      {product.image_url&&<ImageContent alt={product.title} width={600} height={720} loading="lazy" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"/>}
      <ImageFallback><span className="product-placeholder" aria-hidden="true">✺</span></ImageFallback>
    </ImageRoot>
    <Card.Header><HStack gap={2} justify="between" align="start"><Card.Title as="h3"><Link href={`/shop/${product.slug}`}>{product.title}</Link></Card.Title><ArrowUpRight size={18} aria-hidden="true"/></HStack><Card.Description>{product.medium||'Original artwork'} · {Number(product.price) === 0 ? 'Ask about availability' : product.available ? 'One available' : 'Sold'}</Card.Description></Card.Header>
    <Card.Content><div className="product-price-stack">{discount>0&&<span className="product-original-price" aria-label={`Original price ${priceLabel(product.original_price!)}`}>{priceLabel(product.original_price!)}</span>}<span className="flow-product-price">{priceLabel(product.price)}</span>{discount>0&&<span className="product-discount-badge">{discount}% OFF</span>}</div><WishlistButton id={product.id}/></Card.Content>
  </Card.Root>;
}
