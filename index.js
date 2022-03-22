const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { json } = require("express");
const express = require("express");
const app = express();
const cors = require("cors");
const ObjectId = require("mongodb").ObjectId;
const port = process.env.PORT || 5000;
const fileUpload = require("express-fileupload");
require("dotenv").config();

// middleware
app.use(cors());
app.use(json());
app.use(fileUpload());

// firebase JWT
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

// database connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tkswl.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function verifyToken(req, res, next) {
  if (req?.headers?.authorization) {
    const token = req.headers.authorization.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      // sending data to request
      req.decodedEmail = decodedUser.email;
    } catch (error) {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    console.log("connected");
    const database = client.db("internshala-task");
    const postCollection = database.collection("post");

    app.post("/post", verifyToken, async (req, res) => {
      const email = req.body.email;
      const requester = req.decodedEmail;
      if (requester === email) {
        const postText = req.body.postText;
        const name = req.body.name;
        const pic = req.files?.img;
        const userPhoto = req.body.photo;
        const picData = pic?.data;
        const encodedPic = picData?.toString("base64");
        const ImgBuffer = Buffer.from(encodedPic, "base64");
        const post = {
          postText: postText,
          name: name,
          email: email,
          img: ImgBuffer,
          photo: userPhoto,
        };
        const result = await postCollection.insertOne(post);
        res.send(result);
      } else {
        res.json({ message: "you are not authorized" });
      }
    });

    // get every single post
    app.get("/post", verifyToken, async (req, res) => {
      const email = req?.headers?.email;
      const requester = await req?.decodedEmail;
      if (email === requester) {
        const cursor = postCollection.find({});
        const result = await cursor.toArray();
        res.send(result);
      }
      // else {
      //   res.json({ message: "you are not authorized" });
      // }
    });

    // update comments
    app.put("/comments", verifyToken, async (req, res) => {
      const requester = req.decodedEmail;
      const email = req.body.reqEmail;
      if (requester === email) {
        const id = req.body._id;
        const comment = req.body.comments;
        const commentorPhoto = req.body.commentorPhoto;
        const query = await postCollection.findOne({ _id: ObjectId(id) });
        const updateDoc = {
          $push: {
            comments: { comment, commentorPhoto },
          },
        };
        const result = await postCollection.updateOne(query, updateDoc);
        res.send(result);
      } else {
        res.json({ message: "you are not authorized" });
      }
    });
  } finally {
    // client.close()
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("This is the server!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
