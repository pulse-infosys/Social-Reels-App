(function () {
  'use strict';

  async function init() {
    const containers = document.querySelectorAll('.reels-widget-container');
    if (!containers.length) return;

    console.log('[Reels] Found containers:', containers.length);

    containers.forEach(async (container) => {
      const shop = container.dataset.shop;
      const path = container.dataset.path || window.location.pathname;
      const widgetType = container.dataset.widgetType; // "carousel" or "story"

      console.log('[Reels] Init widget:', { shop, path, widgetType });

      if (!shop || !path || !widgetType) return;

      try {
        const params = new URLSearchParams({
          shop,
          path,
          widgetType,
        });

        const apiUrl = `/apps/shoppable-videos/api/storefront?${params.toString()}`;
        console.log('[Reels] Fetch URL:', apiUrl);

        const res = await fetch(apiUrl);
        const json = await res.json();

        console.log('[Reels] API response:', json);

        if (!json.success || !json.data || !json.data.widgets?.length) {
          container.innerHTML = '';
          return;
        }

        const widgets = json.data.widgets;
        let widget = null;


        if (widgetType === 'carousel') {
          widget = widgets.find(w => w.type === 'carousel');
        } else if (widgetType === 'story' || widgetType === 'stories') {
          widget = widgets.find(
            w => w.type === 'story' || w.type === 'stories'
          );
        }

        console.log('[Reels] Picked widget for section:', widget);

        if (!widget) {
          console.warn(
            '[Reels] No widget of type',
            widgetType,
            'found for this page'
          );
          container.innerHTML = '';
          return;
        }


        if (widgetType === 'carousel') {
          renderCarousel(container, widget);
        } else {
          renderStories(container, widget);
        }
      } catch (e) {
        console.error('[Reels] Error fetching widget', e);
      }
    });
  }

  function renderCarousel(container, widget) {
    if (!widget.videos || !widget.videos.length) {
      container.innerHTML = '';
      return;
    }

    const slidesHTML = widget.videos
      .map(
        (video, index) => `
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
            
          </div>
        </div>
        <div class="sv-carousel-info">
          <h4>${video.title || 'Video'}</h4>
          ${
            video.products?.length
              ? `
            <div class="sv-carousel-products">
              <a href="/products/${video.products[0].handle}" class="sv-mini-product" onclick="event.stopPropagation()">
                <img src="${video.products[0].image || ''}" alt="${video.products[0].title || ''}" />
              </a>
            </div>
          `
              : ''
          }
        </div>
      </div>
    `
      )
      .join('');

    container.innerHTML = `
      <div class="page-width carousel-widget">
        <button class="sv-carousel-nav sv-prev">&lt;</button>
        <div class="sv-carousel-track">
          ${slidesHTML}
        </div>
        <button class="sv-carousel-nav sv-next">&gt;</button>
      </div>
    `;

    initCarouselBehaviour(container, widget);
  }

  function initCarouselBehaviour(container, widget) {
    const track = container.querySelector('.sv-carousel-track');
    const slides = container.querySelectorAll('.sv-carousel-slide');
    const prevBtn = container.querySelector('.sv-prev');
    const nextBtn = container.querySelector('.sv-next');

    if (!slides.length) return;

    let current = 0;

    const getSlidesToShow = () => {
      const width = window.innerWidth;
      if (width >= 1200) return 4;
      if (width >= 992) return 3;
      if (width >= 768) return 2;
      return 1;
    };

    const update = () => {
      const slidesToShow = getSlidesToShow();
      const max = Math.max(0, slides.length - slidesToShow);
      if (current > max) current = max;

      const slideWidth = slides[0].offsetWidth;
      const gap = 20;
      track.style.transform = `translateX(-${current * (slideWidth + gap)}px)`;

      prevBtn.disabled = current === 0;
      nextBtn.disabled = current >= max;
    };

    prevBtn.addEventListener('click', () => {
      if (current > 0) {
        current--;
        update();
      }
    });

    nextBtn.addEventListener('click', () => {
      const slidesToShow = getSlidesToShow();
      const max = Math.max(0, slides.length - slidesToShow);
      if (current < max) {
        current++;
        update();
      }
    });

    // Hover video play
    // Videos autoplay + overlay hover behaviour
    slides.forEach((slide, index) => {
      const video = slide.querySelector('video');
      const overlay = slide.querySelector('.sv-play-overlay');

      if (video) {
        video.play().catch(() => {

        });
      }


      slide.addEventListener('mouseenter', () => {
        if (overlay) overlay.style.opacity = '0';
      });

      slide.addEventListener('mouseleave', () => {
        if (overlay) overlay.style.opacity = '1';
      });

      slide.addEventListener('click', () => {
        if (window.ShoppableVideosModal && window.ShoppableVideosModal.open) {
          window.ShoppableVideosModal.open(widget, index, 'carousel');
        }
      });
    });

    window.addEventListener('resize', () => {
      update();
    });

    update();
  }

  function renderStories(container, widget) {
    if (!widget.videos || !widget.videos.length) {
      container.innerHTML = '';
      return;
    }

    const items = widget.videos
      .map(
        (video, i) => `
        <div class="sv-story-item" data-index="${i}">
          <div class="sv-story-thumbnail">
            <video
              src="${video.videoUrl}"
              poster="${video.thumbnailUrl || ''}"
              muted
              autoplay
              loop
              playsinline
            ></video>
          </div>
          <span class="sv-story-title">${truncate(video.title, 10)}</span>
        </div>
      `
      )
      .join('');

    container.innerHTML = `
      <div class="page-width story-widget">
        <div class="sv-story-list">
          ${items}
        </div>
      </div>
    `;

    const storyVideos = container.querySelectorAll('.sv-story-thumbnail video');
    storyVideos.forEach((v) => {
      v.play().catch(() => {

      });
    });

    container.querySelectorAll('.sv-story-item').forEach((el) =>
      el.addEventListener('click', () => {
        const index = parseInt(el.getAttribute('data-index'), 10) || 0;
        if (window.ShoppableVideosModal && window.ShoppableVideosModal.open) {
          window.ShoppableVideosModal.open(widget, index, 'story');
        }
      })
    );
  }

  function truncate(text, len) {
    if (!text) return '';
    return text.length > len ? text.slice(0, len) + '...' : text;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();