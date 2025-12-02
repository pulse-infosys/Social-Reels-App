// assets/app-embed.js
(function () {
  "use strict";

  class ShoppableVideosApp {
    constructor() {
      this.config = this.getConfig();
      this.widgets = [];
      this.initialized = false;
    }

    getConfig() {
      const container = document.getElementById("shoppable-videos-app");
      if (!container) {
        console.warn("ShoppableVideos (embed): container not found");
        return null;
      }

      return {
        shop: container.dataset.shop,
        path: container.dataset.path || window.location.pathname,
      };
    }

    async init() {
      if (this.initialized || !this.config) return;

      console.log("=== ShoppableVideos EMBED Init ===", this.config);

      try {
        const data = await this.fetchWidgets();
        if (data && data.widgets && data.widgets.length > 0) {
          this.widgets = data.widgets;
          this.renderWidgets();
        } else {
          console.log("No widgets found for this page");
        }
        this.initialized = true;
      } catch (error) {
        console.error("ShoppableVideos: Init error", error);
      }
    }

    async fetchWidgets() {
      const params = new URLSearchParams({
        shop: this.config.shop,
        path: this.config.path,
      });

      const apiUrl = `/apps/shoppable-videos/api/storefront?${params.toString()}`;
      const response = await fetch(apiUrl);
      if (!response.ok) return null;

      const result = await response.json();
      return result.success ? result.data : null;
    }

    renderWidgets() {
      console.log("=== EMBED Widget Rendering ===");
      if (!this.widgets || this.widgets.length === 0) return;

      const hasSections = !!document.querySelector(".reels-widget-container");
      console.log("Has section widgets on page:", hasSections);

      const hasFloating = this.widgets.some((w) => w.type === "floating");
      console.log("Has floating widget:", hasFloating);

      if (hasSections) {
        const floatingWidget = this.widgets.find((w) => w.type === "floating");
        if (floatingWidget && floatingWidget.videos?.length) {
          this.renderFloatingWidget(floatingWidget);
        } else {
          console.log("Sections present but no floating widget configured");
        }
        return;
      }

      this.widgets.forEach((widget) => {
        if (hasFloating && widget.type !== "floating") {
          console.log(
            `Embed: skipping widget ${widget.id} type=${widget.type} because floating is enabled`,
          );
          return;
        }

        if (!widget.videos || !widget.videos.length) return;

        console.log('widget====',widget);

        switch (widget.type) {
          case "stories":
          case "story":
            this.renderStoryWidget(widget);
            break;
          case "floating":
            this.renderFloatingWidget(widget);
            break;
          case "carousel":
            this.renderCarouselWidget(widget);
            break;
        }
      });
    }

    // ==== STORY ====
    renderStoryWidget(widget) {
      const container = document.createElement("div");
      container.className = "sv-story-container";
      container.id = `sv-story-${widget.id}`;

      const storiesHTML = widget.videos
        .map(
          (video, index) => `
          <div class="sv-story-item" data-video-index="${index}">
            <div class="sv-story-thumbnail">
              <img src="${video.thumbnailUrl}" alt="${video.title || ""}" loading="lazy">
            </div>
            <span class="sv-story-title">${this.truncateText(video.title, 10)}</span>
          </div>`,
        )
        .join("");

      container.innerHTML = `
        <div class="sv-story-wrapper">
          <div class="sv-story-list">${storiesHTML}</div>
        </div>
      `;

      const main =
        document.querySelector("main") || document.body.firstElementChild;
      if (main) main.insertBefore(container, main.firstChild);
      else document.body.insertBefore(container, document.body.firstChild);

      container.querySelectorAll(".sv-story-item").forEach((item) => {
        item.addEventListener("click", () => {
          const videoIndex = parseInt(item.dataset.videoIndex, 10) || 0;
          this.openVideoModal(widget, videoIndex, "story");
        });
      });
    }

    // ==== FLOATING  ====
    renderFloatingWidget(widget) {
      const existing = document.querySelectorAll(".sv-floating-container");
      existing.forEach((el) => el.remove());

      const firstVideo = widget.videos[0];
      if (!firstVideo) return;

      const container = document.createElement("div");
      container.className = "sv-floating-container";
      container.id = `sv-floating-${widget.id}`;
      container.style.cssText =
        "position:fixed!important;bottom:24px!important;right:24px!important;z-index:999999!important;";

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
          ${
            widget.videos.length > 1
              ? `<div class="sv-floating-badge">${widget.videos.length}</div>`
              : ""
          }
        </div>
      `;

      document.body.appendChild(container);

      setTimeout(() => {
        const bubble = container.querySelector(".sv-floating-bubble");
        if (bubble) {
          bubble.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openVideoModal(widget, 0, "floating");
          });
        }
      }, 100);
    }

    // ==== CAROUSEL ====
    renderCarouselWidget(widget) {
      const container = document.createElement("div");
      container.className = "sv-carousel-container";
      container.id = `sv-carousel-${widget.id}`;

      const slidesHTML = widget.videos
        .map((video, index) => {
          const firstProduct = video.products && video.products[0];
          return `
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
                <h4>${video.title || "Video"}</h4>
                ${
                  firstProduct
                    ? `<div class="sv-carousel-products">
                        <a href="/products/${firstProduct.handle}" class="sv-mini-product" onclick="event.stopPropagation()">
                          <img src="${firstProduct.image}" alt="${firstProduct.title || ""}">
                        </a>
                      </div>`
                    : ""
                }
              </div>
            </div>`;
        })
        .join("");

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

      const footer = document.querySelector("footer");
      const main = document.querySelector("main");

      if (footer && footer.parentNode)
        footer.parentNode.insertBefore(container, footer);
      else if (main) main.appendChild(container);
      else document.body.appendChild(container);

      this.initCarousel(container, widget);
    }

    initCarousel(container, widget) {
      const track = container.querySelector(".sv-carousel-track");
      const slides = container.querySelectorAll(".sv-carousel-slide");
      const prevBtn = container.querySelector(".sv-prev");
      const nextBtn = container.querySelector(".sv-next");
      if (!slides.length) return;

      let currentSlide = 0;

      const getSlidesToShow = () => {
        const width = window.innerWidth;
        if (width >= 1200) return 4;
        if (width >= 992) return 3;
        if (width >= 768) return 2;
        return 1;
      };

      const updateCarousel = () => {
        const slidesToShow = getSlidesToShow();
        const maxSlide = Math.max(0, slides.length - slidesToShow);

        if (currentSlide > maxSlide) currentSlide = maxSlide;

        const slideWidth = slides[0].offsetWidth;
        const gap = 20;
        track.style.transform = `translateX(-${currentSlide * (slideWidth + gap)}px)`;

        prevBtn.disabled = currentSlide === 0;
        nextBtn.disabled = currentSlide >= maxSlide;
      };

      prevBtn.addEventListener("click", () => {
        if (currentSlide > 0) {
          currentSlide--;
          updateCarousel();
        }
      });

      nextBtn.addEventListener("click", () => {
        const slidesToShow = getSlidesToShow();
        const maxSlide = Math.max(0, slides.length - slidesToShow);
        if (currentSlide < maxSlide) {
          currentSlide++;
          updateCarousel();
        }
      });

      slides.forEach((slide, index) => {
        const video = slide.querySelector("video");
        const overlay = slide.querySelector(".sv-play-overlay");

        slide.addEventListener("mouseenter", () => {
          if (video) video.play().catch(() => {});
          if (overlay) overlay.style.opacity = "0";
        });

        slide.addEventListener("mouseleave", () => {
          if (video) {
            video.pause();
            video.currentTime = 0;
          }
          if (overlay) overlay.style.opacity = "1";
        });

        slide.addEventListener("click", () => {
          this.openVideoModal(widget, index, "carousel");
        });
      });

      let resizeTimeout;
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(updateCarousel, 100);
      });

      updateCarousel();
    }

    openVideoModal(widget, index, sourceType) {
      if (!window.ShoppableVideosModal) {
        console.error("ShoppableVideosModal not loaded");
        return;
      }
      if (!widget || !widget.videos || !widget.videos.length) return;
      window.ShoppableVideosModal.open(widget, index, sourceType);
    }

    truncateText(text, maxLength) {
      if (!text) return "";
      return text.length > maxLength
        ? text.substring(0, maxLength) + "..."
        : text;
    }
  }

  function init() {
    if (window.__SV_EMBED_INITIALIZED) {
      console.log("ShoppableVideos EMBED already initialized");
      return;
    }
    window.__SV_EMBED_INITIALIZED = true;

    const app = new ShoppableVideosApp();
    app.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
