# Sine

Sine is a free, open source speech-to-text app that runs entirely on your computer. Hold a shortcut, talk, and your words show up wherever your cursor is. Nothing gets sent to the cloud.

Sine is a fork of [Handy](https://github.com/cjpais/Handy) by CJ Pais. Handy does the heavy lifting here (the recording, the local models, the pasting), and I've been reworking how it looks and feels.

## Built on Handy

The core of Sine comes from Handy and its contributors. If you find Sine useful, go star [Handy on GitHub](https://github.com/cjpais/Handy) and consider [supporting the project](https://handy.computer/donate).

- **Handy:** [github.com/cjpais/Handy](https://github.com/cjpais/Handy) and [handy.computer](https://handy.computer)
- **License:** MIT, copyright (c) 2025 CJ Pais. The original notice is kept in [LICENSE](LICENSE).

Sine isn't affiliated with or endorsed by Handy or CJ Pais. Handy's name, logo, icon and brand assets aren't covered by its open source license, so Sine uses its own.

## Why "Sine"?

The default recording animation is a set of drifting sine waves, so the name fit. And if you say it in Latin, _sine_ means "without," as in without typing.

## What's different from Handy

- **Recording animations:** Instead of the recording pill, Sine shows an animated shape while you hold the shortcut. Aurora (the default) is three drifting ribbons of light, Halo is a spinning ring of color, and Opal is a translucent pearl. They react to your voice, and when you let go they stop moving and pulse until the text is pasted. Pick one in **Settings → Advanced → Recording Animation**.
- **A new look:** a warm neutral theme with a monochrome accent, and a new icon of a podcast mic inside a wavy halo.
- **No update checks:** Sine never checks for updates, since there are no Sine releases to update to.
- **Its own identity:** the app ID is `com.jbnunn.sine`, so Sine installs alongside Handy and keeps its own settings and models.

Everything else (models, shortcuts, post-processing, history and the CLI flags) works the same as Handy.

## How it works

1. **Press** your shortcut. Hold it to record and release to stop, or tap it to toggle recording on and off.
2. **Speak** while it's listening.
3. **Release**, and Sine transcribes your speech locally.
4. **Get** the text pasted into whatever app you're using.

Silence is filtered out with Silero VAD, and transcription runs on your choice of local models (Whisper, Parakeet and others) with GPU acceleration when it's available. Handy supports Windows, macOS and Linux. The code for all three is still here, but Sine has only been tested on macOS.

## Building

There are no prebuilt Sine releases, so you build it from source. You'll need [Rust](https://rustup.rs/) and [Bun](https://bun.sh/).

```bash
bun install

# The VAD model is required
mkdir -p src-tauri/resources/models
curl -L -o src-tauri/resources/models/silero-vad-v6.2-F32.gguf \
  https://huggingface.co/handy-computer/silero-vad-v6.2-gguf/resolve/main/silero-vad-v6.2-F32.gguf

# Run in development
bun run tauri dev
# If you get a cmake error on macOS:
CMAKE_POLICY_VERSION_MINIMUM=3.5 bun run tauri dev

# Build the app
bun run tauri build
```

See [BUILD.md](BUILD.md) for platform-specific setup.

The tray icons and app icon are generated from one shared shape in `src/components/icons/markGeometry.ts`. After changing it, run `bun scripts/generate-brand.ts` and then `bunx tauri icon src-tauri/icons/app-icon.png`.

## Docs and troubleshooting

Sine behaves like Handy, so [Handy's README](https://github.com/cjpais/Handy#readme) is the reference for debug mode, CLI flags, Linux setup, manual model installs and troubleshooting. A few things are different:

- **App data folder:** `~/Library/Application Support/com.jbnunn.sine/` on macOS, `%APPDATA%\com.jbnunn.sine\` on Windows, and `~/.local/share/com.jbnunn.sine/` on Linux.
- **Internal names:** environment variables keep their `HANDY_` prefix (for example `HANDY_DISABLE_UPDATER`), and so do a few internal names in the code. That keeps it easy to pull in fixes from Handy.
- **Reporting problems:** if something only happens in Sine, open an issue on [this repo](https://github.com/jbnunn/Handy/issues). If you can reproduce it in Handy too, report it to [Handy](https://github.com/cjpais/Handy/issues).

## License

MIT. See [LICENSE](LICENSE), which keeps Handy's original copyright notice.

## Acknowledgments

- **Handy** by CJ Pais and its contributors, which Sine is built on
- **Whisper** by OpenAI for the speech recognition model
- **ggml** for an amazing cross-platform tensor library
- **Silero** for great lightweight VAD
- **Tauri** for the Rust-based app framework
