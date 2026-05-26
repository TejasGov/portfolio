export const blogPages = [
  {
    id: 'home',
    title: 'Welcome to TG DevSpace',
    emoji: '👋',
    subtitle: 'Code, Design, and Artificial Intelligence',
    intro: 'Hi there! I am Tejas Govind. Welcome to my personal sandbox and writing space. This blog window is a custom environment where I share my findings, project deep-dives, and academic experiences in Computer Science.',
    sections: [
      {
        title: 'Latest Updates',
        items: [
          { date: 'May 25, 2026', text: 'Optimized photography window images to WebP, saving 94% page load size! The site now loads instantly and is buttery smooth.' },
          { date: 'May 10, 2026', text: 'Finished implementing the 3D Artist Galaxy view inside the music player window using React Three Fiber. Check it out!' },
          { date: 'April 28, 2026', text: 'Wrote an in-depth guide on porting YOLOv8 models to ONNX and running them in the web browser.' }
        ]
      },
      {
        title: 'Writing Focus',
        paragraphs: [
          'Here you will find articles about cutting-edge front-end engineering, custom UI animations, machine learning experiments, and college reflections.',
          'Click the "Article View" switcher in the window title bar above to browse and read full-length articles!'
        ]
      }
    ]
  },
  {
    id: 'about',
    title: 'About the Blog',
    emoji: '✍️',
    subtitle: 'Behind the Scenes & Stack',
    intro: 'Why build a custom OS-style portfolio with a blog window? Because standard portfolios are static, and web browsers are capable of running fully active application ecosystems.',
    sections: [
      {
        title: 'The Stack',
        paragraphs: [
          'This blog is fully integrated into my custom portfolio. It uses React 18 for layout, Framer Motion for window dragging and page transition physics, and vanilla CSS variables to support seamless light/dark theme switching.',
          'Unlike traditional Markdown sites, articles here are represented in a structured JSON schema, which makes it easy to render custom React interactive nodes, live code snippets, and custom widgets directly inside the reader.'
        ]
      },
      {
        title: 'Academic Context',
        paragraphs: [
          'I am currently a Computer Science student at the University at Buffalo (Class of 2027). This space serves as an extension of my learning, allowing me to take theoretical concepts from coursework (like algorithms and system design) and build them into interactive web visualizers.'
        ]
      }
    ]
  },
  {
    id: 'newsletter',
    title: 'TG Tech Bytes',
    emoji: '✉️',
    subtitle: 'Subscribe to my newsletter',
    intro: 'Get occasional summaries of my newest articles, project releases, and web experimentations sent straight to your inbox. No spam, just pure code, ML, and design.',
    formDetails: {
      placeholder: 'Enter your email address',
      buttonText: 'Subscribe',
      successMessage: 'Awesome! Thank you for subscribing. You are now on the list!'
    }
  }
];

export const blogArticles = [
  {
    id: 'ios-portfolio',
    title: 'Building a React-based iOS Portfolio: Lessons in Animation and Performance',
    summary: 'A deep dive into how I built this macOS/iOS desktop portfolio, featuring fluid window dragging, spring physics, and heavy asset optimizations.',
    date: 'May 20, 2026',
    readTime: '6 min read',
    category: 'Web Dev',
    color: '#0A84FF',
    emoji: '📱',
    author: 'Tejas Govind',
    content: [
      { type: 'p', text: 'Building a desktop-like environment inside a standard web browser comes with unique challenges. Users expect standard operating system behaviors: windows should drag smoothly, they should overlap correctly based on focus, and they should scale dynamically depending on the screen size.' },
      { type: 'h2', text: 'Managing Z-Index and Focus' },
      { type: 'p', text: 'To coordinate which window is currently in focus, I implemented a simple active windows array in the global React App state. When a user clicks a window, that window is appended to the end of the array, and its z-index is dynamically computed based on its index:' },
      {
        type: 'code',
        lang: 'javascript',
        code: `const toggleWindow = (id) => {
  setActiveWindows(prev => {
    // Remove if already present, then append to end to bring to front
    const filtered = prev.filter(wId => wId !== id);
    return [...filtered, id];
  });
};`
      },
      { type: 'h2', text: 'Optimizing the Main Thread' },
      { type: 'p', text: 'A major issue arose when loading high-resolution assets in windows like the Photography Gallery. The app loaded twenty-two 3MB-5MB images directly, causing the main thread to freeze and drop frames during transitions. To fix this, I wrote a custom Node.js script utilizing Sharp to resize images to a maximum width of 1200px and compress them into WebP format at 75% quality. This reduced the total image asset size from 55MB to just 3.4MB (a 94% saving!), restoring buttery smooth 60fps animations.' }
    ]
  },
  {
    id: 'yolov8-web',
    title: 'Real-time Object Detection with YOLOv8 on Web Browsers',
    summary: 'How to convert PyTorch-trained YOLOv8 models into ONNX models and run them client-side in the browser using WebGL acceleration.',
    date: 'May 05, 2026',
    readTime: '8 min read',
    category: 'AI & Vision',
    color: '#30D158',
    emoji: '🔍',
    author: 'Tejas Govind',
    content: [
      { type: 'p', text: 'Traditionally, running heavy deep learning models like YOLOv8 required server-side hardware or APIs. However, with modern browser features like WebAssembly and WebGL, we can execute real-time computer vision models directly in the client browser. This eliminates hosting costs and ensures user data privacy.' },
      { type: 'h2', text: 'Step 1: Exporting YOLOv8 to ONNX format' },
      { type: 'p', text: 'First, we train our model using PyTorch, then export it to the Open Neural Network Exchange (ONNX) format using the ultralytics CLI. We specify the image width/height constraints and use half-precision (float16) to minimize the file size:' },
      {
        type: 'code',
        lang: 'bash',
        code: `# Export YOLOv8 model to ONNX format
yolo export model=yolov8n.pt format=onnx imgsz=640 half=True`
      },
      { type: 'h2', text: 'Step 2: Loading model in React with ONNX Runtime Web' },
      { type: 'p', text: 'Next, we install "onnxruntime-web" and set up an HTML5 canvas to capture frames from the user webcam, preprocess the image tensor, run inference, and draw bounding boxes:' },
      {
        type: 'code',
        lang: 'javascript',
        code: `import * as ort from 'onnxruntime-web';

async function loadModel() {
  // Use WebGL execution provider for GPU acceleration
  const session = await ort.InferenceSession.create(
    '/models/yolov8n.onnx',
    { executionProviders: ['webgl'] }
  );
  return session;
}`
      },
      { type: 'p', text: 'By offloading bounding box computations to the GPU via WebGL, we can achieve 20-30 FPS on average laptops, rendering annotations in real time directly on the screen!' }
    ]
  },
  {
    id: 'ub-cs',
    title: 'Transitioning to Computer Science at UB: Life in Buffalo',
    summary: 'Reflections on my academic journey at the University at Buffalo, campus projects, and finding the balance between class projects and side apps.',
    date: 'April 15, 2026',
    readTime: '4 min read',
    category: 'Student Life',
    color: '#BF5AF2',
    emoji: '🎓',
    author: 'Tejas Govind',
    content: [
      { type: 'p', text: 'As a Computer Science student at the University at Buffalo, class projects are highly focused on foundational computer engineering. While building parsers in C and multi-threaded systems in C++ teaches you deep system mechanics, it doesn\'t always satisfy the urge to design beautiful client-facing products.' },
      { type: 'h2', text: 'Balancing Academics and Side Projects' },
      { type: 'p', text: 'I started building custom web applications and interactive systems as a way to apply theoretical software design patterns to concrete products. Features like this portfolio\'s terminal window, folder layouts, and window stacking are designed using object-oriented abstractions that I learned in lecture.' },
      { type: 'h2', text: 'Campus Involvement' },
      { type: 'p', text: 'Beyond coursework, being involved in the campus developer community has been highly rewarding. Collaborating on mock hackathons, contributing to student newspapers like the UB Spectrum, and participating in peer mentoring helps build strong communication skills that are critical in software engineering.' }
    ]
  }
];
