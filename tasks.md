# Development Log

TODO

- Figure out the ground contact logic with the serverless version. Work with uncle to figure that one out before 9pm.
- Going to work on telemetry
- Telemetry needs to depend more strongly on calibration. Need to make the calibration module more robust since everything depends on it for accuracy. Need to be clear about horizontal vs vertical distance calibration. Also, all the measurements and telemetry information needs to recompute if calibration is redone.
- Add another view mode that builds a 'body' onto the skeleton to look like Ralph Mann's figures.
- 3D mode is a must. Alternatives to Three.js? Just to make sure there isn't a better tool before I go forward with it.
- Add the feature to place markers (with optional labels) and then retroactively measure the distance between them
- So many face options in poseconfig panel. Hide most?
- When using the export option, let the draw box disappear after I close the panel.
- When done, create desktop version (Electron.js?) so that I don't have to upload anything. Find a way to run the application on the desktop and run the Python server on the laptop as well. Will have to figure out how to manage both seamlessly (web sockets)?

## Backend

- Working decently and integrated into the frontend directory.

-
- Get the requirements necessary for the application. So that from the server, I can just install the requirements. Luckily its just RTMPose and FastAPI with their respective dependencies.
- Deploy to Fly.io because free tier is more generous and doesn't hibernate? Regardless can write code to warm up the server
-

## Documentation

- Need to find a way to get the Test Driven Development stuff done.
- Add a help section where we'll write some guides to help users. Will record a demo video and post on YouTube and link here. Will provide a download sample so users can test the platform without having their own sprint video. Can use modals to guide the user on what to do. Allow the user to turn off the modal for subsequent visits and store that in local storage but have the option to turn it back on so that it shows up every time they open the application.
- Use CoPilot to scan all the files and write documentation for every aspect of the codebase (especially the math parts. Let's make the equations be done in LaTEX). Then host the docs somewhere and link to it in the README.md
- Speaking of README.md. Let CoPilot scan the entire codebase and write a really good one (for the entire project and also for the frontend and backend)
- Go to Community Standards (https://github.com/mvch1ne/sprintlab/community) and create these things so that the project is up to standard. Ask Chat/Claude for the things I can do that will make my project stand out.
- Work on my GitHub profile's README.md to make it better.
