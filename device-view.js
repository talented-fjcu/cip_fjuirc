/**
 * CIP Device View Switcher Controller (電腦 / 平板 / 手機)
 * 支援手動切換、大字體排版切換與 localStorage 跨頁面記憶
 */
(function() {
  const STORAGE_KEY = "CIP_DEVICE_VIEW_V3";

  function detectDefaultMode() {
    const w = window.innerWidth;
    if (w >= 900) return "desktop";
    if (w >= 600) return "tablet";
    return "mobile";
  }

  function getSavedMode() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (saved === "desktop" || saved === "tablet" || saved === "mobile")) {
      return saved;
    }
    // 若為首次或升級，依當前螢幕寬度自動給予最適模式
    return detectDefaultMode();
  }

  function applyMode(mode) {
    document.documentElement.setAttribute("data-device-mode", mode);
    if (document.body) {
      document.body.setAttribute("data-device-mode", mode);
    }

    // 更新所有切換按鈕的狀態
    document.querySelectorAll(".dev-btn").forEach(btn => {
      const bMode = btn.getAttribute("data-mode");
      if (bMode === mode) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  window.setDeviceMode = function(mode) {
    localStorage.setItem(STORAGE_KEY, mode);
    applyMode(mode);
    try {
      window.dispatchEvent(new CustomEvent("cip-device-mode-change", { detail: { mode: mode } }));
    } catch (e) {}
  };

  // 生成切換器 HTML
  function buildSwitcherHtml(activeMode) {
    return `
      <div class="device-switcher-bar">
        <span class="device-switcher-title">👁️ 畫面排版：</span>
        <div class="device-switcher-group">
          <button type="button" class="dev-btn ${activeMode === 'desktop' ? 'active' : ''}" data-mode="desktop" onclick="setDeviceMode('desktop')">
            💻 電腦寬版
          </button>
          <button type="button" class="dev-btn ${activeMode === 'tablet' ? 'active' : ''}" data-mode="tablet" onclick="setDeviceMode('tablet')">
            📟 平板雙欄
          </button>
          <button type="button" class="dev-btn ${activeMode === 'mobile' ? 'active' : ''}" data-mode="mobile" onclick="setDeviceMode('mobile')">
            📱 手機單欄
          </button>
        </div>
      </div>
    `;
  }

  function initSwitcher() {
    const currentMode = getSavedMode();
    applyMode(currentMode);

    // 1. 若頁面中已有自訂容器 #deviceSwitcher
    const customSlot = document.getElementById("deviceSwitcher");
    if (customSlot) {
      customSlot.innerHTML = buildSwitcherHtml(currentMode);
      return;
    }

    // 2. 自動判斷插入位置：優先放在 .container 或 .card 的最上方，或 .nav-bar 之後
    const wrapper = document.createElement("div");
    wrapper.id = "deviceSwitcher";
    wrapper.innerHTML = buildSwitcherHtml(currentMode);

    const container = document.querySelector(".container") || document.querySelector(".card");
    const navBar = document.querySelector(".nav-bar");

    if (container) {
      container.insertBefore(wrapper, container.firstChild);
    } else if (navBar && navBar.parentNode) {
      navBar.parentNode.insertBefore(wrapper, navBar.nextSibling);
    } else if (document.body) {
      document.body.insertBefore(wrapper, document.body.firstChild);
    }
  }

  // 立即套用模式防止畫面閃爍
  const initialMode = getSavedMode();
  document.documentElement.setAttribute("data-device-mode", initialMode);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSwitcher);
  } else {
    initSwitcher();
  }
})();
