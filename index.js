/**
 * index.js
 * the entry point for the application.
 * @author: Luke Johnson
 */


require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const app = express();

const connection = mysql.createConnection(process.env.DATABASE_URL);

connection.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("Connected to Railway MySQL!");
});



const session = require('express-session'); //import express-session for session management
const path = require('path'); //import path module for handling file paths
//import userRoutes used for routing to register and login views.
const userRoutes = require('./routes/userRoutes');
const { checkAuthenticated } = require('./middleware/auth');
const userModel = require('./models/userModel');

//used for parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


//used for parsing application/json
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));


// Set view engine to EJS
app.set('view engine', 'ejs');
// Set views folder
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'views')));

app.use('/', userRoutes);//use userRoutes for all routes starting with '/'

//route for aboutUs page
app.get("/about", (req, res) => {
  res.render("about");
});

//route for settings page
app.get("/settings", checkAuthenticated, async (req, res) => {
  const notice = req.query.message
    ? {
        type: req.query.type || 'info',
        message: req.query.message
      }
    : null;
  try {
    const dbUser = await userModel.getUserById(req.session.user.id);
    const user = dbUser
      ? {
          ...req.session.user,
          ...dbUser
        }
      : req.session.user;

    res.render("settings", { user, notice });
  } catch (error) {
    console.error('Error loading settings profile:', error);
    res.render("settings", { user: req.session.user, notice });
  }
});

//show register view.
app.get('/', (req, res) => {
    res.redirect('/register');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
