export default class HeaderBadges {
  constructor() {
    this.dmBadge = document.querySelector('.header-badge--dm');
    this.activityBadge = document.querySelector('.header-badge--activity');

    if (!this.dmBadge && !this.activityBadge) return;

    this.initSocket();
  }

  initSocket() {
    if (typeof io === 'undefined') return;

    this.socket = io();
    this.socket.on('badgeUpdate', data => this.updateBadges(data));
  }

  updateBadges({ dmCount, activityCount }) {
    this.setBadge(this.dmBadge, dmCount);
    this.setBadge(this.activityBadge, activityCount);
  }

  setBadge(element, count) {
    if (!element) return;

    if (!count || count <= 0) {
      element.classList.add('header-badge--hidden');
      element.textContent = '0';
      return;
    }

    element.textContent = count > 9 ? '9+' : String(count);
    element.classList.remove('header-badge--hidden');
  }
}