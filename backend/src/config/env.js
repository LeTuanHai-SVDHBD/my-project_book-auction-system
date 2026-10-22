import dotenv from 'dotenv';
import { parseConfig } from './parseConfig.js';
dotenv.config({ path: new URL('../../../.env', import.meta.url), quiet: true });
export const config = parseConfig(process.env);
