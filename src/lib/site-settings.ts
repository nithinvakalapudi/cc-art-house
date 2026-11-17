import { unstable_cache } from 'next/cache';
import { publicDb } from './data';

export const settingDefaults = {
  site_name:'CC Art Works',site_tagline:'You imagine. We create by hand.',announcement_text:'HANDMADE PAINTINGS ✦ PERSONAL ART ✦ MEANINGFUL GIFTS',contact_strip_text:'Made with care, made for your story',seo_title:'CC Art Works | Handmade paintings',seo_description:'Original handmade paintings and custom artwork for meaningful spaces.',
  hero_eyebrow:'THE ART OF MAKING IT PERSONAL',hero_title:'Art that feels',hero_accent:'like you.',hero_description:'Handmade paintings for the corners you love, the people you cherish, and the stories worth keeping.',hero_image_url:'/artist-gallery/traditional-portrait-optimized.webp',
  featured_title:'Paintings to fall in love with',featured_description:'Discover original art made to bring a little more colour into every day.',shop_title:'Find art that feels like home.',shop_description:'One-of-a-kind paintings, patiently made to bring warmth and character to your space.',
  about_title:'Art made with feeling.',about_intro:'From detailed mandalas to personal keepsakes, each piece starts with the joy of making something meaningful by hand.',about_story_title:'One idea can become something you keep forever.',about_story:'CC Art Works brings handmade paintings, mandalas, traditional art, and custom pieces together in one place.',
  contact_heading:'Contact us.',contact_intro:'Have a painting in mind, or just a question? We would love to hear from you.',contact_address:'Kundalahalli Gate, Bengaluru, Karnataka',contact_email:'ccarthouseofficial@gmail.com',contact_phone:'',whatsapp_number:'',instagram_handle:'@artworksof_cctwinzz',instagram_url:'https://www.instagram.com/artworksof_cctwinzz/',map_query:'Kundalahalli Gate, Bengaluru',
  home_label:'Home',nav_shop_label:'Shop paintings',nav_gallery_label:'Artist gallery',nav_style_label:'Style finder',nav_custom_label:'Custom artwork',nav_about_label:'Our story',nav_contact_label:'Contact',
  footer_explore_title:'Explore',footer_help_title:'Need help?',footer_account_title:'Your account',footer_copyright_line:'Handmade with care.',footer_link_1_label:'Frequently asked questions',footer_link_1_url:'/faq',footer_link_2_label:'Store policies',footer_link_2_url:'/policies',footer_link_3_label:'',footer_link_3_url:'',faq:'',policies:'',
  show_gallery:'true',show_style_finder:'true',show_about:'true',show_contact:'true',gallery_auto_seconds:'5',gallery_curator_default:'false',
} as const;
export type SiteSettingKey=keyof typeof settingDefaults;

const cached=unstable_cache(async()=>{const db=publicDb();if(!db)return settingDefaults;const{data,error}=await db.from('site_settings').select('key,value');if(error)return settingDefaults;return {...settingDefaults,...Object.fromEntries((data||[]).map(row=>[row.key,row.value]))}},['site-settings'],{tags:['site-settings'],revalidate:300});
export function normalizeLegacyBrand(settings:Record<string,string>):Record<string,string>{
  const normalized={...settings};
  if(['the art house','cc art house'].includes(normalized.site_name.trim().toLowerCase())) normalized.site_name='CC Art Works';
  if(['the art house | handmade paintings','cc art house | handmade paintings'].includes(normalized.seo_title.trim().toLowerCase())) normalized.seo_title='CC Art Works | Handmade paintings';
  if(normalized.about_story==='The Art House brings handmade paintings, mandalas, traditional art, and custom pieces together in one place.') normalized.about_story='CC Art Works brings handmade paintings, mandalas, traditional art, and custom pieces together in one place.';
  return normalized;
}
export async function getSiteSettings(){return normalizeLegacyBrand(await cached())}
export const settingOn=(value:string)=>value==='true';
