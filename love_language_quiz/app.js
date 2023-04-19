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
  username: String,
  password: String,
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
    const newUser = new User({ username: req.body.username, password: hashedPassword });
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

app.get("/profile", (req, res) => {
    if (req.isAuthenticated()) {
      const mostRecentResult = req.user.quizResults.length > 0 ? req.user.quizResults[req.user.quizResults.length - 1] : null;
      res.render("profile", { mostRecentResult: mostRecentResult });
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

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
  });
