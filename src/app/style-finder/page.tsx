import { serverDb } from '@/lib/supabase-server';
import StyleFinder from './style-finder';

export const dynamic = 'force-dynamic';

export default async function StyleFinderPage(){
  const db=await serverDb();
  const {data:products,error}=db
    ? await db.from('products').select('id,slug,title,image_url,price,original_price,palette,room_tags,available').eq('published',true).eq('archived',false).order('featured',{ascending:false}).order('created_at',{ascending:false})
    : {data:[],error:new Error('The catalogue is not connected.')};
  return <><div className="page-header"><p className="craft-eyebrow">A TWO MINUTE CURATION</p><h1>Find art for your space</h1><p>Tell us about the room and feeling you want. We’ll shortlist pieces from the live collection.</p></div><StyleFinder products={products||[]} unavailable={Boolean(error)}/></>;
}
