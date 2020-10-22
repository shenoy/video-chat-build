const express = require("express");
const http = require("http");
const app = express();
const path = require("path");
const server = http.createServer(app);
const socket = require("socket.io");
const io = socket(server);

app.use(express.static(path.join(__dirname, "build")));

var users = {};
var sockets = {};
var freeUser;

io.on("connection", (socket) => {
  if (!users[socket.id]) {
    sockets[socket.id] = socket;
    users[socket.id] = { connectedTo: -1, previous: -1 };
    console.log(socket.id, "  just connected");
  }

  socket.emit("yourID", socket.id);

  randomMatch();

  function randomMatch() {
    let numUsers = Object.keys(users).length;
    if (numUsers > 1) {
      freeUser = findFreeUser(users);
      console.log("FREE USER ID-->", freeUser);
      if (freeUser) {
        users[socket.id].connectedTo = freeUser;
        users[freeUser].connectedTo = socket.id;
        socket.emit("other user", freeUser);
        sockets[freeUser].emit("other user", socket.id);
      }
    }
  }

  function conditionalMatch(socketid) {
    console.log("ENTERED CONDITONAL MATCH WITH ID ", socketid);
    let numUsers = Object.keys(users).length;
    if (numUsers > 1) {
      let freeUser = Object.entries(users).filter(
        (x) => x[0] !== users[socketid].previous && x[0] !== socketid
      )[0][0];
      console.log("FREE USER-->", freeUser);
      users[socketid].connectedTo = freeUser;
      users[freeUser].connectedTo = socketid;
      console.log("USERS AFTER SETTING CONNECTEDTO--->", users);
    }
  }

  function fixMatches() {
    //FIND LESS THAN ONE IN CONNECTEDTO
    connectionsArray = Object.entries(users).map((x) => x[1].connectedTo);
    console.log(connectionsArray);
    let keysArray = Object.keys(users);
    console.log(keysArray);
    unconnectedUser = keysArray.filter(
      (x) => connectionsArray.indexOf(x) < 0
    )[0];
    console.log("UNCONNECTED USER", unconnectedUser);
    //FIND THE ONE CONNECTED TO THE LESS THAN ONE CONNECTED TO
    if(unconnectedUser) {
      unconnectedUserEntry = Object.entries(users).filter(
        (x) => x[0] === unconnectedUser
      );
      incorrectUser = unconnectedUserEntry.flat()[1].connectedTo;
      //FIX THE CONNECTION OF THE CONNECTED TO
      users[incorrectUser].connectedTo = unconnectedUser;

      console.log("FIXED CONNECTIONS", users);
    }
  }

  io.sockets.emit("allUsers", users);

  socket.on("offer", (payload) => {
    io.to(payload.target).emit("offer", payload);
  });

  socket.on("answer", (payload) => {
    io.to(payload.target).emit("answer", payload);
  });

  socket.on("ice-candidate", (incoming) => {
    io.to(incoming.target).emit("ice-candidate", incoming.candidate);
  });

  socket.on("disconnect", () => {
    socket.emit("user left");

    console.log(socket.id, "Disconnected from server");

    var connTo = users[socket.id].connectedTo;
    if (sockets[connTo]) {
      users[connTo].connectedTo = -1;
      sockets[connTo].emit("user left");
    }
    delete users[socket.id];
    delete sockets[socket];
  io.sockets.emit("allUsers", users);


    console.log(
      "USERS",
      users,
      "NUMBER OF USERS ---->",
      Object.keys(users).length
    );
    console.log("==================================");
  });

  socket.on("next", () => {
    //=======================================================
    console.log("===========ON NEXT==============");
    console.log(socket.id, "<----Peer clicked next");
    console.log("USERS AFTER NEXT CLICKED--->", users);
    //=======================================================
    let connTo = users[socket.id].connectedTo;
    users[connTo].connectedTo = -1;
    users[connTo].previous = socket.id;
    sockets[connTo].emit("next user");
    users[socket.id].previous = connTo;
    users[socket.id].connectedTo = -1;
    console.log("SETTING USERS CONNECTED TO -1-->", users);
    socket.emit("next user");
    let unconnectedUsers = Object.entries(users).filter(
      (x) => x[1].connectedTo === -1
    );
    console.log("UNCONNECTED USERS---->", unconnectedUsers);
    unconnectedUsers.forEach((x) => conditionalMatch(x[0]));
    // fixMatches(); 
    io.sockets.emit("allUsers", users);

    //========================================================

    console.log("===========END OF ON NEXT===============");
    //=========================================================
  });

  function findFreeUser(users) {
    var freeUsers = Object.entries(users).filter(
      (x) => x[0] !== socket.id && x[1].connectedTo === -1
    );
    console.log("USERS IN FREE USER FUNCTION", users);
    console.log("FREEUSERS-->", freeUsers);
    var randomNumber = parseInt(Math.random() * freeUsers.length);
    console.log("RANDOM NUMBER....--->", randomNumber);
    if (freeUsers.length > 0) var randomFreeUser = freeUsers[randomNumber];
    console.log("FREEUSER RANDOM---->", randomFreeUser);
    if (randomFreeUser) return randomFreeUser[0];
    else return 0;
  }

  console.log(
    "USERS---->",
    users,
    "NUMBER OF USERS ---->",
    Object.keys(users).length
  );
});

app.get("*", function (req, res) {
  const index = path.join(__dirname, "build", "index.html");
  res.sendFile(index);
});

const port = process.env.PORT || 3000;

server.listen(port, () =>
  console.log(`Example app listening at http://localhost:${port}`)
);
