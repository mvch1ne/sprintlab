# Development Log

TODO

- You haven't fixed the zoom and crop thing so just simplify and reset the zoom when trim and crop button is pressed
- Zooming in before doing the the trimming and cropping messes everything up. Patch?
- Seems like horizontal measurements don't scale to vertical. Check. Will probably need to scale based on the video width and height? A shorter distance vertically will equal a longer distance horizontally?
- Separate measurement of angles from distances but put them in the same panel just different sections. Otherwise give them the same behaviors
- Will need to refactor the folders to create separation of concerns
- Add a help section where we'll write some guides to help users. Will record a demo video and post on YouTube and link here. Will provide a download sample so users can test the platform without having their own sprint video. Can use modals to guide the user on what to do. Allow the user to turn off the modal for subsequent visits and store that in local storage but have the option to turn it back on so that it shows up every time they open the application.
- Switch from MediaPipe to something else like OpenPose or MoveNet for accuracy. Will need a backend server in Python? Possible to host on Firebase? If using a separate backend server, will probably have to account for free tiers hibernating or shutting down after inactivity so will have to warm it up?
- Work on the telemetry section

## Documentation

- Need to find a way to get the Test Driven Development stuff done.
- Use CoPilot to scan all the files and write documentation for every aspect of the codebase (especially the math parts. Let's make the equations be done in LaTEX). Then host the docs somewhere and link to it in the README.md
- Speaking of README.md. Let CoPilot scan the entire codebase and write a really good one.
- We can also create a contributing.md. As Chat/Claude for the things I can do that will make my project stand out.

# Interview and essay highlights

- Solving real problems for Africa. Going beyond SaaS and Fintech
- Trying to reinvent the wheel with framerate and cropping. Wasted time and eventually fell on a robust solution in FFMpeg.
- Learning to architect systems.
