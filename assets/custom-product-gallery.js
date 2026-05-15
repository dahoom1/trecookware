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

    // LTR: slides left→right, translateX(-n*100%) moves strip left, next slide enters from right
    // RTL: slides right→left (inherited dir), translateX(+n*100%) moves strip right, next slide enters from left
    var sign = this.isRTL ? 1 : -1;
    this.slider.style.transition = 'transform 0.35s ease';
    this.slider.style.transform = 'translateX(' + (sign * index * 100) + '%)';

    // Keep active class for variant-switching compatibility
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
    // Disable transition so the slide follows the finger instantly
    this.slider.style.transition = 'none';
  }

  handleTouchMove(e) {
    if (!this.touchStartX) return;
    var deltaX = e.touches[0].clientX - this.touchStartX;
    var deltaY = e.touches[0].clientY - this.touchStartY;
    if (!this.isSwiping && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      this.isSwiping = true;
    }
    if (this.isSwiping) {
      e.preventDefault();
      var sliderWidth = this.slider.offsetWidth;
      var sign = this.isRTL ? 1 : -1;
      var basePercent = sign * this.currentSlide * 100;
      var dragPercent = (deltaX / sliderWidth) * 100;
      // Boundary rubber-band
      // LTR: right-swipe (deltaX>0) at slide 0 = before start; RTL: left-swipe (deltaX<0) = before start
      var atStart = this.currentSlide === 0 && (this.isRTL ? deltaX < 0 : deltaX > 0);
      var atEnd = this.currentSlide === this.slides.length - 1 && (this.isRTL ? deltaX > 0 : deltaX < 0);
      if (atStart || atEnd) dragPercent *= 0.3;
      this.slider.style.transform = 'translateX(' + (basePercent + dragPercent) + '%)';
    }
  }

  handleTouchEnd(e) {
    if (!this.isSwiping) {
      this.touchStartX = 0;
      this.slider.style.transition = 'transform 0.35s ease';
      return;
    }
    this.touchEndX = e.changedTouches[0].clientX;
    this.handleSwipe(false);
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.isSwiping = false;
  }

  handleSwipe(isModal) {
    var diff = this.touchStartX - this.touchEndX;

    // Snap back if swipe was too short
    if (!isModal && Math.abs(diff) < 50) {
      this.goToSlide(this.currentSlide);
      return;
    }
    if (isModal && Math.abs(diff) < 50) return;

    // LTR: swipe left (diff > 0) = next; RTL: swipe right (diff < 0) = next
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

  // Magnifier: body-level fixed element (avoids overflow:hidden / z-index constraints).
  // 50ms hold to distinguish from swipe/scroll. No e.cancelable dependency (iOS unreliable).
  setupMagnifier() {
    var self = this;

    // Create one shared magnifier appended to body — lives outside any overflow:hidden
    if (!document._galleryMagnifier) {
      var mag = document.createElement('div');
      mag.className = 'custom-gallery__magnifier-global';
      document.body.appendChild(mag);
      document._galleryMagnifier = mag;
    }

    for (var i = 0; i < this.slides.length; i++) {
      var wrapper = this.slides[i].querySelector('.custom-gallery__image-wrapper');
      if (!wrapper) continue;
      (function (w) {
        var startX = 0, startY = 0, lastX = 0, lastY = 0;
        var magnifierActive = false;
        var holdTimer = null;

        function cancelAll() {
          if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
          magnifierActive = false;
          self.hideGlobalMagnifier();
        }

        // Suppress native long-press context menu (Android / iOS)
        w.addEventListener('contextmenu', function (e) { e.preventDefault(); });

        w.addEventListener('touchstart', function (e) {
          cancelAll();
          startX = lastX = e.touches[0].clientX;
          startY = lastY = e.touches[0].clientY;

          // 50ms hold: short enough to feel instant, long enough for swipe/scroll to cancel first
          holdTimer = setTimeout(function () {
            holdTimer = null;
            magnifierActive = true;
            self.showGlobalMagnifier(lastX, lastY, w);
          }, 50);
        }, { passive: true });

        w.addEventListener('touchmove', function (e) {
          lastX = e.touches[0].clientX;
          lastY = e.touches[0].clientY;
          var absDx = Math.abs(lastX - startX);
          var absDy = Math.abs(lastY - startY);

          if (!magnifierActive) {
            // Cancel hold timer on any significant movement (swipe or scroll intent)
            if ((absDx > 8 || absDy > 8) && holdTimer) {
              clearTimeout(holdTimer);
              holdTimer = null;
            }
            return;
          }

          // Magnifier is active — movement only updates the loupe, never cancels it.
          // Only touchend/touchcancel will dismiss it.
          e.stopPropagation();
          e.preventDefault();
          self.showGlobalMagnifier(lastX, lastY, w);
        }, { passive: false });

        w.addEventListener('touchend', function (e) {
          var wasActive = magnifierActive;
          cancelAll();
          if (wasActive) e.stopPropagation();
        });

        w.addEventListener('touchcancel', cancelAll);
      })(wrapper);
    }
  }

  showGlobalMagnifier(clientX, clientY, wrapper) {
    var mag = document._galleryMagnifier;
    if (!mag) return;

    var img = wrapper.querySelector('.custom-gallery__image');
    if (!img) return;

    var magSize = 200;
    var zoom = 3;

    // Fixed position — centered on finger horizontally, above the finger
    var magLeft = clientX - magSize / 2;
    var magTop = clientY - magSize - 30;

    // Clamp within viewport
    magLeft = Math.max(10, Math.min(magLeft, window.innerWidth - magSize - 10));
    magTop = Math.max(10, Math.min(magTop, window.innerHeight - magSize - 10));

    mag.style.left = magLeft + 'px';
    mag.style.top = magTop + 'px';

    // Background image from the actual image element's resolved src
    var imgSrc = img.currentSrc || img.src;
    if (mag._imgSrc !== imgSrc) {
      mag._imgSrc = imgSrc;
      mag.style.backgroundImage = 'url(' + imgSrc + ')';
    }

    // Map touch point to image-relative coordinates for background offset
    var imgRect = img.getBoundingClientRect();
    var x = clientX - imgRect.left;
    var y = clientY - imgRect.top;

    var bgW = imgRect.width * zoom;
    var bgH = imgRect.height * zoom;
    mag.style.backgroundSize = bgW + 'px ' + bgH + 'px';

    var bgX = -(x * zoom - magSize / 2);
    var bgY = -(y * zoom - magSize / 2);
    mag.style.backgroundPosition = bgX + 'px ' + bgY + 'px';

    mag.classList.add('active');
  }

  hideGlobalMagnifier() {
    var mag = document._galleryMagnifier;
    if (mag) mag.classList.remove('active');
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
