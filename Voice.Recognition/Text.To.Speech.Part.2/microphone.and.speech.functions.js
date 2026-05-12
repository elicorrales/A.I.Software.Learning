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


