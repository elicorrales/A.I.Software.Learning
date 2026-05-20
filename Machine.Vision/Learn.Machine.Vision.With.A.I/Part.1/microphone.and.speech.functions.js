//microphone.and.speech.functions.js


// Added: Pure raw volume without history or calibration
function getUncalibratedVolume() {

    analyser.getByteTimeDomainData(dataArray);

    let sumSquares = 0;

    for (let i = 0; i < dataArray.length; i++) {

        const sample =
            (dataArray[i] - 128) / 128;

        sumSquares += sample * sample;
    }

    const rms = Math.sqrt(
        sumSquares / dataArray.length
    );

    return Math.min(
        100,
        Math.round(rms * 300)
    );
}

function getVolume() {

    analyser.getByteTimeDomainData(dataArray);

    let sumSquares = 0;

    for (let i = 0; i < dataArray.length; i++) {

        const sample =
            (dataArray[i] - 128) / 128;

        sumSquares += sample * sample;
    }

    const rms = Math.sqrt(
        sumSquares / dataArray.length
    );

    return Math.min(
        100,
        Math.round(rms * 300)
    );
}

async function calibrateQuietLevel() {
    // --- ADD THIS PORTION ---
    // Wait 500ms to let the sound of the mouse click fade away
    await new Promise(resolve => setTimeout(resolve, 400));
    // ------------------------

    const samples = [];

    const start = performance.now();

    while (performance.now() - start < 3000) {

        // Use the raw uncalibrated volume for the baseline test
        samples.push(getUncalibratedVolume());

        await new Promise(resolve =>
            setTimeout(resolve, 50)
        );
    }

    const total =
        samples.reduce((a, b) => a + b, 0);


    //this one does PEAK
    quietBaseline = Math.max(...samples);

    calibrated = true;
}

async function startMic() {
    // 1. Get the stream (throws error if denied)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // 2. Setup Audio Context and Nodes
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    // 3. Return the "State"
    return {
        stream,
        analyser,
        sampleRate: audioContext.sampleRate,
        dataArray: new Uint8Array(analyser.frequencyBinCount),
        waveArray: new Uint8Array(analyser.fftSize)
    };
}

function processSpeechBuffer({
    speechBuffer,
    sampleRate,
    quietBaseline,
    speechStartTime,
    speechTimeoutMs
}) {

    if (speechBuffer.length === 0) return false;

    // 1. Flatten buffer
    let samples = [];
    for (let chunk of speechBuffer) {
        for (let i = 0; i < chunk.length; i++) {
            samples.push((chunk[i] - 128) / 128);
        }
    }

    // --- RMS CALCULATION (ADDED) ---
    let sumSquares = 0;
    for (let s of samples) { sumSquares += s * s; }
    const phraseRMS = Math.sqrt(sumSquares / samples.length);
    // -------------------------------

    // 2. Trim trailing silence (the silence that occurs during the timeout period)
    const samplesToTrim = Math.floor((speechTimeoutMs / 1000) * sampleRate);
    samples = samples.slice(0, Math.max(0, samples.length - samplesToTrim));
    if (samples.length === 0) return false;

    const quietThreshold = quietBaseline / 300;

    // CHANGE: Make interval size relative to the actual speech length
    // This ensures all 12 intervals are filled regardless of how fast you talk.
    const intervalSize = Math.floor(samples.length / 12);

    // Calculate total time based on performance markers
    const totalLength = ((performance.now() - speechStartTime - speechTimeoutMs) / 1000).toFixed(3);

    // 3. Global Feature: Quiet Moments
    let quietMoments = 0;
    let isQuiet = false;
    for (let s of samples) {
        if (Math.abs(s) <= quietThreshold) {
            if (!isQuiet) {
                quietMoments++;
                isQuiet = true;
            }
        } else {
            isQuiet = false;
        }
    }

    // 4. Interval Features (12 intervals)
    const intervalResults = [];
    for (let i = 0; i < 12; i++) {
        const start = i * intervalSize;
        // For the last interval, we take everything left to avoid rounding gaps
        const end = (i === 11) ? samples.length : start + intervalSize;
        const window = samples.slice(start, end);

        let maxPeakValue = 0;
        let count50 = 0;
        let count40 = 0;
        let count30 = 0;
        let count20 = 0;
        let count10 = 0;
        let count8  = 0;
        let count5  = 0;
        let count3  = 0;
        let countAboveQuiet = 0;
        let zeroCrossings = 0;

        if (window.length > 0) {
            let maxAbs = 0;
            for (let j = 0; j < window.length; j++) {
                const s = window[j];
                const absS = Math.abs(s);

                if (absS > maxAbs) {
                    maxAbs = absS;
                    maxPeakValue = s;
                }
                if (absS > 0.5) count50++;
                if (absS > 0.4) count40++;
                if (absS > 0.3) count30++;
                if (absS > 0.2) count20++;
                if (absS > 0.1) count10++;
                if (absS > 0.08) count8++;
                if (absS > 0.05) count5++;
                if (absS > 0.03) count3++;
                if (absS > quietThreshold) countAboveQuiet++;
                if (j > 0 && ((window[j - 1] >= 0 && s < 0) || (window[j - 1] < 0 && s >= 0))) {
                    zeroCrossings++;
                }
            }
        }

        intervalResults.push({
            maxPeak: maxPeakValue,
            count50,
            count40,
            count30,
            count20,
            count10,
            count8,
            count5,
            count3,
            countAboveQuiet,
            zeroCrossings
        });
    }

    // 5. Construct the flat array for the neural network
    const latestInputFeatures = [
        parseFloat(totalLength),
        phraseRMS * 10, // MODIFIED: Replaced quietMoments/10 with scaled phraseRMS
        ...intervalResults.flatMap(r => {
            const d = 1000;

            const windowLen = intervalSize || 1;

            // NEW: Calculate density (0.0 to 1.0)
            const zcDensity = r.zeroCrossings / windowLen;

            // NEW: S-Score (High frequency relative to peak)
            const sScore = zcDensity > 0.15 ? zcDensity * 5 : 0;

            return [
                r.maxPeak,
                r.count50 / d,
                r.count40 / d,
                r.count30 / d,
                r.count20 / d,
                r.count10 / d,
                sScore,
                r.count5 / d,
                r.count3 / d,
                r.countAboveQuiet / d,
                r.zeroCrossings / 100
            ];
        })
    ];

    return {
        features: latestInputFeatures,
        quietMoments,
        intervalResults,
        totalLength
    };
}

