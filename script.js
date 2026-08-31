/* =========================================================================
   孙嘉麾 · 个人作品集简历网站 —— 完整主脚本
   ========================================================================= */

(function () {
    'use strict';

    var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* 模块 A｜开场封面页 */
    var cover = document.getElementById('cover');
    var IS_MOBILE = window.matchMedia('(max-width: 768px)').matches;
    if (cover && IS_MOBILE) {
        cover.style.display = 'none';
    } else if (cover) {
        var covered = true, autoTimer = null;
        function dismissCover() {
            if (!covered) return;
            covered = false;
            clearTimeout(autoTimer);
            cover.classList.add('hide');
            var wait = REDUCE ? 300 : 800;
            setTimeout(function () { cover.style.display = 'none'; }, wait + 50);
            document.removeEventListener('keydown', dismissCover);
            cover.removeEventListener('click', dismissCover);
        }
        autoTimer = setTimeout(dismissCover, 2200);
        cover.addEventListener('click', dismissCover);
        document.addEventListener('keydown', dismissCover);
    }

    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

    var GROUPS = {};

    /* 模块 B｜PPT 照片堆叠 */
    var STACK_LAYOUT = [
        { x:   0, y:   0, r: -3.4 }, { x:  10, y:  -9, r:  2.6 },
        { x:  -9, y:  10, r:  3.8 }, { x:  11, y:  11, r: -2.0 },
        { x: -11, y:  -8, r:  1.5 }, { x:   8, y:  12, r: -4.0 },
        { x: -10, y:   8, r:  2.2 }, { x:  12, y: -11, r: -2.8 },
        { x:  -8, y: -12, r:  3.4 }, { x:   9, y:   9, r: -1.4 },
        { x: -12, y:  11, r:  3.0 }
    ];

    function initStacks() {
        var mobile = window.innerWidth <= 768;
        var offScale = mobile ? 0.5 : 1;
        var rotScale = mobile ? 0.75 : 1;

        document.querySelectorAll('.ppt-stack').forEach(function (stack) {
            var group = stack.getAttribute('data-group');
            var shots = Array.prototype.slice.call(stack.querySelectorAll('.shot'));
            var list = [];

            shots.forEach(function (shot, i) {
                var lay = STACK_LAYOUT[i % STACK_LAYOUT.length];
                var tx = (lay.x + i * 9) * offScale;
                var ty = (lay.y + i * 8) * offScale;
                var rot = lay.r * rotScale;
                shot.style.setProperty('--tx', tx + 'px');
                shot.style.setProperty('--ty', ty + 'px');
                shot.style.setProperty('--rot', rot + 'deg');
                shot.style.transform = 'translate(' + tx + 'px,' + ty + 'px) rotate(' + rot + 'deg)';
                shot.style.zIndex = String(i + 1);
                shot.setAttribute('data-index', String(i));

                var img = shot.querySelector('img');
                list.push({
                    src: img ? img.getAttribute('src') : '',
                    cap: shot.getAttribute('data-cap') || ''
                });

                shot.addEventListener('click', function (e) {
                    e.stopPropagation();
                    openLightbox(group, i);
                });
            });
            GROUPS[group] = list;
        });
    }

    /* 模块 C｜通用图片分组 */
    function initGroups() {
        var nodes = document.querySelectorAll('[data-lb-group]');
        var buckets = {};

        Array.prototype.forEach.call(nodes, function (el) {
            var g = el.getAttribute('data-lb-group');
            if (!buckets[g]) buckets[g] = { list: [], map: {} };
            var b = buckets[g];

            var img = (el.tagName === 'IMG') ? el : el.querySelector('img');
            var src = img ? img.getAttribute('src') : '';
            if (!src) return;

            if (b.map[src] === undefined) {
                b.map[src] = b.list.length;
                b.list.push({ src: src, cap: el.getAttribute('data-lb-cap') || '' });
            }
            var idx = b.map[src];

            el.style.cursor = 'pointer';
            el.addEventListener('click', function (e) {
                e.stopPropagation();
                openLightbox(g, idx);
            });
        });

        for (var k in buckets) {
            if (Object.prototype.hasOwnProperty.call(buckets, k)) GROUPS[k] = buckets[k].list;
        }
    }

    /* 模块 D｜弹窗及防白屏机制 */
    var lb = document.getElementById('lightbox');
    var lbImg = document.getElementById('lightbox-img');
    var lbCap = document.getElementById('lightbox-cap');
    var lbIdx = document.getElementById('lightbox-index');
    var lbList = [], lbPos = 0;

    var lbLoader = document.getElementById('lb-loader');
    if (!lbLoader && lb) {
        lbLoader = document.createElement('div');
        lbLoader.id = 'lb-loader';
        lbLoader.innerHTML = '<div class="spinner"></div><p>加载中...</p>';
        lb.appendChild(lbLoader);
    }

    function show(i) {
        if (!lbList.length) return;
        lbPos = (i + lbList.length) % lbList.length;
        
        if (lbLoader) lbLoader.style.display = 'flex';
        lbImg.style.opacity = '0';
        lbImg.alt = lbList[lbPos].cap || '';
        lbCap.textContent = lbList[lbPos].cap || '';
        lbIdx.textContent = (lbPos + 1) + ' / ' + lbList.length;

        var tempImg = new Image();
        tempImg.onload = function() {
            lbImg.src = lbList[lbPos].src;
            if (lbLoader) lbLoader.style.display = 'none';
            lbImg.style.opacity = '1';
        };
        tempImg.onerror = function() {
            lbImg.src = '';
            lbImg.alt = '图片加载失败';
            if (lbLoader) lbLoader.style.display = 'none';
            lbImg.style.opacity = '1';
        };
        tempImg.src = lbList[lbPos].src;
    }

    function openLightbox(group, index) {
        if (!lb) return;
        var list = GROUPS[group];
        if (!list || !list.length) return;
        lbList = list;
        lb.classList.add('open');
        document.body.style.overflow = 'hidden';
        show(clamp(index, 0, lbList.length - 1));
    }

    function closeLightbox() {
        if (!lb) return;
        lb.classList.remove('open');
        document.body.style.overflow = '';
        lbList = [];
        lbPos = 0;
    }

    if (lb) {
        lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
        lb.querySelector('.lb-close').addEventListener('click', closeLightbox);
        lb.querySelector('.lb-prev').addEventListener('click', function (e) { e.stopPropagation(); show(lbPos - 1); });
        lb.querySelector('.lb-next').addEventListener('click', function (e) { e.stopPropagation(); show(lbPos + 1); });
        document.addEventListener('keydown', function (e) {
            if (!lb.classList.contains('open')) return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') show(lbPos - 1);
            if (e.key === 'ArrowRight') show(lbPos + 1);
        });
    }

    /* 模块 E｜导航高亮 */
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-link[data-target]'));
    function renderNav() {
        var mid = window.innerHeight / 2;
        for (var i = 0; i < navLinks.length; i++) {
            var sec = document.getElementById(navLinks[i].getAttribute('data-target'));
            if (!sec) continue;
            var r = sec.getBoundingClientRect();
            navLinks[i].classList.toggle('active', r.top <= mid && r.bottom >= mid);
        }
    }
    if (navLinks.length) {
        var tick = false;
        window.addEventListener('scroll', function () {
            if (tick) return;
            tick = true;
            requestAnimationFrame(function () { renderNav(); tick = false; });
        }, { passive: true });
        renderNav();
    }

    /* 模块 F｜联系方式一键复制 */
    document.querySelectorAll('[data-copy]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            var text = btn.getAttribute('data-copy');
            var label = btn.querySelector('.c-label');
            var raw = label ? label.textContent : '';
            function done() {
                btn.classList.add('copied');
                if (label) label.textContent = '已复制';
                setTimeout(function () {
                    btn.classList.remove('copied');
                    if (label) label.textContent = raw;
                }, 1400);
            }
            function fallback() {
                var ta = document.createElement('textarea');
                ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select();
                try { document.execCommand('copy'); done(); } catch (err) { }
                document.body.removeChild(ta);
            }
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(done).catch(fallback);
            } else { fallback(); }
        });
    });

    /* 模块 G｜图片加载失败处理 */
    function toFallback(img) {
        if (img.dataset.failed) return;
        img.dataset.failed = '1';
        var rect = img.getBoundingClientRect();
        var w = rect.width || parseInt(img.getAttribute('width'), 10) || 160;
        var h = rect.height || parseInt(img.getAttribute('height'), 10) || 110;
        var box = document.createElement('div');
        box.className = 'img-fallback ' + (img.className || '');
        box.style.width = w + 'px';
        box.style.height = h + 'px';
        box.textContent = (img.getAttribute('src') || '').split('/').pop();
        if (img.parentNode) img.parentNode.replaceChild(box, img);
    }
    function bindImgErrors() {
        document.querySelectorAll('img').forEach(function (img) {
            if (img.id === 'lightbox-img') return; 
            img.addEventListener('error', function () { toFallback(img); });
            if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) toFallback(img);
        });
    }

    /* 模块 H｜第 8 页 mailto 留言表单降级 */
    var gbForm = document.getElementById('guestbook-form');
    if (gbForm) {
        var TO = 'sunjiahui0313@qq.com';
        var status = document.getElementById('form-status');
        var fName = document.getElementById('gb-name');
        var fMail = document.getElementById('gb-email');
        var fText = document.getElementById('gb-message');
        var subBtn = gbForm.querySelector('button[type="submit"]');

        [fName, fMail, fText].forEach(function(input) {
            input.addEventListener('focus', function() {
                if (window.innerWidth <= 768) {
                    setTimeout(function() {
                        input.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    }, 300);
                }
            });
        });

        gbForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var name = (fName.value || '').trim();
            var mail = (fMail.value || '').trim();
            var text = (fText.value || '').trim();

            if (!name || !text) {
                status.textContent = '请填写昵称和留言内容';
                status.style.color = '#ff94b4';
                (!name ? fName : fText).focus();
                return;
            }
            if (!mail) {
                status.textContent = '请填写你的邮箱，否则无法提交留言';
                status.style.color = '#ff94b4';
                fMail.focus();
                return;
            }

            if (window.innerWidth <= 768) {
                var originalText = subBtn.textContent;
                function fallbackCopy(text) {
                    var ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    var res = false;
                    try { res = document.execCommand('copy'); } catch (err) { }
                    document.body.removeChild(ta);
                    return res ? Promise.resolve() : Promise.reject();
                }
                var copyPromise = (navigator.clipboard && window.isSecureContext) 
                    ? navigator.clipboard.writeText(TO).catch(function() { return fallbackCopy(TO); }) 
                    : fallbackCopy(TO);

                copyPromise.then(function() {
                    subBtn.textContent = '邮箱已复制';
                    status.textContent = '已复制邮箱，请打开邮件 App 发送留言';
                    status.style.color = '#ffffff';
                    setTimeout(function() { subBtn.textContent = originalText; }, 1500);
                }).catch(function() {
                    status.textContent = '复制失败，请手动长按下方邮箱复制';
                    status.style.color = '#ff94b4';
                });
            } else {
                var subject = '个人主页留言 · 来自 ' + name;
                var body = '昵称：' + name + '\n邮箱：' + mail + '\n\n留言内容：\n' + text;
                window.location.href = 'mailto:' + TO + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
                status.textContent = '已调起邮箱客户端，请在客户端中点击发送';
                status.style.color = '#ffffff';
                gbForm.reset();
            }
        });
    }

    /* 模块 I｜移动端图片加载智能优化 */
    function optimizeMobileImages() {
        if (window.innerWidth > 768) return; 

        var lazyImgs = document.querySelectorAll('#page3 img, #page4 img, #page6 img, #page7 img');
        lazyImgs.forEach(function(img) {
            var src = img.getAttribute('src') || '';
            if (!src.includes('head-full.png') && !src.includes('item1.png') && !src.includes('item2.png') && !src.includes('item3.png')) {
                img.setAttribute('loading', 'lazy');
            }
        });

        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        var img = entry.target;
                        var tempImg = new Image();
                        tempImg.src = img.src; 
                        observer.unobserve(img);
                    }
                });
            }, { rootMargin: '300px' });

            var preloadTargets = document.querySelectorAll('.ppt-stack img, .sj, .sq, .thanks-photo, .cert-card img');
            preloadTargets.forEach(function(img) {
                observer.observe(img);
            });
        }
    }

    /* 启动 */
    bindImgErrors();
    initStacks();
    initGroups();
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', optimizeMobileImages);
    } else {
        optimizeMobileImages();
    }

})();