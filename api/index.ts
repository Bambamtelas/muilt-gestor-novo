import { apiApp } from '../src/serverApp.js';
import type { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
  return apiApp(req, res);
}
