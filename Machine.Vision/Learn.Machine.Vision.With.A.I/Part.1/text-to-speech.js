//text-to-speech.js

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

function speak(text, rate = 0.85, pitch = 1.0, volume = 1.0) {

    const utterance = new SpeechSynthesisUtterance(text);

    if (voice) {
        utterance.voice = voice;
    }

    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    synth.speak(utterance);
}
