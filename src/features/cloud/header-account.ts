import { createContext } from 'react';

export const HeaderAccountContext = createContext<(() => void) | null>(null);
