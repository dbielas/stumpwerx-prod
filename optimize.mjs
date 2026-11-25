import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

// Limit sharp to single thread to avoid memory/CPU thread starvation in sandboxed containers
sharp.concurrency(1);

// --- ABSOLUTE PATH RESOLUTION ---
const INPUT_DIR = path.resolve(process.cwd(), 'src/img');
const OUTPUT_DIR = path.resolve(process.cwd(), 'public/img');

// Core target widths for your layout tiers
const TARGET_WIDTHS = [800, 1200];
const VALID_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.tiff'];

async function processImage(filename, aspectRatio) {
  // Check if all output files already exist to prevent slow/timeout builds in sandboxed environment
  let allProcessed = true;
  for (const width of TARGET_WIDTHS) {
    const height = Math.round(width / aspectRatio);
    const avifPath = path.join(OUTPUT_DIR, `${filename}-${width}w-${height}h.avif`);
    const webpPath = path.join(OUTPUT_DIR, `${filename}-${width}w-${height}h.webp`);
    try {
      await fs.access(avifPath);
      await fs.access(webpPath);
    } catch {
      allProcessed = false;
      break;
    }
  }
  if (allProcessed) {
    console.log(`  └─ ⏭️  Skipping conversion (already exists): ${filename}`);
    return;
  }

  let inputPath = null;

  // Resolve the extension automatically
  for (const validExt of VALID_EXTENSIONS) {
    const testPath = path.join(INPUT_DIR, `${filename}${validExt}`);
    try {
      await fs.access(testPath);
      inputPath = testPath;
      break;
    } catch {
      // Continue checking extensions
    }
  }

  if (!inputPath) {
    console.warn(`⚠️  Source asset file not found: ${filename}`);
    return;
  }

  const baseImage = sharp(inputPath);

  const tasks = TARGET_WIDTHS.flatMap((width) => {
    // Derive the strict height required to lock in the requested aspect ratio
    const height = Math.round(width / aspectRatio);
    const baseOutputName = `${filename}-${width}w-${height}h`;
    
    const avifQuality = 42;
    const webpQuality = 75;

    // Separate pipelines avoid internal C++ stream bugs and guarantee the crop executes
    return [
      baseImage.clone()
        .resize({
          width,
          height,
          fit: 'cover',
          position: 'centre',
          withoutEnlargement: true
        })
        .avif({ quality: avifQuality, effort: 4, chromaSubsampling: '4:2:0' })
        .toFile(path.join(OUTPUT_DIR, `${baseOutputName}.avif`))
        .then(() => console.log(`  └─ ✅ AVIF generated: ${baseOutputName}`)),

      baseImage.clone()
        .resize({
          width,
          height,
          fit: 'cover',
          position: 'centre',
          withoutEnlargement: true
        })
        .webp({ quality: webpQuality, smartSubsample: true })
        .toFile(path.join(OUTPUT_DIR, `${baseOutputName}.webp`))
        .then(() => console.log(`  └─ ✅ WebP generated: ${baseOutputName}`))
    ];
  });

  await Promise.all(tasks);
}

async function optimize() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log('🚀 Executing explicit asset matrix optimization pipeline...\n');

    // Fully parallelized across all assets to saturate CPU multi-threading
    await Promise.all([
      processImage('tree-removal-services-macomb-county', 16/9),
      processImage('emergency-storm-damage-cleanup', 16/9),
      processImage('stump-grinding-and-root-removal', 16/9),
      
      // Gallery images - mixed aspect ratios for Masonry stagger
      processImage('large-tree-removal-ira-township-mi', 3/4), // Portrait
      processImage('lexington-mi-tree-removal', 1/1), // Square
      processImage('commercial-tree-trimming-new-baltimore-mi', 2/3), // Tall Portrait
      processImage('emergency-storm-damage-tree-removal-royal-oak-mi', 4/3), // Landscape
      processImage('hollow-tree-removal-berlin-mi', 3/4), // Portrait
      processImage('technical-tree-removal-shelby-twp-mi', 2/3), // Tall Portrait
      processImage('professional-arborist-climbing-tree-removal-macomb-county', 4/5) // About section team photo
    ]);

    console.log('\n✨ All files explicitly cropped and optimized successfully.');
  } catch (error) {
    console.error('❌ Pipeline failure:', error);
    process.exit(1);
  }
}

optimize();