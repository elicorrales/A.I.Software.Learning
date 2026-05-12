const synth = window.speechSynthesis;

let voice = null;

function loadVoice() {
    const voices = synth.getVoices();

    voice = voices.find(
        v => v.name === "en1 espeak-ng-mbrola-generic"
    );
}

// IMPORTANT: voices load async in most browsers
synth.onvoiceschanged = loadVoice;

// also try immediately (some browsers already have them)
loadVoice();

function speak(text) {
    const utterance = new SpeechSynthesisUtterance(text+".");

    if (voice) {
        utterance.voice = voice;
        utterance.rate = 0.85;   // slower than default (1.0)
        utterance.pitch = 1.0;   // optional
        utterance.volume = 1.0;  // optional
    }

    //synth.cancel();
    synth.speak(utterance);
}
