const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
const User = require("./models/User");
const Post = require("./models/Post");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const salt = bcrypt.genSaltSync(10);
const secret = "hereismysecretkey";
const multer = require("multer");
const uploadMiddleware = multer({ dest: "uploads/" });
const fs = require("fs");

app.use(cors({ credentials: true, origin: "http://localhost:5173" }));

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

mongoose.connect(
  "mongodb+srv://togrulali4:h94xhVfr3cuLzZPq@cluster0.afj4bnn.mongodb.net/?retryWrites=true&w=majority"
);

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDocument = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDocument);
  } catch (error) {
    res.status(400).json(error.message);
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const userDocument = await User.findOne({ username });
  const passOK = bcrypt.compareSync(password, userDocument.password);

  if (passOK) {
    jwt.sign({ username, id: userDocument._id }, secret, {}, (err, token) => {
      if (err) throw err;
      res.cookie("token", token).json("ok");
    });
  } else {
    res.status(400).json("wrong credentials");
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json({
    id: userDocument._id,
    username,
  });
});

app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  const { originalname, path } = req.file;
  const parts = originalname.split(".");
  const extension = parts[parts.length - 1];
  const newPath = path + "." + extension;
  fs.renameSync(path, newPath);

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { title, summary, content } = req.body;
    const postDocument = await Post.create({
      title,
      summary,
      content,
      cover: newPath,
      author: info.id,
    });
    res.json(postDocument);
  });
});

app.put('/post',uploadMiddleware.single('file'), async (req,res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const extension = parts[parts.length - 1];
    newPath = path + "." + extension;
    fs.renameSync(path, newPath);
  }

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { id, title, summary, content } = req.body;
    const postDocument = await Post.findById(id);
    const isAuthor =
      JSON.stringify(postDocument?.author) === JSON.stringify(info?.id);

    if (!isAuthor) {
      return res.status(400).json("you are not the author");
    }
    await postDocument.updateOne({
      title,
      summary,
      content,
      cover: newPath ? newPath : postDocument.cover,
    });
    res.json(postDocument);
  });
});


app.delete("/post/:id", async (req, res) => {
  const { id } = req.params;

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;

    const postDocument = await Post.findById(id);
    const isAuthor = JSON.stringify(postDocument?.author) === JSON.stringify(info?.id);

    if (!isAuthor) {
      return res.status(400).json("you are not the author");
    }

    await postDocument.deleteOne();
    res.sendStatus(204);
  });
});

app.get("/post", async (req, res) => {
  res.json(
    await Post.find()
      .populate("author", ["username"])
      .sort({ createdAt: -1 })
      .limit(20)
  );
});

app.get('/post/:id', async (req, res) => {
  const {id} = req.params;
  const postDoc = await Post.findById(id).populate('author', ['username']);
  res.json(postDoc);
})


app.listen(5000);

//togrulali4 h94xhVfr3cuLzZPq mongo user

//
