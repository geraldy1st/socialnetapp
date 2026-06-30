import axios from 'axios';

export default class Likes {
  constructor() {
    this.buttons = document.querySelectorAll('.like-button[data-post-id]');
    if (!this.buttons.length) return;
    this._csrf = document.querySelector('[name="_csrf"]')
      ? document.querySelector('[name="_csrf"]').value
      : '';
    this.events();
  }

  events() {
    this.buttons.forEach(button => {
      button.addEventListener('click', () => this.toggleLike(button));
    });
  }

  toggleLike(button) {
    const postId = button.dataset.postId;
    const icon = button.querySelector('i');
    const countEl = button.querySelector('.like-button__count');

    axios
      .post(`/post/${postId}/like`, { _csrf: this._csrf })
      .then(response => {
        const { liked, count } = response.data;
        button.classList.toggle('like-button--active', liked);
        icon.className = liked ? 'fas fa-heart' : 'far fa-heart';
        countEl.textContent = count;
      })
      .catch(() => {
        console.log('Impossible de mettre à jour le like.');
      });
  }
}