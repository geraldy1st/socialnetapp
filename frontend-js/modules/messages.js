import axios from 'axios';
import DOMPurify from 'dompurify';

export default class Messages {
  constructor() {
    this.searchInput = document.querySelector('#dm-user-search');
    this.searchResults = document.querySelector('#dm-search-results');
    this.messagesList = document.querySelector('#messages-list');
    this.dmLog = document.querySelector('#dm-log');
    this.dmForm = document.querySelector('#dm-form');
    this._csrf = document.querySelector('[name="_csrf"]')
      ? document.querySelector('[name="_csrf"]').value
      : '';
    this.searchTimer = null;
    this.currentUserId = this.dmLog ? this.dmLog.dataset.currentUserId : null;

    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.handleSearchInput());
      document.addEventListener('click', e => this.handleOutsideClick(e));
    }

    if (this.dmForm) {
      this.dmForm.addEventListener('submit', e => this.sendMessage(e));
    }

    if (this.dmLog) {
      this.dmLog.scrollTop = this.dmLog.scrollHeight;
    }

    this.initSocket();
  }

  initSocket() {
    if (typeof io === 'undefined') return;

    this.socket = io();
    this.socket.on('dmMessage', data => this.handleIncomingMessage(data));
  }

  handleSearchInput() {
    const value = this.searchInput.value.trim();
    clearTimeout(this.searchTimer);

    if (value.length < 2) {
      this.hideSearchResults();
      return;
    }

    this.searchTimer = setTimeout(() => this.searchUsers(value), 350);
  }

  searchUsers(term) {
    axios
      .post('/messages/search-users', { searchTerm: term, _csrf: this._csrf })
      .then(response => this.renderSearchResults(response.data))
      .catch(() => this.hideSearchResults());
  }

  renderSearchResults(users) {
    if (!this.searchResults) return;

    if (!users.length) {
      this.searchResults.innerHTML =
        '<p class="messages-search__empty">Aucun utilisateur trouvé.</p>';
      this.searchResults.classList.add('messages-search__results--visible');
      return;
    }

    const html = users
      .map(
        user => `
      <a href="/messages/with/${user.username}" class="messages-search__item">
        <img src="${user.avatar}" alt="${user.username}" />
        <span>${user.username}</span>
      </a>
    `
      )
      .join('');

    this.searchResults.innerHTML = DOMPurify.sanitize(html);
    this.searchResults.classList.add('messages-search__results--visible');
  }

  hideSearchResults() {
    if (!this.searchResults) return;
    this.searchResults.classList.remove('messages-search__results--visible');
    this.searchResults.innerHTML = '';
  }

  handleOutsideClick(e) {
    if (!this.searchResults || !this.searchInput) return;
    if (
      !this.searchResults.contains(e.target) &&
      e.target !== this.searchInput
    ) {
      this.hideSearchResults();
    }
  }

  sendMessage(e) {
    e.preventDefault();
    const input = document.querySelector('#dm-input');
    const body = input.value.trim();
    if (!body || !this.dmForm) return;

    const conversationId = this.dmForm.dataset.conversationId;

    axios
      .post(`/messages/c/${conversationId}/send`, { body: body, _csrf: this._csrf })
      .then(response => {
        input.value = '';
        this.appendMessage(response.data.message, true);
        this.updateConversationPreview(conversationId, response.data.message);
      })
      .catch(() => {
        console.log('Impossible d\'envoyer le message.');
      });
  }

  handleIncomingMessage({ conversationId, message, conversation }) {
    if (!message) return;

    if (this.dmLog && this.dmLog.dataset.conversationId === conversationId) {
      const isSelf = message.senderId.toString() === this.currentUserId;
      this.appendMessage(message, isSelf);

      if (!isSelf) {
        axios
          .post(`/messages/c/${conversationId}/read`, { _csrf: this._csrf })
          .catch(() => {});
      }
    }

    const item = this.messagesList
      ? this.messagesList.querySelector(`[data-conversation-id="${conversationId}"]`)
      : null;

    if (!item && conversation && this.messagesList) {
      this.prependConversation(conversation, message);
    } else {
      this.updateConversationPreview(conversationId, message);
    }
  }

  prependConversation(conversation, message) {
    const empty = document.querySelector('#messages-list-empty');
    if (empty) empty.remove();

    const isSelf = message.senderId.toString() === this.currentUserId;
    const prefix = isSelf ? 'Vous : ' : '';
    const html = DOMPurify.sanitize(`
      <li>
        <a href="/messages/c/${conversation._id}" class="messages-list__item" data-conversation-id="${conversation._id}">
          <img class="messages-list__avatar" src="${conversation.otherUser.avatar}" alt="${conversation.otherUser.username}" />
          <div class="messages-list__content">
            <div class="messages-list__top">
              <strong class="messages-list__username">${conversation.otherUser.username}</strong>
            </div>
            <p class="messages-list__preview">${prefix}${message.body}</p>
          </div>
        </a>
      </li>
    `);

    this.messagesList.insertAdjacentHTML('afterbegin', html);
  }

  appendMessage(message, isSelf) {
    if (!this.dmLog) return;

    const messageId = message._id.toString();
    if (this.dmLog.querySelector(`[data-message-id="${messageId}"]`)) return;

    const date = new Date(message.createdDate);
    const timeLabel = date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const avatarHtml = isSelf
      ? ''
      : `<img class="dm-message__avatar" src="${message.sender.avatar}" alt="" />`;

    const html = DOMPurify.sanitize(`
      <div class="dm-message ${isSelf ? 'dm-message--self' : 'dm-message--other'}" data-message-id="${messageId}">
        ${avatarHtml}
        <div class="dm-message__bubble">
          <p class="dm-message__text">${message.body}</p>
          <time class="dm-message__time">${timeLabel}</time>
        </div>
      </div>
    `);

    this.dmLog.insertAdjacentHTML('beforeend', html);
    this.dmLog.scrollTop = this.dmLog.scrollHeight;
  }

  updateConversationPreview(conversationId, message) {
    if (!this.messagesList) return;

    const item = this.messagesList.querySelector(
      `[data-conversation-id="${conversationId}"]`
    );

    if (!item) return;

    const preview = item.querySelector('.messages-list__preview');
    const isSelf = message.senderId.toString() === this.currentUserId;
    const prefix = isSelf ? 'Vous : ' : '';

    if (preview) {
      preview.textContent = `${prefix}${message.body}`;
      preview.classList.remove('messages-list__preview--empty');
    }

    const listItem = item.closest('li');
    if (listItem && listItem.parentNode) {
      listItem.parentNode.prepend(listItem);
    }
  }
}