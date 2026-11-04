window.SBGOV_CONFIG = {
  API_BASE: "https://api.sbgov.tw",
  TURNSTILE_SITEKEY: "0x4AAAAAAFz0DT7MQ8tNo_UV", 
};

(function () {
  const cfg = window.SBGOV_CONFIG;
  let applyWidgetId = null;
  let statusWidgetId = null;
  let reportWidgetId = null;
  let reportStatusWidgetId = null;
  const tokens = { apply: "", status: "", report: "", report_status: "" };

  function initTurnstile() {
    if (typeof turnstile === "undefined") return;

    if (document.getElementById("apply-turnstile")) {
      applyWidgetId = turnstile.render("#apply-turnstile", {
        sitekey: cfg.TURNSTILE_SITEKEY, action: "apply", theme: "light",
        callback: (t) => { tokens.apply = t; },
        "expired-callback": () => { tokens.apply = ""; },
      });
    }

    if (document.getElementById("status-turnstile")) {
      statusWidgetId = turnstile.render("#status-turnstile", {
        sitekey: cfg.TURNSTILE_SITEKEY, action: "status", theme: "light",
        callback: (t) => { tokens.status = t; },
        "expired-callback": () => { tokens.status = ""; },
      });
    }

    if (document.getElementById("report-turnstile")) {
      reportWidgetId = turnstile.render("#report-turnstile", {
        sitekey: cfg.TURNSTILE_SITEKEY, action: "report", theme: "light",
        callback: (t) => { tokens.report = t; },
        "expired-callback": () => { tokens.report = ""; },
      });
    }
    
    if (document.getElementById("report-status-turnstile")) {
      reportStatusWidgetId = turnstile.render("#report-status-turnstile", {
        sitekey: cfg.TURNSTILE_SITEKEY, action: "report_status", theme: "light",
        callback: (t) => { tokens.report_status = t; },
        "expired-callback": () => { tokens.report_status = ""; },
      });
    }
  }

  async function apiPost(path, payload) {
    try {
      const r = await fetch(cfg.API_BASE + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await r.json();
    } catch (e) {
      return { ok: false, error: "Network error / 網路連線失敗" };
    }
  }

  function setupTabs() {
    const applyBtn = document.getElementById("tab-apply");
    const statusBtn = document.getElementById("tab-status");
    const applyPanel = document.getElementById("panel-apply");
    const statusPanel = document.getElementById("panel-status");
    if (!applyBtn || !statusBtn) return;

    const activeCls = ["border-b-2", "border-slate-900", "font-semibold"];
    const inactiveCls = ["text-slate-400"];

    function setActive(a, b, show, hide) {
      show.classList.remove("hidden"); hide.classList.add("hidden");
      a.classList.add(...activeCls); a.classList.remove(...inactiveCls);
      b.classList.remove(...activeCls); b.classList.add(...inactiveCls);
    }

    applyBtn.onclick = () => {
      setActive(applyBtn, statusBtn, applyPanel, statusPanel);
      if (applyWidgetId) turnstile.reset(applyWidgetId); tokens.apply = "";
    };
    statusBtn.onclick = () => {
      setActive(statusBtn, applyBtn, statusPanel, applyPanel);
      if (statusWidgetId) turnstile.reset(statusWidgetId); tokens.status = "";
    };
  }

  function bindApply(opts) {
    const btn = document.getElementById("apply-go");
    if (!btn) return;
    btn.onclick = async () => {
      const sub = document.getElementById("apply-sub").value.trim().toLowerCase();
      const tgt = document.getElementById("apply-tgt").value.trim().toLowerCase();
      const contact = document.getElementById("apply-contact").value.trim();
      const msg = document.getElementById("apply-msg");

      if (!tokens.apply) {
        msg.className = "text-sm text-amber-600"; msg.textContent = opts.waitTurnstile || "Please complete verification"; return;
      }
      msg.className = "text-sm text-slate-400"; msg.textContent = opts.loading || "Submitting…";
      const j = await apiPost("/api/apply", {
        subdomain: sub, github_target: tgt, contact: contact, turnstile_token: tokens.apply,
      });
      tokens.apply = ""; if (applyWidgetId) turnstile.reset(applyWidgetId);
      msg.className = "text-sm " + (j.ok ? "text-green-600" : "text-red-600");
      msg.textContent = j.ok ? (opts.success || j.message) : (j.error || opts.fail || "Failed");
    };
  }

  function bindStatus(opts) {
    const btn = document.getElementById("status-go");
    if (!btn) return;
    btn.onclick = async () => {
      const sub = document.getElementById("status-sub").value.trim().toLowerCase();
      const out = document.getElementById("status-out");
      if (!tokens.status) { out.innerHTML = `<p class="text-amber-600">${opts.waitTurnstile || "Please complete verification"}</p>`; return; }
      out.innerHTML = `<p class="text-slate-400">${opts.loading || "Checking…"}</p>`;
      const j = await apiPost("/api/status", { subdomain: sub, turnstile_token: tokens.status });
      tokens.status = ""; if (statusWidgetId) turnstile.reset(statusWidgetId);
      if (!j.ok) { out.innerHTML = `<p class="text-red-600">${j.error}</p>`; return; }
      const d = j.data;
      const label = (opts.labels && opts.labels[d.status]) || [d.status, ""];
      out.innerHTML = `
        <p>${opts.subdomainLabel || "Subdomain"}：<b>${d.subdomain}.sbgov.tw</b></p>
        <p>${opts.statusLabel || "Status"}：<span class="${label[1]} font-semibold">${label[0]}</span></p>
        ${d.blocked ? `<p class="text-red-700 font-semibold">${opts.blockedLabel || "Blocked"}</p>` : ""}
        ${d.status === "rejected" && d.reject_reason ? `<p class="text-slate-600">${opts.reasonLabel || "Reason"}：${d.reject_reason}</p>` : ""}
        <p class="text-slate-400">${opts.timeLabel || "Applied at"}：${d.created_at}</p>`;
    };
  }

  function bindReport(opts) {
    const btn = document.getElementById("report-go");
    if (!btn) return;
    btn.onclick = async () => {
      const sub = document.getElementById("report-sub").value.trim().toLowerCase();
      const reason = document.getElementById("report-reason").value.trim();
      const contact = document.getElementById("report-contact").value.trim();
      const msg = document.getElementById("report-msg");

      if (!sub || !reason) {
        msg.className = "text-sm font-bold text-red-600 mt-2";
        msg.textContent = opts.alertEmpty || "Please fill in all fields";
        return;
      }

      if (!tokens.report) {
        msg.className = "text-sm font-bold text-red-600 mt-2"; 
        msg.textContent = opts.waitTurnstile || "Please complete verification";
        return;
      }
      
      msg.className = "text-sm text-slate-400 mt-2"; msg.textContent = opts.loading || "Submitting…";
      
      const j = await apiPost("/api/report", {
        subdomain: sub, reason: reason, contact: contact, turnstile_token: tokens.report,
      });
      
      tokens.report = ""; 
      if (reportWidgetId) turnstile.reset(reportWidgetId);
      
      if (j.ok) {
        const successMsg = (opts.alertSuccess || "Report submitted! Your code is: {code}\nPlease keep it safe.").replace("{code}", j.report_code);
        alert(successMsg);
        
        msg.className = "text-sm font-bold text-green-600 mt-2";
        msg.innerHTML = `${opts.success || "Submitted"} <span class="text-lg select-all font-mono">${j.report_code}</span>`;
        
        document.getElementById("report-sub").value = "";
        document.getElementById("report-reason").value = "";
        document.getElementById("report-contact").value = "";
        
        if (document.getElementById("tab-report-status")) {
          document.getElementById("tab-report-status").click();
          document.getElementById("rstatus-code").value = j.report_code;
        }
      } else {
        msg.className = "text-sm font-bold text-red-600 mt-2";
        msg.textContent = j.error || opts.fail || "Failed";
        alert((opts.alertFail || "Submission failed: ") + (j.error || ""));
      }
    };
  }

  function bindReportStatus(opts) {
    const btn = document.getElementById("rstatus-go");
    if (!btn) return;
    btn.onclick = async () => {
      const code = document.getElementById("rstatus-code").value.trim().toUpperCase();
      const out = document.getElementById("rstatus-out");

      if (!code) {
        out.innerHTML = `<p class="text-red-600">${opts.alertEmpty || "Please enter a code"}</p>`;
        return;
      }
      
      if (!tokens.report_status) { 
        out.innerHTML = `<p class="text-amber-600">${opts.waitTurnstile || "Please complete verification"}</p>`; 
        return; 
      }
      
      out.innerHTML = `<p class="text-slate-400">${opts.loading || "Checking…"}</p>`;
      
      const j = await apiPost("/api/report/status", { report_code: code, turnstile_token: tokens.report_status });
      
      tokens.report_status = ""; 
      if (reportStatusWidgetId) turnstile.reset(reportStatusWidgetId);
      
      if (!j.ok) { 
        out.innerHTML = `<p class="text-red-600">${j.error}</p>`; 
        return; 
      }
      
      const d = j.data;
      const isPending = d.status === 'pending';
      
      out.innerHTML = `
        <div class="bg-slate-50 p-4 rounded-lg mt-4">
          <p class="mb-2"><b>${opts.codeLabel || "Code"}：</b> <span class="font-mono">${code}</span></p>
          <p class="mb-2"><b>${opts.statusLabel || "Status"}：</b> 
            <span class="font-semibold ${isPending ? 'text-amber-600' : 'text-green-600'}">
              ${isPending ? (opts.pendingMsg || '待處理') : (opts.resolvedMsg || '已處理')}
            </span>
          </p>
          <p class="mb-2"><b>${opts.timeLabel || "Submitted at"}：</b> ${d.created_at}</p>
          ${d.admin_reply ? `<div class="mt-4 p-3 bg-white border rounded text-sm"><b>${opts.replyLabel || "Reply"}：</b><br>${d.admin_reply}</div>` : ""}
          ${!isPending ? `<p class="text-xs text-slate-400 mt-4">${opts.deleteMsg || '系統將於 2 天後自動刪除此紀錄。'}</p>` : ""}
        </div>
      `;
    };
  }

  window.SBGOV = { initTurnstile, apiPost, setupTabs, bindApply, bindStatus, bindReport, bindReportStatus };
})();
