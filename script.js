/* =========================================================================
   孙嘉麾 · 个人作品集简历网站 —— 主脚本
   纯原生 JavaScript，无第三方库、无后端。
   模块索引：
     A  开场封面页（自动过渡 + 点击/按键跳过）
     B  🔴 高难度模块 2：PPT 照片堆叠
     C  通用图片分组（第3页 sj、第6页证书、第7页 sq 与主图）
     D  弹窗（全站共用，打开即显示、左右切换、索引、Esc/背景关闭）
     E  导航高亮
     F  联系方式一键复制
     G  图片加载失败 → 灰色占位块 + 文件名
     H  第 8 页 mailto 留言表单（含必填校验）
   ========================================================================= */

(function () {
    'use strict';

    var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* =====================================================================
       模块 A｜开场封面页
       · cover-bg.jpg 已含全部文字，脚本不叠加任何文案
       · 显示 2.2s 后自动淡出：opacity 1→0 + translateY 0→-18px
         时长 0.8s、缓动 cubic-bezier(.22,.61,.36,1)（写在 CSS）
       · 过渡结束后再延迟 50ms 设 display:none
       · 点击任意位置 / 按任意键立即触发同一套淡出
       · prefers-reduced-motion 下 0.3s 直接消失
       ===================================================================== */
    var cover = document.getElementById('cover');
    var IS_MOBILE = window.matchMedia('(max-width: 768px)').matches;
    if (cover && IS_MOBILE) {
        cover.style.display = 'none';   // 移动端直接跳过封面，不等待、不淡出
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

    /* 全站图片分组表：group 名 → [{src, cap}, ...] */
    var GROUPS = {};

    /* =====================================================================
       🔴 模块 B｜PPT 照片堆叠
       ---------------------------------------------------------------------
       · 每张 .shot 绝对定位在同一容器内，尺寸统一 480×320（移动端 100%×240）
       · 偏移量取自固定表（8~12px，方向左上/右上/左下/右下混合）再逐张累加，
         保证"随手叠放"的错落感，同时刷新后版式稳定
       · 旋转 -4°~4°
       · z-index = i + 1：后一张盖住前一张，最上层完整度最高
       · 每张记录自己在数组中的索引；点击时把「这一张」的索引交给弹窗，
         而不是永远打开最上层那张
       · 每个堆叠有独立 data-group，各弹窗互不干扰
       ===================================================================== */
    var STACK_LAYOUT = [
        { x:   0, y:   0, r: -3.4 },
        { x:  10, y:  -9, r:  2.6 },
        { x:  -9, y:  10, r:  3.8 },
        { x:  11, y:  11, r: -2.0 },
        { x: -11, y:  -8, r:  1.5 },
        { x:   8, y:  12, r: -4.0 },
        { x: -10, y:   8, r:  2.2 },
        { x:  12, y: -11, r: -2.8 },
        { x:  -8, y: -12, r:  3.4 },
        { x:   9, y:   9, r: -1.4 },
        { x: -12, y:  11, r:  3.0 }
    ];

    function initStacks() {
        var mobile = window.matchMedia('(max-width: 768px)').matches;
        var offScale = mobile ? 0.5 : 1;   // 移动端偏移收窄到约 4~6px
        var rotScale = mobile ? 0.75 : 1;  // 移动端旋转收窄到约 -3°~3°

        document.querySelectorAll('.ppt-stack').forEach(function (stack) {
            var group = stack.getAttribute('data-group');
            var shots = Array.prototype.slice.call(stack.querySelectorAll('.shot'));
            var list = [];

            shots.forEach(function (shot, i) {
                var lay = STACK_LAYOUT[i % STACK_LAYOUT.length];
                var tx = (lay.x + i * 9) * offScale;     // 逐张再累加，避免完全重合分不清
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
                    openLightbox(group, i);   // 打开被点击的那一张
                });
            });

            GROUPS[group] = list;
        });
    }

    /* =====================================================================
       模块 C｜通用图片分组
       任何带 data-lb-group 的元素都会被收进对应分组并绑定点击放大：
         第 3 页 sj1~sj4、第 6 页证书、第 7 页 sq1~sq3 与主图、子页证书
       弹窗大图直接使用该元素内 <img> 已加载好的 src，命中缓存、点开即显示。
       双向滚动的证书行里每张卡片有两份副本，按 src 去重后共用一张索引表。
       ===================================================================== */
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

            if (b.map[src] === undefined) {          // 去重
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

    /* =====================================================================
       模块 D｜弹窗
       背景半透明黑 + blur(8px)；图片 max 80vw / 80vh；
       左右箭头循环切换（首尾相接）；底部显示「当前 / 总数」；
       Esc 或点击背景空白处关闭；关闭时重置索引。
       图片赋值不加任何延迟或过渡，点开立即显示。
       ===================================================================== */
    var lb = document.getElementById('lightbox');
    var lbImg = document.getElementById('lightbox-img');
    var lbCap = document.getElementById('lightbox-cap');
    var lbIdx = document.getElementById('lightbox-index');
    var lbList = [], lbPos = 0;

    function show(i) {
        if (!lbList.length) return;
        lbPos = (i + lbList.length) % lbList.length;     // 循环切换
        lbImg.src = lbList[lbPos].src;                   // 直接赋值，不重新构造元素
        lbImg.alt = lbList[lbPos].cap || '';
        lbCap.textContent = lbList[lbPos].cap || '';
        lbIdx.textContent = (lbPos + 1) + ' / ' + lbList.length;
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
        lbPos = 0;                 // 关闭时重置索引
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

    /* =====================================================================
       模块 E｜导航高亮
       ===================================================================== */
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

    /* =====================================================================
       模块 F｜联系方式一键复制
       ===================================================================== */
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

    /* =====================================================================
       模块 G｜图片加载失败处理
       替换为同尺寸灰块 + 文件名，既不出现破碎图标，也不塌陷布局。
       ===================================================================== */
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
            if (img.id === 'lightbox-img') return; // 弹窗大图初始 src 为空，不参与失败判定，避免被误判为加载失败而被替换掉
            img.addEventListener('error', function () { toFallback(img); });
            if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) toFallback(img);
        });
    }

    /* =====================================================================
       模块 H｜第 8 页 mailto 留言表单
       不使用任何第三方后端，提交时拼装 mailto: 调起本机邮箱客户端。
       校验：
         · 昵称或留言为空 → "请填写昵称和留言内容"
         · 邮箱为空       → "请填写你的邮箱，否则无法提交留言"
       ===================================================================== */
    var gbForm = document.getElementById('guestbook-form');
    if (gbForm) {
        var TO = 'sunjiahui0313@qq.com';
        var status = document.getElementById('form-status');
        var fName = document.getElementById('gb-name');
        var fMail = document.getElementById('gb-email');
        var fText = document.getElementById('gb-message');

        gbForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var name = (fName.value || '').trim();
            var mail = (fMail.value || '').trim();
            var text = (fText.value || '').trim();

            if (!name || !text) {
                status.textContent = '请填写昵称和留言内容';
                (!name ? fName : fText).focus();
                return;
            }
            if (!mail) {
                status.textContent = '请填写你的邮箱，否则无法提交留言';
                fMail.focus();
                return;
            }

            var subject = '个人主页留言 · 来自 ' + name;
            var body = '昵称：' + name + '\n邮箱：' + mail + '\n\n留言内容：\n' + text;
            window.location.href = 'mailto:' + TO +
                '?subject=' + encodeURIComponent(subject) +
                '&body=' + encodeURIComponent(body);

            status.textContent = '已调起邮箱客户端，请在客户端中点击发送';
            gbForm.reset();
        });
    }

    /* ===================== 启动 ===================== */
    bindImgErrors();
    initStacks();
    initGroups();

})();
