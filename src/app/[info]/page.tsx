import {notFound} from 'next/navigation';
import {getSiteSettings} from '@/lib/site-settings';
const names:{[key:string]:string}={faq:'Frequently asked questions',policies:'Policies'};
export default async function Info({params}:{params:Promise<{info:string}>}){const {info}=await params;if(!names[info])notFound();const settings=await getSiteSettings();const content=settings[info as 'faq'|'policies'];return <><div className="page-header"><h1>{names[info]}</h1></div><div className="content"><div className="panel" style={{whiteSpace:'pre-wrap',lineHeight:1.8}}>{content||'The studio is updating this page. Please contact us if you need help.'}</div></div></>}
