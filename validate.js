/* Armand — shared form validation.
 * The rules mirror the database (supabase-setup.sql / supabase-accounts.sql), so the
 * browser gives instant, friendly feedback and the server still enforces the same limits.
 * Each check returns '' when the value is fine, otherwise a plain-English message. */
(function () {
  'use strict';

  const PHONE_RE = /^[0-9+() -]{7,30}$/;
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

  const AV = {
    name(v, label = 'name') {
      v = String(v || '').trim();
      if (!v) return `Please enter your ${label}.`;
      if (v.length < 2) return `Your ${label} must be at least 2 characters.`;
      if (v.length > 100) return `Your ${label} must be 100 characters or fewer.`;
      return '';
    },
    email(v, required = true) {
      v = String(v || '').trim();
      if (!v) return required ? 'Please enter your email address.' : '';
      if (v.length > 200) return 'That email address is too long.';
      if (!EMAIL_RE.test(v)) return 'Enter a valid email address, e.g. name@example.com.';
      return '';
    },
    phone(v, required = true) {
      v = String(v || '').trim();
      if (!v) return required ? 'Please enter your phone number.' : '';
      if (!PHONE_RE.test(v)) return 'Use digits, spaces and + ( ) - only, e.g. +263 78 079 3585.';
      const digits = v.replace(/\D/g, '').length;
      if (digits < 7 || digits > 15) return 'A phone number has between 7 and 15 digits.';
      return '';
    },
    password(v) {
      v = String(v || '');
      if (!v) return 'Please enter a password.';
      if (v.length < 8) return 'Use at least 8 characters.';
      if (v.length > 72) return 'Use 72 characters or fewer.';
      if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) return 'Include at least one letter and one number.';
      return '';
    },
    match(a, b) { return a === b ? '' : 'The passwords do not match.'; },
    text(v, min, max, label = 'This field') {
      v = String(v || '').trim();
      if (v.length < min) return min <= 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`;
      if (v.length > max) return `${label} must be ${max} characters or fewer (currently ${v.length}).`;
      return '';
    },
    number(v, { min = -Infinity, max = Infinity, label = 'This value', required = true } = {}) {
      if (v === '' || v == null) return required ? `${label} is required.` : '';
      const n = Number(v);
      if (!Number.isFinite(n)) return `${label} must be a number.`;
      if (n < min) return `${label} must be at least ${min}.`;
      if (n > max) return `${label} must be at most ${max}.`;
      return '';
    },

    /* Show or clear an inline error under an input (screen-reader friendly). */
    setError(input, msg) {
      if (!input) return;
      const id = (input.id || input.name || 'field') + '-err';
      let el = document.getElementById(id);
      if (msg) {
        if (!el) {
          el = document.createElement('div');
          el.id = id;
          el.className = 'field-error';
          el.setAttribute('role', 'alert');
          // a checkbox sits inside a .form-check wrapper: put the message after the wrapper, not inside it
          const anchor = input.type === 'checkbox' ? (input.closest('.form-check') || input) : input;
          anchor.insertAdjacentElement('afterend', el);
        }
        el.textContent = msg;
        input.setAttribute('aria-invalid', 'true');
        input.classList.add('is-invalid');
        input.setAttribute('aria-describedby', id);
      } else {
        if (el) el.remove();
        input.removeAttribute('aria-invalid');
        input.classList.remove('is-invalid');
        input.removeAttribute('aria-describedby');
      }
    },

    /* rules: [[input, message], ...]. Marks every field, focuses the first bad one.
       Returns true when everything is valid. */
    check(rules) {
      let first = null;
      rules.forEach(([input, msg]) => {
        AV.setError(input, msg);
        if (msg && !first) first = input;
      });
      if (first) first.focus();
      return !first;
    },

    /* Re-validate a single field when the user leaves it. */
    live(input, fn) {
      if (!input) return;
      input.addEventListener('blur', () => AV.setError(input, fn()));
      input.addEventListener('input', () => { if (input.getAttribute('aria-invalid')) AV.setError(input, fn()); });
    },
  };

  window.AV = AV;
})();
