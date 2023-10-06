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
const secret = "fsefsefsdfsfgsefsef";
const multer = require("multer");
const uploadMiddleware = multer({ dest: "uploads/" });
const fs = require("fs");
const dotenv = require("dotenv").config();

app.use(cors({ credentials: true, origin: "https://astounding-zuccutto-df395c.netlify.app" }));

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

mongoose.set("strictQuery", false);
mongoose.connect(process.env.MONGODB_URI);

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDocument = await User.create({
      username,
      password: await bcrypt.hashSync(password, salt),
    });
    if (!userDocument) {
      return res.status(404).json("User not found");
    }
    res.json(userDocument);
  } catch (error) {
    res.status(400).json(error.message);
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  if (!userDoc) {
    res.status(400).json("wrong credentialss");
    return;
  }

  const passOk = await bcrypt.compareSync(password, userDoc?.password);
  if (passOk) {
    // logged in
    const token = jwt.sign({ username, id: userDoc._id }, secret, {
      expiresIn: "2h",
    });

    res
      .cookie("token", token, {
        httpOnly: false,
        maxAge: 1000 * 60 * 60 * 24 * 30 * 12,
        sameSite: "none",
        secure: true,
      })
      .json({
        id: userDoc._id,
        username,
      });
    // jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
    //   if (err) throw err;
    //   res.cookie("token", token).json({
    //     id: userDoc._id,
    //     username,
    //   });
    // });
  } else {
    res.status(400).json("wrong credentials");
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  if (!token) {
    return res.status(401).json("Unauthorized");
  }
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});

app.post("/logout", (req, res) => {
  const cookieOptions = {
    expires: new Date(0), // Set the expiration date to a past date to delete the cookie
    maxAge: -1,
    path: "/", // Set the path to the root to ensure the cookie is deleted for the entire site
    secure: true, // Require a secure (HTTPS) connection for the cookie
    sameSite: "none", // Enforce strict SameSite policy (adjust as needed)
  };

  res.clearCookie("token", "", cookieOptions).json("ok");
});

app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  const { originalname, path } = req.file;
  const parts = originalname.split(".");
  const extension = parts[parts.length - 1];
  const newPath = path + "." + extension;
  fs.renameSync(path, newPath);

  const { token } = req.cookies;
  if (!token) {
    return res.status(401).json("Unauthorized");
  }
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

app.put("/post", uploadMiddleware.single("file"), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const extension = parts[parts.length - 1];
    newPath = path + "." + extension;
    fs.renameSync(path, newPath);
  }

  const { token } = req.cookies;
  if (!token) {
    return res.status(401).json("Unauthorized user");
  }
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
  if (!token) {
    return res.status(401).json("Unauthorized");
  }
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;

    const postDocument = await Post.findById(id);
    const isAuthor =
      JSON.stringify(postDocument?.author) === JSON.stringify(info?.id);

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

app.get("/post/:id", async (req, res) => {
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate("author", ["username"]);
  res.json(postDoc);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT);
