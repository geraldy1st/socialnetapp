import axios from 'axios';

export default class RegistrationForm {
  constructor() {
    this._csrf = document.querySelector('[name="_csrf"]').value;
    this.form = document.querySelector('#registration-form');
    this.allFields = document.querySelectorAll(
      '#registration-form .form-control'
    );
    this.insertValidationElements();
    this.username = document.querySelector('#username-register');
    this.username.previousValue = '';
    this.email = document.querySelector('#email-register');
    this.email.previousValue = '';
    this.password = document.querySelector('#password-register');
    this.password.previousValue = '';
    this.username.isUnique = false;
    this.email.isUnique = false;
    this.events();
  }

  events() {
    this.form.addEventListener('submit', e => {
      e.preventDefault();
      this.formSubmitHandler();
    });

    this.username.addEventListener('keyup', () => {
      this.isDifferent(this.username, this.usernameHandler);
    });
    this.email.addEventListener('keyup', () => {
      this.isDifferent(this.email, this.emailHandler);
    });
    this.password.addEventListener('keyup', () => {
      this.isDifferent(this.password, this.passwordHandler);
    });

    this.username.addEventListener('blur', () => {
      this.isDifferent(this.username, this.usernameHandler);
    });
    this.email.addEventListener('blur', () => {
      this.isDifferent(this.email, this.emailHandler);
    });
    this.password.addEventListener('blur', () => {
      this.isDifferent(this.password, this.passwordHandler);
    });
  }

  formSubmitHandler() {
    this.username.errors = false;
    this.email.errors = false;
    this.password.errors = false;

    this.usernameImmediately();
    this.passwordImmediately();
    this.usernameAfterDelay(true);
    this.emailAfterDelay(true);
    this.passwordAfterDelay();

    if (
      this.username.value.length >= 3 &&
      this.username.isUnique &&
      !this.username.errors &&
      this.email.isUnique &&
      !this.email.errors &&
      this.password.value.length >= 12 &&
      this.password.value.length <= 50 &&
      !this.password.errors
    ) {
      this.form.submit();
    }
  }

  isDifferent(el, handler) {
    if (el.previousValue != el.value) {
      handler.call(this);
    }
    el.previousValue = el.value;
  }

  usernameHandler() {
    this.username.errors = false;
    this.usernameImmediately();
    clearTimeout(this.username.timer);
    this.username.timer = setTimeout(() => this.usernameAfterDelay(), 800);
  }

  passwordHandler() {
    this.password.errors = false;
    this.passwordImmediately();
    clearTimeout(this.password.timer);
    this.password.timer = setTimeout(() => this.passwordAfterDelay(), 800);
  }

  passwordImmediately() {
    if (this.password.value.length > 50) {
      this.showValidationError(
        this.password,
        'Le mot de passe ne peut pas dépasser 50 caractères.'
      );
    }
    if (!this.password.errors) {
      this.hideValidationError(this.password);
    }
  }

  passwordAfterDelay() {
    if (this.password.value.length < 12) {
      this.showValidationError(
        this.password,
        'Le mot de passe doit contenir au moins 12 caractères.'
      );
    } else if (this.password.value.length <= 50) {
      this.hideValidationError(this.password);
      this.password.errors = false;
    }
  }

  emailHandler() {
    this.email.errors = false;
    clearTimeout(this.email.timer);
    this.email.timer = setTimeout(() => this.emailAfterDelay(), 800);
  }

  emailAfterDelay(forceCheck) {
    if (!/^\S+@\S+$/.test(this.email.value)) {
      this.showValidationError(
        this.email,
        'Vous devez fournir une adresse e-mail valide.'
      );
      return;
    }

    if (!this.email.errors || forceCheck) {
      axios
        .post('/doesEmailExist', { _csrf: this._csrf, email: this.email.value })
        .then(response => {
          if (response.data) {
            this.email.isUnique = false;
            this.showValidationError(
              this.email,
              'Cet e-mail est déjà utilisé.'
            );
          } else {
            this.email.isUnique = true;
            this.hideValidationError(this.email);
            this.email.errors = false;
          }
        })
        .catch(() => {
          console.log('Veuillez réessayer plus tard.');
        });
    }
  }

  usernameImmediately() {
    if (
      this.username.value != '' &&
      !/^([a-zA-Z0-9]+)$/.test(this.username.value)
    ) {
      this.showValidationError(
        this.username,
        "L'identifiant ne peut contenir que des lettres et des chiffres."
      );
    }
    if (this.username.value.length > 30) {
      this.showValidationError(
        this.username,
        "L'identifiant ne peut pas dépasser 30 caractères."
      );
    }
    if (!this.username.errors) {
      this.hideValidationError(this.username);
    }
  }

  hideValidationError(el) {
    const message = el.parentElement.querySelector('.liveValidateMessage');
    if (message) {
      message.classList.remove('liveValidateMessage--visible');
    }
  }

  showValidationError(el, message) {
    const messageEl = el.parentElement.querySelector('.liveValidateMessage');
    if (messageEl) {
      messageEl.innerHTML = message;
      messageEl.classList.add('liveValidateMessage--visible');
    }
    el.errors = true;
  }

  usernameAfterDelay(forceCheck) {
    if (this.username.value.length < 3) {
      this.showValidationError(
        this.username,
        "L'identifiant doit contenir au moins 3 caractères."
      );
      return;
    }

    if (!this.username.errors || forceCheck) {
      axios
        .post('/doesUsernameExist', {
          _csrf: this._csrf,
          username: this.username.value
        })
        .then(response => {
          if (response.data) {
            this.showValidationError(
              this.username,
              'Cet identifiant est déjà pris.'
            );
            this.username.isUnique = false;
          } else {
            this.username.isUnique = true;
            this.hideValidationError(this.username);
            this.username.errors = false;
          }
        })
        .catch(() => {
          console.log('Veuillez réessayer plus tard.');
        });
    }
  }

  insertValidationElements() {
    this.allFields.forEach(function(el) {
      if (!el.parentElement.querySelector('.liveValidateMessage')) {
        el.insertAdjacentHTML(
          'afterend',
          '<div class="alert alert-danger small liveValidateMessage"></div>'
        );
      }
    });
  }
}