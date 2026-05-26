import React from 'react';
import { Globe, FileText, Instagram, Command, Mic, Mail } from 'lucide-react';
import memojiImg from '../assets/memoji.png';

export const searchIndex = [
  { id: 'projects', title: 'Projects', synonyms: ['work', 'portfolio', 'apps'], icon: <Globe size={18} /> },
  { id: 'about', title: 'About Me', synonyms: ['bio', 'profile', 'me', 'info'], icon: <img src={memojiImg} alt="Me" style={{width:'18px', borderRadius:'50%'}}/> },
  { id: 'work-ex', title: 'Work Experience', synonyms: ['experience', 'resume', 'career'], icon: <FileText size={18} /> },
  { id: 'photography', title: 'Photography', synonyms: ['photos', 'gallery', 'pictures'], icon: <Instagram size={18} /> },
  { id: 'certificates', title: 'Certificates', synonyms: ['awards', 'achievements'], icon: <FileText size={18} /> },
  { id: 'terminal', title: 'Terminal', synonyms: ['shell', 'cmd', 'command', 'prompt'], icon: <Command size={18} /> },
  { id: 'talk-to-me', title: 'Talk to Me', synonyms: ['ai', 'voice', 'chat'], icon: <Mic size={18} /> },
  { id: 'contact', title: 'Contact Me', synonyms: ['email', 'message', 'connect'], icon: <Mail size={18} /> },
  { id: 'blog', title: 'Blog', synonyms: ['posts', 'articles', 'writing', 'pages', 'blog'], icon: <FileText size={18} /> },
];
