# Development Log

When the video hits its end, I want the next press of space to restart it. Right now it pauses it even though its already paused then I have to press again to start.

TODO

-
- Test with a 60fps video to see if it's actually reading the framerate
- Will need to refactor the folders to create separation of concerns
- Add a help section where we'll write some guides to help users. Will record a demo video and post on YouTube and link here. Will provide a download sample so users can test the platform without having their own sprint video. Can use modals to guide the user on what to do. Allow the user to turn off the modal for subsequent visits and store that in local storage but have the option to turn it back on so that it shows up every time they open the application.
- Switch from MediaPipe to something else like OpenPose or MoveNet for accuracy. Will need a backend server in Python? Possible to host on Firebase?
