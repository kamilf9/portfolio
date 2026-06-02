/**
 * Primary nav: hide on scroll down / show on scroll up (near top always shown).
 * When scroll-hidden, a top hover zone reveals the bar until pointer leaves nav + zone.
 */
(function () {
  'use strict';
  if (window.__navAutoHideInit) return;
  window.__navAutoHideInit = true;

  var nav = document.querySelector('nav.site-header');
  if (!nav && document.body.classList.contains('case-page')) {
    nav = document.querySelector('body > nav');
  }
  if (!nav || nav.classList.contains('case-next-project')) return;

  if (nav.classList.contains('site-header')) {
    function markNavLandingDone() {
      nav.classList.add('site-header--landing-done');
    }
    if (
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      markNavLandingDone();
    } else {
      nav.addEventListener('animationend', function (e) {
        var name = e.animationName || '';
        if (name === 'landingNavDrop' || /landingNavDrop$/i.test(name)) {
          markNavLandingDone();
        }
      });
      setTimeout(markNavLandingDone, 4000);
    }
  }

  var contact = document.querySelector('.site-contact');
  var recolorBtn = document.querySelector('.hero-recolor-btn');
  var hiddenClass = 'is-header-hidden';
  var lastY = window.scrollY || 0;
  var threshold = 8;
  var topRevealPx = 40;

  var wantsHidden = false;
  var hoverReveal = false;

  function syncHiddenClass() {
    var shouldHide = wantsHidden && !hoverReveal;
    if (shouldHide) {
      nav.classList.add(hiddenClass);
      if (contact) {
        contact.classList.add('site-contact--intro-done');
        contact.classList.add('is-hidden-on-scroll');
      }
      if (recolorBtn) {
        recolorBtn.classList.add('hero-recolor-btn--intro-done');
        recolorBtn.classList.add('is-hidden-on-scroll');
      }
    } else {
      nav.classList.remove(hiddenClass);
      if (contact) contact.classList.remove('is-hidden-on-scroll');
      if (recolorBtn) recolorBtn.classList.remove('is-hidden-on-scroll');
    }
  }

  function onScroll() {
    var y = window.scrollY || 0;
    var dy = y - lastY;

    if (y <= topRevealPx) {
      wantsHidden = false;
    } else if (dy > threshold) {
      wantsHidden = true;
    } else if (dy < -threshold) {
      wantsHidden = false;
    }

    lastY = y;
    syncHiddenClass();
  }

  var zone = document.createElement('div');
  zone.className = 'site-nav-hover-zone';
  zone.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(zone, document.body.firstChild);

  zone.addEventListener('mouseenter', function () {
    if (!wantsHidden) return;
    hoverReveal = true;
    syncHiddenClass();
  });

  zone.addEventListener('mouseleave', function (e) {
    var rel = e.relatedTarget;
    if (rel && nav.contains(rel)) return;
    hoverReveal = false;
    syncHiddenClass();
  });

  nav.addEventListener('mouseleave', function (e) {
    var rel = e.relatedTarget;
    if (rel && (zone.contains(rel) || nav.contains(rel))) return;
    hoverReveal = false;
    syncHiddenClass();
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
