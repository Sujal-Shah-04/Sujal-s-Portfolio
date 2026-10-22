// All portfolio content lives here (from Sujal's CV) — edit this file to update the site.

export const PROFILE = {
  name: 'Sujal Shah',
  first: 'Sujal',
  role: 'AI / ML Engineer',
  line: 'I train models and ship them.',
  city: 'Kolhapur',
  country: 'India',
  email: 'shahsujal618@gmail.com',
  githubUser: 'Sujal-Shah-04',
  github: 'https://github.com/Sujal-Shah-04',
  linkedinUser: 'sujal-shah-ai',
  linkedin: 'https://linkedin.com/in/sujal-shah-ai',
  cv: 'Sujal-Shah-Resume.pdf',
  summary:
    'Final-year B.Tech student in AI & Machine Learning, specialising in computer vision, model deployment and cloud-scale ML infrastructure. I ship production CNN classifiers behind FastAPI and contribute R&D on satellite-imagery encroachment detection and RAG document intelligence.',
  seeking: 'Looking for an AI/ML Engineer role building data-driven ML systems end to end.',
};

export const EMAILJS = {
  publicKey: 'bwqvaPQiteOihXm8V',
  serviceId: 'service_yt6sfjc',
  templateId: 'template_dhsz9jy',
};

export const SECTIONS = [
  { key: 'projects', num: '01', title: 'Projects', prop: 'the monitor' },
  { key: 'experience', num: '02', title: 'Experience', prop: 'the pinboard' },
  { key: 'about', num: '03', title: 'About', prop: 'the TV' },
  { key: 'contact', num: '04', title: 'Contact', prop: 'the phone' },
];

// `poster` picks the illustration drawn on a tile until a real screenshot exists.
// To use a screenshot: put it in public/projects/ and set e.g. image: 'projects/tender-rag.png'.
// `url` (optional) is the live site, shown running inside the project's window.
export const PROJECTS = [
  {
    slug: 'tender-rag',
    ws: 'rag', // short name on the desktop's workspace bar
    name: 'Tender RAG',
    full: 'RAG AI Model — Civil Tender Document Intelligence',
    pitch: 'Tender analysis in minutes, not hours.',
    when: '2025 – Present',
    poster: 'rag',
    url: 'https://promptivo.live',
    built: [
      'Built the PDF-parsing and vector-embedding ingestion pipeline powering a RAG platform that cuts tender analysis from hours to minutes.',
      'Implemented the contradiction-detector and synopsis-generator modules, served through FastAPI for end-to-end procurement intelligence.',
    ],
    stack: ['Python', 'LangChain', 'RAG', 'LLM', 'FastAPI', 'PDF Parsing', 'Vector Embeddings'],
  },
  {
    slug: 'encroachment',
    ws: 'orbit',
    name: 'Encroachment AI',
    full: 'Imagery-Based Unauthorised Construction Detection System',
    pitch: 'Spotting illegal construction from orbit.',
    when: '2025 – Present',
    poster: 'sat',
    built: [
      'Built the 3-model detection ensemble (YOLOv8 + SAR/NDVI-NDBI fusion) targeting ~95% accuracy and under 4% false positives on pipeline encroachment detection.',
      'Used QGIS for geospatial analysis and validation, and served detections through a FastAPI backend for the alert dashboard.',
    ],
    stack: ['Python', 'YOLOv8', 'Sentinel-1/2', 'SAR', 'PostGIS', 'NDVI/NDBI', 'FastAPI'],
  },
  {
    slug: 'xai-care',
    ws: 'xai',
    name: 'XAI-Care',
    full: 'XAI-Care: Explainable Multimodal AI for Elderly Assistance',
    pitch: 'Fall alerts caregivers can understand.',
    when: '2025 – Present',
    poster: 'xai',
    built: [
      'Built the FastAPI backend delivering sub-second fall-detection alerts from fused wearable-sensor and camera data.',
      'Integrated Grad-CAM and SHAP explainability into the real-time inference pipeline for non-technical caregivers.',
    ],
    stack: ['Python', 'TensorFlow', 'FastAPI', 'Grad-CAM', 'SHAP', 'Wearable Sensors'],
  },
  {
    slug: 'plant-doctor',
    ws: 'plant',
    name: 'Plant Doctor',
    full: 'AI Plant Disease Detection System',
    pitch: '38 diseases, 92% accurate, works offline.',
    when: '2026 – Present',
    poster: 'leaf',
    built: [
      'Designed the CNN architecture and data-augmentation strategy behind a 92%-accuracy, 38-class classifier trained on a 50K-image dataset.',
      'Deployed Grad-CAM–explained predictions via Flutter for rural, offline use.',
    ],
    stack: ['Python', 'TensorFlow', 'CNN', 'Flutter', 'Grad-CAM', 'Data Augmentation'],
  },
  {
    slug: 'pos',
    ws: 'pos',
    name: 'Offline POS',
    full: 'Restaurant POS System (Offline-First)',
    pitch: 'A restaurant till that never needs Wi-Fi.',
    when: '2026 – Present',
    poster: 'pos',
    built: [
      'Built the backend for real-time order tracking and role-based access (Admin/Staff) on a fully offline POS system.',
      'Built the analytics engine surfacing daily revenue and peak-hour trends.',
    ],
    stack: ['Flutter', 'FastAPI', 'SQLite', 'JWT Authentication'],
  },
  {
    slug: 'water-survey',
    ws: 'water',
    name: 'Water Survey',
    full: 'Water Survey — Flutter Field Application',
    pitch: 'Meter readings captured offline, synced later.',
    when: '2025',
    poster: 'water',
    built: [
      'Designed the UX and form-validation flows for non-technical field staff capturing water connection data and meter readings offline.',
      'Built structured data export for municipal workflows and auto-sync on network availability.',
    ],
    stack: ['Flutter', 'SQLite', 'REST API', 'Offline-First Architecture'],
  },
];

// The lanyard badges hanging on the pegboard, in order. Click a badge to flip it.
export const BADGES = [
  {
    org: 'Endureva Innovations',
    short: 'Endureva',
    color: '#a3002a',
    role: 'AI / ML Intern',
    when: 'Jan 2026 to June 2026',
    points: [
      'CNN plant-disease classifier: 92% accuracy, 50K images, 38 classes, served via FastAPI under 200 ms.',
      'Cut inference time 30% with quantization and batch processing.',
      'End-to-end ML pipelines, from preprocessing and augmentation to production REST APIs.',
    ],
  },
  {
    org: 'Smart India Hackathon',
    short: 'SIH',
    color: '#00574b',
    role: 'Top 3 · College Round',
    when: 'Hackathon',
    points: ['Sign Language Learning App converting English and Gujarati Sign Language.'],
  },
  {
    org: 'Prabal Hackathon · GDG SGU',
    short: 'GDG SGU',
    color: '#151515',
    role: 'Creative Team Lead',
    when: 'Organiser',
    points: ['Led the creative team for a 40-hour hackathon with 600+ participants across multiple colleges.'],
  },
  {
    org: 'Accenture Hackathon',
    short: 'Accenture',
    color: '#5b2bc9',
    role: 'Participant',
    when: 'Hackathon',
    points: ['Built an AI-powered fashion retail recommendation system under time-constrained conditions.'],
  },
  {
    org: 'Sanjay Ghodawat University',
    short: 'SGU',
    color: '#1554c0',
    role: 'B.Tech · AI & Machine Learning',
    when: 'June 2026',
    points: ['CGPA 8.33 / 10.', '12th Science (Computer Science), Yashwantrao Chavan College of Science, Karad, 2022.'],
  },
  {
    org: 'Certifications',
    short: 'AWS',
    color: '#c2731b',
    role: 'AWS · Accenture',
    when: 'Certified',
    points: ['AWS Cloud Practitioner.', 'Accenture Software Engineering Simulation.', 'Accenture Technology Apprenticeship.'],
  },
];

// The About TV's "journey" channel. Only dates that are on the CV.
export const JOURNEY = [
  { when: '2022', title: '12th Science (Computer Science)', where: 'Yashwantrao Chavan College of Science, Karad' },
  { when: '2022', title: 'B.Tech in AI & Machine Learning begins', where: 'Sanjay Ghodawat University, Kolhapur' },
  { when: '2025', title: 'Water Survey ships', where: 'Offline-first Flutter field app for municipal staff' },
  { when: '2025', title: 'R&D: Tender RAG, Encroachment AI, XAI-Care', where: 'RAG, satellite imagery and explainable AI' },
  { when: 'Jan 2026', title: 'AI / ML Intern', where: 'Endureva Innovations' },
  { when: '2026', title: 'Plant Doctor and Offline POS', where: 'CNNs in the field, and a till that never needs Wi-Fi' },
  { when: 'Jun 2026', title: 'Graduation (expected)', where: 'B.Tech, CGPA 8.33 / 10' },
];

// The "facts" channel: numbers that count up, and cards that flip.
export const STATS = [
  { n: 6, suffix: '', label: 'projects shipped or in R&D' },
  { n: 92, suffix: '%', label: 'accuracy, 38-class CNN' },
  { n: 30, suffix: '%', label: 'faster inference after quantization' },
  { n: 600, suffix: '+', label: 'hackers at Prabal, which I helped run' },
];
export const FACTS = [
  { front: 'Top 3', back: 'Smart India Hackathon, college round, with a sign language learning app.' },
  { front: '4 languages', back: 'English, Hindi and Marathi fluently, German at a basic level.' },
  { front: 'AWS', back: 'Certified Cloud Practitioner, plus two Accenture programmes.' },
  { front: 'Not just code', back: 'Figma and Canva for design; I care how the screen looks as much as the model.' },
];

// The speaker plays this Spotify playlist (or album / artist / track link) through Spotify's own player.
// Replace it with your playlist: Spotify > your playlist > Share > Copy link.
// Visitors logged in to Spotify hear full songs; everyone else gets Spotify's 30-second previews.
export const SPOTIFY = {
  url: 'https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn', // TODO: your playlist
};

// The phone on the desk.
export const PHONE_MODEL = { name: 'iPhone 14 Plus', color: 'Blue' };

// Offline lo-fi radio, the speaker's second tab. Songs for it: Put audio files in public/music/ and list them here, e.g.
// { title: 'My Song', artist: 'Someone', src: 'music/my-song.mp3', cover: 'music/my-song.jpg' }
// Use music you have the rights to. The built-in lo-fi tracks below always play.
export const MUSIC = [];

export const SKILLS = {
  Languages: ['Python', 'C++', 'JavaScript', 'SQL', 'R'],
  'AI / ML': ['TensorFlow', 'PyTorch', 'Scikit-learn', 'OpenCV', 'CNNs', 'Transfer Learning', 'Grad-CAM', 'SHAP', 'RAG', 'LLMs'],
  'Deployment & Cloud': ['FastAPI', 'REST APIs', 'Docker', 'AWS', 'Model Quantization', 'Inference Pipelines'],
  'Web & Mobile': ['React.js', 'Node.js', 'Flutter', 'SQLite', 'JWT'],
  Tools: ['Git', 'Figma', 'Canva', 'PostGIS', 'QGIS'],
};

export const SPOKEN = ['English (fluent)', 'Hindi (fluent)', 'Marathi (fluent)', 'German (basic)'];
