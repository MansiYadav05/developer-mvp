import app from '../server';

// This file acts as the entry point for Vercel Serverless Functions.
// Vercel will automatically handle the Express app when exported.

export default async (req: any, res: any) => {
  // Handle potential path prefix issues in Vercel environment
  if (req.url.startsWith('/api')) {
    return app(req, res);
  }
  res.status(404).json({ error: 'Not Found' });
};