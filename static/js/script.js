// ============================================
// 月光酒馆 · 调酒交互逻辑
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  // 只在首页执行调酒逻辑
  if (!document.getElementById('spiritShelf')) return;

  // --- 状态 ---
  const state = {
    selectedSpirits: [],
    maxIngredients: 3,
    isMixing: false
  };

  const spiritsData = window.spiritsData || [];
  const postsData = window.tavernPosts || [];

  // --- DOM 引用 ---
  const spiritBtns = document.querySelectorAll('.spirit-btn');
  const glassFill = document.getElementById('glassFill');
  const glassBubbles = document.getElementById('glassBubbles');
  const glassContent = document.getElementById('glassContent');
  const selectedTags = document.getElementById('selectedTags');
  const btnMix = document.getElementById('btnMix');
  const btnClear = document.getElementById('btnClear');
  const resultAnimation = document.getElementById('resultAnimation');
  const resultContent = document.getElementById('resultContent');
  const mixResult = document.getElementById('mixResult');

  // --- 工具函数 ---
  function getSpiritData(id) {
    return spiritsData.find(s => s.id === id);
  }

  function getMixedColor() {
    if (state.selectedSpirits.length === 0) return 'rgba(255, 179, 0, 0.15)';
    if (state.selectedSpirits.length === 1) {
      const s = getSpiritData(state.selectedSpirits[0]);
      return s ? s.color + '66' : 'rgba(255, 179, 0, 0.15)';
    }
    // 混合颜色
    const colors = state.selectedSpirits.map(id => {
      const s = getSpiritData(id);
      return s ? s.color : '#ffb300';
    });
    return blendColors(colors, 0.4);
  }

  function blendColors(hexColors, alpha = 0.5) {
    // 将多个 hex 颜色混合
    let r = 0, g = 0, b = 0;
    hexColors.forEach(hex => {
      const clean = hex.replace('#', '');
      r += parseInt(clean.substring(0, 2), 16);
      g += parseInt(clean.substring(2, 4), 16);
      b += parseInt(clean.substring(4, 6), 16);
    });
    const count = hexColors.length;
    return `rgba(${Math.round(r/count)}, ${Math.round(g/count)}, ${Math.round(b/count)}, ${alpha})`;
  }

  function getSpiritEmoji(id) {
    const s = getSpiritData(id);
    return s ? s.emoji : '🍸';
  }

  function getSpiritName(id) {
    const s = getSpiritData(id);
    return s ? s.name : id;
  }

  function sortMoods(moods) {
    return [...moods].sort();
  }

  function moodsMatch(a, b) {
    const sa = sortMoods(a);
    const sb = sortMoods(b);
    return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
  }

  // --- 更新调酒杯 ---
  function updateGlass() {
    const count = state.selectedSpirits.length;
    const fillPercent = Math.min(count / state.maxIngredients * 100, 100);

    // 更新液面
    glassFill.style.height = fillPercent + '%';
    glassFill.style.background = getMixedColor();
    glassFill.style.boxShadow = `inset 0 0 20px ${getMixedColor()}`;

    // 更新显示内容
    if (count === 0) {
      glassContent.innerHTML = '<span class="glass-placeholder">点击基酒加入</span>';
      clearBubbles();
    } else {
      const emojis = state.selectedSpirits.map(id => getSpiritEmoji(id)).join(' ');
      const names = state.selectedSpirits.map(id => getSpiritName(id)).join(' + ');
      glassContent.innerHTML = `
        <div style="text-align:center;padding:0.5rem;">
          <div style="font-size:1.5rem;margin-bottom:0.3rem;">${emojis}</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);">${names}</div>
        </div>
      `;
      generateBubbles(count);
    }

    // 更新按钮状态
    btnMix.disabled = count < 2;
  }

  // --- 气泡效果 ---
  function clearBubbles() {
    glassBubbles.innerHTML = '';
  }

  function generateBubbles(count) {
    clearBubbles();
    const numBubbles = count * 3;
    for (let i = 0; i < numBubbles; i++) {
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.style.left = Math.random() * 90 + '%';
      bubble.style.width = (3 + Math.random() * 5) + 'px';
      bubble.style.height = bubble.style.width;
      const delay = Math.random() * 3;
      const duration = 2 + Math.random() * 3;
      bubble.style.animationDelay = delay + 's';
      bubble.style.animationDuration = duration + 's';
      glassBubbles.appendChild(bubble);
    }
  }

  // --- 更新已选标签 ---
  function updateTags() {
    selectedTags.innerHTML = '';
    state.selectedSpirits.forEach(id => {
      const tag = document.createElement('span');
      tag.className = 'selected-tag';
      tag.innerHTML = `${getSpiritEmoji(id)} ${getSpiritName(id)}`;
      tag.style.borderColor = getSpiritData(id)?.color + '44' || 'rgba(255,179,0,0.2)';
      tag.addEventListener('click', () => removeSpirit(id));
      tag.style.cursor = 'pointer';
      tag.title = '点击移除';
      selectedTags.appendChild(tag);
    });
  }

  // --- 添加基酒 ---
  function addSpirit(id) {
    if (state.isMixing) return;
    if (state.selectedSpirits.includes(id)) return;
    if (state.selectedSpirits.length >= state.maxIngredients) {
      shakeGlass();
      return;
    }

    state.selectedSpirits.push(id);
    updateButtons();
    updateTags();
    updateGlass();
    hideResult();
  }

  // --- 移除基酒 ---
  function removeSpirit(id) {
    if (state.isMixing) return;
    state.selectedSpirits = state.selectedSpirits.filter(s => s !== id);
    updateButtons();
    updateTags();
    updateGlass();
    hideResult();
  }

  // --- 清空 ---
  function clearAll() {
    if (state.isMixing) return;
    state.selectedSpirits = [];
    updateButtons();
    updateTags();
    updateGlass();
    hideResult();
  }

  // --- 更新按钮样式 ---
  function updateButtons() {
    spiritBtns.forEach(btn => {
      const id = btn.dataset.spirit;
      btn.classList.toggle('selected', state.selectedSpirits.includes(id));
    });
  }

  // --- 摇杯动画 ---
  function shakeGlass() {
    const glass = document.querySelector('.glass-body');
    glass.style.animation = 'shake 0.4s ease';
    setTimeout(() => { glass.style.animation = ''; }, 400);
  }

  // --- 隐藏结果 ---
  function hideResult() {
    resultAnimation.style.display = 'none';
    resultContent.style.display = 'none';
    document.querySelector('.result-no-match')?.remove();
  }

  // --- 调配 ---
  function mixDrink() {
    if (state.isMixing) return;
    if (state.selectedSpirits.length < 2) return;

    state.isMixing = true;
    hideResult();

    // 调配动画
    resultAnimation.style.display = 'block';
    resultAnimation.textContent = '🍸 调制中...';

    // 模拟调酒过程
    setTimeout(() => {
      resultAnimation.textContent = '✨ 咕噜咕噜...';
    }, 500);

    setTimeout(() => {
      resultAnimation.textContent = '🌟 完成！';
    }, 1000);

    // 查找匹配的文章
    setTimeout(() => {
      resultAnimation.style.display = 'none';

      const matched = postsData.filter(post => {
        return moodsMatch(state.selectedSpirits, post.moods);
      });

      if (matched.length > 0) {
        const post = matched[0];
        // 颜色混合效果
        const mixedColor = getMixedColor();
        resultContent.style.display = 'block';
        resultContent.style.borderColor = mixedColor;
        resultContent.innerHTML = `
          <div style="font-size:3rem;margin-bottom:0.5rem;">✨</div>
          <h3>🍸 ${post.title}</h3>
          <p>${post.description || '一杯恰到好处的酒'}</p>
          <a href="${post.url}" class="btn-read">📖 阅读这篇文章</a>
        `;
        // 彩带/粒子效果
        createParticles();
      } else {
        const noMatch = document.createElement('div');
        noMatch.className = 'result-no-match';
        noMatch.innerHTML = `
          <div style="font-size:2rem;margin-bottom:0.5rem;">🤔</div>
          <p>这杯酒... 似乎还没人调制过</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-top:0.3rem;">试试其他组合吧！</p>
        `;
        mixResult.appendChild(noMatch);
      }

      state.isMixing = false;
    }, 1800);
  }

  // --- 粒子效果 ---
  function createParticles() {
    const container = mixResult;
    const colors = ['#ffb300', '#ff8a65', '#ffe082', '#ffd54f', '#ffffff'];
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: absolute;
        width: ${4 + Math.random() * 8}px;
        height: ${4 + Math.random() * 8}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        border-radius: 50%;
        pointer-events: none;
        left: ${40 + Math.random() * 20}%;
        top: 50%;
        animation: particle-fly ${1 + Math.random() * 1.5}s ease-out forwards;
        z-index: 10;
      `;
      container.appendChild(particle);
      setTimeout(() => particle.remove(), 2500);
    }
  }

  // --- 事件绑定 ---
  spiritBtns.forEach(btn => {
    btn.addEventListener('click', () => addSpirit(btn.dataset.spirit));
  });

  btnMix.addEventListener('click', mixDrink);
  btnClear.addEventListener('click', clearAll);

  // 添加 shake 动画
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-8px) rotate(-2deg); }
      40% { transform: translateX(8px) rotate(2deg); }
      60% { transform: translateX(-5px) rotate(-1deg); }
      80% { transform: translateX(5px) rotate(1deg); }
    }
    @keyframes particle-fly {
      0% { transform: translateY(0) scale(1); opacity: 1; }
      100% { transform: translateY(-100px) translateX(${() => (Math.random() - 0.5) * 100}px) scale(0); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  // 初始化配方显示（将 mood ID 映射为 emoji + 名称）
  document.querySelectorAll('.recipe-ingredient').forEach(el => {
    const spiritId = el.dataset.spirit;
    const s = getSpiritData(spiritId);
    if (s) {
      el.textContent = `${s.emoji} ${s.name}`;
    }
  });

  // 初始化调酒杯
  updateGlass();
});