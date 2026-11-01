import CustomArtForm from './request-form';

const steps = [
  { number: '01', title: 'Share your idea', copy: 'Tell us the subject, colours, size, and feeling you have in mind. Add reference images if they help.' },
  { number: '02', title: 'Receive your quote', copy: 'The artist reviews the size, detail, medium, references, and timeline to prepare a personal quotation.' },
  { number: '03', title: 'Confirm the details', copy: 'The studio reviews your request and confirms the final scope, timing, and payment terms with you.' },
  { number: '04', title: 'Follow the progress', copy: 'Once confirmed, your account shows the production status through completion and dispatch.' },
];

export default function CustomArt() {
  return <>
    <div className="page-header custom-art-header"><div className="eyebrow">MADE JUST FOR YOU</div><h1>Let’s make it personal.</h1><p>Start with a memory, a colour, or a corner of your home. We’ll help shape your idea into art.</p></div>
    <section className="custom-journey"><div className="craft-section-inner"><span className="craft-eyebrow">HOW IT WORKS</span><h2>From your idea to your wall</h2><div className="custom-journey-grid">{steps.map(step => <div key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.copy}</p></div>)}</div></div></section>
    <section className="content custom-request-section"><div className="custom-request-heading"><span className="craft-eyebrow">YOUR CUSTOM ART REQUEST</span><h2>Tell us what you imagine</h2><p>There are no confusing option lists. Describe what you want in your own words and the artist will prepare a personal quote.</p></div><CustomArtForm /></section>
  </>;
}
