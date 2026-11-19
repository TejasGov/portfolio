// The story, in order. Copy is a first draft in Tejas's voice (from aboutData); edit freely.
// `tone: 'dark'` flips the text to paper for dark colour fields.
export const chapters = [
  {
    id: 'boot',
    act: '0',
    label: 'Boot',
    field: 'var(--field-boot)',
    caption: 'sample 000 — the model, untrained',
    title: 'Tejas Govind',
    line: ['I find the problem first, then I can’t stop', 'building'],
    // No tableau: the name and the pixel field carry this screen; the orb arrives in act 1.
  },
  {
    id: 'hero',
    act: '1',
    label: 'The model',
    field: 'var(--field-hero)',
    caption: 'specimen — one human, CS @ UB, class of 2027',
    objects: ['orb'],
    title: 'Hello, model',
    line: ['I build for the messy, human corners most products', 'skip'],
    tableau: 'inked orb on a plinth',
  },
  {
    id: 'training',
    act: '2',
    label: 'Training data',
    field: 'var(--field-training)',
    caption: 'samples 001–003 — cricket ball · kulhad · film reel',
    // Scroll-morphs orb → ball → kulhad → reel, so it needs a longer runway than other acts.
    objects: ['orb', 'ball', 'kulhad', 'reel'],
    height: '340svh',
    title: 'Training data',
    line: ['Every model is what it was trained on. Mine was cricket, chai and', 'Bollywood'],
    tableau: 'orb with cricket ball, kulhad of chai, film reel',
  },
  {
    id: 'inference',
    act: '3',
    label: 'Inference',
    field: 'var(--field-inference)',
    tone: 'dark',
    accent: 'var(--field-interval)', // vermilion fails contrast on cobalt; mustard passes
    caption: 'outputs — CogniFlow · Revere · Smash Cricket · CineSearch · Socra',
    title: 'Inference',
    line: ['Give it a hard, human problem and it returns', 'something you can use'],
    tableau: 'one object per project, wheel to step',
  },
  {
    id: 'interval',
    act: '⏸',
    label: 'Interval',
    field: 'var(--field-interval)',
    caption: 'interval — 00:05, grab a chai',
    title: 'Interval',
    line: ['Trained on chai. Fine-tuned on iced vanilla', 'lattes'],
  },
  {
    id: 'checkpoints',
    act: '4',
    label: 'Checkpoints',
    field: 'var(--field-checkpoints)',
    caption: 'ckpt_2022 → ckpt_2026 — saved along the way',
    title: 'Checkpoints',
    line: ['Every role taught the model something it still', 'uses'],
    tableau: 'points line up into a rail of saved checkpoints',
  },
  {
    id: 'still',
    act: '5',
    label: 'Still training',
    field: 'var(--field-still)',
    caption: 'ongoing — photographs, records, books, films, one GOAT',
    title: 'Still training',
    line: ['Interstellar broke something open. It never', 'closed'],
    tableau: 'mosaic of frames resolving from pixels',
  },
  {
    id: 'deploy',
    act: '6',
    label: 'Deploy',
    field: 'var(--field-deploy)',
    tone: 'dark',
    caption: 'deployed: us-east-1 (NYC) · next region: us-west (SF)',
    title: 'Deploy',
    line: ['Have a messy, human problem? Let’s', 'talk'],
    tableau: 'NYC skyline above dark water, diyas drifting down',
  },
]

// Museum-tag captions for each still-life object, keyed like src/v2/three/objects.jsx.
export const sampleLabels = {
  orb: 'the model, untrained',
  ball: 'cricket ball, gully edition',
  kulhad: 'kulhad of chai, 4 p.m.',
  reel: 'film reel, Friday first show',
}

export const contact = {
  email: 'tejasgov2005@gmail.com',
  links: [
    { label: 'GitHub', href: 'https://github.com/TejasGov' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/tejas-govind-29520a2b2/' },
    { label: 'Instagram', href: 'https://www.instagram.com/tejasgovind_' },
    { label: 'X', href: 'https://x.com/TejasGovin17982' },
  ],
}
