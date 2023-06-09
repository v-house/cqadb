const express = require("express");
const { Client } = require("pg");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

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

app.get("/", (req, res) => {
  res.send("Hello world");
});

app.listen(3000, () => {
  console.log("Server listening on port 3000.");
});

app.get("/create_account", (req, res) => {
  res.sendFile(`${__dirname}/createAccount.html`);
});

app.post("/create_account", (req, res) => {
  const query1 = `SELECT * FROM users WHERE username = $1`;
  const userName = [req.body.username];

  client.query(query1, userName, (err, result) => {
    if (result.rows == 0) {
      console.log("Can be created.");
      const query = `INSERT INTO users (username, password) VALUES ($1, $2)`;
      const values = [req.body.username, req.body.username];

      client.query(query, values, (err, result) => {
        if (err) {
          console.error(err);
          res.send("Error storing data in the database.");
        } else {
          //   res.send("Data stored in the database successfully.");
          res.redirect("/login");
        }
      });
    } else {
      res.send("Username already used.");
    }
  });
});

app.get("/login", (req, res) => {
  res.sendFile(`${__dirname}/loginUser.html`);
});

app.post("/login", (req, res) => {
  const query1 = `SELECT * FROM users WHERE username = $1`;
  const userName = [req.body.username];

  client.query(query1, userName, (err, result) => {
    console.log(result);
    if (result.rows != 0) {
      console.log("Can be created.");
      const passCheck = result.rows[0].password;
      const passWord = req.body.password;
      if (passCheck == passWord) {
        res.send("User logged in successfully");
      } else {
        res.send("Wrong credentials");
      }
    } else {
      res.send("No such account found.");
    }
  });
});
