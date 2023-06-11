const express = require("express");
const { Client } = require("pg");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const cookies = require("cookie-parser");

dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookies());
app.use(express.json());

const client = new Client({
  user: process.env.DB1_USER,
  host: process.env.DB1_HOST,
  database: process.env.DB1_DATABASE,
  password: process.env.DB1_PASSWORD,
  port: process.env.PORT,
});

client.connect(function () {
  console.log("Connected!");
});

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log("Server listening on port 3000.");
});

app.get("/login", (req, res) => {
  res.sendFile(`${__dirname}/index.html`);
});

app.post("/login", (req, res) => {
  const query1 = `SELECT * FROM users WHERE account_id = $1`;
  const userName = [req.body.username];

  client.query(query1, userName, (err, result) => {
    if (result.rowCount != 0) {
      const id = result.rows[0].id;
      const name_display = result.rows[0].display_name;

      if (req.body.username == req.body.password) {
        let jwtSecretKey = process.env.JWT_SECRET_KEY;
        let data = {
          time: Date(),
          account_id: req.body.username,
          fullname: name_display,
          id: id,
        };

        const token = jwt.sign(data, jwtSecretKey);

        return res
          .cookie("jwt", token, {
            httpOnly: true,
            secure: true,
          })
          .status(200)
          .redirect("/posts");
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
    req.id = data.id;
    req.fullname = data.fullname;
    return next();
  } catch {
    return res.sendStatus(403);
  }
};

app.get("/posts", authorization, (req, res) => {
  res.sendFile(`${__dirname}/homePage.html`);
});

app.get("/home", authorization, (req, res) => {
  const query = "SELECT * FROM posts ORDER BY last_activity_date DESC";
  client.query(query, (err, result) => {
    if (result.rowCount != 0) {
      res.json(result.rows);
    } else {
      res.send("In home, No recent posts available.");
    }
  });
});

app.get("/posts/:id", (req, res) => {
  const id = req.params.id;
  res.sendFile(`${__dirname}/onePost.html`);
});

app.get("/post_takens/:id", (req, res) => {
  const id = req.params.id;

  // Query the database to read a particular row from the table
  client.query("SELECT * FROM posts WHERE id = $1", [id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error retrieving row from database");
    } else {
      client.query(
        "UPDATE posts SET view_count = view_count + 1 WHERE id = $1",
        [id],
        (err, result2) => {
          if (err) {
            console.error(err);
            res.status(500).send("Error updating view count in database");
          } else {
            client.query(
              "SELECT * FROM comments WHERE post_id = $1",
              [id],
              (err, result1) => {
                const html = `
                <html>
                  <head>
                    <style>
                      #home-btn {
                        background-color: #008CBA;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        text-align: center;
                        text-decoration: none;
                        display: inline-block;
                        font-size: 16px;
                        margin: 4px 2px;
                        cursor: pointer;
                      }
                      
                      #like-btn {
                        background-color: #4CAF50;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        text-align: center;
                        text-decoration: none;
                        display: inline-block;
                        font-size: 16px;
                        margin: 4px 2px;
                        cursor: pointer;
                      }
                      
                      form {
                        display: flex;
                      }
                      
                      input[type="text"] {
                        width: 100%;
                        padding: 12px 20px;
                        margin: 8px 0;
                        box-sizing: border-box;
                        border: 2px solid #ccc;
                        border-radius: 4px;
                        resize: none;
                      }
                      
                      button[type="submit"] {
                        background-color: #008CBA;
                        color: white;
                        padding: 12px 20px;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                      }
                    </style>
                  </head>
                  <body>
                    <a href="/posts"><button id="home-btn">Back to homepage</button></a>
                    <h1>${result.rows[0].title}</h1>
                    <h4>${result.rows[0].body}</h4>
                    <div>
                      <p>${result.rows[0].favorite_count} likes</p>
                      <a href="/post_takens/${id}/like-post"><button id="like-btn">Like</button></a>
                    </div>
                    <ul>
                      ${result1.rows
                        .map(
                          (comment) =>
                            `<li>
                            <div>
                              <h5>Posted by ${comment.user_display_name}</h5>
                              ${comment.text_body}
                            </div>
                          </li>`
                        )
                        .join("")}
                    </ul>
                    <form action="/post_takens/${id}/addcomment" method="post">
                      <input type="text" name="newcomment" placeholder="Comment on this question" required/>
                      <button type="submit">Post comment</button></form>`;
                res.send(html);
              }
            );
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
    .sendFile(`${__dirname}/loggedOut.html`);
});

app.get("/create_account", (req, res) => {
  res.sendFile(`${__dirname}/createAccount.html`);
});

app.post("/create_account", (req, res) => {
  const query =
    "INSERT INTO users (account_id, reputation, views, down_votes, up_votes, display_name, profile_image_url, website_url, about_me, creation_date, last_access_date) VALUES ($1, 0, 0, 0, 0, $2, null, null, null, to_timestamp($3 / 1000.0), to_timestamp($3 / 1000.0))";
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

app.get("/start_a_discussion", authorization, (req, res) => {
  res.sendFile(`${__dirname}/createPost.html`);
});

app.post("/start_a_discussion", authorization, (req, res) => {
  const query =
    "INSERT INTO posts (owner_user_id, accepted_answer_id, score, view_count, answer_count, comment_count, owner_display_name, title, body, favorite_count, creation_date, closed_date, last_activity_date, tags) VALUES ($1, null, 0, 0, 0, 0, $2, $3, $4, 0,to_timestamp($6 / 1000.0),to_timestamp($6 / 1000.0),to_timestamp($6 / 1000.0),$5)";
  const values = [
    req.id,
    req.userId,
    req.body.title,
    req.body.bhead,
    req.body.search,
    Date.now(),
  ];
  client.query(query, values, (err, result) => {
    if (err) {
      console.log(err);
      res.status(401).send("Unable to post, please try again.");
    } else {
      res.status(200).redirect("/posts");
    }
  });
});

app.get("/all_tags", (req, res) => {
  const query = "SELECT tag_name FROM tags";
  client.query(query, (err, result) => {
    if (result.rowCount != 0) {
      return res.json(result.rows);
    } else {
      res.send("Nothing found");
    }
  });
});

app.post("/searchname", (req, res) => {
  const searchQuery = req.body.searchQuery;
  const query = `SELECT * FROM posts WHERE owner_display_name ILIKE '%${searchQuery}%' ORDER BY last_activity_date DESC`;
  client.query(query, (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send("An error occurred");
    } else {
      res.send(result.rows);
    }
  });
});

app.post("/searchnamevotes", (req, res) => {
  const searchQuery = req.body.searchQuery;
  const query = `SELECT * FROM posts WHERE owner_display_name ILIKE '%${searchQuery}%' ORDER BY view_count DESC`;
  client.query(query, (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send("An error occurred");
    } else {
      res.send(result.rows);
      // const halfRows = Math.ceil(result.rows.length / 2);
      // res.send(result.rows.slice(0, halfRows));
    }
  });
});

app.get("/search-by-name", authorization, (req, res) => {
  res.sendFile(`${__dirname}/searchbyName.html`);
});

app.get("/autocomplete", async (req, res) => {
  const searchValue = req.query.search;
  try {
    const { rows } = await client.query(
      `SELECT tag_name FROM tags WHERE tag_name ILIKE $1`,
      [`${searchValue}%`]
    );
    const suggestions = rows.map((row) => row.tag_name);
    res.json({ suggestions });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});

app.get("/autocompleten", async (req, res) => {
  const searchValue = req.query.search;
  try {
    const { rows } = await client.query(
      `SELECT account_id FROM users WHERE account_id ILIKE $1 OR display_name ILIKE $1`,
      [`${searchValue}%`]
    );
    const suggestions = rows.map((row) => row.account_id);
    res.json({ suggestions });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});

app.get("/post_takens/:id/like-post", (req, res) => {
  const id = req.params.id;

  // update the database to increment the favorite_count for the given post_id
  client.query(
    "UPDATE posts SET favorite_count = favorite_count + 1, view_count = view_count - 1 WHERE id = $1",
    [id],
    (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).send("Error updating favorite count in database");
      } else {
        res.redirect(`/post_takens/${id}`);
      }
    }
  );
});

app.post("/post_takens/:id/addcomment", authorization, (req, res) => {
  const postId = req.params.id;
  const query =
    "INSERT INTO comments (post_id, user_id, score, user_display_name, text_body, creation_date) VALUES ($1, $2, 0, $3, $4, to_timestamp($5 / 1000.0))";
  const values = [
    postId,
    req.id,
    req.fullname,
    req.body.newcomment,
    Date.now(),
  ];
  client.query(query, values, (err, result) => {
    if (err) {
      console.log(err);
      res.status(401).send("Unable to create an account");
    } else {
      res.status(200).redirect("/post_takens/" + postId);
    }
  });
});

app.post("/searchtag", (req, res) => {
  const searchQuery = req.body.searchQuery;
  const queryParams = searchQuery.split(",").map((tag) => `%${tag}%`);
  queryParams.pop();
  const query = `SELECT * FROM posts WHERE tags ILIKE ALL ($1) ORDER BY last_activity_date DESC`;
  client.query(query, [queryParams], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send("An error occurred");
    } else {
      // const halfRows = Math.ceil(result.rows.length / 2);
      // res.send(result.rows.slice(0, halfRows - 1));
      res.send(result.rows);
    }
  });
});

app.post("/searchtagvotes", (req, res) => {
  const searchQuery = req.body.searchQuery;
  const queryParams = searchQuery.split(",").map((tag) => `%${tag}%`);
  queryParams.pop();
  // console.log(queryParams);

  const query =
    "SELECT * FROM posts WHERE tags ILIKE ALL ($1) ORDER BY view_count DESC";
  client.query(query, [queryParams], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send("An error occurred");
    } else {
      // console.log(result.rows);
      // const halfRows = Math.ceil(result.rowCount / 2);
      // res.send(result.rows.slice(0, halfRows - 1));
      res.send(result.rows);
    }
  });
});

app.get("/search-by-tag", authorization, (req, res) => {
  res.sendFile(`${__dirname}/searchbyTag.html`);
});

app.get("/search", authorization, (req, res) => {
  res.sendFile(`${__dirname}/searchAll.html`);
});

app.get("/profile", authorization, (req, res) => {
  res.sendFile(`${__dirname}/profile.html`);
});

app.get("/profilequestions", authorization, (req, res) => {
  const query = "SELECT * FROM posts WHERE owner_user_id = $1";
  client.query(query, [req.id], (err, result) => {
    if (result.rows != 0) {
      res.json(result.rows);
    } else {
      res.send("In home, No recent posts available.");
    }
  });
});

app.post("/searchall", authorization, (req, res) => {
  const searchQuery = req.body.searchQuery;
  const query = `SELECT * FROM posts WHERE tags ILIKE '%${searchQuery}%' OR owner_display_name ILIKE '%${searchQuery}%' OR title ILIKE '%${searchQuery}%' OR body ILIKE '%${searchQuery}%'`;
  client.query(query, (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send("An error occurred");
    } else {
      res.send(result.rows);
    }
  });
});

app.post("/inprofilequestions", authorization, async (req, res) => {
  const searchQuery = req.body.searchQuery;
  query = `SELECT * FROM posts WHERE tags ILIKE '%${searchQuery}%' AND owner_user_id = '%${req.id}'`;
  client.query(query, (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send("An error occurred");
    } else {
      res.send(result.rows);
    }
  });
});

app.get("/update_post/:id", authorization, (req, res) => {
  const qid = req.params.id;
  client.query("SELECT * FROM posts WHERE id = $1", [qid], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error retrieving row from database");
    } else {
      res
        .render("edit-post", { previousValues: result })
        .sendFile(`${__dirname}/updatePost.html`);
    }
  });
});

app.put("/update_posts/:id", authorization, (req, res) => {
  const id = req.params.id;
  const values = [
    id,
    req.body.title,
    req.body.bhead,
    req.body.search,
    Date.now(),
  ];

  client.query("SELECT * FROM posts WHERE id = $1", [id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error retrieving row from database");
    } else {
      client.query(
        `UPDATE posts SET title = $2, body = $3, last_activity_date = to_timestamp($5 / 1000.0), tags = $4 WHERE id = $1`,
        values,
        (err, result2) => {
          if (err) {
            console.error(err);
            res.status(500).send("Error updating view count in database");
          } else {
            res.sendFile(`${__dirname}/questionUptStat.html`);
          }
        }
      );
    }
  });
});

app.get("/post/:id", (req, res) => {
  const id = req.params.id;

  client.query("SELECT * FROM posts WHERE id = $1", [id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error retrieving row from database");
    } else {
      return res.json({
        title: result.title,
        body: result.body,
        tags: result.tags,
      });
    }
  });
});

app.get("/delete_post/:id", (req, res) => {
  const id = req.params.id;

  // Query the database to read a particular row from the table
  client.query("DELETE FROM posts WHERE id = $1", [id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error retrieving row from database");
    } else {
      res.sendFile(`${__dirname}/deleteupt.html`);
    }
  });
});
