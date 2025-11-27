// extensions/shoppable-videos/assets/reels-widget.js

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

        const widget = json.data.widgets[0]; 

        if (widgetType === 'carousel') {
          renderCarousel(container, widget);
        } else if (widgetType === 'story' || widgetType === 'stories') {
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
        (video) => `
      <div class="sv-carousel-slide">
        <div class="sv-carousel-video-wrapper">
          <video 
            src="${video.videoUrl}"
            poster="${video.thumbnailUrl}"
            muted
            loop
            playsinline
          ></video>
          <div class="sv-play-overlay">
            <svg viewBox="0 0 24 24" fill="white" width="36" height="36">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        <div class="sv-carousel-info">
          <h4>${video.title || 'Video'}</h4>
          ${
            video.products?.length
              ? `
            <div class="sv-carousel-products">
              ${video.products
                .slice(0, 2)
                .map(
                  (p) => `
                  <a href="/products/${p.handle}" class="sv-mini-product">
                    <img src="${p.image || ''}" alt="${p.title || ''}" />
                  </a>
                `
                )
                .join('')}
              ${
                video.products.length > 2
                  ? `<span class="sv-more-products">+${
                      video.products.length - 2
                    }</span>`
                  : ''
              }
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
      <div class="sv-carousel-wrapper">
        <button class="sv-carousel-nav sv-prev">&lt;</button>
        <div class="sv-carousel-track">
          ${slidesHTML}
        </div>
        <button class="sv-carousel-nav sv-next">&gt;</button>
      </div>
    `;

    initCarouselBehaviour(container);
  }

  function initCarouselBehaviour(container) {
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
      const gap = 16;
      track.style.transform = `translateX(-${
        current * (slideWidth + gap)
      }px)`;

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
          <img src="${video.thumbnailUrl}" alt="${video.title || ''}" />
          <div class="sv-story-ring"></div>
        </div>
        <span class="sv-story-title">${truncate(video.title, 10)}</span>
      </div>
    `
      )
      .join('');

    container.innerHTML = `
      <div class="sv-story-wrapper">
        <div class="sv-story-list">
          ${items}
        </div>
      </div>
    `;

    container
      .querySelectorAll('.sv-story-item')
      .forEach((el) =>
        el.addEventListener('click', () => {
          const index = parseInt(el.dataset.index, 10);
          openStoryModal(widget, index);
        })
      );
  }

  function openStoryModal(widget, startIndex) {

    alert('Story modal ');
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