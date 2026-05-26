import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

// Because type: "module" is in package.json, we can use import/export and standard ESM setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const galleryDir = path.join(__dirname, '../src/assets/gallery');
const dataFilePath = path.join(__dirname, '../src/data/photographyData.js');

async function run() {
  console.log('Reading gallery directory:', galleryDir);
  const files = fs.readdirSync(galleryDir);
  
  let totalOriginalSize = 0;
  let totalNewSize = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') {
      const inputPath = path.join(galleryDir, file);
      const outputFileName = path.basename(file, ext) + '.webp';
      const outputPath = path.join(galleryDir, outputFileName);
      
      const origStats = fs.statSync(inputPath);
      totalOriginalSize += origStats.size;
      
      console.log(`Processing ${file} (${(origStats.size / 1024 / 1024).toFixed(2)} MB)...`);
      
      try {
        await sharp(inputPath)
          .resize({ width: 1200, withoutEnlargement: true })
          .webp({ quality: 75 })
          .toFile(outputPath);
          
        const newStats = fs.statSync(outputPath);
        totalNewSize += newStats.size;
        
        console.log(`Saved ${outputFileName} (${(newStats.size / 1024).toFixed(2)} KB) - saved ${((1 - newStats.size / origStats.size) * 100).toFixed(1)}%`);
        
        // Delete original file
        fs.unlinkSync(inputPath);
        console.log(`Deleted original ${file}`);
      } catch (err) {
        console.error(`Error processing ${file}:`, err);
      }
    }
  }

  console.log(`\nImage optimization complete!`);
  console.log(`Total original size: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total optimized size: ${(totalNewSize / 1024 / 1024).toFixed(2)} MB`);
  
  // Now update photographyData.js
  if (fs.existsSync(dataFilePath)) {
    console.log(`Updating data file: ${dataFilePath}`);
    let content = fs.readFileSync(dataFilePath, 'utf8');
    
    // Replace all .jpg and .jpeg imports with .webp
    const updatedContent = content
      .replace(/\.jpg(['"])/g, '.webp$1')
      .replace(/\.jpeg(['"])/g, '.webp$1');
      
    fs.writeFileSync(dataFilePath, updatedContent, 'utf8');
    console.log('Successfully updated photographyData.js');
  } else {
    console.error(`Photography data file not found at ${dataFilePath}`);
  }
}

run().catch(console.error);
