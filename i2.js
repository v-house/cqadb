const express = require("express");
const { Client } = require("pg");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const cookies = require("cookie-parser");

dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookies());

const client = new Client({
  user: "postgres",
  host: "localhost",
  database: "cqadb",
  password: "root",
  port: 5432,
});

client.connect(function (err) {
  if (err) throw err;
  console.log("Connected!");
});

app.listen(3000, () => {
  console.log("Server listening on port 3000.");
});

app.get("/login", (req, res) => {
  res.sendFile(`${__dirname}/loginUser.html`);
});

app.post("/login", (req, res) => {
  const query1 = `SELECT * FROM users WHERE account_id = $1`;
  const userName = [req.body.username];

  client.query(query1, userName, (err, result) => {
    if (result.rows != 0) {
      if (req.body.username == req.body.password) {
        let jwtSecretKey = process.env.JWT_SECRET_KEY;
        let data = {
          time: Date(),
          account_id: req.body.username,
        };

        const token = jwt.sign(data, jwtSecretKey);

        return res
          .cookie("jwt", token, {
            httpOnly: true,
            secure: true,
          })
          .status(200)
          .redirect("/home");
      } else {
        res.send("Wrong credentials");
      }
    } else {
      res.send("No such account found.");
    }
  });
});

const authorization = (req, res, next) => {
  let token = req.cookies.jwt;
  let jwtSecretKey = process.env.JWT_SECRET_KEY;
  if (!token) {
    return res.sendStatus(403);
  }
  try {
    const data = jwt.verify(token, jwtSecretKey);
    req.userId = data.account_id;
    return next();
  } catch {
    return res.sendStatus(403);
  }
};

app.get("/home", authorization, (req, res) => {
  const query = "SELECT * FROM posts ORDER BY last_activity_date DESC";
  client.query(query, (err, result) => {
    if (result.rows != 0) {
      return res.json(result.rows).status(200);
    } else {
      res.send("No such account found.");
    }
  });
});

app.get("/posts/:id", (req, res) => {
  const id = req.params.id;

  // Query the database to read a particular row from the table
  client.query("SELECT * FROM posts WHERE id = $1", [id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error retrieving row from database");
    } else {
      client.query(
        "SELECT * FROM comments WHERE post_id = $1",
        [id],
        (err, result1) => {
          if (err) {
            console.error(err);
            res.status(500).send("Error retrieving row from database");
          } else {
            res.json({ question: result.rows[0], comments: result1.rows });
          }
        }
      );
    }
  });
});

app.get("/logout", authorization, (req, res) => {
  return res
    .clearCookie("jwt")
    .status(200)
    .json({ message: "Successfully logged out" });
});

app.get("/create_account", (req, res) => {
  res.sendFile(`${__dirname}/createAccount.html`);
});

app.post("/create_account", (req, res) => {
  const query =
    "INSERT INTO users (account_id, reputation, views, down_votes, up_votes, display_name, location, profile_image_url, website_url, about_me, creation_date, last_access_date) VALUES ($1, 0, 0, 0, 0, $2, null, null, null, null, to_timestamp($3 / 1000.0), to_timestamp($3 / 1000.0))";
  const values = [req.body.username, req.body.fullname, Date.now()];
  client.query(query, values, (err, result) => {
    if (err) {
      console.log(err);
      res.status(401).send("Unable to create an account");
    } else {
      res.status(200).redirect("/login");
    }
  });
});
