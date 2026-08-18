# Whisper On-Device Model

Place the quantized Whisper model file here:

```
assets/models/ggml-tiny.en.bin
```

## Download

Download the ~75 MB tiny.en model from the official Whisper.cpp repository:

```bash
curl -L -o assets/models/ggml-tiny.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin
```

Or visit: https://huggingface.co/ggerganov/whisper.cpp

## CoreML (iOS, optional)

For faster inference on Apple Silicon, also download the CoreML model:

```bash
curl -L -o assets/models/ggml-tiny.en-encoder.mlmodelc.zip \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-encoder.mlmodelc.zip
unzip assets/models/ggml-tiny.en-encoder.mlmodelc.zip -d assets/models/
```

## Notes

- The `.bin` file is excluded from git (see `.gitignore`).
- The model is loaded once at runtime and cached for the app session.
- Audio input is expected as a local file URI (WAV or M4A supported on iOS via native decoders).
