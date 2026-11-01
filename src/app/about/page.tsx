import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getSiteSettings } from '@/lib/site-settings';

export const metadata = { title: 'Our story | The Art House', description: 'Get to know the handmade art and custom work behind The Art House.' };

export default async function AboutPage() {
  const settings=await getSiteSettings();
  return <>
    <section className="studio-page-hero studio-about-hero"><div className="craft-section-inner"><span className="craft-eyebrow">OUR STORY</span><h1>{settings.about_title}</h1><p>{settings.about_intro}</p></div></section>
    <section className="studio-about-main"><div className="craft-section-inner studio-about-grid"><div className="studio-about-art"><img src={settings.hero_image_url} alt="Featured artwork from the studio"/><span>Handmade work from {settings.instagram_handle}</span></div><div className="studio-about-copy"><span className="craft-eyebrow">BEHIND THE WORK</span><h2>{settings.about_story_title}</h2><p>{settings.about_story}</p><p>Follow <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer">{settings.instagram_handle}</a> for studio updates.</p><Link className="craft-text-link" href="/gallery">Explore the artist gallery <ArrowRight size={17}/></Link></div></div></section>
    <section className="studio-about-values"><div className="craft-section-inner"><span className="craft-eyebrow">WHAT YOU’LL FIND HERE</span><div className="studio-about-values-grid"><div><span>01</span><h3>Made by hand</h3><p>Real brushwork, texture, detail, and the character of a piece made by a person.</p></div><div><span>02</span><h3>Many ways to tell a story</h3><p>Traditional themes, mandalas, portraits, and thoughtful gifts.</p></div><div><span>03</span><h3>Room for your idea</h3><p>Custom artwork begins with the colours, memories, and moments that matter to you.</p></div></div></div></section>
    <section className="studio-about-cta"><span className="craft-eyebrow">YOUR STORY, ON CANVAS</span><h2>What would you like to create?</h2><Link className="craft-button" href="/custom-art">Request custom artwork <ArrowRight size={17}/></Link></section>
  </>;
}
