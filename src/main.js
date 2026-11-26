import 'photoswipe/style.css';
import 'photoswipe-dynamic-caption-plugin/photoswipe-dynamic-caption-plugin.css';
import { createIcons, Phone, Menu, X, ChevronDown, MapPin, Mail, Clock, ArrowUp, ArrowRight, } from 'lucide';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Masonry from 'masonry-layout';

// Suppress ResizeObserver benign errors
window.addEventListener('error', e => {
  const msg = e.message || (e.error && e.error.message) || '';
  if (msg.includes('ResizeObserver loop completed with undelivered notifications.') || 
      msg.includes('ResizeObserver loop limit exceeded')) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}, true);

// Initialize specific icons
createIcons({
  icons: {
    Phone,
    Menu,
    X,
    ChevronDown,
    MapPin,
    Mail,
    Clock,
    ArrowUp,
    ArrowRight
  }
});

// --- ELEMENTS CACHE ---
const navbar = document.getElementById('navbar');
const brandLogo = document.getElementById('brand-logo');
const navLinks = document.querySelectorAll('.nav-link');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const closeMenuBtn = document.getElementById('close-menu-btn');
const mobileMenuLinks = mobileMenu ? mobileMenu.querySelectorAll('a, button') : [];
const form = document.getElementById('contact-form');
const result = document.getElementById('result');
const selectEl = document.getElementById('service-select');
const scrollToTopBtn = document.getElementById('scrollToTop');
const grid = document.querySelector('.grid-gallery');

// --- NAVBAR SCROLL STATE TRACKING ---
if (navbar && brandLogo) {
  // 1. Extract the layout mutation logic into a standalone function
  const handleNavbarState = () => {
    if (window.scrollY > 50) {
      navbar.classList.add('bg-brand-surface/95', 'backdrop-blur-md', 'shadow-2xl', 'py-3');
      navbar.classList.remove('py-4');
      brandLogo.classList.add('text-brand-primary');
      navLinks.forEach(link => {
        link.classList.add('text-brand-text');
      });
    } else {
      navbar.classList.remove('bg-brand-surface/95', 'backdrop-blur-md', 'shadow-2xl', 'py-3');
      navbar.classList.add('py-4');
      brandLogo.classList.remove('text-brand-primary');
      navLinks.forEach(link => {
        link.classList.remove('text-brand-text');
      });
    }
  };

  // 2. Run immediately on script execution to check if the user loaded mid-page
  handleNavbarState();

  // 3. Attach the exact same listener loop to catch active scrolling
  window.addEventListener('scroll', handleNavbarState);
}

// Mobile menu toggle
if (mobileMenu && mobileMenuBtn && closeMenuBtn) {
  mobileMenuBtn.addEventListener('click', () => {
    const navItems = mobileMenu.querySelectorAll('a');
    
    // Kill any running animations instantly
    gsap.killTweensOf([mobileMenu, navItems]);
    
    // Pull the structural display layer out BEFORE running the animation track
    mobileMenu.classList.remove('translate-x-full');
    gsap.set(navItems, { transition: 'none' });

    const tl = gsap.timeline();
    tl.fromTo(mobileMenu, 
      { x: '100%' }, 
      { x: '0%', duration: 0.5, ease: 'power3.out' }
    )
    .fromTo(navItems, 
      { y: 20, opacity: 0 },
      { 
        y: 0, 
        opacity: 1, 
        duration: 0.4, 
        stagger: 0.08, 
        ease: 'power3.out',
        clearProps: 'all' // Cleanly hands back sizing to CSS styles
      },
      '-=0.2'
    );
  });

  const closeMobileMenu = () => {
    const navItems = mobileMenu.querySelectorAll('a');
    gsap.killTweensOf([mobileMenu, navItems]);
    
    gsap.to(mobileMenu, {
      x: '100%',
      duration: 0.4,
      ease: 'power3.in',
      onComplete: () => {
        mobileMenu.classList.add('translate-x-full');
        gsap.set(mobileMenu, { clearProps: 'transform' });
      }
    });
  };

  closeMenuBtn.addEventListener('click', closeMobileMenu);
  mobileMenu.addEventListener('click', (e) => { if (e.target === mobileMenu) closeMobileMenu(); });
  mobileMenuLinks.forEach(link => link.addEventListener('click', closeMobileMenu));
}

// Fade-in animations on scroll using GSAP ScrollTrigger
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const mm = gsap.matchMedia();
mm.add('(prefers-reduced-motion: no-preference)', () => {
  const revealBlocks = (targets, { y = 24, duration = 0.65, stagger = 0.08, start = 'top 88%' } = {}) => {
    const elements = gsap.utils.toArray(targets);
    if (!elements.length) return;

    gsap.set(elements, { y, opacity: 0, force3D: true });
    ScrollTrigger.batch(elements, {
      start,
      once: true,
      onEnter: (batch) => {
        gsap.to(batch, {
          y: 0,
          opacity: 1,
          duration,
          stagger,
          ease: 'power3.out',
          force3D: true,
          overwrite: 'auto'
        });
      }
    });
  };

  // About text column & photo reveal independently (staggered on desktop, per-block on mobile)
  revealBlocks('#about > div > div');

  // Services heading & individual cards
  revealBlocks('#services > div:first-child');
  revealBlocks('#tree-removal, #stump-grinding, #storm-damage');

  // Reviews, Gallery heading, Service Area, and Contact content blocks
  revealBlocks('#reviews > div, #gallery > div > div:first-child, #location > div, #contact > div:not(.absolute)');

  // Project gallery photos with subtle, quick stagger (targets <a> to avoid Masonry/img hover conflict)
  revealBlocks('#project-gallery .grid-item a', { y: 20, duration: 0.5, stagger: 0.06, start: 'top 90%' });

  // Shared reveal hook for service subpages
  revealBlocks('.reveal-block');
});

window.addEventListener('load', () => {
  ScrollTrigger.refresh();
});

// Lock review stage min-height to the tallest slide per viewport width so carousel slides never shrink/bounce the page
const reviewsWidgetStage = document.getElementById('reviews-widget-stage');
const reviewsWidgetInner = reviewsWidgetStage ? reviewsWidgetStage.firstElementChild : null;
if (reviewsWidgetStage && reviewsWidgetInner) {
  let reviewsResizeTimeout;
  let reviewsRafId;
  let maxReviewsHeight = 0;
  let lastViewportWidth = window.innerWidth;

  const syncReviewsStageHeight = () => {
    const innerHeight = reviewsWidgetInner.offsetHeight;
    if (!innerHeight) return;

    const style = getComputedStyle(reviewsWidgetStage);
    const chromeHeight =
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom) +
      parseFloat(style.borderTopWidth) +
      parseFloat(style.borderBottomWidth);
    const requiredHeight = Math.ceil(innerHeight + chromeHeight);

    if (requiredHeight > maxReviewsHeight) {
      maxReviewsHeight = requiredHeight;
      reviewsWidgetStage.style.minHeight = `${maxReviewsHeight}px`;
      clearTimeout(reviewsResizeTimeout);
      reviewsResizeTimeout = setTimeout(() => {
        ScrollTrigger.refresh();
      }, 150);
    }
  };

  const scheduleSyncReviewsStageHeight = () => {
    cancelAnimationFrame(reviewsRafId);
    reviewsRafId = requestAnimationFrame(syncReviewsStageHeight);
  };

  const reviewsObserver = new ResizeObserver(scheduleSyncReviewsStageHeight);
  reviewsObserver.observe(reviewsWidgetInner);

  window.addEventListener('resize', () => {
    if (window.innerWidth === lastViewportWidth) return;
    lastViewportWidth = window.innerWidth;
    maxReviewsHeight = 0;
    reviewsWidgetStage.style.minHeight = '';
    scheduleSyncReviewsStageHeight();
  });
}

// Initialize Masonry Layout
if (grid) {
  const msnry = new Masonry(grid, {
    itemSelector: '.grid-item',
    columnWidth: '.grid-sizer',
    percentPosition: true,
    transitionDuration: '0.4s'
  });

  let resizeTimeout;
  const resizeObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => { 
      msnry.layout(); 
      ScrollTrigger.refresh();
    }, 100);
  });
  
  resizeObserver.observe(grid);
}

// PhotoSwipe Lightbox initialization
const setupGallery = async () => {
  // Prevent script execution if the gallery component is not present on the current layout
  if (!document.getElementById('project-gallery')) return;

  const [PhotoSwipeLightboxModule, PhotoSwipeDynamicCaptionModule] = await Promise.all([
    import('photoswipe/lightbox'),
    import('photoswipe-dynamic-caption-plugin')
  ]);

  const PhotoSwipeLightbox = PhotoSwipeLightboxModule.default;
  const PhotoSwipeDynamicCaption = PhotoSwipeDynamicCaptionModule.default;

  const lightbox = new PhotoSwipeLightbox({
    gallery: '#project-gallery',
    children: 'a',
    pswpModule: () => import('photoswipe'),
    initialZoomLevel: 'fit',
    secondaryZoomLevel: 1.5,
    maxZoomLevel: 2,
    bgClickAction: 'close',
    tapAction: 'close'
  });

  new PhotoSwipeDynamicCaption(lightbox, {
    type: 'auto',
    captionContent: (slide) => slide.data.element.getAttribute('data-pswp-caption-content'),
  });

  lightbox.init();
};

// Form submission with unified success template
if (form && result) {
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const formData = new FormData(form);
    const name = formData.get('name');
    const subject = `NEW ESTIMATE REQUEST FROM WEBSITE - ${name}`;
    formData.set('subject', subject);
    
    const object = Object.fromEntries(formData);
    const json = JSON.stringify(object);
    
    result.style.display = "block";
    result.innerHTML = "Please wait...";

    fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: json
    })
    .then(async (response) => {
        let resJson = await response.json();
        if (response.status == 200) {
          form.reset(); 
          result.innerHTML = `
            <div class="flex flex-col items-center text-center space-y-3 py-4 animate-fade-in">
              <span class="text-brand-primary text-4xl font-bold font-sans" aria-hidden="true">✓</span>
              <p class="text-white font-heading text-xl font-normal tracking-wide">
                ${resJson.message}
              </p>
              <p class="text-brand-text-muted font-sans text-xs uppercase tracking-widest pt-2 border-t border-gray-800 w-2/3 mx-auto">
                If you need to submit another request, please refresh the page.
              </p>
            </div>
          `;
        } else {
            result.innerHTML = resJson.message;
            if (submitBtn) submitBtn.disabled = false;
        }
    })
    .catch(error => {
        console.error(error);
        result.innerHTML = "Something went wrong! Please try again.";
        if (submitBtn) submitBtn.disabled = false;
    });
  });
}

// Scroll to top button functionality
if (scrollToTopBtn) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > (document.documentElement.scrollHeight / 3)) {
      scrollToTopBtn.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
      scrollToTopBtn.classList.add('opacity-100', 'translate-y-0');
    } else {
      scrollToTopBtn.classList.remove('opacity-100', 'translate-y-0');
      scrollToTopBtn.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
    }
  });

  scrollToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// Document-wide setup listeners
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', (e) => {
    const button = e.target.closest('[data-service]');
    if (button && selectEl) {
      selectEl.value = button.getAttribute('data-service');
    }
  });
});

// Defer gallery lightbox chunk loading until after initial paint & hero reveal
const initDeferredGallery = () => {
  setupGallery().then(() => {
    ScrollTrigger.refresh();
  });
};

if (document.readyState === 'complete') {
  initDeferredGallery();
} else {
  window.addEventListener('load', () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(initDeferredGallery, { timeout: 1500 });
    } else {
      setTimeout(initDeferredGallery, 250);
    }
  }, { once: true });
}