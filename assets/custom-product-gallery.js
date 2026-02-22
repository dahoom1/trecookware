/**
 * Custom Product Gallery with Full-Width Images and Zoom
 * Supports touch swipe, keyboard navigation, and zoom modal
 */

/* Single global keyboard listener shared across all gallery instances */
(function () {
  var activeModalGallery = null;

  document.addEventListener('keydown', function (e) {
    if (!activeModalGallery) return;
    if (e.key === 'Escape') {
      activeModalGallery.closeModal();
    } else if (e.key === 'ArrowLeft') {
      activeModalGallery.modalNavigate(activeModalGallery.isRTL ? 'next' : 'prev');
    } else if (e.key === 'ArrowRight') {
      activeModalGallery.modalNavigate(activeModalGallery.isRTL ? 'prev' : 'next');
    }
  });

  /* Shared live region - created once */
  var liveRegion = null;
  function getLiveRegion() {
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'gallery-live-region';
      liveRegion.className = 'visually-hidden';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      document.body.appendChild(liveRegion);
    }
    return liveRegion;
  }

  window.CustomGalleryGlobals = {
    setActiveModal: function (gallery) { activeModalGallery = gallery; },
    clearActiveModal: function (gallery) {
      if (activeModalGallery === gallery) activeModalGallery = null;
    },
    getLiveRegion: getLiveRegion
  };
})();

class CustomProductGallery {
  constructor(element) {
    if (element._galleryInitialized) return;
    element._galleryInitialized = true;

    this.gallery = element;
    this.currentSlide = 0;
    this.modalCurrentSlide = 0;
    this.isRTL = document.documentElement.getAttribute('dir') === 'rtl';

    // Elements
    this.slider = this.gallery.querySelector('.custom-gallery__slider');
    this.slides = this.gallery.querySelectorAll('.custom-gallery__slide');
    this.dots = this.gallery.querySelectorAll('.custom-gallery__dot');
    this.modal = this.gallery.querySelector('.custom-gallery__modal');
    this.modalSlider = this.gallery.querySelector('.custom-gallery__modal-slider');
    this.modalSlides = this.gallery.querySelectorAll('.custom-gallery__modal-slide');
    this.modalDots = this.gallery.querySelectorAll('.custom-gallery__modal-dot');
    this.modalClose = this.gallery.querySelector('.custom-gallery__modal-close');
    this.modalPrev = this.gallery.querySelector('.custom-gallery__modal-nav--prev');
    this.modalNext = this.gallery.querySelector('.custom-gallery__modal-nav--next');

    // Touch handling
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.touchStartY = 0;
    this.isSwiping = false;

    this.init();
  }

  init() {
    this.setupMainGallery();
    this.setupMagnifier();
    this.goToSlide(0);
  }

  setupMainGallery() {
    // Dot navigation - use event delegation on parent
    var dotsContainer = this.gallery.querySelector('.custom-gallery__dots');
    if (dotsContainer) {
      dotsContainer.addEventListener('click', function (e) {
        var dot = e.target.closest('.custom-gallery__dot');
        if (!dot) return;
        var index = parseInt(dot.getAttribute('data-slide-to'), 10);
        if (!isNaN(index)) this.goToSlide(index);
      }.bind(this));
    }

    // Touch swipe for main gallery
    if (this.slider) {
      this.slider.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
      this.slider.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
      this.slider.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
    }

  }

  setupModal() {
    if (!this.modal) return;

    if (this.modalClose) {
      this.modalClose.addEventListener('click', this.closeModal.bind(this));
    }

    var overlay = this.modal.querySelector('.custom-gallery__modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', this.closeModal.bind(this));
    }

    if (this.modalPrev) {
      this.modalPrev.addEventListener('click', function () {
        this.modalNavigate('prev');
      }.bind(this));
    }

    if (this.modalNext) {
      this.modalNext.addEventListener('click', function () {
        this.modalNavigate('next');
      }.bind(this));
    }

    // Touch swipe for modal
    if (this.modalSlider) {
      this.modalSlider.addEventListener('touchstart', this.handleModalTouchStart.bind(this), { passive: true });
      this.modalSlider.addEventListener('touchmove', this.handleModalTouchMove.bind(this), { passive: false });
      this.modalSlider.addEventListener('touchend', this.handleModalTouchEnd.bind(this), { passive: true });
    }

    // Prevent modal image dragging via delegation
    if (this.modalSlider) {
      this.modalSlider.addEventListener('dragstart', function (e) {
        if (e.target.tagName === 'IMG') e.preventDefault();
      });
    }
  }

  // Main Gallery Navigation
  goToSlide(index) {
    if (index < 0 || index >= this.slides.length) return;
    this.currentSlide = index;

    for (var i = 0; i < this.slides.length; i++) {
      this.slides[i].classList.toggle('active', i === index);
    }
    for (var i = 0; i < this.dots.length; i++) {
      this.dots[i].classList.toggle('active', i === index);
      if (i === index) {
        this.dots[i].setAttribute('aria-current', 'true');
      } else {
        this.dots[i].removeAttribute('aria-current');
      }
    }

    // Announce to screen readers
    var region = window.CustomGalleryGlobals.getLiveRegion();
    region.textContent = 'Image ' + (index + 1) + ' of ' + this.slides.length;
  }

  // Touch Handling for Main Gallery
  handleTouchStart(e) {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.isSwiping = false;
  }

  handleTouchMove(e) {
    if (!this.touchStartX) return;
    var deltaX = Math.abs(e.touches[0].clientX - this.touchStartX);
    var deltaY = Math.abs(e.touches[0].clientY - this.touchStartY);
    if (deltaX > deltaY && deltaX > 10) {
      this.isSwiping = true;
      e.preventDefault();
    }
  }

  handleTouchEnd(e) {
    if (!this.isSwiping) return;
    this.touchEndX = e.changedTouches[0].clientX;
    this.handleSwipe(false);
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.isSwiping = false;
  }

  handleSwipe(isModal) {
    var diff = this.touchStartX - this.touchEndX;
    if (Math.abs(diff) < 50) return;

    var goNext = this.isRTL ? diff < 0 : diff > 0;

    if (isModal) {
      this.modalNavigate(goNext ? 'next' : 'prev');
    } else {
      var newIndex = goNext
        ? (this.currentSlide + 1) % this.slides.length
        : (this.currentSlide - 1 + this.slides.length) % this.slides.length;
      this.goToSlide(newIndex);
    }
  }

  // Modal Functions
  openModal(slideIndex) {
    if (!this.modal) return;
    slideIndex = slideIndex || 0;
    this.modalCurrentSlide = slideIndex;
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('custom-gallery-modal-open');
    window.CustomGalleryGlobals.setActiveModal(this);
    this.goToModalSlide(slideIndex);
    if (this.modalClose) this.modalClose.focus();
  }

  closeModal() {
    if (!this.modal) return;
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('custom-gallery-modal-open');
    window.CustomGalleryGlobals.clearActiveModal(this);
  }

  goToModalSlide(index) {
    if (index < 0 || index >= this.modalSlides.length) return;
    this.modalCurrentSlide = index;

    for (var i = 0; i < this.modalSlides.length; i++) {
      this.modalSlides[i].classList.toggle('active', i === index);
    }
    for (var i = 0; i < this.modalDots.length; i++) {
      this.modalDots[i].classList.toggle('active', i === index);
    }
  }

  modalNavigate(direction) {
    var len = this.modalSlides.length;
    var newIndex = direction === 'next'
      ? (this.modalCurrentSlide + 1) % len
      : (this.modalCurrentSlide - 1 + len) % len;
    this.goToModalSlide(newIndex);
  }

  // Magnifier
  // Interaction: touch and hold (~150ms) → magnifier appears and follows finger.
  // Quick horizontal swipe → passes through to slide navigation as normal.
  setupMagnifier() {
    var self = this;
    for (var i = 0; i < this.slides.length; i++) {
      var wrapper = this.slides[i].querySelector('.custom-gallery__image-wrapper');
      if (!wrapper) continue;
      (function (w) {
        var startX = 0, startY = 0, lastX = 0, lastY = 0;
        var magnifierActive = false, swipeDetected = false;
        var holdTimer = null;

        function clearTimer() {
          if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        }

        // touchstart: record position and start hold timer
        w.addEventListener('touchstart', function (e) {
          startX = lastX = e.touches[0].clientX;
          startY = lastY = e.touches[0].clientY;
          magnifierActive = false;
          swipeDetected = false;
          clearTimer();
          holdTimer = setTimeout(function () {
            holdTimer = null;
            if (!swipeDetected) {
              magnifierActive = true;
              self.updateMagnifier(lastX, lastY, w);
            }
          }, 150);
        }, { passive: true });

        // touchmove: decide swipe vs magnifier
        w.addEventListener('touchmove', function (e) {
          lastX = e.touches[0].clientX;
          lastY = e.touches[0].clientY;
          var absDx = Math.abs(lastX - startX);
          var absDy = Math.abs(lastY - startY);

          // Before magnifier activates: if user is swiping horizontally,
          // cancel the hold timer and let the slider handle navigation
          if (!swipeDetected && !magnifierActive && absDx > 10 && absDx > absDy) {
            swipeDetected = true;
            clearTimer();
            return; // don't stopPropagation — slider's touchmove will handle it
          }

          if (swipeDetected) return; // committed to swipe, ignore rest

          if (magnifierActive) {
            e.stopPropagation(); // prevent slider from treating this as a swipe
            e.preventDefault();  // prevent page scroll (works because touch-action:none on wrapper)
            self.updateMagnifier(lastX, lastY, w);
          }
        }, { passive: false });

        // touchend: hide magnifier; stop propagation only when magnifier was active
        // (otherwise the slider's touchend fires and handles swipe navigation)
        w.addEventListener('touchend', function (e) {
          clearTimer();
          if (magnifierActive) {
            e.stopPropagation();
          }
          magnifierActive = false;
          swipeDetected = false;
          self.hideMagnifier(w);
        });

        w.addEventListener('touchcancel', function () {
          clearTimer();
          magnifierActive = false;
          swipeDetected = false;
          self.hideMagnifier(w);
        });
      })(wrapper);
    }
  }

  // clientX/clientY are page coordinates (from e.touches[0])
  updateMagnifier(clientX, clientY, wrapper) {
    var magnifier = wrapper.querySelector('.custom-gallery__magnifier');
    if (!magnifier) return;
    var img = wrapper.querySelector('.custom-gallery__image');
    if (!img) return;

    var rect = wrapper.getBoundingClientRect();
    var imgRect = img.getBoundingClientRect();
    var x = clientX - rect.left;  // touch position relative to image
    var y = clientY - rect.top;

    var magSize = 140;
    var zoom = 2.5;
    var fingerOffset = 20; // gap between magnifier bottom and finger tip

    // Centre the magnifier horizontally on the finger; position it above the finger
    var magLeft = Math.max(0, Math.min(x - magSize / 2, rect.width - magSize));
    var magTop = Math.max(0, Math.min(y - magSize - fingerOffset, rect.height - magSize));

    magnifier.style.left = magLeft + 'px';
    magnifier.style.top = magTop + 'px';

    // Use the browser-chosen responsive image src
    var imgSrc = img.currentSrc || img.src;
    if (magnifier._imgSrc !== imgSrc) {
      magnifier._imgSrc = imgSrc;
      magnifier.style.backgroundImage = 'url(' + imgSrc + ')';
    }

    // Scale background so the image appears zoom times larger inside the circle
    var bgW = imgRect.width * zoom;
    var bgH = imgRect.height * zoom;
    magnifier.style.backgroundSize = bgW + 'px ' + bgH + 'px';

    // Shift background so the touch point appears at the centre of the magnifier
    var bgX = -(x * zoom - magSize / 2);
    var bgY = -(y * zoom - magSize / 2);
    magnifier.style.backgroundPosition = bgX + 'px ' + bgY + 'px';

    magnifier.classList.add('visible');
  }

  hideMagnifier(wrapper) {
    var magnifier = wrapper ? wrapper.querySelector('.custom-gallery__magnifier') : null;
    if (magnifier) magnifier.classList.remove('visible');
  }

  // Touch Handling for Modal
  handleModalTouchStart(e) {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.isSwiping = false;
  }

  handleModalTouchMove(e) {
    if (!this.touchStartX) return;
    var deltaX = Math.abs(e.touches[0].clientX - this.touchStartX);
    var deltaY = Math.abs(e.touches[0].clientY - this.touchStartY);
    if (deltaX > deltaY && deltaX > 10) {
      this.isSwiping = true;
      e.preventDefault();
    }
  }

  handleModalTouchEnd(e) {
    if (!this.isSwiping) return;
    this.touchEndX = e.changedTouches[0].clientX;
    this.handleSwipe(true);
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.isSwiping = false;
  }
}

// Initialize galleries
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.custom-product-gallery').forEach(function (el) {
    new CustomProductGallery(el);
  });
});

// Shopify theme editor support
if (typeof Shopify !== 'undefined' && Shopify.designMode) {
  document.addEventListener('shopify:section:load', function () {
    document.querySelectorAll('.custom-product-gallery').forEach(function (el) {
      new CustomProductGallery(el);
    });
  });
}
