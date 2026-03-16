# Development Log

## Next Steps

- Update the main README.md of the project to have information on how to run the project in development and how to build it for production.
- When we go into fullscreen, if the user doesn't know the shortcut, they can't get back out. How do we fix that?
- Change the icon from the Electron logo to the SprintLab logo that we were using for the web version.
- There's a lot of stuff begin pushed to git (10k). Update the .gitignore to ship only what needs to be.
- Update the READMEs and docs to capture everything we have changed. README.md should contain information on how to build the project from source on the different operating systems.
- Upload the installer files, like the .exe for Windows and the rest for the other operating systems, to the Git repository and link them in the README and docs.

## Future Work

- Play around with det_frequency = 1 in serverlessTest, then try it in a separate branch of the actual codebase and let's see how that affects performance and accuracy.
- Take the codebase for your portfolio website, and turn it into something that reads the information from a database (like something from Firebase) so that we can modify information without having to re-deploy. Then add sprintlab to it. Or better yet, allow me to log in and update things with a rich-text editor. Or use VitePress with GitHub Actions? Ask around for better solutions.
