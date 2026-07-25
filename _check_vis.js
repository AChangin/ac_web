
(function(){
  // ═══════════════════════════════════════
  //  NarrativeEngine — scroll-driven animation
  // ═══════════════════════════════════════
  // Easing functions
  function easeOutCubic(t){ return 1 - Math.pow(1-t, 3); }
  function easeOutQuad(t){ return 1 - (1-t)*(1-t); }
  function easeInOutCubic(t){ return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }

  var NarrativeEngine = {
    elements: [],
    register: function(el, config){
      this.elements.push({ el:el, config:config||{} });
    },
    update: function(scrollX, viewW, viewH){
      for(var i=0; i<this.elements.length; i++){
        var entry = this.elements[i];
        var el = entry.el;
        var c = entry.config;

        // Element's original position
        var elX = parseFloat(el.getAttribute('data-x')) || 0;
        var elW = parseFloat(el.getAttribute('data-w')) || 300;

        // Parallax offset
        var anticipation = viewW * 0.5; // origin shifts left by half viewport
        var px = c.parallax ? Math.max(0, scrollX - elX + anticipation) * c.parallax : 0;
        var visualX = elX + px;
        var visualInView = (visualX + elW > scrollX) && (visualX < scrollX + viewW);

        // Element enters from the RIGHT as user scrolls right
        // 0 = left edge just touching right viewport edge, 1 = left edge at left viewport edge
        var enterProgress = Math.max(0, Math.min(1, ((scrollX + viewW) - visualX) / viewW));
        // Element exits to the LEFT: 1 = fully in, 0 = right edge just leaving
        var exitProgress = Math.max(0, Math.min(1, (visualX + elW - scrollX) / viewW));

        var tx = px, ty = 0, sc = 1, op = 1, blur = 0, rot = 0, clipX = 0;

        // ── Parallax ──
        if(c.parallax){ tx = px; }

        // ── Float ──
        if(c.float){ ty = Math.sin(scrollX * 0.002 + elX * 0.001) * (c.floatAmount || 20); }

        // ── Unified enterAnimation ──
        var anims = c.enterAnimation;
        if(!anims && c.fadeIn){ anims = [{ type:'fade' }]; } // legacy support
        if(anims){
          if(!(anims instanceof Array)) anims = [anims];
          for(var a=0; a<anims.length; a++){
            var anim = anims[a];
            var dur = anim.duration || 0.35; // in viewport widths
            var del = anim.delay || 0;
            // Progress through this animation (0=before start, 1=complete)
            var t = Math.max(0, Math.min(1, (enterProgress - del) / dur));
            var e = anim.ease || 'cubic';
            var ev = e === 'quad' ? easeOutQuad(t) : e === 'inout' ? easeInOutCubic(t) : easeOutCubic(t);

            switch(anim.type){
              case 'fade':
                op = 0.05 + 0.95 * ev;
                break;
              case 'slideUp':
                ty += (anim.distance || 60) * (1 - ev);
                break;
              case 'slideLeft':
                tx += (anim.distance || 40) * (1 - ev);
                break;
              case 'slideRight':
                tx -= (anim.distance || 40) * (1 - ev);
                break;
              case 'scale':
                sc = (anim.from || 0.85) + (1 - (anim.from || 0.85)) * ev;
                break;
              case 'blur':
                blur = (anim.amount || 10) * (1 - ev);
                break;
              case 'rotate':
                rot = (anim.amount || 3) * (1 - ev);
                break;
              case 'reveal':
                // Clip from right: element reveals as it scrolls in
                clipX = 100 * (1 - ev);
                break;
            }
          }
        }

        // ── Legacy fadeIn/scaleOnScroll (if no enterAnimation) ──
        if(!anims){
          if(c.fadeIn){
            var leftEdge = visualX, rightEdge = visualX + elW;
            var fadeZone = viewW * 0.25;
            var enterDist = rightEdge - scrollX;
            var exitDist = (scrollX + viewW) - leftEdge;
            if(enterDist < fadeZone && enterDist > 0){ op = 0.1 + 0.9 * (enterDist / fadeZone); }
            else if(exitDist < fadeZone && exitDist > 0){ op = 0.1 + 0.9 * (exitDist / fadeZone); }
            else if(visualInView){ op = 1; }
            else { op = 0.1; }
          }
        }

        // ── Build transform ──
        var cx = el.getAttribute('data-center-x') ? '-50%' : '0px';
        var cy = el.getAttribute('data-center-y') ? '-50%' : '0px';
        var transform = 'translate3d('+tx+'px,'+ty+'px,0) translate('+cx+','+cy+')';
        if(sc !== 1 || rot !== 0) transform += ' scale('+sc+')';
        if(rot !== 0) transform += ' rotate('+rot+'deg)';
        el.style.transform = transform;
        el.style.opacity = op;

        // ── Filter (blur) ──
        if(blur > 0.1){ el.style.filter = 'blur('+blur+'px)'; }
        else { el.style.filter = ''; }

        // ── Clip-path (reveal) ──
        if(clipX > 0.1){ el.style.clipPath = 'inset(0 '+clipX+'% 0 0)'; }
        else { el.style.clipPath = ''; }
      }
    }
  };

  // ═══════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════
  var slug = new URLSearchParams(window.location.search).get('slug') || 'dusk-dawn';
  var canvas = document.getElementById('project-canvas');
  var inner = document.getElementById('project-canvas-inner');
  var loading = document.getElementById('project-loading');
  var projectMeta = null;

  // ═══════════════════════════════════════
  //  EMBEDDED DATA — sync with content/projects/*/project.json + scenes.json
  // ═══════════════════════════════════════
  var EMBEDDED = {
    "dusk-dawn": {
      meta: {"slug":"dusk-dawn","title":"黄昏黎明融作一片","type":"NOTE","icon":"icons/note.svg","date":"2026 JUL","description":"A brief exploration of twilight and dawn dissolving into one another — where the boundaries between night and day become indistinguishable and the in-between emerges as its own form.","cover":"posts/tired_20260718.jpg"},
      narrative: {"canvasWidth":12000,"scenes":[{"id":"opening","x":0,"width":3000,"elements":[{"type":"image","src":"posts/tired_20260718.jpg","x":200,"y":60,"width":700,"height":500,"zIndex":1,"animation":{"parallax":0.2,"fadeIn":true}},{"type":"text","content":"黄昏黎明<br>融作一片","x":1100,"y":120,"fontFamily":"'Playfair Display', Georgia, serif","fontSize":"6rem","fontWeight":"600","color":"#fff","lineHeight":1.1,"zIndex":2,"animation":{"parallax":0.4,"fadeIn":true}},{"type":"text","content":"NOTE · 2026 JUL","x":1100,"y":360,"fontFamily":"'Inter', sans-serif","fontSize":"1rem","fontWeight":"500","color":"rgba(255,255,255,0.5)","letterSpacing":"0.15em","zIndex":2,"animation":{"fadeIn":true}},{"type":"text","content":"Where the boundaries between night and day<br>become indistinguishable, and the in-between<br>emerges as its own form of light.","x":1100,"y":420,"fontFamily":"'Inter', sans-serif","fontSize":"1.3rem","fontWeight":"300","color":"rgba(255,255,255,0.55)","lineHeight":1.8,"maxWidth":"500px","zIndex":2,"animation":{"parallax":0.25,"fadeIn":true}}]},{"id":"middle","x":3000,"width":4000,"elements":[{"type":"image","src":"posts/test_20260718.jpg","x":3200,"y":80,"width":600,"height":450,"zIndex":1,"animation":{"parallax":0.15,"float":true,"floatAmount":15}},{"type":"text","content":"The space between light and shadow<br>defines everything we see.","x":4000,"y":200,"fontFamily":"'Playfair Display', Georgia, serif","fontSize":"4rem","fontWeight":"600","color":"#fff","lineHeight":1.2,"zIndex":2,"animation":{"parallax":0.35,"fadeIn":true}},{"type":"text","content":"Form emerges not from what we add,<br>but from what we choose to reveal.","x":4000,"y":420,"fontFamily":"'Inter', sans-serif","fontSize":"1.4rem","fontWeight":"300","color":"rgba(255,255,255,0.5)","lineHeight":1.8,"zIndex":2,"animation":{"parallax":0.2,"fadeIn":true}}]},{"id":"closing","x":7000,"width":5000,"elements":[{"type":"image","src":"posts/tired_20260718.jpg","x":7300,"y":50,"width":800,"height":550,"zIndex":1,"animation":{"parallax":0.1,"fadeIn":true}},{"type":"text","content":"Every surface holds a story<br>waiting for the right angle of light.","x":8300,"y":180,"fontFamily":"'Playfair Display', Georgia, serif","fontSize":"4.5rem","fontWeight":"600","color":"#fff","lineHeight":1.2,"zIndex":2,"animation":{"parallax":0.3,"fadeIn":true}},{"type":"text","content":"Clarity is not about brightness.<br>It is about direction.","x":8300,"y":400,"fontFamily":"'Inter', sans-serif","fontSize":"1.3rem","fontWeight":"300","color":"rgba(255,255,255,0.5)","lineHeight":1.8,"zIndex":2,"animation":{"parallax":0.15,"fadeIn":true}}]}]}
    },
    "shape-of-silence": {
      meta: {"slug":"shape-of-silence","title":"The Shape of Silence","type":"PROJECT","icon":"icons/project.svg","date":"2026 JUN","description":"An investigation into negative space as an active design element — how absence shapes presence in visual communication and editorial composition.","cover":"posts/test_20260718.jpg"},
      narrative: {"canvasWidth":15000,"scenes":[{"id":"intro","x":0,"width":4000,"elements":[{"type":"image","src":"posts/test_20260718.jpg","x":300,"y":80,"width":650,"height":480,"zIndex":1,"animation":{"parallax":0.25,"fadeIn":true}},{"type":"text","content":"The Shape<br>of Silence","x":1200,"y":100,"fontFamily":"'Playfair Display', Georgia, serif","fontSize":"6.5rem","fontWeight":"600","color":"#fff","lineHeight":1.05,"zIndex":2,"animation":{"parallax":0.45,"fadeIn":true}},{"type":"text","content":"PROJECT · 2026 JUN","x":1200,"y":350,"fontFamily":"'Inter', sans-serif","fontSize":"1rem","fontWeight":"500","color":"rgba(255,255,255,0.5)","letterSpacing":"0.15em","zIndex":2,"animation":{"fadeIn":true}},{"type":"text","content":"How absence shapes presence<br>in visual communication and<br>editorial composition.","x":1200,"y":410,"fontFamily":"'Inter', sans-serif","fontSize":"1.3rem","fontWeight":"300","color":"rgba(255,255,255,0.55)","lineHeight":1.8,"maxWidth":"480px","zIndex":2,"animation":{"parallax":0.2,"fadeIn":true}}]},{"id":"development","x":4000,"width":5000,"elements":[{"type":"image","src":"posts/tired_20260718.jpg","x":4300,"y":60,"width":550,"height":420,"zIndex":1,"animation":{"parallax":0.18,"float":true,"floatAmount":20}},{"type":"text","content":"Negative space is not empty.<br>It is active, breathing, alive.","x":5100,"y":180,"fontFamily":"'Playfair Display', Georgia, serif","fontSize":"4rem","fontWeight":"600","color":"#fff","lineHeight":1.2,"zIndex":2,"animation":{"parallax":0.35,"fadeIn":true}},{"type":"image","src":"posts/test_20260718.jpg","x":7000,"y":100,"width":500,"height":380,"zIndex":1,"animation":{"parallax":0.12,"fadeIn":true}},{"type":"text","content":"What you remove is just as important<br>as what you leave behind.","x":7800,"y":520,"fontFamily":"'Inter', sans-serif","fontSize":"1.5rem","fontWeight":"300","color":"rgba(255,255,255,0.5)","lineHeight":1.7,"zIndex":2,"animation":{"parallax":0.2,"fadeIn":true}}]},{"id":"conclusion","x":9000,"width":6000,"elements":[{"type":"image","src":"posts/tired_20260718.jpg","x":9300,"y":40,"width":850,"height":560,"zIndex":1,"animation":{"parallax":0.1,"fadeIn":true}},{"type":"text","content":"Silence is not the absence<br>of sound. It is the presence<br>of space.","x":10400,"y":150,"fontFamily":"'Playfair Display', Georgia, serif","fontSize":"5rem","fontWeight":"600","color":"#fff","lineHeight":1.15,"zIndex":2,"animation":{"parallax":0.3,"fadeIn":true}}]}]}
    }
  };

  // ═══ Shared helpers (used by initProject and ProgressBar) ═══
  function u(v){ return typeof v === 'number' ? v + 'px' : v; }
  function resolvePX(v){ if(typeof v==='number')return v; var n=parseFloat(v); if(!isNaN(n)){if(v.indexOf('vw')>=0)return n*window.innerWidth/100;if(v.indexOf('vh')>=0)return n*window.innerHeight/100;if(v.indexOf('rem')>=0)return n*16;if(v.indexOf('px')>=0)return n;return n}return 0 }

  function initProject(meta, narrative){
    projectMeta = meta;
    document.title = projectMeta.title + ' — AC';

    // Set canvas width + enable native horizontal scroll
    var canvasW = narrative.canvasWidth || 10000;
    canvas.style.width = (typeof canvasW === 'number' ? canvasW + 'px' : canvasW);
    inner.style.width = (typeof canvasW === 'number' ? canvasW + 'px' : canvasW);
    setupDesktopScroll(typeof canvasW === 'number' ? canvasW : resolvePX(canvasW));
    // Apply page background
    if(narrative.pageBackground) document.body.style.background = narrative.pageBackground;

    // u() and resolvePX() are defined at top level below

    // Apply all common layout/visual properties from config to element
    function applyLayout(el, cfg, offsetX, offsetY){
      offsetX = offsetX || 0; offsetY = offsetY || 0;
      if(cfg.x !== undefined) el.style.left = u(typeof cfg.x === 'number' ? cfg.x + offsetX : cfg.x);
      else if(cfg.left !== undefined) el.style.left = u(typeof cfg.left === 'number' ? cfg.left + offsetX : cfg.left);
      if(cfg.y !== undefined) el.style.top = u(typeof cfg.y === 'number' ? cfg.y + offsetY : cfg.y);
      else if(cfg.top !== undefined) el.style.top = u(typeof cfg.top === 'number' ? cfg.top + offsetY : cfg.top);
      if(cfg.right !== undefined) el.style.right = u(cfg.right);
      if(cfg.bottom !== undefined) el.style.bottom = u(cfg.bottom);
      if(cfg.width) el.style.width = u(cfg.width);
      if(cfg.height) el.style.height = u(cfg.height);
      if(cfg.minWidth) el.style.minWidth = u(cfg.minWidth);
      if(cfg.maxWidth) el.style.maxWidth = u(cfg.maxWidth);
      if(cfg.minHeight) el.style.minHeight = u(cfg.minHeight);
      if(cfg.maxHeight) el.style.maxHeight = u(cfg.maxHeight);
      if(cfg.padding) el.style.padding = u(cfg.padding);
      if(cfg.paddingTop) el.style.paddingTop = u(cfg.paddingTop);
      if(cfg.paddingRight) el.style.paddingRight = u(cfg.paddingRight);
      if(cfg.paddingBottom) el.style.paddingBottom = u(cfg.paddingBottom);
      if(cfg.paddingLeft) el.style.paddingLeft = u(cfg.paddingLeft);
      if(cfg.margin) el.style.margin = u(cfg.margin);
      if(cfg.marginTop) el.style.marginTop = u(cfg.marginTop);
      if(cfg.marginRight) el.style.marginRight = u(cfg.marginRight);
      if(cfg.marginBottom) el.style.marginBottom = u(cfg.marginBottom);
      if(cfg.marginLeft) el.style.marginLeft = u(cfg.marginLeft);
      if(cfg.zIndex) el.style.zIndex = cfg.zIndex;
      if(cfg.opacity !== undefined) el.style.opacity = cfg.opacity;
      if(cfg.background) el.style.background = cfg.background;
      if(cfg.borderRadius) el.style.borderRadius = u(cfg.borderRadius);
      if(cfg.overflow) el.style.overflow = cfg.overflow;
      // Centering: stored as data for NarrativeEngine to include in transform
      if(cfg.centerX) el.setAttribute('data-center-x', '1');
      if(cfg.centerY) el.setAttribute('data-center-y', '1');
      if(cfg.fontFamily) el.style.fontFamily = cfg.fontFamily;
      if(cfg.fontSize) el.style.fontSize = cfg.fontSize;
      if(cfg.fontWeight) el.style.fontWeight = cfg.fontWeight;
      if(cfg.color) el.style.color = cfg.color;
      if(cfg.lineHeight) el.style.lineHeight = cfg.lineHeight;
      if(cfg.letterSpacing) el.style.letterSpacing = cfg.letterSpacing;
      if(cfg.textAlign) el.style.textAlign = cfg.textAlign;
      // Outline effect
      if(cfg.outline){
        var ol = cfg.outline;
        if(cfg.color || cfg.type === 'text') el.style.webkitTextStroke = (ol.width||'2px') + ' ' + ol.color;
        else { el.style.outline = (ol.width||'2px') + ' solid ' + (ol.color||'#fff'); el.style.outlineOffset = '-1px'; }
      }
      // Shadow effect
      if(cfg.shadow){
        var sh = cfg.shadow;
        if(cfg.color || cfg.type === 'text') el.style.textShadow = sh.offsetX + ' ' + sh.offsetY + ' ' + (sh.blur||'0') + ' ' + sh.color;
        else el.style.boxShadow = sh.offsetX + ' ' + sh.offsetY + ' ' + (sh.blur||'0') + ' ' + sh.color;
      }
      var ax = cfg.x || cfg.left || 0;
      el.setAttribute('data-x', typeof ax === 'number' ? ax + offsetX : resolvePX(ax));
      el.setAttribute('data-w', typeof (cfg.width||100) === 'number' ? (cfg.width||100) : resolvePX(cfg.width) || 100);
    }

    // Recursive element renderer
    function renderElement(elCfg, parentEl, offsetX, offsetY){
      offsetX = offsetX || 0; offsetY = offsetY || 0;
      var el = document.createElement('div');

      if(elCfg.type === 'group'){
        el.className = 'narrative-el group';
        el.style.position = 'absolute';
        applyLayout(el, elCfg, offsetX, offsetY);
        if(!elCfg.width) el.style.width = 'max-content';
        if(elCfg.children){
          elCfg.children.forEach(function(child){
            renderElement(child, el, 0, 0);
          });
        }
        parentEl.appendChild(el);
        if(elCfg.animation || elCfg.enterAnimation || elCfg.parallax || elCfg.float || elCfg.fadeIn){
          var animCfg = {};
          // Merge legacy animation.* and direct properties into one config
          if(elCfg.animation){ for(var k in elCfg.animation) animCfg[k] = elCfg.animation[k]; }
          if(elCfg.enterAnimation) animCfg.enterAnimation = elCfg.enterAnimation;
          if(elCfg.parallax) animCfg.parallax = elCfg.parallax;
          if(elCfg.float) animCfg.float = elCfg.float;
          if(elCfg.floatAmount) animCfg.floatAmount = elCfg.floatAmount;
          if(elCfg.fadeIn) animCfg.fadeIn = elCfg.fadeIn;
          NarrativeEngine.register(el, animCfg);
        }
        return;
      }

      // Leaf element
      el.className = 'narrative-el ' + (elCfg.type || '');
      var hasXY = elCfg.x !== undefined || elCfg.y !== undefined || elCfg.left !== undefined || elCfg.top !== undefined;
      if(hasXY){ el.style.position = 'absolute'; }
      else { el.style.position = 'relative'; if(!elCfg.maxWidth) el.style.whiteSpace = 'nowrap'; }
      applyLayout(el, elCfg, offsetX, offsetY);

      if(elCfg.type === 'image'){
        el.innerHTML = '<img src="'+elCfg.src+'" style="width:100%;height:100%;object-fit:'+(elCfg.objectFit||'cover')+';display:block">';
      } else if(elCfg.type === 'text'){
        el.innerHTML = (elCfg.content || '').replace(/\n/g, '<br>');
      } else if(elCfg.type === 'svg'){
        if(elCfg.src){
          // External SVG via <img>. Use svgColor as direct CSS filter (e.g. "brightness(0) invert(1)")
          var svgFilter = elCfg.svgColor || '';
          el.innerHTML = '<img src="'+elCfg.src+'" style="width:100%;height:100%;'+(svgFilter?'filter:'+svgFilter+';':'')+'display:block">';
        } else if(elCfg.content){
          // Inline SVG — fill/stroke applied directly
          el.innerHTML = elCfg.content;
          var svgEl = el.querySelector('svg');
          if(svgEl){
            if(elCfg.svgFill) svgEl.style.fill = elCfg.svgFill;
            if(elCfg.svgStroke) svgEl.style.stroke = elCfg.svgStroke;
            if(elCfg.svgColor){ svgEl.style.fill = elCfg.svgColor; svgEl.style.stroke = elCfg.svgColor; }
          }
        }
      } else if(elCfg.type === 'video'){
        var vattrs = (elCfg.autoplay !== false ? ' autoplay' : '') + (elCfg.loop !== false ? ' loop' : '') + (elCfg.muted !== false ? ' muted' : '') + (elCfg.controls ? ' controls' : '');
        el.innerHTML = '<video src="'+elCfg.src+'" style="width:100%;height:100%;object-fit:'+(elCfg.objectFit||'cover')+';display:block"'+vattrs+'></video>';
      } else if(elCfg.type === 'gif'){
        el.innerHTML = '<img src="'+elCfg.src+'" style="width:100%;height:100%;object-fit:'+(elCfg.objectFit||'cover')+';display:block">';
      } else if(elCfg.type === 'model3d'){
        el.setAttribute('data-model-src', elCfg.src || '');
        el.setAttribute('data-model-wireframe', elCfg.wireframe ? '1' : '0');
        el.style.background = elCfg.background || 'transparent';
        el.innerHTML = '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:rgba(0,255,255,0.4);font-size:12px;pointer-events:none">◇ 3D<br><span style="font-size:9px">'+(elCfg.src||'model.glb')+'</span></div>';
      } else if(elCfg.type === 'rect'){
        el.style.background = elCfg.background || '#888';
      } else if(elCfg.type === 'glass'){
        el.style.background = elCfg.background || 'rgba(255,255,255,0.15)';
        el.style.backdropFilter = 'blur(' + (elCfg.blur||'12px') + ')';
        el.style.webkitBackdropFilter = 'blur(' + (elCfg.blur||'12px') + ')';
      } else if(elCfg.type === 'gradient-mask'){
        el.innerHTML = '<img src="'+elCfg.src+'" style="width:100%;height:100%;object-fit:'+(elCfg.objectFit||'cover')+';display:block">';
        var dir = elCfg.direction || 'to right';
        var sa = elCfg.startAlpha !== undefined ? elCfg.startAlpha : 0;
        var ea = elCfg.endAlpha !== undefined ? elCfg.endAlpha : 1;
        var sp = elCfg.startPos || '0%';
        var ep = elCfg.endPos || '100%';
        el.style.webkitMaskImage = 'linear-gradient('+dir+', rgba(0,0,0,'+sa+') '+sp+', rgba(0,0,0,'+ea+') '+ep+')';
        el.style.maskImage = 'linear-gradient('+dir+', rgba(0,0,0,'+sa+') '+sp+', rgba(0,0,0,'+ea+') '+ep+')';
      }

      parentEl.appendChild(el);
      if(elCfg.animation || elCfg.enterAnimation || elCfg.parallax || elCfg.float || elCfg.fadeIn){
        var animCfg = {};
        if(elCfg.animation){ for(var k in elCfg.animation) animCfg[k] = elCfg.animation[k]; }
        if(elCfg.enterAnimation) animCfg.enterAnimation = elCfg.enterAnimation;
        if(elCfg.parallax) animCfg.parallax = elCfg.parallax;
        if(elCfg.float) animCfg.float = elCfg.float;
        if(elCfg.floatAmount) animCfg.floatAmount = elCfg.floatAmount;
        if(elCfg.fadeIn) animCfg.fadeIn = elCfg.fadeIn;
        NarrativeEngine.register(el, animCfg);
      }
    }

    // Render all scenes
    narrative.scenes.forEach(function(scene){
      scene.elements.forEach(function(elCfg){
        renderElement(elCfg, inner, 0, 0);
      });
    });

    loading.style.display = 'none';

    // Init progress bar
    if (narrative.progressBar && narrative.progressBar.enabled) {
      setTimeout(function() { ProgressBar.init(narrative.progressBar, narrative); }, 100);
    }
  }

  // ═══════════════════════════════════════
  //  LOAD — use ACProjectData shared module, fallback to embedded data
  // ═══════════════════════════════════════
  Promise.all([
    ACProjectData.loadProject(slug),
    ACProjectData.loadScenes(slug)
  ]).then(function(results){
    initProject(results[0], results[1]);
  }).catch(function(err){
    console.warn('Fetch failed (run a local server for live JSON): ' + err.message);
    var fb = EMBEDDED[slug];
    if(fb){ initProject(fb.meta, fb.narrative); }
    else { loading.textContent = 'Project not found: ' + slug; }
  });

  // ═══════════════════════════════════════
  //  HORIZONTAL SCROLL — same principle as index.html
  //  Desktop: body height = canvasWidth → vertical scroll → horizontal translateX
  //  Mobile: touch events with velocity inertia
  // ═══════════════════════════════════════
  var scrollX = 0;
  var isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  function clampX(v){
    var cwPx = canvas.offsetWidth || resolvePX(String(canvas.style.width||'100vw'));
    var maxScroll = Math.max(0, cwPx - window.innerWidth);
    return Math.max(0, Math.min(maxScroll, v));
  }

  function setScrollX(x){
    scrollX = clampX(x);
    canvas.style.transform = 'translateX(' + (-scrollX) + 'px)';
  }

  // ── Desktop: smooth scroll with inertia ──
  var targetX = 0, velX = 0, scrollRaf = 0;
  function setupDesktopScroll(canvasW){
    if(isMobileDevice) return;
    document.body.style.overflow = 'hidden';

    window.addEventListener('wheel', function(e){
      e.preventDefault();
      velX += e.deltaY * 0.05;
      targetX = clampX(targetX + e.deltaY * 0.05);
    }, { passive: false });

    (function scrollLoop(){
      if(!isMobileDevice && Math.abs(velX) > 0.05){
        velX *= 0.98;
        targetX = clampX(targetX + velX);
      }
      // Lerp current position toward target
      scrollX += (targetX - scrollX) * 0.08;
      if(Math.abs(targetX - scrollX) < 0.1) scrollX = targetX;
      setScrollX(scrollX);
      NarrativeEngine.update(scrollX, window.innerWidth, window.innerHeight);
      scrollRaf = requestAnimationFrame(scrollLoop);
    })();
  }

  // ── Mobile: touch with velocity inertia ──
  var touchVX = 0, touchLastX = 0, touchLastT = 0, touching = false, inertiaRaf = 0;
  function stopInertia(){ if(inertiaRaf){ cancelAnimationFrame(inertiaRaf); inertiaRaf = 0; } }

  if(isMobileDevice){
    window.addEventListener('touchstart', function(e){
      if(e.touches.length !== 1) return;
      stopInertia();
      touchLastX = e.touches[0].clientX;
      touchLastT = performance.now();
      touchVX = 0;
      touching = true;
    }, { passive: true });

    window.addEventListener('touchmove', function(e){
      if(!touching) return;
      var x = e.touches[0].clientX;
      var dx = touchLastX - x;
      var dt = performance.now() - touchLastT;
      touchVX = dt > 0 ? dx / dt : 0;
      setScrollX(scrollX + dx);
      touchLastX = x;
      touchLastT = performance.now();
    }, { passive: true });

    window.addEventListener('touchend', function(){
      if(!touching) return;
      touching = false;
      if(Math.abs(touchVX) > 0.1){
        stopInertia();
        (function step(){
          if(Math.abs(touchVX) < 0.03){ inertiaRaf = 0; return; }
          touchVX *= 0.95;
          setScrollX(scrollX + touchVX * 16);
          inertiaRaf = requestAnimationFrame(step);
        })();
      }
    }, { passive: true });
  }

  window.addEventListener('resize', function(){
    setScrollX(scrollX);
  });

  // ═══════════════════════════════════════
  //  PROGRESS BAR
  // ═══════════════════════════════════════
  var ProgressBar = {
    config: null, container: null, track: null, fill: null, pctEl: null,
    chapters: [], chapterEls: [], labelEls: [], activeIdx: -1, hoverIdx: -1,

    _narrative: null,
    _flatElements: null,
    init: function(config, narrative) {
      this.config = config;
      this._narrative = narrative;
      // Flatten all elements with world-x for quick lookup
      this._flatElements = [];
      var self = this;
      function walk(arr, px) { px = px || 0; arr.forEach(function(el) {
        var wx = resolvePX(el.x || el.left || 0) + px;
        self._flatElements.push({ el: el, worldX: wx, w: resolvePX(el.width || 100), h: resolvePX(el.height || 100) });
        if (el.type === 'group' && el.children) walk(el.children, wx);
      });}
      narrative.scenes.forEach(function(s) { walk(s.elements, 0); });
      this.container = document.getElementById("pb-wrap");
      this.track = document.getElementById("pb-track");
      this.fill = document.getElementById("pb-fill");
      this.pctEl = document.getElementById("pb-pct");
      if (!this.container) return;
      this.collectChapters(narrative);
      this.buildDOM();
      this.container.classList.remove("pre-init");
      this.update(scrollX);
    },

    collectChapters: function(narrative) {
      var self = this; self.chapters = [];
      function walk(elements, parentX) {
        parentX = parentX || 0;
        elements.forEach(function(el) {
          var worldX = resolvePX(el.x || el.left || 0) + parentX;
          if (el.chapter && el.chapter.enabled) {
            self.chapters.push({ id: el.id, label: el.chapter.label || "Chapter", worldX: worldX });
          }
          if (el.type === "group" && el.children) walk(el.children, worldX);
        });
      }
      narrative.scenes.forEach(function(sc) { walk(sc.elements, 0); });
      self.chapters.sort(function(a, b) { return a.worldX - b.worldX; });
    },

    buildDOM: function() {
      var self = this, cfg = this.config;
      self.chapterEls.forEach(function(el) { if(el.parentNode) el.parentNode.removeChild(el); });
      self.labelEls.forEach(function(el) { if(el.parentNode) el.parentNode.removeChild(el); });
      self.chapterEls = []; self.labelEls = [];
      var offPx = (cfg.offsetVh || 3) * window.innerHeight / 100;
      self.container.style.top = cfg.position === "bottom" ? "auto" : offPx + "px";
      self.container.style.bottom = cfg.position === "bottom" ? offPx + "px" : "auto";
      self.container.style.width = cfg.width || "70vw";
      self.track.style.height = (cfg.height || 4) + "px";
      self.container.style.opacity = cfg.opacity !== undefined ? cfg.opacity : 1;
      self.pctEl.style.display = cfg.showPercentage ? "" : "none";
      if (cfg.showChapters && self.chapters.length) {
        self.chapters.forEach(function(ch, i) {
          var dot = document.createElement("div"); dot.className = "pb-chapter"; dot.setAttribute("data-idx", i);
          dot.addEventListener("mouseenter", function() {
            self.hoverIdx = parseInt(this.getAttribute("data-idx")); self.updateLabels();
          });
          dot.addEventListener("mouseleave", function() {
            self.hoverIdx = -1; self.updateLabels();
          });
          dot.addEventListener("click", function(e) {
            e.stopPropagation(); self.scrollTo(ch.worldX);
          });
          self.track.appendChild(dot); self.chapterEls.push(dot);
          var lbl = document.createElement("span"); lbl.className = "pb-label";
          lbl.textContent = ch.label; lbl.setAttribute("data-idx", i);
          self.track.appendChild(lbl); self.labelEls.push(lbl);
        });
      }
    },

    getMaxScroll: function() {
      var c = document.getElementById("project-canvas");
      var cwPx = (c && c.offsetWidth) || resolvePX(String((c && c.style.width) || "100vw"));
      return Math.max(0, cwPx - window.innerWidth);
    },

    update: function(sx) {
      var self = ProgressBar;
      if (!self.container || !self.config) return;
      var maxScroll = self.getMaxScroll();
      if (maxScroll <= 0) { self.container.style.opacity = '0'; return; }
      self.updateContrast();
      var threshPx = (self.config.scrollThreshold || 0) * window.innerWidth / 100;
      var visible = sx >= threshPx;
      self.container.style.opacity = visible ? (self.config.opacity !== undefined ? self.config.opacity : 1) : '0';
      self.container.style.pointerEvents = visible ? 'none' : 'none';
      var progress = Math.max(0, Math.min(1, sx / maxScroll));
      self.fill.style.width = (progress * 100) + "%";
      if (self.config.showPercentage) self.pctEl.textContent = Math.round(progress * 100) + "%";
      if (self.config.showChapters && self.chapters.length) {
        var triggerOffset = window.innerWidth * 0.25; self.activeIdx = -1;
        for (var i = self.chapters.length - 1; i >= 0; i--) {
          if (self.chapters[i].worldX <= sx + triggerOffset) { self.activeIdx = i; break; }
        }
        self.chapterEls.forEach(function(dot, i) {
          var cp = maxScroll > 0 ? Math.max(0, Math.min(1, self.chapters[i].worldX / maxScroll)) : 0;
          dot.style.left = (cp * 100) + "%";
          dot.classList.toggle("visited", i < self.activeIdx);
          dot.classList.toggle("current", i === self.activeIdx);
          // Current pill width = track width / 40 (proportional to total)
          if (i === self.activeIdx && self.track) {
            var tw = self.track.offsetWidth;
            dot.style.width = Math.max(18, tw / 20) + "px";
          } else {
            dot.style.width = "";
          }
        });
        self.labelEls.forEach(function(lbl, i) {
          var cp = maxScroll > 0 ? Math.max(0, Math.min(1, self.chapters[i].worldX / maxScroll)) : 0;
          lbl.style.left = (cp * 100) + "%";
          lbl.classList.toggle("active", i === self.activeIdx);
        });
        self.updateLabels();
      }
    },

    updateLabels: function() {
      var self = this;
      self.labelEls.forEach(function(lbl, i) {
        lbl.classList.toggle("visible", (i === self.activeIdx) || (i === self.hoverIdx));
      });
    },

    scrollTo: function(worldX) {
      var dest = clampX(worldX);
      if (isMobileDevice) {
        // Mobile: smooth scroll via rAF since no lerp loop
        stopInertia();
        var startSx = scrollX, startT = performance.now(), duration = 400;
        function anim(now) {
          var t = Math.min(1, (now - startT) / duration);
          var eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
          setScrollX(startSx + (dest - startSx) * eased);
          if (t < 1) requestAnimationFrame(anim);
        }
        requestAnimationFrame(anim);
      } else {
        targetX = dest; velX = 0;
      }
    },

    _contrastFrame: 0,
    updateContrast: function() {
      var self = this;
      if (!self.config.autoContrast) { self.container.classList.add("pb-light"); return; }
      self._contrastFrame = (self._contrastFrame || 0) + 1;
      if (self._contrastFrame % 15 !== 0) return;
      var dbg = document.getElementById("pb-debug");
      if (!dbg) {
        dbg = document.createElement("div"); dbg.id = "pb-debug";
        dbg.style.cssText = "position:fixed;top:0;left:0;z-index:99999;pointer-events:none;font:9px monospace;color:#0f0";
        document.body.appendChild(dbg);
      }
      var infoLines = [];
      var lightVotes = 0, totalVotes = 0;
      var dotsHTML = "";
      for (var i = 0; i < 5; i++) {
        var sx = window.innerWidth * (0.1 + i * 0.2);
        var sy = window.innerHeight * 0.5;
        var canvasX = scrollX + sx;
        // Find elements covering this point, must be vertically in viewport too
        var matches = [];
        for (var ei = 0; ei < self._flatElements.length; ei++) {
          var fe = self._flatElements[ei];
          // Check horizontal overlap
          if (canvasX < fe.worldX || canvasX > fe.worldX + fe.w) continue;
          // Check vertical: element must be within viewport vertically
          var ey = resolvePX(fe.el.y || fe.el.top || 0);
          var eh = fe.h;
          if (ey > window.innerHeight || ey + eh < 0) continue; // off-screen vertically
          // Element covers this point
          matches.push(fe.el);
        }
        // Find best color from topmost match first
        var foundColor = "", foundSource = "";
        for (var mi = matches.length - 1; mi >= 0; mi--) {
          var ed = matches[mi];
          if (ed.background && ed.background !== "transparent" && ed.background !== "rgba(0, 0, 0, 0)") {
            foundColor = ed.background; foundSource = ed.type + ".bg"; break;
          }
          if (ed.color && ed.color !== "rgb(0, 0, 0)" && ed.color !== "#000" && ed.color !== "#000000") {
            foundColor = ed.color; foundSource = ed.type + ".color";
          }
        }
        if (!foundColor) { foundColor = self._narrative.pageBackground || "#000000"; foundSource = "pageBG"; }
        // Parse and vote
        var rgb = {r:0,g:0,b:0}, isLight = false;
        if (foundColor.charAt(0) === "#") {
          var h = foundColor.substring(1);
          if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
          if (h.length >= 6) { rgb.r = parseInt(h.substring(0,2),16); rgb.g = parseInt(h.substring(2,4),16); rgb.b = parseInt(h.substring(4,6),16); }
        } else if (foundColor.indexOf("rgb") >= 0) {
          var nums2 = foundColor.substring(foundColor.indexOf("(")+1, foundColor.indexOf(")")).split(",");
          if (nums2.length >= 3) { rgb.r = parseInt(nums2[0]); rgb.g = parseInt(nums2[1]); rgb.b = parseInt(nums2[2]); }
        }
        var lum = (0.299*rgb.r + 0.587*rgb.g + 0.114*rgb.b) / 255;
        totalVotes++;
        if (lum > 0.5) { lightVotes++; isLight = true; }
        infoLines.push("pt"+i+" x="+Math.round(canvasX)+" m="+matches.length+" -> "+(isLight?"L":"D"));
        // Visual dot at sample position
        dotsHTML += "<span style="position:fixed;left:"+sx+"px;top:"+sy+"px;width:10px;height:10px;border-radius:50%;background:"+foundColor+";border:2px solid "+(isLight?"#000":"#fff")+";transform:translate(-50%,-50%)"+(i===2?";width:14px;height:14px":"")+""></span>";
      }
      var isLight = totalVotes > 0 && lightVotes >= totalVotes * 0.5;
      infoLines.push("=" + lightVotes + "/" + totalVotes + " -> " + (isLight ? "LIGHT" : "DARK"));
      dbg.innerHTML = "<div style="background:rgba(0,0,0,0.8);padding:4px 6px;border-radius:3px;white-space:nowrap">"+infoLines.join(" ")+"</div>" + dotsHTML;
      dbg.style.background = "none";
      self.container.classList.toggle("pb-light", isLight);
    },

    

    

    

    

    

    

    

    

    

    

    

    

        destroy: function() {
      if (this.container) this.container.classList.add("pre-init");
      this.chapters = [];
      this.chapterEls.forEach(function(el) { if(el.parentNode) el.parentNode.removeChild(el); });
      this.labelEls.forEach(function(el) { if(el.parentNode) el.parentNode.removeChild(el); });
    }
  };
  //  MAIN RAF LOOP — animations + progress bar
  // ═══════════════════════════════════════
  (function mainLoop(){
    NarrativeEngine.update(scrollX, window.innerWidth, window.innerHeight);
    if (ProgressBar.container && ProgressBar.config) {
      ProgressBar.update(scrollX);
    }
    requestAnimationFrame(mainLoop);
  })();
})();
