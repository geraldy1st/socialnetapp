import axios from 'axios';

export default class Likes {
  constructor() {
    this.buttons = document.querySelectorAll('.like-button[data-post-id]');
    if (!this.buttons.length) return;

    this._csrf = document.querySelector('[name="_csrf"]')
      ? document.querySelector('[name="_csrf"]').value
      : '';

    this.events();
    this.initSocket();
  }

  events() {
    this.buttons.forEach(button => {
      button.addEventListener('click', () => this.toggleLike(button));
    });
  }

  initSocket() {
    if (typeof io === 'undefined') return;

    this.socket = io();
    this.socket.on('likeUpdate', data => this.applyLikeUpdate(data));
  }

  applyLikeUpdate({ postId, liked, count }) {
    document.querySelectorAll(`.like-button[data-post-id="${postId}"]`).forEach(button => {
      const icon = button.querySelector('i');
      const countEl = button.querySelector('.like-button__count');

      if (button.classList.contains('like-button--readonly')) {
        if (countEl) countEl.textContent = count;
        return;
      }

      if (liked !== undefined) {
        button.classList.toggle('like-button--active', liked);
        if (icon) icon.className = liked ? 'fas fa-heart' : 'far fa-heart';
      }

      if (countEl) countEl.textContent = count;
    });
  }

  toggleLike(button) {
    const postId = button.dataset.postId;
    const icon = button.querySelector('i');
    const countEl = button.querySelector('.like-button__count');

    axios
      .post(`/post/${postId}/like`, { _csrf: this._csrf })
      .then(response => {
        this.applyLikeUpdate({
          postId: postId,
          liked: response.data.liked,
          count: response.data.count
        });
      })
      .catch(() => {
        console.log('Impossible de mettre à jour le like.');
      });
  }
}