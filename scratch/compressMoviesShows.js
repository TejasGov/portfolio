import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const moviesDir = path.join(__dirname, '../public/movies');
const showsDir = path.join(__dirname, '../public/shows');
const dataFilePath = path.join(__dirname, '../src/data/movieData.js');

async function compressDirectory(dirPath) {
  console.log(`\n--- Optimizing directory: ${dirPath} ---`);
  const files = fs.readdirSync(dirPath);
  let originalBytes = 0;
  let optimizedBytes = 0;

  for (const file of files) {
    if (file.startsWith('.')) continue;

    const ext = path.extname(file).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
    if (!allowedExts.includes(ext)) continue;

    const inputPath = path.join(dirPath, file);
    const baseName = path.basename(file, ext);
    const outputFileName = `${baseName}.webp`;
    const outputPath = path.join(dirPath, outputFileName);
    const tempPath = path.join(dirPath, `_temp_${outputFileName}`);

    const origStats = fs.statSync(inputPath);
    originalBytes += origStats.size;

    console.log(`Processing ${file} (${(origStats.size / 1024).toFixed(1)} KB)...`);

    try {
      // Resize to max width 320px, keep aspect ratio, convert to webp quality 80
      await sharp(inputPath)
        .resize({ width: 320, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(tempPath);

      // Replace target file
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      fs.renameSync(tempPath, outputPath);

      // If original file was not a webp, delete it
      if (ext !== '.webp') {
        fs.unlinkSync(inputPath);
        console.log(`  -> Converted to webp and deleted original ${file}`);
      } else {
        console.log(`  -> Re-optimized webp in-place`);
      }

      const newStats = fs.statSync(outputPath);
      optimizedBytes += newStats.size;
      console.log(`  Saved as ${outputFileName} (${(newStats.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }

  console.log(`Directory completed. Original: ${(originalBytes / 1024 / 1024).toFixed(2)} MB, Optimized: ${(optimizedBytes / 1024 / 1024).toFixed(2)} MB`);
}

async function run() {
  await compressDirectory(moviesDir);
  await compressDirectory(showsDir);

  // Now update movieData.js file to point to .webp for everything
  if (fs.existsSync(dataFilePath)) {
    console.log(`\nUpdating data file: ${dataFilePath}`);
    let content = fs.readFileSync(dataFilePath, 'utf8');

    // Replace all poster: '/movies/*.xyz' or '/shows/*.xyz' with .webp
    // Matches extensions inside single or double quotes
    const updatedContent = content
      .replace(/\/movies\/([^'"]+)\.(jpg|jpeg|png|avif|webp)/gi, '/movies/$1.webp')
      .replace(/\/shows\/([^'"]+)\.(jpg|jpeg|png|avif|webp)/gi, '/shows/$1.webp');

    fs.writeFileSync(dataFilePath, updatedContent, 'utf8');
    console.log('Successfully updated all movie/show poster paths to .webp in movieData.js');
  } else {
    console.error(`movieData file not found at ${dataFilePath}`);
  }
}

run().catch(console.error);
