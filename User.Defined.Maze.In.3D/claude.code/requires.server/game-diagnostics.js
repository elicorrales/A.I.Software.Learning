// GEMINI.3 game-diagnostics.js
import { GameInterface } from './interface.js';

// Internal module memory tracker holding logs, snapshots, and view metrics
const DiagnosticData = {
  snapshots: { current: null, previous: null },
  playerHistory: [],
  ballHistory: [],
  activePanel: null, // Holds string key: 'S', 'P', 'B', 'M' or null if completely closed
  zoomFactors: { S: 1.0, P: 1.0, B: 1.0, M: 1.0 }
};

export const GameDiagnostics = {
  // --- Initialization Hook ---
  init() {
    // Prime the baseline initial structural snapshot immediately upon launch
    this.captureSnapshot();
  },

  // --- Mutually Exclusive Panel Toggle Machine ---
  togglePanel(panelId) {
    const windowEl = document.getElementById('diagnostic-window');
    if (!windowEl) return;

    // If clicking the same button twice, minimize/hide it completely
    if (DiagnosticData.activePanel === panelId) {
      DiagnosticData.activePanel = null;
      windowEl.style.display = 'none';
      this.updateButtonHighlights();
      return;
    }

    // Otherwise, transition view exclusively to the newly requested tab
    DiagnosticData.activePanel = panelId;
    windowEl.style.display = 'flex';
    
    this.renderActivePanelContent();
    this.updateButtonHighlights();
  },

  // --- State Snapshot Serialization Engine ---
  captureSnapshot() {
    // Grab clean decoupled deep primitive copies through the interface façade boundary
    const liveStateSnapshot = GameInterface.getBirdsEyeContext();
    
    // Cycle chronological indices forward
    DiagnosticData.snapshots.previous = DiagnosticData.snapshots.current;
    DiagnosticData.snapshots.current = JSON.stringify(liveStateSnapshot); // Minified, packed string payload

    // If the state panel is currently visible, redraw its contents live
    if (DiagnosticData.activePanel === 'S') {
      this.renderActivePanelContent();
    }
  },

  // --- Assembly Style Chronological Logging Methods ---
  logPlayer(opcode, actionText, hallId, localZ) {
    const context = GameInterface.getSceneRenderContext();
    // Dynamically query the structural state boundary to calculate true global positioning coordinates
    const globalX = GameInterface.getLocalZToGlobalX(context.player.currentHall, localZ);
    
    const logLine = `${opcode.padEnd(4)} ${actionText.padEnd(9)} ${hallId} Z:${localZ.toFixed(3).padEnd(7)} X:${globalX.toFixed(3)}`;
    DiagnosticData.playerHistory.unshift(logLine); // Inserts at the top of the feed stack
    
    // Enforce 500 entry limit ceiling constraint caps
    if (DiagnosticData.playerHistory.length > 500) {
      DiagnosticData.playerHistory.pop();
    }

    if (DiagnosticData.activePanel === 'P') this.renderActivePanelContent();
  },

  logBall(opcode, actionText, hallId, localZ) {
    const context = GameInterface.getSceneRenderContext();
    // Dynamically query the structural state boundary to calculate true global positioning coordinates
    const globalX = GameInterface.getLocalZToGlobalX(context.ball.currentHall, localZ);
    
    const logLine = `${opcode.padEnd(4)} ${actionText.padEnd(9)} ${hallId} Z:${localZ.toFixed(3).padEnd(7)} X:${globalX.toFixed(3)}`;
    DiagnosticData.ballHistory.unshift(logLine);
    
    if (DiagnosticData.ballHistory.length > 500) {
      DiagnosticData.ballHistory.pop();
    }

    if (DiagnosticData.activePanel === 'B') this.renderActivePanelContent();
  },

  // --- Zoom Scaling Matrix Updates ---
  adjustZoom(panelId, direction) {
    const step = 0.1;
    const currentZoom = DiagnosticData.zoomFactors[panelId];
    
    // Lock values within healthy responsive constraints (0.6x to 2.5x magnification)
    const nextZoom = direction === 'IN' 
      ? Math.min(2.5, currentZoom + step) 
      : Math.max(0.6, currentZoom - step);

    DiagnosticData.zoomFactors[panelId] = nextZoom;

    // Apply the CSS Transform layout property directly to the active frame scale node
    const scaleNode = document.getElementById('diag-content-scaler');
    if (scaleNode) {
      scaleNode.style.setProperty('--zoom-factor', nextZoom);
    }
  },

  // ── INJECTED CLIPBOARD EXTRACTION UTILITY ──────────────────────────────────
  copyToClipboard() {
    const panel = DiagnosticData.activePanel;
    if (!panel) return;

    let textToCopy = "";

    // Serialize text fields neatly based on which panel context is open
    if (panel === 'S') {
      textToCopy = `=== ANCIENT MAZE SYSTEM STATE SNAPSHOTS ===\nPREVIOUS SNAPSHOT:\n${DiagnosticData.snapshots.previous || 'NULL'}\n\nCURRENT SNAPSHOT:\n${DiagnosticData.snapshots.current}`;
    } 
    else if (panel === 'P') {
      textToCopy = `=== ANCIENT MAZE PLAYER REGISTRY LOG ===\n${DiagnosticData.playerHistory.join('\n') || '; NO RECORDED ENTRIES'}`;
    } 
    else if (panel === 'B') {
      textToCopy = `=== ANCIENT MAZE BALL TRACE LOG ===\n${DiagnosticData.ballHistory.join('\n') || '; NO RECORDED ENTRIES'}`;
    } 
    else if (panel === 'M') {
      textToCopy = `=== ANCIENT MAZE ARCHITECTURE MAP ===\n; TOPOLOGY SCHEMA SUSPENDED`;
    }

    // Write text string to system clipboard
    navigator.clipboard.writeText(textToCopy).then(() => {
      const copyBtn = document.getElementById('diag-copy-btn');
      if (copyBtn) {
        // Quick interactive button flash feedback routine
        copyBtn.innerHTML = "<b>[Copied!]</b>";
        copyBtn.style.color = "#00ff66";
        copyBtn.style.borderColor = "#00ff66";

        setTimeout(() => {
          copyBtn.innerHTML = "<b>[Copy All]</b>";
          copyBtn.style.color = "";
          copyBtn.style.borderColor = "";
        }, 1200);
      }
    }).catch(err => {
      console.error("Clipboard export operation failed: ", err);
    });
  },

  // --- UI Synchronizer Rendering Pipeline ---
  renderActivePanelContent() {
    const titleEl = document.getElementById('diag-panel-title');
    const scrollerEl = document.getElementById('diag-content-scaler');
    if (!titleEl || !scrollerEl) return;

    const panel = DiagnosticData.activePanel;
    if (!panel) return;

    // Apply the corresponding cached zoom factor multiplier smoothly
    scrollerEl.style.setProperty('--zoom-factor', DiagnosticData.zoomFactors[panel]);

    // Map content frames dynamically based on the current panel index target
    if (panel === 'S') {
      titleEl.innerText = "SNAPSHOT SYSTEM STATE [S]";
      scrollerEl.innerHTML = `
        <div class="json-header">PREV:</div>
        <div class="json-blob">${DiagnosticData.snapshots.previous || 'NULL'}</div>
        <div class="json-header" style="margin-top:12px;">CURR:</div>
        <div class="json-blob" style="color:#00ff66;">${DiagnosticData.snapshots.current}</div>
      `;
    } 
    else if (panel === 'P') {
      titleEl.innerText = "PLAYER MOVEMENT REGISTRY [P]";
      scrollerEl.innerHTML = `
        <div class="diag-legend">ASM LISTING: [OP] [ACTION] [HALL] [LOCAL_Z] [WORLD_X]</div>
        <div class="assembly-feed">${DiagnosticData.playerHistory.join('\n') || '; NO ENTRIES RECORDED'}</div>
      `;
    } 
    else if (panel === 'B') {
      titleEl.innerText = "BALL TRACE METRICS [B]";
      scrollerEl.innerHTML = `
        <div class="diag-legend">ASM LISTING: [OP] [ACTION] [HALL] [LOCAL_Z] [WORLD_X]</div>
        <div class="assembly-feed" style="color:#ffaa44;">${DiagnosticData.ballHistory.join('\n') || '; NO ENTRIES RECORDED'}</div>
      `;
    } 
    else if (panel === 'M') {
      titleEl.innerText = "MAZE ARCHITECTURE GRAPH [M]";
      scrollerEl.innerHTML = `
        <div class="diag-legend">MAZE TOPOLOGY VECTOR SCHEMA MAP</div>
        <div class="assembly-feed" style="color:#888888; text-align:center; padding-top:40px;">; ARCHITECTURE SCHEMA SUSPENDED</div>
      `;
    }
  },

  updateButtonHighlights() {
    const keys = ['S', 'P', 'B', 'M'];
    keys.forEach(k => {
      const btn = document.getElementById(`toggle-diag-${k.toLowerCase()}-btn`);
      if (!btn) return;
      
      if (DiagnosticData.activePanel === k) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
};
