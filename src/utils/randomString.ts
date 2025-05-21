import { randomBytes } from 'crypto';

export const getRandomHex = (length: number = 3) => randomBytes(length).toString('hex'); // generates length*2 hex characters
