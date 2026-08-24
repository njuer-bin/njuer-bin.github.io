/**
 * 月光酒馆 - 信箱功能
 * - 寄信：通过 GitHub API 创建 Issue（需 Token）
 * - 备选：通过 Formspree 发送（无 Token 时自动降级）
 * - 读信：通过 GitHub Issues API 公开读取
 * - 搜索、排序、分页、详情弹窗、回复
 */

(function () {
  'use strict';

  // ====== 配置 ======
  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/mnjegolj';
  var GITHUB_TOKEN = (typeof MAILBOX_CONFIG !== 'undefined' && MAILBOX_CONFIG.githubToken) ? MAILBOX_CONFIG.githubToken : '';
  var GITHUB_REPO = (typeof MAILBOX_CONFIG !== 'undefined' && MAILBOX_CONFIG.githubRepo) ? MAILBOX_CONFIG.githubRepo : 'njuer-bin/njuer-bin.github.io';
  var ISSUES_LABEL = '酒馆来信';
  var PER_PAGE = 10;

  // ====== 状态 ======
  var allLetters = [];
  var displayedLetters = [];
  var currentPage = 1;
  var hasMore = true;
  var isLoading = false;
  var currentSort = 'desc'; // 'desc' = 最新优先, 'asc' = 最早优先
  var currentSearch = '';
  var currentIssueNumber = null;
  var pendingIdCounter = 0; // 当前弹窗中的 Issue 编号

  // ====== DOM 引用 ======
  var form = document.getElementById('letterForm');
  var nameInput = document.getElementById('name');
  var titleInput = document.getElementById('title');
  var messageInput = document.getElementById('message');
  var charCount = document.getElementById('charCount');
  var submitBtn = document.getElementById('submitBtn');
  var lettersContainer = document.getElementById('lettersContainer');
  var searchInput = document.getElementById('searchInput');
  var searchClear = document.getElementById('searchClear');
  var sortBtn = document.getElementById('sortBtn');
  var loadMoreWrap = document.getElementById('loadMoreWrap');
  var loadMoreBtn = document.getElementById('loadMoreBtn');
  var modal = document.getElementById('letterModal');
  var modalBackdrop = document.getElementById('modalBackdrop');
  var modalClose = document.getElementById('modalClose');
  var modalBody = document.getElementById('modalBody');
  var notification = document.getElementById('notification');

  // ====== 工具函数 ======

  function showNotification(message, type) {
    if (!notification) return;
    notification.textContent = message;
    notification.className = 'notification';
    void notification.offsetWidth;
    notification.classList.add('notification-' + (type || 'success'));
    notification.classList.add('notification-visible');
    if (notification._hideTimer) clearTimeout(notification._hideTimer);
    notification._hideTimer = setTimeout(function () {
      notification.classList.remove('notification-visible');
    }, 4000);
  }

  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? '📨 寄出中...' : '📨 寄出';
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function truncateText(str, maxLen) {
    if (!str) return '';
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + '...';
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /** 解析 Issue 为信件数据 */
  function issueToLetter(issue) {
    var from = '匿名访客';
    var body = issue.body || '';
    var match = body.match(/\*\*寄信人：\*\*\s*(.+)/);
    if (match) {
      from = match[1].trim();
    }
    // 去掉正文中的元数据部分
    var content = body;
    var separatorIndex = content.indexOf('---');
    if (separatorIndex !== -1) {
      content = content.substring(separatorIndex + 3).trim();
    }
    return {
      id: issue.number,
      title: issue.title,
      from: from,
      body: content,
      date: issue.created_at,
    };
  }

  /** 检查信件是否匹配搜索关键词 */
  function letterMatchesSearch(letter, keyword) {
    if (!keyword) return true;
    var kw = keyword.toLowerCase();
    return (letter.title && letter.title.toLowerCase().indexOf(kw) !== -1) ||
           (letter.from && letter.from.toLowerCase().indexOf(kw) !== -1) ||
           (letter.body && letter.body.toLowerCase().indexOf(kw) !== -1);
  }

  // ====== 寄信 ======

  /** 通过 GitHub API 创建 Issue */
  function createIssueViaGitHub(name, title, message) {
    var body = '**寄信人：** ' + (name.trim() || '匿名访客') + '\n\n**标题：** ' + title.trim() + '\n\n---\n\n' + message.trim();
    return fetch('https://api.github.com/repos/' + GITHUB_REPO + '/issues', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + GITHUB_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title.trim(),
        body: body,
        labels: [ISSUES_LABEL],
      }),
    }).then(function (res) {
      if (res.ok) return res.json();
      return res.json().then(function (data) {
        throw new Error((data && data.errors && data.errors[0] && data.errors[0].message) || '创建失败');
      });
    });
  }

  /** 通过 Formspree 发送（备选方案） */
  function submitLetterViaFormspree(name, title, message) {
    var formData = new FormData();
    formData.append('name', name.trim() || '匿名访客');
    formData.append('title', title.trim());
    formData.append('message', message.trim());
    formData.append('_subject', '📬 酒馆来信：' + title.trim());
    return fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'application/json' },
    }).then(function (res) {
      if (res.ok) return { success: true };
      return res.json().then(function (data) {
        throw new Error((data && data.error) || '寄信失败，请稍后再试');
      });
    });
  }

  // ====== 读信 ======

  function fetchLetters(page) {
    var url = 'https://api.github.com/repos/' + GITHUB_REPO + '/issues?labels=' +
      encodeURIComponent(ISSUES_LABEL) + '&state=all&sort=created&direction=desc&per_page=' +
      PER_PAGE + '&page=' + page;
    return fetch(url, {
      headers: { 'Accept': 'application/vnd.github+json' },
    }).then(function (res) {
      if (!res.ok) throw new Error('加载失败');
      // 检查是否有更多页（GitHub 返回的 Link header）
      var linkHeader = res.headers.get('Link');
      hasMore = linkHeader && linkHeader.indexOf('rel="next"') !== -1;
      return res.json();
    });
  }

  function loadLetters(page) {
    if (isLoading) return Promise.resolve();
    isLoading = true;

    if (page === 1) {
      lettersContainer.innerHTML = '<div class="loading-letters"><p>📬 正在加载信件...</p></div>';
      loadMoreWrap.style.display = 'none';
    }

    return fetchLetters(page)
      .then(function (issues) {
        if (!issues || !issues.length) {
          if (page === 1) {
            lettersContainer.innerHTML = '<div class="no-letters"><p>📭 还没有公开的信件，写第一封吧！</p></div>';
          }
          hasMore = false;
          loadMoreWrap.style.display = 'none';
          isLoading = false;
          return;
        }

        // 过滤掉 PR
        var newLetters = [];
        for (var i = 0; i < issues.length; i++) {
          if (issues[i].pull_request) continue;
          newLetters.push(issueToLetter(issues[i]));
        }

        if (page === 1) {
          allLetters = newLetters;
        } else {
          allLetters = allLetters.concat(newLetters);
        }

        currentPage = page;
        applyFiltersAndRender();

        if (hasMore) {
          loadMoreWrap.style.display = 'block';
        } else {
          loadMoreWrap.style.display = 'none';
        }

        isLoading = false;
      })
      .catch(function () {
        if (page === 1) {
          lettersContainer.innerHTML = '<div class="no-letters"><p>⚠️ 暂时无法加载信件</p></div>';
        }
        isLoading = false;
      });
  }

  // ====== 搜索与排序 ======

  function applyFiltersAndRender() {
    // 先排序
    var sorted = sortLetters(allLetters);

    // 再搜索
    if (currentSearch) {
      sorted = sorted.filter(function (l) {
        return letterMatchesSearch(l, currentSearch);
      });
    }

    displayedLetters = sorted;
    renderLetterList(displayedLetters);
  }

  function sortLetters(letters) {
    var copy = letters.slice();
    copy.sort(function (a, b) {
      var da = new Date(a.date).getTime();
      var db = new Date(b.date).getTime();
      return currentSort === 'desc' ? db - da : da - db;
    });
    return copy;
  }

  function renderLetterList(letters) {
    if (!letters.length && currentSearch) {
      lettersContainer.innerHTML = '<div class="no-letters"><p>🔍 没有找到匹配的信件</p></div>';
      return;
    }
    if (!letters.length) {
      lettersContainer.innerHTML = '<div class="no-letters"><p>📭 还没有公开的信件，写第一封吧！</p></div>';
      return;
    }

    var html = '<div class="letters-list">';
    for (var i = 0; i < letters.length; i++) {
      var l = letters[i];
      var excerpt = truncateText(l.body, 120);
      var isHighlight = currentSearch && letterMatchesSearch(l, currentSearch);
      var pendingClass = l._pending ? ' letter-pending' : '';
      var pendingBadge = l._pending ? '<span class="letter-badge">⏳ 待公开</span>' : '';
      html +=
        '<article class="letter-card' + (isHighlight ? ' highlight' : '') + pendingClass + '" data-issue-id="' + l.id + '">' +
          '<h3>' + escapeHtml(l.title) + pendingBadge + '</h3>' +
          '<p class="letter-from">✉️ 来自：' + escapeHtml(l.from) + '</p>' +
          '<p class="letter-excerpt">' + escapeHtml(excerpt) + '</p>' +
          '<time>' + formatDate(l.date) + '</time>' +
        '</article>';
    }
    html += '</div>';
    lettersContainer.innerHTML = html;

    // 绑定点击事件
    var cards = lettersContainer.querySelectorAll('.letter-card');
    for (var j = 0; j < cards.length; j++) {
      cards[j].addEventListener('click', function () {
        var issueId = parseInt(this.dataset.issueId, 10);
        openLetterModal(issueId);
      });
    }
  }

  // ====== 搜索事件 ======

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      currentSearch = this.value.trim();
      if (searchClear) {
        searchClear.classList.toggle('visible', !!currentSearch);
      }
      // 如果有搜索词但当前 letters 不全，先加载所有
      // 但为了简单，只在已加载的范围内搜索
      applyFiltersAndRender();
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', function () {
      searchInput.value = '';
      currentSearch = '';
      searchClear.classList.remove('visible');
      applyFiltersAndRender();
    });
  }

  // ====== 排序事件 ======

  if (sortBtn) {
    sortBtn.addEventListener('click', function () {
      currentSort = currentSort === 'desc' ? 'asc' : 'desc';
      var label = currentSort === 'desc' ? '最新优先' : '最早优先';
      var arrow = currentSort === 'desc' ? '↓' : '↑';
      sortBtn.querySelector('.sort-label').textContent = label;
      sortBtn.querySelector('.sort-arrow').textContent = arrow;
      applyFiltersAndRender();
    });
  }

  // ====== 加载更多 ======

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function () {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = '📩 加载中...';
      loadLetters(currentPage + 1).then(function () {
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = '📩 加载更多';
      }).catch(function () {
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = '📩 加载更多';
      });
    });
  }

  // ====== 信件详情弹窗 ======

  function openLetterModal(issueNumber) {
    if (!modal) return;
    currentIssueNumber = issueNumber;
    modalBody.innerHTML = '<div class="modal-loading">📬 加载中...</div>';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // 加载 Issue 详情和评论
    loadLetterDetail(issueNumber);
  }

  function closeLetterModal() {
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    currentIssueNumber = null;
  }

  function loadLetterDetail(issueNumber) {
    // 从 allLetters 中找缓存
    var letter = null;
    for (var i = 0; i < allLetters.length; i++) {
      if (allLetters[i].id === issueNumber) {
        letter = allLetters[i];
        break;
      }
    }

    if (!letter) {
      // 不在缓存中，单独 fetch
      var url = 'https://api.github.com/repos/' + GITHUB_REPO + '/issues/' + issueNumber;
      fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } })
        .then(function (res) {
          if (!res.ok) throw new Error('加载失败');
          return res.json();
        })
        .then(function (issue) {
          if (issue.pull_request) return;
          var l = issueToLetter(issue);
          renderLetterDetail(l);
          loadReplies(issueNumber);
        })
        .catch(function () {
          modalBody.innerHTML = '<div class="no-letters"><p>⚠️ 无法加载信件详情</p></div>';
        });
    } else {
      renderLetterDetail(letter);
      loadReplies(issueNumber);
    }
  }

  function renderLetterDetail(letter) {
    modalBody.innerHTML =
      '<div class="modal-letter-header">' +
        '<h2 class="modal-letter-title">' + escapeHtml(letter.title) + '</h2>' +
        '<div class="modal-letter-meta">' +
          '<span>✉️ ' + escapeHtml(letter.from) + '</span>' +
          '<span>' + formatDate(letter.date) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="modal-letter-body">' + escapeHtml(letter.body) + '</div>' +
      '<div class="modal-replies" id="modalReplies">' +
        '<h4>💬 回复</h4>' +
        '<div id="repliesContainer"><p style="color:var(--text-muted);font-size:0.8rem;">加载回复中...</p></div>' +
      '</div>' +
      '<div class="reply-form">' +
        '<h5>📝 写回复</h5>' +
        '<div class="form-group">' +
          '<label for="replyName">你的名字</label>' +
          '<input type="text" id="replyName" class="reply-name" placeholder="匿名访客" maxlength="20">' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="replyMessage">回复内容</label>' +
          '<textarea id="replyMessage" class="reply-message" rows="3" placeholder="写下你的回复..." required maxlength="1000"></textarea>' +
        '</div>' +
        '<button class="btn-reply" id="replySubmitBtn">📨 发送回复</button>' +
      '</div>';

    // 绑定回复提交
    var replyBtn = document.getElementById('replySubmitBtn');
    if (replyBtn) {
      replyBtn.addEventListener('click', function () {
        submitReply(letter.id);
      });
    }
  }

  // ====== 回复加载 ======

  function loadReplies(issueNumber) {
    var url = 'https://api.github.com/repos/' + GITHUB_REPO + '/issues/' + issueNumber + '/comments';
    fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('加载失败');
        return res.json();
      })
      .then(function (comments) {
        renderReplies(comments);
      })
      .catch(function () {
        var container = document.getElementById('repliesContainer');
        if (container) {
          container.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">暂无回复</p>';
        }
      });
  }

  function renderReplies(comments) {
    var container = document.getElementById('repliesContainer');
    if (!container) return;

    if (!comments || !comments.length) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">暂无回复，来写第一条吧</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < comments.length; i++) {
      var c = comments[i];
      // 如果评论是机器人发的，显示为"酒馆主人"
      var author = c.user && c.user.login === 'github-actions[bot]' ? '🏮 酒馆主人' : (c.user ? c.user.login : '匿名');
      html +=
        '<div class="reply-item">' +
          '<div class="reply-header">' +
            '<span class="reply-author">' + escapeHtml(author) + '</span>' +
            '<span>' + formatDate(c.created_at) + '</span>' +
          '</div>' +
          '<div class="reply-body">' + escapeHtml(c.body || '') + '</div>' +
        '</div>';
    }
    container.innerHTML = html;
  }

  // ====== 回复提交 ======

  function submitReply(issueNumber) {
    var replyName = document.getElementById('replyName');
    var replyMessage = document.getElementById('replyMessage');
    var replyBtn = document.getElementById('replySubmitBtn');

    var name = replyName ? replyName.value.trim() || '匿名访客' : '匿名访客';
    var message = replyMessage ? replyMessage.value.trim() : '';

    if (!message) {
      showNotification('请填写回复内容', 'error');
      return;
    }

    replyBtn.disabled = true;
    replyBtn.textContent = '📨 发送中...';

    // 通过 Formspree 发送回复
    var formData = new FormData();
    formData.append('name', name);
    formData.append('issue_number', issueNumber);
    formData.append('message', message);
    formData.append('_subject', '💬 酒馆回复 #' + issueNumber + '：' + name);

    fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'application/json' },
    })
      .then(function (res) {
        if (res.ok) {
          showNotification('💬 回复已发送，等待酒馆主人确认', 'success');
          if (replyMessage) replyMessage.value = '';
          if (replyName && replyName.value && replyName.value === name) {
            // 保留名字
          }
        } else {
          throw new Error('发送失败');
        }
      })
      .catch(function () {
        showNotification('❌ 回复发送失败，请稍后再试', 'error');
      })
      .finally(function () {
        replyBtn.disabled = false;
        replyBtn.textContent = '📨 发送回复';
      });
  }

  // ====== 弹窗事件绑定 ======

  if (modalClose) {
    modalClose.addEventListener('click', closeLetterModal);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', closeLetterModal);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
      closeLetterModal();
    }
  });

  // ====== 字数统计 ======

  if (messageInput && charCount) {
    messageInput.addEventListener('input', function () {
      var len = this.value.length;
      charCount.textContent = len + ' / 2000';
    });
  }

  // ====== 寄信表单提交 ======

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = nameInput ? nameInput.value : '';
      var title = titleInput ? titleInput.value : '';
      var message = messageInput ? messageInput.value : '';

      if (!title.trim()) {
        showNotification('请填写信件标题', 'error');
        return;
      }
      if (!message.trim()) {
        showNotification('请写下你想说的话', 'error');
        return;
      }

      setLoading(true);

      // 判断是否有 GitHub Token
      var useGitHub = GITHUB_TOKEN ? true : false;

      var submitPromise;
      if (useGitHub) {
        // 用 GitHub API 创建 Issue
        submitPromise = createIssueViaGitHub(name, title, message)
          .then(function (issue) {
            // 添加到本地列表，立即显示
            var newLetter = {
              id: issue.number,
              title: title.trim() || '无标题',
              from: name.trim() || '匿名访客',
              body: message.trim(),
              date: issue.created_at,
            };
            // 从 allLetters 中移除同名的临时条目
            allLetters = allLetters.filter(function (l) { return l.id >= 0; });
            allLetters.unshift(newLetter);
            applyFiltersAndRender();
            return { success: true };
          });
      } else {
        // 无 Token，用 Formspree 降级（不会立即显示）
        submitPromise = submitLetterViaFormspree(name, title, message)
          .then(function () {
            // 添加到本地列表，显示为"待公开"
            pendingIdCounter--;
            var pendingLetter = {
              id: pendingIdCounter,
              title: title.trim() || '无标题',
              from: name.trim() || '匿名访客',
              body: message.trim(),
              date: new Date().toISOString(),
              _pending: true,
            };
            allLetters.unshift(pendingLetter);
            applyFiltersAndRender();
            return { success: true };
          });
      }

      submitPromise
        .then(function () {
          showNotification('📨 信件已安全送达酒馆！', 'success');

          if (nameInput) nameInput.value = '';
          if (titleInput) titleInput.value = '';
          if (messageInput) messageInput.value = '';
          if (charCount) charCount.textContent = '0 / 2000';
        })
        .catch(function (err) {
          showNotification('❌ ' + err.message, 'error');
        })
        .finally(function () {
          setLoading(false);
        });
    });
  }

  // ====== 初始化 ======

  if (lettersContainer) {
    loadLetters(1);
  }
})();