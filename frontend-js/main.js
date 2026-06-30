import Search from './modules/search';
import RegistrationForm from './modules/registrationForm';
import Likes from './modules/likes';
import Comments from './modules/comments';
import Messages from './modules/messages';
import HeaderBadges from './modules/headerBadges';

if (document.querySelector('#registration-form')) {
  new RegistrationForm();
}

if (document.querySelector('.header-badge')) {
  new HeaderBadges();
}

if (document.querySelector('.messages-page')) {
  new Messages();
}
if (document.querySelector('.header-search-icon')) {
  new Search();
}
if (document.querySelector('.like-button[data-post-id]')) {
  new Likes();
}
if (document.querySelector('.post-comments[data-post-id]')) {
  new Comments();
}
