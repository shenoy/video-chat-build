import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";
import styled from "styled-components";
import logo from "./logo.gif";

import { createGlobalStyle } from "styled-components";
const GlobalStyles = createGlobalStyle`
 
  @import url('https://fonts.googleapis.com/css2?family=Ranchers&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Open+Sans+Condensed:wght@300;700&display=swap');

  body {
    font-family: 'Ranchers', cursive;
    color:aquamarine;
      text-shadow: 2px 2px grey;
      font-size:3rem;
      font-weight:700;
  } 

 
`;

const Container = styled.div`
  min-height: 100%;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  display: block;
`;

const Row = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  font-family: "Open Sans Condensed", sans-serif;
  width: 100%;
  text-align: center;
  margin-bottom: 0;
`;

const Video = styled.video`
  width: 50%;
  height: 50%;
  border: 1px solid grey;
  border-radius: 10px;
  margin-right: 20px;
  margin-left: 20px;
  margin-top: 20px;
`;
const Button = styled.button`
  background-color: aquamarine;
  color: grey;
  border-radius: 15px;
  height: 60px;
  width: 120px;
  margin-top: 10px;
  font-family: "Open Sans Condensed", sans-serif;
  font-size: 2rem;
`;

const Logo = styled.img`
  width: 80px;
  height: 60px;
`;

function App() {
  const [yourID, setYourID] = useState();
  const [users, setUsers] = useState({});
  const [receivingCall, setReceivingCall] = useState(false);
  const [stream, setStream] = useState();
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const userVideo = useRef();
  const partnerVideo = useRef();
  const peerRef = useRef();
  const socket = useRef();
  const otherUser = useRef();
  const userStream = useRef();

  const stun_turn = {};

  useEffect(() => {
    console.log("IN USE EFFECT");

    socket.current = io.connect("/");
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        setStream(stream);
        if (userVideo.current) {
          userVideo.current.srcObject = stream;
          userStream.current = stream;
        }
      });

    socket.current.on("yourID", (id) => {
      setYourID(id);
      console.log("YOUR ID--->", id);
    });
    socket.current.on("allUsers", (users) => {
      setUsers(users);
      console.log("ALL USERS", users);
    });

    socket.current.on("other user", (otherUserId) => {
      otherUser.current = otherUserId;
      console.log("OTHER USER ---> ", otherUserId);
    });

    socket.current.on("offer", handleReceiveCall);

    socket.current.on("answer", handleAnswer);

    socket.current.on("ice-candidate", handleNewICECandidateMsg);

    socket.current.on("user left", () => {
      setReceivingCall(false);
      setCaller("");
      setCallAccepted(false);
      peerRef.current.close();
    });

    socket.current.on("next user", () => {
      setReceivingCall(false);
      setCaller("");
      setCallAccepted(false);
      peerRef.current.close();
    });
  }, []);

  function callUser(userID) {
    setCaller(yourID);
    console.log(yourID, "...CALLED ...", otherUser.current);
    peerRef.current = createPeer(userID);
    userStream.current
      .getTracks()
      .forEach((track) => peerRef.current.addTrack(track, userStream.current));
  }

  function createPeer(userID) {
    console.log(
      `NEW PEER CREATED WITH USERID PARAMETER ${userID} BY...`,
      yourID
    );
    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.stunprotocol.org",
        },
        {
          urls: "turn:numb.viagenie.ca",
          credential: "muazkh",
          username: "webrtc@live.com",
        },
      ],
    });
    console.log("PEER ---> ", peer);
    peer.onicecandidate = handleICECandidateEvent;
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

    return peer;
  }

  function handleNegotiationNeededEvent(userID) {
    console.log("IN HANDLE NEGOTIATION NEEDED EVENT");

    peerRef.current
      .createOffer()
      .then((offer) => {
        console.log("OFFER CREATED--->", offer);
        return peerRef.current.setLocalDescription(offer);
      })
      .then(() => {
        const payload = {
          target: userID,
          caller: socket.current.id,
          sdp: peerRef.current.localDescription,
        };
        console.log("PAYLOAD----->", payload);
        socket.current.emit("offer", payload);
      })
      .catch((e) => console.log(e));
  }

  function handleReceiveCall(incoming) {
    console.log(
      "IN HANDLERECEIVECALL.....INCOMING ARGUMENT-->",
      incoming,
      "  INCOMING CALLER ...->",
      incoming.caller
    );
    peerRef.current = createPeer();
    const desc = new RTCSessionDescription(incoming.sdp);
    peerRef.current
      .setRemoteDescription(desc)
      .then(() => {
        userStream.current
          .getTracks()
          .forEach((track) =>
            peerRef.current.addTrack(track, userStream.current)
          );
      })
      .then(() => {
        return peerRef.current.createAnswer();
      })
      .then((answer) => {
        console.log("ANSWER ---> ", answer);
        return peerRef.current.setLocalDescription(answer);
      })
      .then(() => {
        const payload = {
          target: incoming.caller,
          caller: socket.current.id,
          sdp: peerRef.current.localDescription,
        };
        socket.current.emit("answer", payload);

        setReceivingCall(true);
        setCaller(incoming);
        console.log(
          "RECEIVED OFFER. IN HANDLE RECEIVE CALL, ANSWER PAYLOAD--->",
          payload
        );
      });
  }

  function handleAnswer(message) {
    setReceivingCall(true);
    const desc = new RTCSessionDescription(message.sdp);
    peerRef.current.setRemoteDescription(desc).catch((e) => console.log(e));
    console.log(
      "IN HANDLE ANSWER...MESSAGE PARAMETER --->",
      message,
      ".....DESCRIPTION....",
      desc
    );
  }

  function handleICECandidateEvent(e) {
    if (e.candidate) {
      const payload = {
        target: otherUser.current,
        candidate: e.candidate,
      };
      socket.current.emit("ice-candidate", payload);
      console.log("IN HANDLE ICE CANDIDATE.....->", payload);
      console.log("handleicecandidateevent e.....->", e);
    }
  }

  function handleNewICECandidateMsg(incoming) {
    console.log("IN HANDLE NEW ICE CANDIDATE...INCOMING--->", incoming);

    const candidate = new RTCIceCandidate(incoming);
    peerRef.current.addIceCandidate(candidate).catch((e) => console.log(e));
  }

  function handleTrackEvent(e) {
    setCallAccepted(true);
    console.log(
      "IN HANDLE TRACK EVENT..SETTING CALL ACCEPTED TO ..->",
      callAccepted
    );
    console.log("IN HANDLE TRACK EVENT..e ..->", e);
    partnerVideo.current.srcObject = e.streams[0];
  }

  let UserVideo;
  if (stream) {
    console.log("IN USERVIDEO ELEMENT..STREAM IS...--> ", stream);
    UserVideo = <Video playsInline ref={userVideo} autoPlay />;
  }

  let PartnerVideo;
  if (callAccepted) {
    console.log("IN CALL ACCEPTED..---> CALL ACCEPTED IS--->", callAccepted);

    PartnerVideo = <Video playsInline ref={partnerVideo} autoPlay />;
  }

  let incomingCall;
  if (receivingCall) {
    console.log("IN RECEIVING CALL---> RECEIVING CALL VALUE-->", receivingCall);
    incomingCall = <Button onClick={() => next()}>Next</Button>;
  }

  function next() {
    socket.current.emit("next", socket.id);
  }

  return (
    <Container>
      <GlobalStyles />
      <Row>
        <Logo src={logo} />
        Taugle
      </Row>
      <Row>
        {UserVideo}

        {PartnerVideo}
      </Row>

      <Row>
        <Button onClick={() => callUser(users[yourID].connectedTo)}>
          Connect
        </Button>
        &nbsp;{incomingCall}&nbsp;
        {Object.keys(users).length}&nbsp; Users Online
      </Row>
    </Container>
  );
}

export default App;
