const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const postsUploadDir = path.join(__dirname, '../public/uploads/posts');

if (!fs.existsSync(postsUploadDir)) {
  fs.mkdirSync(postsUploadDir, { recursive: true });
}

const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const videoMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime'];

async function processPostMedia(file) {
  if (!file) {
    return null;
  }

  const ext = path.extname(file.originalname).toLowerCase();

  if (imageMimeTypes.includes(file.mimetype)) {
    const outputName = `${path.basename(file.filename, ext)}.webp`;
    const outputPath = path.join(postsUploadDir, outputName);

    await sharp(file.path)
      .rotate()
      .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(outputPath);

    fs.unlinkSync(file.path);

    return {
      type: 'image',
      url: `/uploads/posts/${outputName}`
    };
  }

  if (videoMimeTypes.includes(file.mimetype)) {
    return {
      type: 'video',
      url: `/uploads/posts/${file.filename}`
    };
  }

  fs.unlinkSync(file.path);
  throw new Error('INVALID_MEDIA_TYPE');
}

function deletePostMedia(media) {
  if (!media || !Array.isArray(media)) {
    return;
  }

  media.forEach(function(item) {
    if (!item.url || !item.url.startsWith('/uploads/posts/')) {
      return;
    }

    const filePath = path.join(__dirname, '../public', item.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
}

module.exports = { processPostMedia, deletePostMedia };