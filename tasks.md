# Development Log

## Next Steps

Context: SprintLab is a biomechanics sprint analysis platform. The frontend is a Vite/React SPA being hosted on Firebase Hosting. The backend is a FastAPI/Python server (backend/server.py) that runs RTMLib pose estimation with ONNX Runtime, uses StreamingResponse, and requires ≥2GB RAM. It currently runs locally at localhost:8000. The frontend reads VITE_POSE_BACKEND_URL from env to find it (frontend/src/components/dashboard/viewport/PoseEngine/usePoseLandmarker.ts).

Previous recommendation: Host the backend on Google Cloud Run (same GCP project as Firebase), bake the ONNX model weights into the Docker image to avoid cold-start delays, and use Firebase Hosting rewrites to proxy /api/\*\* → Cloud Run so the frontend never needs a hardcoded backend URL.

Task: Review this plan, confirm it's still the right approach (vs. Fly.io or other options), then implement it: write the Dockerfile, configure the Cloud Run service, update firebase.json with the rewrite, and set base: '/' in vite.config.ts. Then proceed to deploy the frontend to Firebase Hosting.

---

- Add link for frontend to Github repository.

## Future Work

- For hosting, can some automated hosting be done so that anytime that branch changes, both the frontend and backend redeploy? Github Actions and some function in the hosting platform.
- Play around with det_frequency = 1 in serverlessTest, then try it in a separate branch of the actual codebase and let's see how that affects performance and accuracy.
- Take the codebase for your portfolio website, and turn it into something that reads the information from a database (like something from Firebase) so that we can modify information without having to re-deploy. Then add sprintlab to it. Or better yet, allow me to log in and update things with a rich-text editor. Or use VitePress with GitHub Actions?
- When done, consider create desktop version (Electron.js?) so that I don't have to upload anything. Find a way to run the application on the desktop and run the Python server on the laptop as well. Will have to figure out how to manage both seamlessly (web sockets)?
