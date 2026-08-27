import express from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEADS_PATH = join(__dirname, '..', 'leads.json');
const SRC_PATH = join(__dirname, '..', 'src', 'index.ts');

const app = express();
const PORT = 3000;

app.use(express.static(join(__dirname, 'public')));

app.get('/api/leads', (_req, res) => {
  if (!existsSync(LEADS_PATH)) {
    return res.json([]);
  }
  try {
    const data = readFileSync(LEADS_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch {
    res.json([]);
  }
});

app.post('/api/run', (_req, res) => {
  const child = execFile('npx', ['tsx', SRC_PATH], {
    cwd: join(__dirname, '..'),
    env: process.env,
  });

  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (chunk) => { stdout += chunk; });
  child.stderr?.on('data', (chunk) => { stderr += chunk; });

  child.on('close', (code) => {
    res.json({ code, stdout, stderr });
  });

  child.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});

app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
