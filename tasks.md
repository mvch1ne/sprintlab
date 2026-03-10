# Development Log

TODO

## Next Steps

- Redesign the body character's appearance to look cooler.
- Review all files for (typescript and other) errors

===

- When done, create desktop version (Electron.js?) so that I don't have to upload anything. Find a way to run the application on the desktop and run the Python server on the laptop as well. Will have to figure out how to manage both seamlessly (web sockets)?

## Backend

- Deploy to Fly.io because free tier is more generous and doesn't hibernate? Regardless can write code to warm up the server

## Documentation

- Add a help section where we'll write some guides to help users. Will record a demo video and post on YouTube and link here. Will provide a download sample so users can test the platform without having their own sprint video. Can use modals to guide the user on what to do. Allow the user to turn off the modal for subsequent visits and store that in local storage but have the option to turn it back on so that it shows up every time they open the application.
- Use Claude Code to scan all the files and write documentation for every aspect of the codebase (especially the math parts. Let's make the equations be done in LaTEX). Let it explain the design decisions and everything. Then host the docs somewhere online and link to it in the README.md. Claude can probably help me set that up.
