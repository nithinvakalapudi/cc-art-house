import {AlertRoot,AlertContent,AlertTitle,AlertDescription} from '@flowstack-ui/brick/alert';
import {Button} from '@flowstack-ui/brick/button';
import {Container} from '@flowstack-ui/brick/container';
import {EmptyState} from '@flowstack-ui/brick/empty-state';
import {Grid} from '@flowstack-ui/brick/grid';
import {VStack} from '@flowstack-ui/brick/stack';
import {Eyebrow,Heading,Paragraph} from '@flowstack-ui/brick/text';
import {Section} from '@flowstack-ui/brick/section';
import ProductCard from '@/components/product-card';
import {getCatalogue} from '@/lib/data';
import ShopFilters from './shop-filters';
import {getSiteSettings} from '@/lib/site-settings';
export const dynamic='force-dynamic';

export default async function Shop({searchParams}:{searchParams:Promise<{category?:string;q?:string;sort?:string}>}){
  const params=await searchParams;const [{products,categories,error},settings]=await Promise.all([getCatalogue(),getSiteSettings()]);
  let shown=products.filter(p=>(!params.category||categories.find(c=>c.id===p.category_id)?.slug===params.category)&&(!params.q||p.title.toLowerCase().includes(params.q.toLowerCase())));
  if(params.sort==='price-low')shown=[...shown].sort((a,b)=>(Number(a.price)===0?Infinity:Number(a.price))-(Number(b.price)===0?Infinity:Number(b.price)));
  if(params.sort==='price-high')shown=[...shown].sort((a,b)=>(Number(b.price)===0?-1:Number(b.price))-(Number(a.price)===0?-1:Number(a.price)));
  return <>
    <Section spacing="lg" className="shop-intro"><Container><VStack gap={3}><Eyebrow tone="accent">THE COLLECTION</Eyebrow><Heading level={1} variant="display-md">{settings.shop_title}</Heading><Paragraph variant="body-lg" tone="secondary">{settings.shop_description}</Paragraph></VStack></Container></Section>
    <Section spacing="lg"><Container><VStack gap={7}><ShopFilters categories={categories} params={params}/>
      {error&&<AlertRoot status="info" variant="soft" role="status"><AlertContent><AlertTitle>The catalogue is taking a moment to load</AlertTitle><AlertDescription>Please try again shortly, or explore custom artwork in the meantime.</AlertDescription></AlertContent></AlertRoot>}
      <div className="shop-result-heading"><Heading level={2} variant="title-sm">All paintings</Heading><span>{shown.length} {shown.length===1?'piece':'pieces'}</span></div>
      <Grid.Root columns={{initial:1,sm:2,lg:3}} gap={5}>{shown.length?shown.map(p=><ProductCard product={p} key={p.id}/>):<EmptyState.Root align="start" className="shop-empty"><EmptyState.Content><VStack gap={2}><EmptyState.Title as="h3">{params.q||params.category?'No paintings match these filters':'Original paintings are on their way'}</EmptyState.Title><EmptyState.Description>{params.q||params.category?'Try a different search or category.':'The first collection will be shown here once it is published.'}</EmptyState.Description></VStack><Button href={params.q||params.category?'/shop':'/custom-art'} variant="outline" tone="accent">{params.q||params.category?'Clear filters':'Explore custom art'}</Button></EmptyState.Content></EmptyState.Root>}</Grid.Root>
    </VStack></Container></Section>
  </>;
}
