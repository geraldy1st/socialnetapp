import axios from 'axios';
import DOMPurify from 'dompurify';

export default class Comments {
  constructor() {
    this.section = document.querySelector('.post-comments[data-post-id]');
    if (!this.section) return;

    this.postId = this.section.dataset.postId;
    this.form = document.querySelector('#comment-form');
    this.list = document.querySelector('#comment-list');
    this.empty = document.querySelector('#comment-empty');
    this.countEl = document.querySelector('#comment-count');
    this._csrf = document.querySelector('[name="_csrf"]')
      ? document.querySelector('[name="_csrf"]').value
      : '';

    if (this.form) {
      this.form.addEventListener('submit', e => this.submitComment(e));
    }

    this.initSocket();
  }

  initSocket() {
    if (typeof io === 'undefined') return;

    this.socket = io();
    this.socket.on('commentAdded', data => {
      if (data.postId === this.postId) {
        this.appendComment(data.comment);
      }
    });
  }

  submitComment(e) {
    e.preventDefault();
    const textarea = this.form.querySelector('#comment-body');
    const body = textarea.value.trim();
    if (!body) return;

    axios
      .post(`/post/${this.postId}/comment`, { body: body, _csrf: this._csrf })
      .then(response => {
        textarea.value = '';
        this.appendComment(response.data.comment);
      })
      .catch(() => {
        console.log('Impossible d\'ajouter le commentaire.');
      });
  }

  appendComment(comment) {
    if (!comment || !this.list) return;

    const commentId = comment._id.toString();
    if (this.list.querySelector(`[data-comment-id="${commentId}"]`)) return;

    if (this.empty) {
      this.empty.remove();
      this.empty = null;
    }

    const date = new Date(comment.createdDate);
    const dateLabel = date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    const html = DOMPurify.sanitize(`
      <li class="post-comment" data-comment-id="${commentId}">
        <a href="/profile/${comment.author.username}" class="post-comment__avatar">
          <img src="${comment.author.avatar}" alt="${comment.author.username}" />
        </a>
        <div class="post-comment__body">
          <div class="post-comment__meta">
            <a href="/profile/${comment.author.username}" class="post-comment__author">${comment.author.username}</a>
            <time class="post-comment__date">${dateLabel}</time>
          </div>
          <p class="post-comment__text">${comment.body}</p>
        </div>
      </li>
    `);

    this.list.insertAdjacentHTML('beforeend', html);

    if (this.countEl) {
      this.countEl.textContent = this.list.querySelectorAll('.post-comment').length;
    }
  }
}