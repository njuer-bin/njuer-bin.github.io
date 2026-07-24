/**
 * 月光酒馆 - 信箱功能
 * - 寄信：通过 Formspree 发送（AJAX，不跳转）
 * - 读信：通过 GitHub Issues API 公开读取（无需 Token）
 */

(function () {
  'use strict';

  // ====== 配置 ======
  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/mnjegolj';
  var GITHUB_REPO = 'njuer-bin/njuer-bin.github.io';
  var ISSUES_LABEL = '酒馆来信';

  // ====== DOM 引用 ======
  var form = document.getElementById('letterForm');
  var nameInput = document.getElementById('name');
  var titleInput = document.getElementById('title');
  var messageInput = document.getElementById('message');
  var submitBtn = document.getElementById('submitBtn');
  var lettersContainer = document.getElementById('lettersContainer');
  var notification = document.getElementById('notification');

  // ====== 工具函数 ======

  /** 显示通知 */
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

  /** 设置按钮加载状态 */
  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? '📨 寄出中...' : '📨 寄出';
  }

  /** 转义 HTML */
  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /** 截断文本 */
  function truncateText(str, maxLen) {
    if (!str) return '';
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + '...';
  }

  /** 解析 Issue 为信件数据 */
  function issueToLetter(issue) {
    // 尝试从正文中提取寄信人
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

  // ====== 寄信 - 通过 Formspree ======

  function submitLetter(name, title, message) {
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
      if (res.ok) {
        return { success: true };
      }
      return res.json().then(function (data) {
        throw new Error((data && data.error) || '寄信失败，请稍后再试');
      });
    });
  }

  // ====== 读信 - 通过 GitHub Issues API（公开） ======

  function loadLetters() {
    if (!lettersContainer) return;

    lettersContainer.innerHTML = '<div class="loading-letters"><p>📬 正在加载信件...</p></div>';

    var url =
      'https://api.github.com/repos/' + GITHUB_REPO + '/issues?labels=' +
      encodeURIComponent(ISSUES_LABEL) + '&state=all&sort=created&direction=desc&per_page=20';

    fetch(url, {
      headers: { 'Accept': 'application/vnd.github+json' },
    })
      .then(function (res) {
        if (!res.ok) throw new Error('加载失败');
        return res.json();
      })
      .then(function (issues) {
        if (!issues || !issues.length) {
          lettersContainer.innerHTML = '<div class="no-letters"><p>📭 还没有公开的信件，写第一封吧！</p></div>';
          return;
        }

        var html = '<div class="letters-list">';
        for (var i = 0; i < issues.length; i++) {
          if (issues[i].pull_request) continue; // 跳过 PR
          var letter = issueToLetter(issues[i]);
          var d = new Date(letter.date);
          var dateStr =
            d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');

          html +=
            '<article class="letter-card">' +
              '<h3>' + escapeHtml(letter.title) + '</h3>' +
              '<p class="letter-from">✉️ 来自：' + escapeHtml(letter.from) + '</p>' +
              '<p class="letter-excerpt">' + escapeHtml(truncateText(letter.body, 150)) + '</p>' +
              '<time>' + dateStr + '</time>' +
            '</article>';
        }
        html += '</div>';
        lettersContainer.innerHTML = html;
      })
      .catch(function () {
        lettersContainer.innerHTML =
          '<div class="no-letters"><p>⚠️ 暂时无法加载信件</p></div>';
      });
  }

  // ====== 事件绑定 ======

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

      submitLetter(name, title, message)
        .then(function () {
          showNotification('📨 信件已安全送达酒馆！', 'success');
          if (nameInput) nameInput.value = '';
          if (titleInput) titleInput.value = '';
          if (messageInput) messageInput.value = '';
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
    loadLetters();
  }
})();