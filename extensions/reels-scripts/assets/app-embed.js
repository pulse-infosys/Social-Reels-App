// extensions/shoppable-videos/assets/app-embed.js

(function() {
  'use strict';

  class ShoppableVideosApp {
    constructor() {
      this.config = this.getConfig();
      this.widgets = [];
      this.initialized = false;
    }

    getConfig() {
      const container = document.getElementById('shoppable-videos-app');
      if (!container) {
        console.warn('ShoppableVideos: Config container not found');
        return null;
      }

      return {
        shop: container.dataset.shop,
        path: container.dataset.path || window.location.pathname,
        pageType: container.dataset.pageType,
        productHandle: container.dataset.productHandle,
        collectionHandle: container.dataset.collectionHandle,
      };
    }

    async init() {
      if (this.initialized || !this.config) return;

      console.log('ShoppableVideos: Initializing for path:', this.config.path);

      try {
        const data = await this.fetchWidgets();
        
        if (data && data.widgets && data.widgets.length > 0) {
          console.log('ShoppableVideos: Found widgets:', data.widgets.length);
          this.widgets = data.widgets;
          this.renderWidgets();
        } else {
          console.log('ShoppableVideos: No widgets for this page');
        }
        
        this.initialized = true;
      } catch (error) {
        console.error('ShoppableVideos: Init error', error);
      }
    }

    async fetchWidgets() {
      // Build API URL with current page path
      const params = new URLSearchParams({
        shop: this.config.shop,
        path: this.config.path,
      });
      
      // Use App Proxy URL
      const apiUrl = `/apps/shoppable-videos/api/storefront?${params.toString()}`;
      
      console.log('ShoppableVideos: Fetching from:', apiUrl);

      try {
        const response = await fetch(apiUrl);
        const result = await response.json();
        
        console.log('ShoppableVideos: API Response:', result);
        
        if (result.success) {
          return result.data;
        }
        return null;
      } catch (error) {
        console.error('ShoppableVideos: Fetch error', error);
        return null;
      }
    }

    renderWidgets() {
      this.widgets.forEach(widget => {
        console.log('ShoppableVideos: Rendering widget type:', widget.type);
        
        switch (widget.type) {
          case 'stories':
          case 'story':
            this.renderStoryWidget(widget);
            break;
          case 'floating':
            this.renderFloatingWidget(widget);
            break;
          case 'carousel':
            this.renderCarouselWidget(widget);
            break;
          default:
            console.warn('ShoppableVideos: Unknown widget type:', widget.type);
        }
      });
    }

    // ==================== STORY WIDGET ====================
    renderStoryWidget(widget) {
      if (!widget.videos || widget.videos.length === 0) return;

      const container = document.createElement('div');
      container.className = 'sv-story-container';
      container.id = `sv-story-${widget.id}`;

      const storiesHTML = widget.videos.map((video, index) => `
        <div class="sv-story-item" data-video-index="${index}" data-video-id="${video.id}">
          <div class="sv-story-thumbnail">
            <img src="${video.thumbnailUrl}" alt="${video.title || ''}" loading="lazy">
            <div class="sv-story-ring"></div>
          </div>
          <span class="sv-story-title">${this.truncateText(video.title, 10)}</span>
        </div>
      `).join('');

      container.innerHTML = `
        <div class="sv-story-wrapper">
          <div class="sv-story-list">${storiesHTML}</div>
        </div>
      `;

      // Insert at top of main content
      const mainContent = document.querySelector('main') || document.body.firstElementChild;
      if (mainContent) {
        mainContent.insertBefore(container, mainContent.firstChild);
      } else {
        document.body.insertBefore(container, document.body.firstChild);
      }

      // Add click handlers
      this.initStoryClickHandlers(widget);
    }

    initStoryClickHandlers(widget) {
      const items = document.querySelectorAll(`#sv-story-${widget.id} .sv-story-item`);
      
      items.forEach(item => {
        item.addEventListener('click', () => {
          const videoIndex = parseInt(item.dataset.videoIndex);
          this.openStoryModal(widget, videoIndex);
        });
      });
    }

    openStoryModal(widget, startIndex = 0) {
      // Remove existing modal
      const existingModal = document.getElementById('sv-story-modal');
      if (existingModal) existingModal.remove();

      const video = widget.videos[startIndex];

      const modal = document.createElement('div');
      modal.id = 'sv-story-modal';
      modal.className = 'sv-modal sv-story-modal';

      modal.innerHTML = `
        <div class="sv-modal-overlay"></div>
        <div class="sv-modal-content">
          <button class="sv-modal-close">&times;</button>
          <div class="sv-story-viewer">
            <div class="sv-story-progress">
              ${widget.videos.map((_, i) => `
                <div class="sv-progress-bar ${i < startIndex ? 'sv-viewed' : ''} ${i === startIndex ? 'sv-active' : ''}" data-index="${i}">
                  <div class="sv-progress-fill"></div>
                </div>
              `).join('')}
            </div>
            <div class="sv-story-video-container">
              <video 
                id="sv-story-video"
                src="${video.videoUrl}"
                poster="${video.thumbnailUrl}"
                playsinline
                autoplay
              ></video>
            </div>
            <div class="sv-story-nav">
              <button class="sv-nav-prev" ${startIndex === 0 ? 'disabled' : ''}>&lt;</button>
              <button class="sv-nav-next" ${startIndex === widget.videos.length - 1 ? 'disabled' : ''}>&gt;</button>
            </div>
            <div class="sv-story-products">
              ${this.renderProducts(video.products)}
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      document.body.style.overflow = 'hidden';

      this.initStoryViewer(modal, widget, startIndex);
    }

    initStoryViewer(modal, widget, currentIndex) {
      const video = modal.querySelector('#sv-story-video');
      const prevBtn = modal.querySelector('.sv-nav-prev');
      const nextBtn = modal.querySelector('.sv-nav-next');
      const closeBtn = modal.querySelector('.sv-modal-close');
      const overlay = modal.querySelector('.sv-modal-overlay');
      const progressBars = modal.querySelectorAll('.sv-progress-bar');
      const productsContainer = modal.querySelector('.sv-story-products');

      let index = currentIndex;

      const updateStory = (newIndex) => {
        if (newIndex < 0 || newIndex >= widget.videos.length) return;
        
        index = newIndex;
        const currentVideo = widget.videos[index];
        
        video.src = currentVideo.videoUrl;
        video.poster = currentVideo.thumbnailUrl;
        video.play().catch(() => {});
        
        // Update progress bars
        progressBars.forEach((bar, i) => {
          bar.classList.remove('sv-active', 'sv-viewed');
          const fill = bar.querySelector('.sv-progress-fill');
          if (fill) fill.style.width = '0%';
          
          if (i < index) {
            bar.classList.add('sv-viewed');
            if (fill) fill.style.width = '100%';
          }
          if (i === index) bar.classList.add('sv-active');
        });
        
        // Update products
        productsContainer.innerHTML = this.renderProducts(currentVideo.products);
        
        // Update nav buttons
        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === widget.videos.length - 1;
      };

      // Video progress
      video.addEventListener('timeupdate', () => {
        if (video.duration) {
          const progress = (video.currentTime / video.duration) * 100;
          const activeBar = modal.querySelector('.sv-progress-bar.sv-active .sv-progress-fill');
          if (activeBar) activeBar.style.width = `${progress}%`;
        }
      });

      // Video ended
      video.addEventListener('ended', () => {
        if (index < widget.videos.length - 1) {
          updateStory(index + 1);
        } else {
          this.closeModal(modal);
        }
      });

      // Navigation
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateStory(index - 1);
      });
      
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateStory(index + 1);
      });

      // Close
      closeBtn.addEventListener('click', () => this.closeModal(modal));
      overlay.addEventListener('click', () => this.closeModal(modal));

      // Keyboard
      const handleKeydown = (e) => {
        if (e.key === 'ArrowLeft') updateStory(index - 1);
        if (e.key === 'ArrowRight') updateStory(index + 1);
        if (e.key === 'Escape') this.closeModal(modal);
      };
      document.addEventListener('keydown', handleKeydown);
      modal._keydownHandler = handleKeydown;
    }

    // ==================== FLOATING WIDGET ====================
    renderFloatingWidget(widget) {
      if (!widget.videos || widget.videos.length === 0) return;

      const firstVideo = widget.videos[0];
      
      const container = document.createElement('div');
      container.className = 'sv-floating-container';
      container.id = `sv-floating-${widget.id}`;

      container.innerHTML = `
        <div class="sv-floating-bubble">
          <video 
            src="${firstVideo.videoUrl}" 
            poster="${firstVideo.thumbnailUrl}"
            muted 
            loop 
            playsinline
            autoplay
          ></video>
          ${widget.videos.length > 1 ? `<div class="sv-floating-badge">${widget.videos.length}</div>` : ''}
        </div>
      `;

      document.body.appendChild(container);

      // Click handler
      container.querySelector('.sv-floating-bubble').addEventListener('click', () => {
        this.openFloatingModal(widget);
      });
    }

    openFloatingModal(widget) {
      const existingModal = document.getElementById('sv-floating-modal');
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = 'sv-floating-modal';
      modal.className = 'sv-modal sv-floating-modal';

      const firstVideo = widget.videos[0];

      modal.innerHTML = `
        <div class="sv-modal-overlay"></div>
        <div class="sv-modal-content">
          <button class="sv-modal-close">&times;</button>
          <div class="sv-floating-viewer">
            <div class="sv-video-main">
              <video 
                id="sv-floating-video"
                src="${firstVideo.videoUrl}"
                poster="${firstVideo.thumbnailUrl}"
                controls
                playsinline
                autoplay
              ></video>
            </div>
            <div class="sv-floating-sidebar">
              <div class="sv-video-list">
                ${widget.videos.map((video, i) => `
                  <div class="sv-video-thumb ${i === 0 ? 'sv-active' : ''}" data-index="${i}">
                    <img src="${video.thumbnailUrl}" alt="${video.title || ''}">
                    <span>${this.truncateText(video.title, 20)}</span>
                  </div>
                `).join('')}
              </div>
              <div class="sv-products-panel">
                <h4>Shop Products</h4>
                ${this.renderProducts(firstVideo.products)}
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      document.body.style.overflow = 'hidden';

      this.initFloatingViewer(modal, widget);
    }

    initFloatingViewer(modal, widget) {
      const video = modal.querySelector('#sv-floating-video');
      const thumbs = modal.querySelectorAll('.sv-video-thumb');
      const productsPanel = modal.querySelector('.sv-products-panel');
      const closeBtn = modal.querySelector('.sv-modal-close');
      const overlay = modal.querySelector('.sv-modal-overlay');

      thumbs.forEach(thumb => {
        thumb.addEventListener('click', () => {
          const index = parseInt(thumb.dataset.index);
          const currentVideo = widget.videos[index];
          
          video.src = currentVideo.videoUrl;
          video.poster = currentVideo.thumbnailUrl;
          video.play().catch(() => {});
          
          thumbs.forEach(t => t.classList.remove('sv-active'));
          thumb.classList.add('sv-active');
          
          productsPanel.innerHTML = `
            <h4>Shop Products</h4>
            ${this.renderProducts(currentVideo.products)}
          `;
        });
      });

      closeBtn.addEventListener('click', () => this.closeModal(modal));
      overlay.addEventListener('click', () => this.closeModal(modal));
    }

    // ==================== CAROUSEL WIDGET ====================
    renderCarouselWidget(widget) {
      if (!widget.videos || widget.videos.length === 0) return;

      const container = document.createElement('div');
      container.className = 'sv-carousel-container';
      container.id = `sv-carousel-${widget.id}`;

      const slidesHTML = widget.videos.map((video, index) => `
        <div class="sv-carousel-slide" data-index="${index}">
          <div class="sv-carousel-video-wrapper">
            <video 
              src="${video.videoUrl}"
              poster="${video.thumbnailUrl}"
              muted
              loop
              playsinline
            ></video>
            <div class="sv-play-overlay">
              <svg viewBox="0 0 24 24" fill="white" width="48" height="48">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
          <div class="sv-carousel-info">
            <h4>${video.title || 'Video'}</h4>
            ${video.products && video.products.length > 0 ? `
              <div class="sv-carousel-products">
                ${video.products.slice(0, 2).map(p => `
                  <a href="/products/${p.handle}" class="sv-mini-product">
                    <img src="${p.image}" alt="${p.title || ''}">
                  </a>
                `).join('')}
                ${video.products.length > 2 ? `<span class="sv-more-products">+${video.products.length - 2}</span>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `).join('');

      container.innerHTML = `
        <div class="sv-carousel-header">
          <h3>Shop Our Videos</h3>
        </div>
        <div class="sv-carousel-wrapper">
          <button class="sv-carousel-nav sv-prev" aria-label="Previous">&lt;</button>
          <div class="sv-carousel-track">${slidesHTML}</div>
          <button class="sv-carousel-nav sv-next" aria-label="Next">&gt;</button>
        </div>
      `;

      // Insert before footer or at end of main
      const footer = document.querySelector('footer');
      const main = document.querySelector('main');
      
      if (footer && footer.parentNode) {
        footer.parentNode.insertBefore(container, footer);
      } else if (main) {
        main.appendChild(container);
      } else {
        document.body.appendChild(container);
      }

      this.initCarousel(container, widget);
    }

    initCarousel(container, widget) {
      const track = container.querySelector('.sv-carousel-track');
      const slides = container.querySelectorAll('.sv-carousel-slide');
      const prevBtn = container.querySelector('.sv-prev');
      const nextBtn = container.querySelector('.sv-next');

      if (!slides.length) return;

      let currentSlide = 0;
      
      const getSlidesToShow = () => {
        const width = window.innerWidth;
        if (width >= 1200) return 4;
        if (width >= 992) return 3;
        if (width >= 576) return 2;
        return 1;
      };

      const updateCarousel = () => {
        const slidesToShow = getSlidesToShow();
        const maxSlide = Math.max(0, slides.length - slidesToShow);
        
        if (currentSlide > maxSlide) currentSlide = maxSlide;
        
        const slideWidth = slides[0].offsetWidth;
        const gap = 16;
        track.style.transform = `translateX(-${currentSlide * (slideWidth + gap)}px)`;
        
        prevBtn.disabled = currentSlide === 0;
        nextBtn.disabled = currentSlide >= maxSlide;
        
        prevBtn.style.opacity = currentSlide === 0 ? '0.3' : '1';
        nextBtn.style.opacity = currentSlide >= maxSlide ? '0.3' : '1';
      };

      prevBtn.addEventListener('click', () => {
        if (currentSlide > 0) {
          currentSlide--;
          updateCarousel();
        }
      });

      nextBtn.addEventListener('click', () => {
        const slidesToShow = getSlidesToShow();
        const maxSlide = Math.max(0, slides.length - slidesToShow);
        if (currentSlide < maxSlide) {
          currentSlide++;
          updateCarousel();
        }
      });

      // Hover to play
      slides.forEach(slide => {
        const video = slide.querySelector('video');
        const overlay = slide.querySelector('.sv-play-overlay');
        
        slide.addEventListener('mouseenter', () => {
          video.play().catch(() => {});
          if (overlay) overlay.style.opacity = '0';
        });
        
        slide.addEventListener('mouseleave', () => {
          video.pause();
          video.currentTime = 0;
          if (overlay) overlay.style.opacity = '1';
        });

        // Click to open modal
        slide.addEventListener('click', () => {
          const index = parseInt(slide.dataset.index);
          this.openCarouselModal(widget, index);
        });
      });

      // Resize handler
      let resizeTimeout;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(updateCarousel, 100);
      });

      updateCarousel();
    }

    openCarouselModal(widget, startIndex = 0) {
      const existingModal = document.getElementById('sv-carousel-modal');
      if (existingModal) existingModal.remove();

      const video = widget.videos[startIndex];

      const modal = document.createElement('div');
      modal.id = 'sv-carousel-modal';
      modal.className = 'sv-modal sv-carousel-modal';

      modal.innerHTML = `
        <div class="sv-modal-overlay"></div>
        <div class="sv-modal-content">
          <button class="sv-modal-close">&times;</button>
          <div class="sv-carousel-viewer">
            <div class="sv-video-section">
              <video 
                id="sv-carousel-video"
                src="${video.videoUrl}"
                poster="${video.thumbnailUrl}"
                controls
                playsinline
                autoplay
              ></video>
            </div>
            <div class="sv-products-section">
              <h3>Featured Products</h3>
              ${this.renderProductsDetailed(video.products)}
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      document.body.style.overflow = 'hidden';

      const closeBtn = modal.querySelector('.sv-modal-close');
      const overlay = modal.querySelector('.sv-modal-overlay');

      closeBtn.addEventListener('click', () => this.closeModal(modal));
      overlay.addEventListener('click', () => this.closeModal(modal));
    }

    // ==================== HELPER METHODS ====================
    renderProducts(products) {
      if (!products || products.length === 0) {
        return '<p class="sv-no-products">No products tagged</p>';
      }

      return `
        <div class="sv-products-grid">
          ${products.map(product => `
            <a href="/products/${product.handle}" class="sv-product-card">
              <img src="${product.image || ''}" alt="${product.title || ''}" loading="lazy">
              <div class="sv-product-info">
                <span class="sv-product-title">${this.truncateText(product.title, 25)}</span>
                <span class="sv-product-price">${this.formatPrice(product.price)}</span>
              </div>
            </a>
          `).join('')}
        </div>
      `;
    }

    renderProductsDetailed(products) {
      if (!products || products.length === 0) {
        return '<p class="sv-no-products">No products tagged</p>';
      }

      return `
        <div class="sv-products-detailed">
          ${products.map(product => `
            <div class="sv-product-detail-card">
              <img src="${product.image || ''}" alt="${product.title || ''}" loading="lazy">
              <div class="sv-product-detail-info">
                <h4>${product.title || 'Product'}</h4>
                <span class="sv-price">${this.formatPrice(product.price)}</span>
                <a href="/products/${product.handle}" class="sv-view-btn">View Product</a>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    closeModal(modal) {
      const video = modal.querySelector('video');
      if (video) video.pause();
      
      if (modal._keydownHandler) {
        document.removeEventListener('keydown', modal._keydownHandler);
      }
      
      modal.remove();
      document.body.style.overflow = '';
    }

    truncateText(text, maxLength) {
      if (!text) return '';
      return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    formatPrice(price) {
      if (!price) return '';
      const num = parseFloat(price);
      return isNaN(num) ? price : `$${num.toFixed(2)}`;
    }
  }

  // Initialize when DOM ready
  function init() {
    const app = new ShoppableVideosApp();
    app.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();