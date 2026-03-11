# Development Log

## Next Steps

- Right now, the system is expecting the athlete to be running left to right, I think. I say this because I presume it has the origin (x=0, y=0) of the image frame at the top-left or top-right corner (actually, tell me which one and let's have a diagram in the math docs for it). So how do we support righr to left sprints natively? in the case where the athlete is going from right to left, it's tricky. right? I know we have some flip stuff that can in when we added flipping in the trim and crop panel but I don't trust that solution. How about we don't try to use that but instead deduce rtl (right to left) based on if the start marker is on the right of the finish marker? If there's no finish marker (as might be the case in the start mode), we can deduce rtl if the CoM is on the right of the start marker, right? For assurance, if we detect rtl, we can ask the athlete to confirm. Even if we don't detect rtl, there should be a switch somewhere in the control panel for the athlete to choose (of course we'll sync this with the automatic detection). Then all the calculations can account for the fact that the CoM will be moving from a higher x position to a lower one on each frame (assuming the origin is on one of the left corners not the right). So if we do this, we can compute positive displacement correctly. Oh and don't forget to turn the coordinate display we put in the viewport to show positive x in the appropriate direction depending on if we're going rtl or ltr. Of course,update the docs everywhere this touches and create a section explaining this logic.

- MAKE SURE THAT AS LONG AS SOMETHING CHANGES IN THE DOCS FOLDER, WE ALWAYS REDEPLOY.

- Add a help button on the header that opens a modal where we'll write some guides to help users. Will record a demo video and post on YouTube and link here. Will provide a download sample so users can test the platform without having their own sprint video. Can use modals to guide the user on what to do. Allow the user to turn off the modal for subsequent visits and store that in local storage but have the option to turn it back on so that it shows up every time they open the application.

- Embed a link to the demo video in the GitHub README.md and on the docs page.

- Create a separate branch for hosting and host the frontend and backend. Make sure all the settings and modifications are made so they can talk to each other. Can some automated hosting be done so that anytime that branch changes, both the frontend and backend redeploy? That would be cool. I'm thinking Firebase for the frontend and Fly or Render for the backend but open to suggestions. I want to use free tiers and have the frontend and backend running as seamlessly as possible without any interruptions.

- Play around with det_frequency = 1 in serverlessTest, then try it in a separate branch of the actual codebase and let's see how that affects performance and accuracy.

- Add link for frontend to Github repository.

- Take the codebase for your portfolio website, and turn it into something that reads the information from a database (like something from Firebase) so that we can modify information without having to re-deploy. Then add sprintlab to it. Or better yet, allow me to log in and update things with a rich-text editor. Or use VitePress with GitHub Actions?

## Future Work

- When done, consider create desktop version (Electron.js?) so that I don't have to upload anything. Find a way to run the application on the desktop and run the Python server on the laptop as well. Will have to figure out how to manage both seamlessly (web sockets)?
