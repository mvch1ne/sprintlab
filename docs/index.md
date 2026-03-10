---
layout: home

hero:
  name: SprintLab
  text: Sprint Kinematic Analysis from Video
  tagline: Research-level biomechanics. No lab required. Free and open-source.
  actions:
    - theme: brand
      text: Get Started
      link: /architecture
    - theme: alt
      text: Math Reference
      link: /math
    - theme: alt
      text: GitHub
      link: https://github.com/mvch1ne/zero

features:
  - title: 133-Keypoint Pose Estimation
    details: Powered by RTMLib's Wholebody3d model (MMPose). Tracks the full body — joints, feet, hands, face — at research-grade accuracy via ONNX Runtime.
  - title: Complete Biomechanics Metrics
    details: Ground contact times, flight times, step length, step frequency, joint angles, angular velocities, angular accelerations, and center-of-mass trajectory — all in real units.
  - title: Calibration-Based Scaling
    details: Draw a reference line over any known distance in the frame. Every pixel measurement is converted to metres automatically.
  - title: Pure Math Layer
    details: All biomechanics computation lives in framework-free TypeScript functions. Aspect-ratio corrected, physically meaningful, and fully unit-tested.
---

## What is SprintLab?

SprintLab is a web application for kinematic analysis of sprint videos. Upload a video, run pose estimation, calibrate a reference distance, and get a full breakdown of your sprint mechanics — joint angles, contact times, center-of-mass speed, and more.

It was built by an athlete and engineer from Ghana, West Africa, where biomechanics labs and sports science infrastructure are essentially nonexistent. The goal is to give any athlete, anywhere, access to the kind of analysis that was previously only available in well-funded research settings.

## How to read these docs

- **[Architecture](/architecture)** — start here for the big picture: how the frontend, backend, and data pipeline fit together.
- **[Math Reference](/math)** — all the equations that power the metrics engine, written out fully with derivations and design rationale.
- **Frontend** — deep dives into each major component: Viewport, Pose Engine, Calibration, Metrics Engine, and Telemetry.
- **Backend** — the FastAPI server, the SSE streaming protocol, and the keypoint wire format.
- **[Testing](/testing)** — test strategy, what is covered, and how to run the suites.
