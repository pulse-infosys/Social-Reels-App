// COMPLETE FIXED VERSION WITH EXTENSIVE DEBUGGING
// Replace entire sv-shared-modal.js with this

(function () {
  'use strict';

  if (window.ShoppableVideosModal) {
    console.log('ShoppableVideosModal already exists');
    return;
  }

  var modalState = {
    widget: null,
    index: 0,
    sourceType: ''
  };

  var modal, overlayEl, closeBtn, videoEl, prevBtn, nextBtn,
    counterEl, thumbsRoot, productsRoot, titleEl, descEl,messageEl;

 


  function ensureModal() {
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'sv-modal-backdrop';
    modal.className = 'sv-modal-backdrop hidden';

    modal.innerHTML = `
      <div class="sv-modal-overlay"></div>
      <div class="sv-modal-dialog">
        <button class="sv-modal-close" type="button">×</button>
        <div class="sv-modal-body">
          <div class="sv-modal-left">
            <div class="sv-modal-video-container">
              <video id="sv-modal-video" playsinline controls></video>
            </div>
            <div class="sv-modal-controls">
              <button id="sv-modal-prev" class="sv-modal-btn sv-modal-prev-btn" type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <span id="sv-modal-counter" class="sv-modal-counter"></span>
              <button id="sv-modal-next" class="sv-modal-btn sv-modal-next-btn" type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>
            <div id="sv-modal-thumbs" class="sv-modal-thumbs"></div>
          </div>
          <div class="sv-modal-right">
            <div class="sv-modal-header">
              <h3 id="sv-modal-title" class="sv-modal-title"></h3>
              <p id="sv-modal-desc" class="sv-modal-desc"></p>
            </div>
            <div id="sv-modal-products" class="sv-modal-products"></div>
             <div id="sv-modal-message" class="sv-modal-message"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    overlayEl = modal.querySelector('.sv-modal-overlay');
    closeBtn = modal.querySelector('.sv-modal-close');
    videoEl = modal.querySelector('#sv-modal-video');
    prevBtn = modal.querySelector('#sv-modal-prev');
    nextBtn = modal.querySelector('#sv-modal-next');
    counterEl = modal.querySelector('#sv-modal-counter');
    thumbsRoot = modal.querySelector('#sv-modal-thumbs');
    productsRoot = modal.querySelector('#sv-modal-products');
    titleEl = modal.querySelector('#sv-modal-title');
    descEl = modal.querySelector('#sv-modal-desc');
       messageEl = modal.querySelector('#sv-modal-message');

    overlayEl.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function () { changeSlide(-1); });
    nextBtn.addEventListener('click', function () { changeSlide(1); });
    document.addEventListener('keydown', handleKeydown);

    console.log('✅ Modal created and attached to DOM');
  }

  function open(widget, index, sourceType) {
    console.log('═══════════════════════════════════════');
    console.log('🚀 MODAL OPEN CALLED');
    console.log('═══════════════════════════════════════');
    
    // DETAILED WIDGET INSPECTION
    console.log('1️⃣ RAW WIDGET OBJECT:', widget);
    console.log('2️⃣ Widget type:', typeof widget);
    console.log('3️⃣ Widget is null?', widget === null);
    console.log('4️⃣ Widget is undefined?', widget === undefined);

    if (!widget) {
      console.error('❌ ERROR: Widget is null or undefined!');
      alert('Error: No widget data provided');
      return;
    }

    console.log('5️⃣ Widget.videos exists?', !!widget.videos);
    console.log('6️⃣ Widget.videos type:', typeof widget.videos);
    console.log('7️⃣ Widget.videos is Array?', Array.isArray(widget.videos));
    
    if (widget.videos) {
      console.log('8️⃣ Widget.videos.length:', widget.videos.length);
      console.log('9️⃣ Widget.videos content:', widget.videos);
      
      // Log each video
      widget.videos.forEach(function(v, i) {
        console.log(`   Video ${i + 1}:`, {
          title: v.title,
          videoUrl: v.videoUrl ? '✓' : '✗',
          thumbnailUrl: v.thumbnailUrl ? '✓' : '✗',
          products: v.products ? v.products.length : 0
        });
      });
    } else {
      console.error('❌ ERROR: Widget.videos is missing!');
      alert('Error: No videos in widget');
      return;
    }

    if (!Array.isArray(widget.videos)) {
      console.error('❌ ERROR: Widget.videos is not an array!');
      alert('Error: Invalid video data format');
      return;
    }

    if (widget.videos.length === 0) {
      console.error('❌ ERROR: Widget.videos array is empty!');
      alert('Error: No videos to display');
      return;
    }

    console.log('✅ All validations passed!');
    console.log('📊 Total videos to display:', widget.videos.length);
    
    ensureModal();

    // IMPORTANT: Direct reference instead of deep clone to avoid data loss
    console.log('🔄 Setting modal state...');
    modalState.widget = widget; // CHANGED: No JSON clone
    modalState.index = typeof index === 'number' ? index : 0;
    
    if (modalState.index < 0) modalState.index = 0;
    if (modalState.index >= modalState.widget.videos.length) {
      modalState.index = modalState.widget.videos.length - 1;
    }
    
    modalState.sourceType = sourceType || widget.type || '';

    console.log('📋 Modal State Set:', {
      videoCount: modalState.widget.videos.length,
      currentIndex: modalState.index,
      sourceType: modalState.sourceType
    });

    console.log('🎬 Rendering thumbnails...');
    renderThumbnails();
    
    console.log('🎬 Updating content...');
    updateContent();

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    console.log('✅ MODAL OPENED SUCCESSFULLY');
    console.log('═══════════════════════════════════════\n');

    // Auto play with delay
    setTimeout(function() {
      if (videoEl) {
        videoEl.play().catch(function(e) {
          console.log('Auto-play prevented (normal):', e.message);
        });
      }
    }, 200);
  }



  function renderThumbnails() {
  console.log('🖼️ renderThumbnails() called');
  
  if (!thumbsRoot) {
    console.error('❌ Thumbs root element not found!');
    return;
  }

  var widget = modalState.widget;
  thumbsRoot.innerHTML = '';

  if (!widget || !widget.videos) {
    console.error('❌ Cannot render thumbnails - no widget/videos');
    return;
  }

  console.log('📊 Rendering thumbnails for', widget.videos.length, 'videos');

  if (widget.videos.length <= 1) {
    thumbsRoot.style.display = 'none';
    console.log('ℹ️ Only 1 video - hiding thumbnails section');
    return;
  }

  thumbsRoot.style.display = 'flex';

  widget.videos.forEach(function (video, i) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sv-thumb' + (i === modalState.index ? ' sv-thumb-active' : '');
    btn.setAttribute('data-index', (i + 1)); // For CSS ::before content (1-based index)
    
    var imgSrc = video.thumbnailUrl || '';
    var altText = video.title || ('Video ' + (i + 1));
    
    btn.innerHTML = '<img src="' + imgSrc + '" alt="' + altText + '" loading="lazy">';
    
    // Click handler
    btn.addEventListener('click', function () {
      console.log('👆 Thumbnail ' + (i + 1) + ' clicked');
      modalState.index = i;
      updateContent();
      
      // Scroll active thumbnail into view smoothly
      setTimeout(function() {
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }, 100);
    });
    
    thumbsRoot.appendChild(btn);
    console.log('  ✓ Thumbnail ' + (i + 1) + ' rendered');
  });

  // Auto-scroll active thumbnail into view
  setTimeout(function() {
    var activeThumb = thumbsRoot.querySelector('.sv-thumb-active');
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, 200);

  console.log('✅ All thumbnails rendered successfully');
}

  function updateContent() {
    console.log('\n🔄 updateContent() called');
    
    var widget = modalState.widget;
    
    if (!widget || !widget.videos || !widget.videos.length) {
      console.error('❌ Cannot update content - invalid widget');
      return;
    }

    var idx = modalState.index;
    if (idx < 0) idx = 0;
    if (idx >= widget.videos.length) idx = widget.videos.length - 1;
    modalState.index = idx;

    var videoData = widget.videos[idx];
    
    console.log('📺 Updating to video', (idx + 1), 'of', widget.videos.length);
    console.log('   Video:', videoData.title || 'Untitled');

    // Update video
    if (videoEl && videoData.videoUrl) {
      videoEl.pause();
      videoEl.src = videoData.videoUrl;
      videoEl.poster = videoData.thumbnailUrl || '';
      videoEl.load();
      console.log('   ✓ Video source updated');
      
      videoEl.play().catch(function(e) {
        console.log('   ℹ️ Play prevented:', e.message);
      });
    }

    // Update title and description
    if (titleEl) {
      titleEl.textContent = videoData.title || 'Video ' + (idx + 1);
      console.log('   ✓ Title updated');
    }
    if (descEl) {
      descEl.textContent = videoData.description || '';
      console.log('   ✓ Description updated');
    }

    // Update counter
    if (counterEl) {
      counterEl.textContent = (idx + 1) + ' / ' + widget.videos.length;
      console.log('   ✓ Counter updated:', counterEl.textContent);
    }

    // Update products
    // Update products
if (productsRoot) {
  var products = videoData.products || [];

  if (!products.length) {
    productsRoot.innerHTML =
      '<div class="sv-no-products">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<circle cx="9" cy="21" r="1"></circle>' +
          '<circle cx="20" cy="21" r="1"></circle>' +
          '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>' +
        '</svg>' +
        '<p>No products tagged</p>' +
      '</div>';
  } else {
    var html = products.map(function (p, idx) {
      var productUrl = p.productUrl || (p.handle ? '/products/' + p.handle : '#');
      return (
        '<div class="sv-modal-product" data-product-index="' + idx + '">' +
          '<div class="sv-modal-product-image">' +
            '<img src="' + (p.image || '') + '" alt="' + escapeHtml(p.title || 'Product') + '">' +
          '</div>' +
          '<div class="sv-modal-product-info">' +
            '<div class="sv-modal-product-title">' + escapeHtml(p.title || 'Product') + '</div>' +
            '<div class="sv-modal-product-price">' + formatPrice(p.price) + '</div>' +
            '<div class="sv-modal-product-actions">' +
              '<a href="' + productUrl + '" class="sv-modal-product-more" target="_blank">More info</a>' +
              (p.variantId
                ? '<button type="button" class="sv-modal-product-add" data-variant-id="' + p.variantId + '">Add to cart</button>'
                : ''
              ) +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    productsRoot.innerHTML = html;

    // Attach add-to-cart click handlers
    var addButtons = productsRoot.querySelectorAll(".sv-modal-product-add");
    addButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var variantId = this.getAttribute("data-variant-id");
        addToCart(variantId, 1);
      });
    });
  }

  console.log("   ✓ Products updated:", products.length, "items");
}

    // Update thumbnails active state
    if (thumbsRoot) {
      var thumbs = thumbsRoot.querySelectorAll('.sv-thumb');
      for (var i = 0; i < thumbs.length; i++) {
        if (i === idx) {
          thumbs[i].classList.add('sv-thumb-active');
        } else {
          thumbs[i].classList.remove('sv-thumb-active');
        }
      }
      console.log('   ✓ Thumbnail active state updated');
    }

    // Update nav buttons
    var hasMultiple = widget.videos.length > 1;
    var isFirst = idx === 0;
    var isLast = idx >= widget.videos.length - 1;

    console.log('🎮 Navigation state:', {
      hasMultiple: hasMultiple,
      isFirst: isFirst,
      isLast: isLast,
      currentIndex: idx,
      totalVideos: widget.videos.length
    });

    if (prevBtn) {
      if (hasMultiple) {
        prevBtn.style.display = 'flex';
        prevBtn.disabled = isFirst;
        prevBtn.style.opacity = isFirst ? '0.3' : '1';
        console.log('   ◀️ Prev button: visible,', isFirst ? 'disabled' : 'enabled');
      } else {
        prevBtn.style.display = 'none';
        console.log('   ◀️ Prev button: hidden (single video)');
      }
    }
    
    if (nextBtn) {
      if (hasMultiple) {
        nextBtn.style.display = 'flex';
        nextBtn.disabled = isLast;
        nextBtn.style.opacity = isLast ? '0.3' : '1';
        console.log('   ▶️ Next button: visible,', isLast ? 'disabled' : 'enabled');
      } else {
        nextBtn.style.display = 'none';
        console.log('   ▶️ Next button: hidden (single video)');
      }
    }

    console.log('✅ Content update complete\n');
  }

  function changeSlide(delta) {
    console.log('🔀 changeSlide() called with delta:', delta);
    
    var widget = modalState.widget;
    
    if (!widget || !widget.videos || !widget.videos.length) {
      console.error('❌ Cannot change slide - invalid widget');
      return;
    }

    var newIndex = modalState.index + delta;
    
    console.log('   Current index:', modalState.index);
    console.log('   New index:', newIndex);
    console.log('   Total videos:', widget.videos.length);

    if (newIndex < 0) {
      console.log('   ⚠️ Already at first video');
      newIndex = 0;
    }
    
    if (newIndex >= widget.videos.length) {
      console.log('   ⚠️ Already at last video');
      newIndex = widget.videos.length - 1;
    }

    if (newIndex === modalState.index) {
      console.log('   ℹ️ No change in index');
      return;
    }

    modalState.index = newIndex;
    console.log('   ✓ Moving to video', newIndex + 1);
    updateContent();
  }

  function close() {
    if (!modal) return;
    
    console.log('🔒 Closing modal');
    
    if (videoEl) {
      try {
        videoEl.pause();
        videoEl.src = '';
      } catch (e) {
        console.error('Error pausing video:', e);
      }
    }
    
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    
    console.log('✅ Modal closed');
  }

  function handleKeydown(e) {
    if (!modal || modal.classList.contains('hidden')) return;
    
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowLeft') {
      changeSlide(-1);
    } else if (e.key === 'ArrowRight') {
      changeSlide(1);
    }
  }

  function normalizeVariantId(variantId) {
    if (!variantId) return null;
    if (variantId.indexOf("gid://") === 0) {
      var parts = variantId.split("/");
      return parts[parts.length - 1];
    }
    return variantId;
  }

  function addToCart(variantId, quantity) {
    quantity = quantity || 1;
    var normalizedId = normalizeVariantId(variantId);

    if (!normalizedId) {
      console.error("addToCart: Missing variantId");
      alert("Variant not available for this product");
      return;
    }

    console.log("🛒 Adding to cart:", { variantId: normalizedId, quantity: quantity });

    fetch("/cart/add.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ id: normalizedId, quantity: quantity }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then(function (data) {
        console.log("✅ Added to cart:", data);
         showMessage('Product added to cart', 'success');

      })
      .catch(function (err) {
        console.error("❌ Add to cart error", err);
         showMessage('Could not add to cart, please try again.', 'error');
      });
  }

  function showMessage(text, type) {
    if (!messageEl) return;

    messageEl.textContent = text || '';
    messageEl.className =
      'sv-modal-message ' +
      (type === 'error' ? 'sv-modal-message-error' : 'sv-modal-message-success');

    messageEl.style.opacity = '1';

    clearTimeout(showMessage._timer);
    showMessage._timer = setTimeout(function () {
      messageEl.style.opacity = '0';
    }, 2000); 
  }



  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (s) {
      switch (s) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return s;
      }
    });
  }

  function formatPrice(price) {
    if (price === null || price === undefined || price === '') return '';
    var num = Number(price);
    if (isNaN(num)) return String(price);
    return '$' + num.toFixed(2);
  }

  window.ShoppableVideosModal = { 
    open: open,
    close: close 
  };
  
  console.log('✅ ShoppableVideosModal initialized');
})();