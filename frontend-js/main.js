import Search from './modules/search';
import Chat from './modules/chat';
import RegistrationForm from './modules/registrationForm';
import Likes from './modules/likes';
import Comments from './modules/comments';

if (document.querySelector('#registration-form')) {
  new RegistrationForm();
}

if (document.querySelector('#chat-wrapper')) {
  new Chat();
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
