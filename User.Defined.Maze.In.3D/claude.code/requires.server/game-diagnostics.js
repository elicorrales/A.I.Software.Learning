// GEMINI.3 game-diagnostics.js
import { GameInterface } from './interface.js';

const DiagnosticData = {
  snapshots: { current: null, previous: null },
  playerHistory: [],
  ballHistory: [],
  activePanel: null, 
  zoomFactors: { S: 1.0, P: 1.0, B: 1.0, M: 1.0 }
};

export const GameDiagnostics = {
  init() {
    this.captureSnapshot();
  },

  togglePanel(panelId) {
    const windowEl = document.getElementById('diagnostic-window');
    if (!windowEl) return;

    if (DiagnosticData.activePanel === panelId) {
      DiagnosticData.activePanel = null;
      windowEl.style.display = 'none';
      this.updateButtonHighlights();
      return;
    }

    DiagnosticData.activePanel = panelId;
    windowEl.style.display = 'flex';
    
    this.renderActivePanelContent();
    this.updateButtonHighlights();
  },

  captureSnapshot() {
    const liveStateSnapshot = GameInterface.getBirdsEyeContext();
    DiagnosticData.snapshots.previous = DiagnosticData.snapshots.current;
    DiagnosticData.snapshots.current = JSON.stringify(liveStateSnapshot);

    if (DiagnosticData.activePanel === 'S') {
      this.renderActivePanelContent();
    }
  },

  logPlayer(opcode, actionText, hallId, localZ) {
    const context = GameInterface.getSceneRenderContext();
    const player = context.player;
    const globalX = GameInterface.getLocalZToGlobalX(player.currentHall, localZ, 'player');
  
    let stateFlags = "";
    if (player.inTunnel) stateFlags += ` [TUNNEL:${player.currentTunnelId}]`;
    if (player.justExitedTunnel) stateFlags += ` [DECOUPLED]`;

    const logLine = `${opcode.padEnd(4)} ${actionText.padEnd(9)} ${hallId} Z:${localZ.toFixed(3).padEnd(7)} X:${globalX.toFixed(3)}${stateFlags}`;
    DiagnosticData.playerHistory.unshift(logLine);
  
    if (DiagnosticData.playerHistory.length > 500) DiagnosticData.playerHistory.pop();
    if (DiagnosticData.activePanel === 'P') this.renderActivePanelContent();
  },

  logBall(opcode, actionText, hallId, localZ) {
    const context = GameInterface.getSceneRenderContext();
    const globalX = GameInterface.getLocalZToGlobalX(context.ball.currentHall, localZ, 'ball');
    
    const logLine = `${opcode.padEnd(4)} ${actionText.padEnd(9)} ${hallId} Z:${localZ.toFixed(3).padEnd(7)} X:${globalX.toFixed(3)}`;
    DiagnosticData.ballHistory.unshift(logLine);
    
    if (DiagnosticData.ballHistory.length > 500) {
      DiagnosticData.ballHistory.pop();
    }

    if (DiagnosticData.activePanel === 'B') this.renderActivePanelContent();
  },

  adjustZoom(panelId, direction) {
    const step = 0.1;
    const currentZoom = DiagnosticData.zoomFactors[panelId];
    const nextZoom = direction === 'IN' 
      ? Math.min(2.5, currentZoom + step) 
      : Math.max(0.6, currentZoom - step);

    DiagnosticData.zoomFactors[panelId] = nextZoom;

    const scaleNode = document.getElementById('diag-content-scaler');
    if (scaleNode) {
      scaleNode.style.setProperty('--zoom-factor', nextZoom);
    }
  },

  copyToClipboard() {
    const panel = DiagnosticData.activePanel;
    if (!panel) return;

    let textToCopy = "";

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

    navigator.clipboard.writeText(textToCopy).then(() => {
      const copyBtn = document.getElementById('diag-copy-btn');
      if (copyBtn) {
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

  renderActivePanelContent() {
    const titleEl = document.getElementById('diag-panel-title');
    const scrollerEl = document.getElementById('diag-content-scaler');
    if (!titleEl || !scrollerEl) return;

    const panel = DiagnosticData.activePanel;
    if (!panel) return;

    scrollerEl.style.setProperty('--zoom-factor', DiagnosticData.zoomFactors[panel]);

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
