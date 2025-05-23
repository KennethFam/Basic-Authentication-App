/////// app.js
require("dotenv").config();
const bcrypt = require("bcryptjs");
const path = require("node:path");
const { Pool } = require("pg");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require('passport-local').Strategy;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
        const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        const user = rows[0];

        if (!user) {
            return done(null, false, { message: "Incorrect username" });
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
        // passwords do not match!
            return done(null, false, { message: "Incorrect password" })
        }
        return done(null, user);
    } catch(err) {
        return done(err);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    const user = rows[0];

    done(null, user);
  } catch(err) {
    done(err);
  }
});

const app = express();
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(session({ 
  store: new (require(`connect-pg-simple`)(session))({
    conString: process.env.DATABASE_URL, // connection string for the db
    createTableIfMissing: true // create session db if it does not exist
  }),
  secret: process.env.SESSION_SECRET, // set secret
  resave: false, // session is only saved if it was modified, affects existing sessions
  saveUninitialized: false, // only save session if you modify it, affects new sessions
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
}));
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.render("index", { user: req.user });
});
app.get("/sign-up", (req, res) => res.render("sign-up-form"));
app.post("/sign-up", async (req, res, next) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        await pool.query("insert into users (username, password) values ($1, $2)", [req.body.username, hashedPassword]);
        res.redirect("/");
    } catch (error) {
        console.error(error);
        next(error);
    }
});
app.post(
  "/log-in",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/"
  })
);
app.get("/log-out", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.listen(3000, () => console.log("app listening on port 3000!"));
