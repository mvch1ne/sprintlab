# Development Log

## Next Steps

- Windows and maybe some antivirus software seems to be treating the software like malware - affecting the installation for some people. How do we build the .exe so that everything checks out, installs and runs smoothly?

### UI Revamp

- Phase 0: Foundation — ✅ Done. Extracted 7 hooks from Viewport (1575→889 lines), split Telemetry into 5 sub-components (1309→244 lines), split ControlPanel into 6 sub-components (613→257 lines). UIContext deferred to Phase 1.
- Phase 1: Stage-Based Workflow — ✅ Done. Added UIContext (stage, completion, hasVideo), StageBar with 5 workflow stages (Import/Calibrate/Analyse/Measure/Report), completion indicators, auto-advance on video load, stage-aware control dimming in ControlPanel.

- Phase 2: Multi-Lane Timeline — Replace scrubber with zoomable timeline showing frame ruler, ground contacts, events, and speed sparkline lanes
- Phase 3: Visual Polish — Two-font typography system (sans for UI, mono for data), depth/glassmorphism on panels, stage accent colors, micro-interactions, interactive sparklines
- Phase 4: Command Palette — Ctrl+K searchable action palette with keyboard shortcuts for all major actions (cmdk library)
- Phase 5: Annotation Layer — Frame-pinned drawing tools (pen, arrow, circle, text) with PNG export for coach-athlete feedback
- Phase 6: Split-View Comparison — Side-by-side or overlay dual-video mode with synced playback and telemetry diff for athlete comparison
- Phase 7: Detachable Panels — Electron-only pop-out windows for telemetry/timeline on secondary monitors

- Review limitations.md and get work on fixing what's fixable

## Future Work

- How do we account for multiple figures being detected?
- Play around with det_frequency = 1 in serverlessTest, then try it in a separate branch of the actual codebase and let's see how that affects performance and accuracy.
- Take the codebase for your portfolio website, and turn it into something that reads the information from a database (like something from Firebase) so that we can modify information without having to re-deploy. Then add sprintlab to it. Or better yet, allow me to log in and update things with a rich-text editor. Or use VitePress with GitHub Actions? Ask around for better solutions. We have the capability to build things from scratch now and build impressive stuff. Build from scratch with Three.JS?
