import { Router } from 'express';

const router = Router();

// Mocked data for search
const mockData = [
  'Presentation on AI advancements',
  'Introduction to React',
  'Dashboard overview',
  'Search menu implementation',
  'Backend API design',
];

router.get('/search', (req, res) => {
  const query = (req.query.query as string || '').toLowerCase();

  // Filter mocked data based on query
  const results = mockData.filter(item => item.toLowerCase().includes(query));

  res.json({ results });
});

export default router;
