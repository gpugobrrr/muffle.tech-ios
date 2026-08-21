# Whisper On-Device Models

Place quantized GGML model files here:

```
assets/models/ggml-tiny.en.bin
assets/models/ggml-silero-v6.2.0.bin
```

`.bin` files are gitignored. Metro already bundles `bin` via `metro.config.js`.

## Whisper speech model

Download the ~75 MB tiny.en model from the official Whisper.cpp repository:

```bash
curl -L -o assets/models/ggml-tiny.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin
```

Or visit: https://huggingface.co/ggerganov/whisper.cpp

## Silero VAD model (required for live PTT)

whisper.rn 0.7.2 realtime transcription uses Silero VAD via `initWhisperVad` + `RingBufferVad`.

Compatible file (do not substitute a different VAD binary):

```
ggml-silero-v6.2.0.bin
```

Download (~885 KB):

```bash
curl -L -o assets/models/ggml-silero-v6.2.0.bin \
  https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin
```

Hugging Face page: https://huggingface.co/ggml-org/whisper-vad

If this file is missing, live PTT fails with a VAD initialization error. It will **not** fall back to canned simulation text.

## CoreML (iOS, optional)

For faster inference on Apple Silicon, also download the CoreML model:

```bash
curl -L -o assets/models/ggml-tiny.en-encoder.mlmodelc.zip \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-encoder.mlmodelc.zip
unzip assets/models/ggml-tiny.en-encoder.mlmodelc.zip -d assets/models/
```

## Notes

- Models are loaded once at runtime and cached for the app session.
- Live PTT streams 16 kHz mono signed 16-bit PCM into whisper.rn `RealtimeTranscriber`.
- File transcription (if used) still accepts a local `file://` URI (WAV or M4A on iOS).
