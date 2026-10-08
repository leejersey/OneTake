# UI Regression Fixes Implementation Plan

> Inline execution; preserve the user's uncommitted UI work. No automatic Git commit.

**Goal:** Repair narrow-screen editing, sentence playback, native text-field shortcuts, waveform lifecycle errors, audio export guards, and consistent styled captions.

**Architecture:** Keep current React/FFmpeg/SQLite structure. Use a small caption grouping helper mirrored in Python with shared fixture tests. Styled captions use an ASS canvas of logical height 216, with preview scaled to the visible video area. All caption-enabled exports burn ASS; caption-disabled exports retain existing behavior. Requires libass and available fonts, no new npm/Python dependency.

- [x] Add failing Node/Python regressions for grouping, editing target detection, style validation, and styled MP4/MOV/AVI rendering.
- [x] Implement ASS grouping/style/time remap in app/services/subtitle_service.py and use it in app/api/export.py; burn ASS for all formats while retaining requested quality and AVI PCM.
- [x] Update frontend/src/pages/Editor.jsx shortcuts, sentence playback, caption helper and audio export guard. Update VideoPlayer/WaveformPlayer range playback and cancelled load handling.
- [x] Add mobile workspace CSS, split shared theme context/hook from component exports, correct Hook dependencies and trailing whitespace.
- [x] Run full pytest, npm test/lint/build, git diff --check and real browser desktop/mobile/audio/keyboard/caption export checks. Update README findings.

Known limits: browser/FFmpeg font rasterization can differ; missing server fonts fall back. Hard subtitles cannot be disabled after export. Original-media preview still does not skip deleted video sections. Existing SPA-back unsaved guard and single-worker job recovery limits remain.

## Verification
- Full pytest: 69 passed, 5 pre-existing deprecation warnings. Node: 21 passed. ESLint, Vite build and git diff --check pass.
- Browser checked 1440×900, 768×900, 390×844 and 320×640 layouts. Sentence audition starts and pauses at the bound in video/audio, input Ctrl+Z is native, button Space retains native activation, zero-duration blocks are disabled.
- Real styled MP4 export/download passed: Arial/color/position/size compared against preview with frame pixel extraction. MP4/MOV/AVI style tests check visible colors and placement, no separate subtitle stream. ASS uses greedy wrapping similar to CSS; rasterization/line breaks may differ across engines.
- Audio export disabled, rapid audio reload has no reported page errors. Save/reload, search, theme, shortcut dialog and speed checks pass. Test services stopped and owned browser tab closed.
- Logs/media: /tmp/agentpy-ui-fixes/ and /tmp/agentpy-ui-review/. Latest automated logs: /tmp/agentpy-ui-fix-final-python.log and /tmp/agentpy-ui-fix-final2-frontend.log.
- No full Docker build or long-transcript stress test. Server font availability remains an external requirement. Hard-subtitle behavior replaces the earlier soft-subtitle contract with user approval.

