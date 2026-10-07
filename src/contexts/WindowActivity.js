import { createContext } from 'react';

// Retain app state while allowing expensive canvases to suspend when minimized.
export const WindowActivityContext = createContext(true);
