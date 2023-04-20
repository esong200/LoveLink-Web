const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const flash = require("connect-flash");
const bcrypt = require("bcryptjs");

const app = express();
const path = require("path");
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/loveLanguageQuiz", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define User schema and model
const UserSchema = new mongoose.Schema({
    name: String,
    username: String,
    password: String,
    partner: String,
    quizResults: [
      {
        name: String,
        showLove: String,
        preferredGift: String,
        favoriteActivity: String,
        communicationPreference: String,
      },
    ],
  });

const User = mongoose.model("User", UserSchema);

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
    const newUser = new User({ name: req.body.name, username: req.body.username, password: hashedPassword });
    await newUser.save();
    req.flash("success", "Registered successfully!");
    res.redirect("/login");
  } catch {
    req.flash("error", "Registration failed. Please try again.");
    res.redirect("/register");
  }
});

app.get("/login", (req, res) => {
  if (req.query.loggedOut === "true") {
    req.flash("success", "Logged out successfully!");
  }
  res.render("login");
});

app.post("/login",
  passport.authenticate("local", {
    successRedirect: "/profile",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

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

app.post("/quiz", async (req, res) => {
  if (req.isAuthenticated()) {
    const quizResults = {
        name: req.body.name,
        showLove: req.body.showLove,
        preferredGift: req.body.preferredGift,
        favoriteActivity: req.body.favoriteActivity,
        communicationPreference: req.body.communicationPreference,
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
      res.render("profile", { mostRecentResult: mostRecentResult, partnerResults: partnerResults });
    } else {
      req.flash("error", "You must be logged in to access the user profile.");
      res.redirect("/login");
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
  
  app.post('/partnerSearch', async (req, res) => {
    if (req.isAuthenticated()) {
      try {
        const partner = await User.findOne({ username: req.body.partnerUsername });
        if (partner) {
          await User.updateOne({ _id: req.user._id }, { partner: partner.username });
          req.flash('success', 'Partner updated successfully!');
          res.redirect('/profile');
        } else {
          req.flash('error', 'Partner not found. Please try again.');
          res.redirect('/partnerSearch');
        }
      } catch {
        req.flash('error', 'Error searching for partner. Please try again.');
        res.redirect('/partnerSearch');
      }
    } else {
      req.flash('error', 'You must be logged in to search for a partner.');
      res.redirect('/login');
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

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
  });
