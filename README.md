# LoveLink

LoveLink is a web application that allows couples to send each other messages and drawings, either instantly or with a delay. The app includes a profile page, a settings page, pages for sending and receiving messages with drawings (referred to as "nudges"), and a love language quiz. This quiz helps users to learn more about their partner's preferences and improve their emotional connection.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [File Structure](#file-structure)

## Features

- Send messages and drawings instantly or with a delay
- View sent and received messages with drawings
- Adjust application settings, such as viewing your pin or connecting with a partner
- Responsive design for various screen sizes
- Love language quiz to identify users' preferences and improve emotional connections

## Installation

1. Ensure you have Node.js installed on your machine.
2. Clone this repository:

```bash
git clone https://github.com/user/repo
cd repo
```

3. Install the necessary dependencies:

```bash
npm install
```

4. Start the application:

```bash
npm start
```

5. Visit `http://localhost:3000` in your browser to access the application.

## Usage

1. Register or log in to the application.
2. You will be redirected to your profile page, where you can view your sent and received messages.
3. Use the navigation buttons to access the following features:

   - Send a message (nudge) with a drawing instantly
   - Send a message (nudge) with a drawing with a delay
   - View your unique pin for connecting with your partner
   - Connect with your partner using their pin
   - Take the love language quiz to learn about your preferences and improve your emotional connection

4. In the Settings page, you can choose to view your pin or connect with your partner.

## File Structure

- `app.js`: The main application file that sets up the server and routes.
- `public/`: Directory containing static assets for the application (stylesheets, scripts, etc.).
- `views/`: Directory containing EJS templates for rendering the different pages of the application.

   - `register.ejs`: Registration page template.
   - `login.ejs`: Login page template.
   - `profile.ejs`: Profile page template, showing sent and received messages.
   - `sendNudge.ejs`: Page for composing and sending a message (nudge) with a drawing instantly.
   - `sendNudgeDelayed.ejs`: Page for composing and sending a message (nudge) with a drawing with a delay.
   - `settings.ejs`: Settings page template, where users can view their pin or connect with their partner.
   - `quiz.ejs`: Love language quiz page template, allowing users to answer questions and learn about their preferences.

Please refer to the comments within each file for more detailed information about the code structure and functionality.

**Note**: Make sure to properly set up the database and environment variables before running the application.