const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const flash = require("connect-flash");
const bcrypt = require("bcryptjs");

const app = express();
const path = require("path");
const openai = require("openai");
const axios = require("axios");
const bodyParser = require('body-parser');
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + '/public'));

// Google Firebase initialization
const admin = require('firebase-admin');
const serviceAccount = require('./lovelink-cs160-firebase-adminsdk-4x5ds-08996f4c48.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://lovelink-cs160-default-rtdb.firebaseio.com"
});



// Set up openai key
openai.apiKey = "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";

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/loveLanguageQuiz", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define User schema and model

const NudgeSchema = new mongoose.Schema({
    message: String,
    timestamp: Date,
    drawing: String
  });

//TODO @liam update this
const UserSchema = new mongoose.Schema({
    name: String,
    username: String,
    password: String,
    pin: Number,
    partner: String,
    quizResults: [
      {
        name: String,
        showLove: String,
        preferredGift: String,
        favoriteActivity: String,
        communicationPreference: String,
        frequency: String,
        favoriteThing: String,
      },
    ],

    deviceToken: {
        type: String,
        default: null,
    },

    nudgeInbox: [NudgeSchema],
    nudgeOutbox: [NudgeSchema],
    delayedNudgeOutbox: [NudgeSchema]
  });

const User = mongoose.model("User", UserSchema);
const Nudge = mongoose.model("Nudge", NudgeSchema);

// Configure passport and session
app.use(
  session({
    secret: "1234",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 6000000 },
  })
);

app.use(passport.initialize());
app.use(passport.session());
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await User.findOne({ username: username });
      if (!user) {
        return done(null, false, { message: "Incorrect username." });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return done(null, false, { message: "Incorrect password." });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

app.use(flash());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware to pass user and flash messages to all views
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});

// Routes
app.get("/", (req, res) => {
  res.render("login");
});

// Authentication routes
app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
    try {
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
  
      // Generate a unique 6-digit pin
      let pin;
      let isUnique = false;
      while (!isUnique) {
        pin = Math.floor(100000 + Math.random() * 900000);
        const existingUser = await User.findOne({ pin: pin });
        if (!existingUser) {
          isUnique = true;
        }
      }
  
      const newUser = new User({ name: req.body.name, username: req.body.username, password: hashedPassword, pin: pin });
      await newUser.save();
      req.flash("success", `Registered successfully!`);
      res.redirect("/login");
    } catch {
      req.flash("error", "Registration failed. Please try again.");
      res.redirect("/register");
    }
  });
app.get("/login", async (req, res) => {
  if (req.query.loggedOut === "true") {
    req.flash("success", "Logged out successfully!");
  }
//   user.deviceToken = req.body.deviceToken;
//   await user.save();
  res.render("login");
});

app.post("/login", (req, res, next) => {
    passport.authenticate("local", async (err, user, info) => {
      if (err) {
        return next(err);
      }
  
      if (!user) {
        req.flash("error", info.message);
        return res.redirect("/login");
      }
  
      req.logIn(user, async (err) => {
        if (err) {
          return next(err);
        }
  
        // Save the device token to the user object
        user.deviceToken = req.body.deviceToken;
        await user.save();
  
        req.flash("success", "Logged in successfully!");
        console.log('logged in!');
        console.log(req.body.deviceToken);
        res.redirect("/profile");
      });
    })(req, res, next);
  });

app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      res.redirect("/");
    } else {
      res.clearCookie("connect.sid");
      res.redirect("/login?loggedOut=true");
    }
  });
});

// Quiz route
app.get("/quiz", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("quiz");
  } else {
    req.flash("error", "You must be logged in to access the quiz.");
    res.redirect("/login");
  }
});

//TODO @liam update this
app.post("/quiz", async (req, res) => {
  if (req.isAuthenticated()) {
    const quizResults = {
        name: req.body.name,
        showLove: req.body.showLove,
        preferredGift: req.body.preferredGift,
        favoriteActivity: req.body.favoriteActivity,
        communicationPreference: req.body.communicationPreference,
        frequency: req.body.frequency,
        favoriteThing: req.body.favoriteThing,
    };
    try {
      await User.updateOne(
        { _id: req.user._id },
        { $push: { quizResults: quizResults } }
      );
        req.flash("success", "Quiz results saved successfully!");
        res.redirect("/results");
    } catch {
        req.flash("error", "Failed to save quiz results. Please try again.");
        res.redirect("/quiz");
    }
  } else {
        req.flash("error", "You must be logged in to submit quiz results.");
        res.redirect("/login");
  }
});

app.get("/profile", async (req, res) => {
    if (req.isAuthenticated()) {
      const mostRecentResult = req.user.quizResults.length > 0 ? req.user.quizResults[req.user.quizResults.length - 1] : null;
      let partnerResults = null;
      if (req.user.partner) {
        const partner = await User.findOne({ username: req.user.partner });
        if (partner) {
          partnerResults = partner.quizResults.length > 0 ? partner.quizResults[partner.quizResults.length - 1] : null;
        }
      }
      res.render("profile", 
      { mostRecentResult: mostRecentResult, 
        partnerResults: partnerResults, 
        compiledResults: compiledResults, 
        compatibilityReport: compatibilityReport });
    } else {
      req.flash("error", "You must be logged in to access the user profile.");
      res.redirect("/login");
    }
  });

app.get("/settings", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("settings");
  } else {
    req.flash("error", "You must be logged in to access settings.");
    res.redirect("/login");
  }
});

  // Helper function to compile quiz results into string
  let compiledResults = "Quiz summaries will appear here";
  let compatibilityReport = "Analysis will appear here";

  function getCompiledQuizResults(userResults, partnerResults) {
    // Formats both partner's quiz results into a single cohesive sentence
    return `${partnerResults.name}
    shows love through ${userResults.showLove}, 
    enjoys activities such as ${userResults.favoriteActivity}, 
    and communicates best through ${userResults.communicationPreference}. 
    When asked about gift preferences they said: ${userResults.preferredGift}.
    When asked about communication frequency they said: ${userResults.frequency}.
    When asked the favorite thing about their partner they said ${userResults.favoriteThing}
    Their partner, ${userResults.name},
    shows love through ${partnerResults.showLove}, 
    enjoys activities such as ${partnerResults.favoriteActivity}, 
    and communicates best through ${partnerResults.communicationPreference}.
    When asked about gift preferences they said: ${partnerResults.preferredGift}.
    When asked about communication frequency they said: ${partnerResults.frequency}.
    When asked the favorite thing about their partner they said ${partnerResults.favoriteThing}`;
  }

  async function getCompatibilityReport(prompt) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openai.apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo-0301",
            messages: [{role: "user", content: prompt}]
        }),
      });
      console.log('responded!');
      const responseData = await response.json();
      console.log(responseData);
      if (responseData && responseData.choices && responseData.choices.length > 0) {
        return responseData.choices[0].message.content;
      } else {
        return "Error: No response from ChatGPT";
      }
    } catch (error) {
      console.error("Error querying ChatGPT:", error);
      return "Error: Unable to get a compatibility report from ChatGPT";
    }
    //return 'You two have a high compatibility rating!';
  }

// Update the /compiledQuizResults route in app.js
app.get("/compiledQuizResults", async (req, res) => {
    console.log('yay');
    if (req.isAuthenticated()) {
      if (req.user.partner) {
        const partner = await User.findOne({ username: req.user.partner });
        if (partner) {
          const mostRecentResult = req.user.quizResults.length > 0 ? req.user.quizResults[req.user.quizResults.length - 1] : null;
          const partnerResults = partner.quizResults.length > 0 ? partner.quizResults[partner.quizResults.length - 1] : null;
  
          if (mostRecentResult && partnerResults) {
            compiledResults = getCompiledQuizResults(mostRecentResult, partnerResults);

            // Ask ChatGPT!
            const chatGptPrompt = `My partner and I took a love language and got these results: ${compiledResults}. We are long-distance partners. We are located in different time zones. How should we communicate going forward?`;
            console.log(chatGptPrompt);
            compatibilityReport = await getCompatibilityReport(chatGptPrompt);

            req.flash("success", "Compiled quiz results have been updated.");
            console.log("success");
            res.redirect("/profile");
          } else {
            req.flash("error", "Both partners must have taken the quiz.");
            res.redirect("/profile");
            console.log("error");
          }
        } else {
          req.flash("error", "Partner not found.");
          res.redirect("/profile");
          console.log("error");
        }
      } else {
        req.flash("error", "You must have a partner to get compiled quiz results.");
        res.redirect("/profile");
        console.log("error");
      }
    } else {
      req.flash("error", "You must be logged in to access this feature.");
      res.redirect("/login");
      console.log("error");
    }
  });

app.get("/results", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const user = await User.findById(req.user._id);
      res.render("results", { quizResults: user.quizResults });
    } catch {
      req.flash("error", "Failed to load quiz results. Please try again.");
      res.redirect("/quiz");
    }
  } else {
    req.flash("error", "You must be logged in to view quiz results.");
    res.redirect("/login");
  }
});

app.get('/partnerSearch', (req, res) => {
    if (req.isAuthenticated()) {
      res.render('partnerSearch');
    } else {
      req.flash('error', 'You must be logged in to search for a partner.');
      res.redirect('/login');
    }
  });
  
app.post("/partnerSearch", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const partner = await User.findOne({ username: req.body.partnerUsername });
      if (!partner) {
        req.flash("error", "User not found.");
        console.log("error", "User not found.");
        return res.redirect("/partnerSearch");
      }
      enteredPin = parseInt(req.body.partnerPin)
      if (partner.pin !== enteredPin) {
        req.flash("error",  "Incorrect partner's pin.");
        console.log(typeof partner.pin);
        console.log(typeof req.body.partnerPin);
        return res.redirect("/partnerSearch");
      }

      // Set the current user's partner field to the partner's username
      req.user.partner = partner.username;
      await req.user.save();

      // Set the partner's partner field to the current user's username
      partner.partner = req.user.username;
      await partner.save();

      req.flash("success", `You are now connected with ${partner.username}.`);
      console.log("success", `You are now connected with ${partner.username}.`)
      res.redirect("/settings");
    } catch (error) {
      req.flash("error", "An error occurred while searching for a partner.");
      console.log("error", "An error occurred while searching for a partner.");
      res.redirect("/partnerSearch");
    }
  } else {
    req.flash("error", "You must be logged in to search for a partner.");
    console.log("error", "You must be logged in to search for a partner.");
    res.redirect("/login");
  }
});

app.get('/searchSuggestions', async (req, res) => {
    if (req.isAuthenticated()) {
    const input = req.query.input;
    if (input) {
        const suggestions = await User.find({ username: { $regex: input, $options: 'i' } }).select('username').limit(5);
        res.json(suggestions.map(suggestion => suggestion.username));
    } else {
        res.json([]);
    }
    } else {
    res.status(401).json([]);
    }
});

app.get("/pin", (req, res) => {
if (req.isAuthenticated()) {
    res.render("pin");
} else {
    req.flash("error", "You must be logged in to view your pin.");
    res.redirect("/login");
}
});

// Send Nudge route
app.get("/sendNudge", (req, res) => {
    if (req.isAuthenticated()) {
      res.render("sendNudge");
    } else {
      req.flash("error", "You must be logged in to send a nudge.");
      res.redirect("/login");
    }
  });
  
app.post("/sendNudge", async (req, res) => {
  const message = req.body.nudgeMessage;
  const drawingData = req.body.drawingData;

  if (req.isAuthenticated()) {
      console.log(message);
    const nudge = new Nudge({
      message: message,
      timestamp: new Date(),
      drawing: drawingData
    });
    console.log('drawingData:');
    console.log(drawingData);

    // Save nudge to sender's outbox
    req.user.nudgeOutbox.push(nudge);
    await req.user.save();

    // Save nudge to receiver's inbox (assumes req.user.partner exists)
    const partner = await User.findOne({ username: req.user.partner });
    if (partner) {
      console.log(nudge);
      partner.nudgeInbox.push({ ...nudge.toObject(), incoming: true });
      await partner.save();
      req.flash("success", "Nudge sent successfully!");
    } else {
      req.flash("error", "Failed to send nudge. Partner not found.");
    }
    res.redirect("/profile");
  } else {
    req.flash("error", "You must be logged in to send a nudge.");
    res.redirect("/login");
  }
});

app.get('/sendNudgeDelayed', (req, res) => {
  res.render('sendNudgeDelayed');
});

app.post('/sendNudgeDelayed', async (req, res) => {
  const nudgeMessage = req.body.nudgeMessage;
  const nudgeDateTime = req.body.nudgeDateTime;
  
  console.log('sending delayed');
  console.log(nudgeMessage);

  const delayedNudge = new Nudge({
    message: nudgeMessage,
    timestamp: nudgeDateTime,
  });

  // Save nudge to sender's outbox
  req.user.nudgeOutbox.push(delayedNudge);
  await req.user.save();

  res.redirect('/profile');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
 });
  
  