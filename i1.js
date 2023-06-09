const express = require("express");
const { Client } = require("pg");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

dotenv.config();

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
          .cookie("access_token", token, {
            httpOnly: true,
          })
          .status(200)
          .send(token)
          .redirect("/");
      } else {
        res.send("Wrong credentials");
      }
    } else {
      res.send("No such account found.");
    }
  });
});

const authorization = (req, res, next) => {
  const token = req.cookies.access_token;
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
  // let tokenHeaderKey = process.env.TOKEN_HEADER_KEY;
  // let jwtSecretKey = process.env.JWT_SECRET_KEY;

  // try {
  //   const token = req.header(tokenHeaderKey);

  //   const verified = jwt.verify(token, jwtSecretKey);
  //   if (verified) {
  //     return res.sendFile(`${__dirname}/home.html`);
  //   } else {
  //     // Access Denied
  //     return res.status(401).send(error);
  //   }
  // } catch (error) {
  //   // Access Denied
  //   return res.status(401).send(error);
  // }
  return res.json({ username: req.userId });
});

app.get("/logout", authorization, (req, res) => {
  return res
    .clearCookie("access_token")
    .status(200)
    .json({ message: "Successfully logged out" });
});
