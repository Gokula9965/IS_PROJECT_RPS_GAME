import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import dotenv from 'dotenv';
import multer from "multer";
import bcrypt from "bcrypt";
import connectionDb from './connectionDb.js';
import UserCreds from "./Schema/usercreds.js";
import cors from "cors";
dotenv.config();
const app = express();
connectionDb();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url); 
const __dirname = path.dirname(__filename); 
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "view")));
app.use(express.static(path.join(__dirname, "images")));
const storage = multer.memoryStorage(); 
const upload = multer({ storage: storage });
app.get("/", (req, res, next) => {
  res.sendFile(path.join(__dirname, "login.html"));
});
app.get("/openindex", (req, res, next) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/openadmin", (req, res, next) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});
app.get("/openregister", (req, res, next) => {
  res.sendFile(path.join(__dirname, "register.html"));
})
app.post('/register', upload.single('profileImage'), async (req, res) => {
  try {
    const { userName, emailId, password } = req.body;
    console.log(req.body);
    
    // Check for missing fields
    if (!userName || !emailId || !password || !req.file) {
      return res.status(400).json({ errorMessage: "username, emailId, password, and profileImage are mandatory" });
    }

    const userResponse = await UserCreds.findOne({ emailId });
    if (userResponse) {
      return res.status(400).json({ errorMessage: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await UserCreds.create({
      userName,
      emailId,
      password: hashedPassword,
      profileImage: req.file.buffer,
      imageType: req.file.mimetype,
    });

    res.status(201).json({message:"Registration Successful"})
  } catch (err) {
    res.status(500).send("Error in registering user: " + err.message);
  }
});

app.post("/login", async (req, res) => {
  
  try {
    const { emailId, password } = req?.body;
    console.log("login", req?.body);
    if (!emailId || !password)
    {
      res.status(400).json({ errorMesaage: "EmailId and password are mandatory" });
    }
    else {
      const userResponse = await UserCreds.findOne({ emailId });
      if (userResponse && await bcrypt.compare(password, userResponse.password)) {
        res.status(200).json({
          message: "Successfully logged in",
          Role:userResponse?.userRole
        })
      }
    }
  }
  catch (error)
  {
    res.status(500).send("Error in logining user: " + error?.message);
  }
});
app.get("/getProfileImage/:userId", async (req, res) => {
  try {
    const user = await UserCreds.findById(req.params.userId);

    if (!user || !user.profileImage) {
      return res.status(404).send("Image not found");
    }

    res.contentType(user.imageType); // Set the correct content type for the image
    res.send(user.profileImage); // Send the binary image data
  } catch (err) {
    res.status(500).send("Error retrieving image: " + err.message);
  }
});

app.get("/userDetails", async (req, res) => {
  try {
    const userDatas = await UserCreds.find({ userRole: "user" });
    if (userDatas.length > 0) {
      const userDetailsWithImageLinks = userDatas.map(user => ({
        _id: user._id,
        userName: user?.userName,
        emailId:user?.emailId,
        block: user?.block,
        totalMatches: user?.TotalMatches,
        win: user?.win,
        lost:user?.lost,
        imageUrl: `/getProfileImage/${user._id}` // Return a URL to fetch the image
      }));

      res.status(200).json({
        data: userDetailsWithImageLinks
      });
    } else {
      res.status(200).json({ message: "No user data exists" });
    }
  } catch (error) {
    res.status(500).json({
      errorMessage: "Error in getting the data",
      reason: error?.message
    });
  }
});
app.patch('/updateBlock', async (req, res) => {
  const { userId, block } = req.body;
  try {
    await UserCreds.updateOne({_id: userId}, { $set: { block } });
      res.status(200).json({ message: 'Block status updated' });
  } catch (error) {
      res.status(500).json({ message: 'Error updating block status', error });
  }
});

const server = app.listen(PORT);
const io = new Server(server);

let room = [];

io.on("connection", (socket) => {
  console.log("client connected");

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });

  socket.on("createRoom", (roomID) => {
    room[roomID] = { p1Choice: null };
    room[roomID] = { p1Score: 0 };
    socket.join(roomID);
    socket.to(roomID).emit("playersConnected", { roomID: roomID });
  });

  socket.on("joinRoom", (roomID) => {
    if (!io.sockets.adapter.rooms.has(roomID)) {
      return socket.emit("Not a ValidToken");
    }

    const roomSize = io.sockets.adapter.rooms.get(roomID).size;
    if (roomSize > 1) {
      return socket.emit("roomFull");
    }

    if (io.sockets.adapter.rooms.has(roomID)) {
      socket.join(roomID);
      room[roomID] = { p2Choice: null };

      socket.to(roomID).emit("playersConnected");
      return socket.emit("playersConnected");
    }
  });

  socket.on("p1Choice", (data) => {
    if (data) {
      const choice = data.rpschoice;
      const roomID = data.roomID;
      room[roomID].p1Choice = choice;
      socket
        .to(roomID)
        .emit("p1Choice", { rpsValue: choice, score: room[roomID].p1Score });
      if (room[roomID].p2Choice) {
        return declareWinner(roomID);
      }
    }
  });

  socket.on("p2Choice", (data) => {
    if (data) {
      const choice = data.rpschoice;
      const roomID = data.roomID;
      room[roomID].p2Choice = choice;
      socket
        .to(roomID)
        .emit("p2Choice", { rpsValue: choice, score: room[roomID].p2Score });
      if (room[roomID].p1Choice) {
        return declareWinner(roomID);
      }
    }
  });

  socket.on("playerClicked", (data) => {
    const roomID = data.roomID;
    room[roomID].p1Choice = null;
    return socket.to(roomID).emit("playAgain");
  });

  socket.on("exitGame", (data) => {
    const roomID = data.roomID;
    if (data.player) {
      socket.to(roomID).emit("player1Left");
    } else {
      socket.to(roomID).emit("player2Left");
    }
    return socket.leave(roomID);
  });
});

const declareWinner = (roomID) => {
  let winner;
  if (room[roomID].p1Choice == room[roomID].p2Choice) {
    winner = "draw";
  } else if (room[roomID].p1Choice == "rock") {
    if (room[roomID].p2Choice == "scissor") {
      winner = "p1";
    } else {
      winner = "p2";
    }
  } else if (room[roomID].p1Choice == "paper") {
    if (room[roomID].p2Choice == "scissor") {
      winner = "p2";
    } else {
      winner = "p1";
    }
  } else if (room[roomID].p1Choice == "scissor") {
    if (room[roomID].p2Choice == "rock") {
      winner = "p2";
    } else {
      winner = "p1";
    }
  }
  return io.sockets.to(roomID).emit("winner", winner);
};
