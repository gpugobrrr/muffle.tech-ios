import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const modelsDir = path.join(projectRoot, 'assets', 'models');

const MODELS = [
  {
    name: 'ggml-tiny.en.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
    minBytes: 70 * 1024 * 1024, // ~75MB
  },
  {
    name: 'ggml-silero-v6.2.0.bin',
    url: 'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin',
    minBytes: 800 * 1024, // ~885KB
  },
];

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    function get(currentUrl) {
      https.get(currentUrl, (res) => {
        // Handle 301/302 redirects (HuggingFace CDN)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download ${currentUrl}: HTTP ${res.statusCode}`));
          return;
        }

        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }

    get(url);
  });
}

async function main() {
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }

  for (const model of MODELS) {
    const filePath = path.join(modelsDir, model.name);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size >= model.minBytes) {
        console.log(`✓ Model already present: ${model.name} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
        continue;
      }
      console.log(`! Model file ${model.name} exists but size is suspicious (${stats.size} bytes). Re-downloading...`);
    }

    console.log(`⬇ Downloading ${model.name} from ${model.url}...`);
    try {
      await downloadFile(model.url, filePath);
      const stats = fs.statSync(filePath);
      console.log(`✓ Downloaded ${model.name} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
    } catch (err) {
      console.error(`✖ Failed to download ${model.name}:`, err.message);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('Download models script failed:', err);
  process.exit(1);
});
