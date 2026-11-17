import { getCatalogue } from '@/lib/data';
import StyleFinder from './style-finder';

export const revalidate = 300;

export default async function StyleFinderPage(){
  const {products,error}=await getCatalogue();
  return <><div className="page-header"><p className="craft-eyebrow">A TWO MINUTE CURATION</p><h1>Find art for your space</h1><p>Tell us about the room and feeling you want. We’ll shortlist pieces from the live collection.</p></div><StyleFinder products={products} unavailable={Boolean(error)}/></>;
}
