const icon = (file, label) => ({ src: `/tech-icons/${file}.svg`, label });

export const technologies = {
  Python: icon('python', 'Python'), OpenCV: icon('opencv', 'OpenCV'), MediaPipe: icon('mediapipe', 'MediaPipe'),
  NumPy: icon('numpy', 'NumPy'), Flask: icon('flask', 'Flask'), TypeScript: icon('typescript', 'TypeScript'),
  React: icon('react', 'React'), Vercel: icon('vercel', 'Vercel'), 'LLaMA-3': icon('meta', 'Llama 3'),
  YOLOv8: icon('ultralytics', 'YOLOv8'), XGBoost: icon('xgboost', 'XGBoost'), 'Google Cloud': icon('googlecloud', 'Google Cloud'),
  FastAPI: icon('fastapi', 'FastAPI'), 'Gemini 2.0 Flash': icon('googlegemini', 'Gemini'),
  'Raspberry Pi': icon('raspberrypi', 'Raspberry Pi'), NextJS: icon('nextdotjs', 'Next.js'), 'Next.js': icon('nextdotjs', 'Next.js'),
  GSAP: icon('gsap', 'GSAP'), WebGL: icon('webgl', 'WebGL'), 'Three.js': icon('threedotjs', 'Three.js'),
  Rapier: icon('rapier', 'Rapier'), Vite: icon('vite', 'Vite'), Express: icon('express', 'Express'),
  'Strands Agents': icon('strands', 'Strands Agents'), 'A2A SDK': icon('a2a', 'A2A SDK'), Zod: icon('zod', 'Zod'),
  'Tailwind CSS': icon('tailwindcss', 'Tailwind CSS'), Supabase: icon('supabase', 'Supabase'),
  'AI SDK': icon('vercel', 'AI SDK'), JavaScript: icon('javascript', 'JavaScript'),
  HTML: icon('html5', 'HTML'), HTML5: icon('html5', 'HTML'), CSS: icon('css', 'CSS'), Markdown: icon('markdown', 'Markdown'),
};
