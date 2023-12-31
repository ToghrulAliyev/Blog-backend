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
const fs = require("fs");
const dotenv = require("dotenv").config();
const multer = require("multer");

app.use(
  cors({
    credentials: true,
    origin: [
      "https://astounding-zuccutto-df395c.netlify.app",
      "http://localhost:5173",
    ],
  })
);

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

app.post("/logout", async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  if (!userDoc) {
    res.status(400).json("wrong credentialss");
    return;
  }
  const passOk = await bcrypt.compareSync(password, userDoc?.password);
  if (passOk) {
    const token = jwt.sign({ username, id: userDoc._id }, secret, {
      expiresIn: "2h",
    });

    res
      .cookie("token", token, {
        httpOnly: false,
        maxAge: -1,
        sameSite: "none",
        secure: true,
      })
      .json("ok");
  } else {
    res.status(400).json("wrong credentials");
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
  } else {
    res.status(400).json("wrong credentials");
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  if (!token) {
    return res.status(401).json("Unauthorized");
  }

  try {
    const info = jwt.verify(token, secret, {});
    res.json(info);
  } catch (err) {
    // Handle the error gracefully
    console.log(err);
    res.status(403).json("Forbidden");
  }
});
 
const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "./uploads");
    },
    filename: function (req, file, callback) {
      callback(null, file.originalname);
    },
  }),
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
