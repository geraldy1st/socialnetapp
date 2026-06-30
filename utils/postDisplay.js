function getPostExcerpt(post, maxLength) {
  maxLength = maxLength || 160;

  if (post.body && post.body.trim()) {
    const text = post.body.trim();
    return text.length > maxLength ? text.substring(0, maxLength) + '…' : text;
  }

  if (post.media && post.media.length) {
    return post.media[0].type === 'video' ? 'Vidéo' : 'Photo';
  }

  if (post.title && post.title.trim()) {
    const text = post.title.trim();
    return text.length > maxLength ? text.substring(0, maxLength) + '…' : text;
  }

  return 'Publication';
}

function getPostPageTitle(post) {
  if (post.body && post.body.trim()) {
    const text = post.body.trim();
    return text.length > 60 ? text.substring(0, 60) + '…' : text;
  }

  if (post.media && post.media.length) {
    return post.media[0].type === 'video' ? 'Vidéo' : 'Photo';
  }

  if (post.title && post.title.trim()) {
    return post.title.trim();
  }

  return 'Publication';
}

module.exports = { getPostExcerpt, getPostPageTitle };