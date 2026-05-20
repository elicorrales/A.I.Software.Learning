        let activeStream = null;
        let backgroundPixels = null;
        const compareCanvas = document.createElement('canvas');
        const compareCtx = compareCanvas.getContext('2d');
        let liveCompareRunning = false;

        function handleLabelClick(labelName) {
            console.log(`Training Event Logged: Classification labeled as [${labelName}]`);
        }

        function takeSnapshot(which) {
          const canvas = document.getElementById('snapBackground');
          const video = document.getElementById('cam');
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          backgroundPixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }

        function clearBackground() {
            const canvas = document.getElementById('snapBackground');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (canvas.width > 0 && canvas.height > 0) {
                backgroundPixels = ctx.createImageData(canvas.width, canvas.height);
            }
        }

        function renderColorDiff(diffCtx, currentPixels, backgroundPixels, width, height, threshold = 40) {
            const out = diffCtx.createImageData(width, height);

            const a = currentPixels.data;
            const b = backgroundPixels.data;
            const d = out.data;

            for (let i = 0; i < a.length; i += 4) {
                const rDiff = Math.abs(a[i] - b[i]);
                const gDiff = Math.abs(a[i + 1] - b[i + 1]);
                const bDiff = Math.abs(a[i + 2] - b[i + 2]);

                const diff = (rDiff + gDiff + bDiff) > threshold;

                if (diff) {
                    d[i] = a[i];
                    d[i + 1] = a[i + 1];
                    d[i + 2] = a[i + 2];
                    d[i + 3] = 255;
                } else {
                    d[i] = 255;
                    d[i + 1] = 255;
                    d[i + 2] = 255;
                    d[i + 3] = 255;
                }
            }

            diffCtx.putImageData(out, 0, 0);
        }

        function startLiveCompare() {
          if (liveCompareRunning) return;
          liveCompareRunning = true;

          const video = document.getElementById('cam');
          const diff2Canvas = document.getElementById('bkg2VsSnapped');
          const diff2Ctx = diff2Canvas.getContext('2d');

          function loop() {
            if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
              if (compareCanvas.width !== video.videoWidth || compareCanvas.height !== video.videoHeight) {
                compareCanvas.width = video.videoWidth;
                compareCanvas.height = video.videoHeight;
              }

              compareCtx.drawImage(video, 0, 0, compareCanvas.width, compareCanvas.height);
              const currentPixels = compareCtx.getImageData(0, 0, compareCanvas.width, compareCanvas.height);

              if (backgroundPixels && backgroundPixels.data.length === currentPixels.data.length) {
                renderColorDiff(
                  diff2Ctx,
                  currentPixels,
                  backgroundPixels,
                  compareCanvas.width,
                  compareCanvas.height,
                  40
                );
              }
            }
            requestAnimationFrame(loop);
          }
          requestAnimationFrame(loop);
        }

        async function startDashboardCamera() {
          const video = document.getElementById('cam');
          if (!activeStream) {
            activeStream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
          video.srcObject = activeStream;
          video.onloadedmetadata = () => {
            video.play();
            requestAnimationFrame(() => {
              const w = video.videoWidth;
              const h = video.videoHeight;
              video.width = w;
              video.height = h;

              const snapBg = document.getElementById('snapBackground');
              snapBg.width = w;
              snapBg.height = h;
              
              document.getElementById('bkg2VsSnapped').width = w;
              document.getElementById('bkg2VsSnapped').height = h;

              compareCanvas.width = w;
              compareCanvas.height = h;

              const snapCtx = snapBg.getContext('2d');
              backgroundPixels = snapCtx.createImageData(w, h);
            });
          };
        }

        async function checkCameras() {
            const statusLabel = document.getElementById('status-label');
            const mainBtn = document.getElementById('main-btn');

            mainBtn.disabled = true;
            statusLabel.innerHTML = "Requesting camera access...";

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                statusLabel.innerHTML = "<span class='error-text'>Error:</span> Media access not supported.";
                mainBtn.disabled = false;
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                activeStream = stream;

                statusLabel.innerHTML = "<span class='success-text'>Access Granted:</span> Camera hardware is active and recognized.";

                mainBtn.innerText = "Go To Dashboard";
                mainBtn.onclick = goToDashboard;

            } catch (err) {
                statusLabel.innerHTML = `<span class='error-text'>Error:</span> ${err.message}`;
            } finally {
                mainBtn.disabled = false;
            }
        }

        function goToDashboard() {
          document.getElementById('diagnostic-view').style.display = 'none';
          document.getElementById('dashboard-view').style.display = 'block';
          startDashboardCamera();
          startLiveCompare();
          requestAnimationFrame(() => {
            requestAnimationFrame(resizeCanvases);
          });
        }

        function resizeCanvases() {
          const canvas2 = document.getElementById('snapBackground');
          const canvas4 = document.getElementById('bkg2VsSnapped');

          canvas2.style.background = "#2b2f3a";
          canvas4.style.background = "#2b2f3a";
        }

        window.addEventListener('DOMContentLoaded', async () => {
            const statusLabel = document.getElementById('status-label');
            const mainBtn = document.getElementById('main-btn');

            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(d => d.kind === 'videoinput');

                if (videoDevices.length === 0) {
                    statusLabel.innerHTML = "No camera hardware detected.";
                } else if (videoDevices.every(d => d.label === "")) {
                    statusLabel.innerHTML = `System ready. ${videoDevices.length} camera(s) detected. Click above to enable access.`;
                    mainBtn.innerText = "Unlock Cameras";
                } else {
                    statusLabel.innerHTML = `${videoDevices.length} camera(s) authorized and ready for use.`;
                }
            } catch (err) {
                statusLabel.innerHTML = "System standby.";
            }

            requestAnimationFrame(() => {
              requestAnimationFrame(resizeCanvases);
            });

            window.addEventListener('resize', resizeCanvases);
        });
