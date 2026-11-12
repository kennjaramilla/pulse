"use client";

import { useEffect, useRef, useState } from "react";
import EntryGate from "./components/EntryGate";
import WorldMap from "./components/WorldMap";
import ConnectionPrompt from "./components/ConnectionPrompt";
import ChatPanel, { type ChatMessage } from "./components/ChatPanel";
import VideoPanel from "./components/VideoPanel";
import TopBar from "./components/TopBar";
import Toast from "./components/Toast";
import { VideoIcon } from "./components/icons";
import { dotColor } from "@/lib/color";
import { describeDistance } from "@/lib/geo";
import { join, leave, poll, sendSignal, SessionExpiredError } from "@/lib/api";
import { PeerSession, type DescType, type PeerControl } from "@/lib/webrtc";
import { POLL_INTERVAL_MS } from "@/lib/presence";
import { type PeerDot, type SignalMsg } from "@/lib/types";

type Conn =
  | { kind: "idle" }
  | { kind: "requesting"; peerId: string }
  | { kind: "incoming"; peerId: string }
  | { kind: "connecting"; peerId: string }
  | { kind: "connected"; peerId: string };

type VideoState = "none" | "requesting" | "incoming" | "active";

const REQUEST_TIMEOUT_MS = 30_000;

export default function Home() {
  const [phase, setPhase] = useState<"gate" | "live">("gate");
  const [token, setToken] = useState(""); // secret session token from /api/join
  const [peers, setPeers] = useState<PeerDot[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  const [conn, _setConn] = useState<Conn>({ kind: "idle" });
  const connRef = useRef<Conn>(conn);
  const setConn = (c: Conn) => {
    connRef.current = c;
    _setConn(c);
  };

  const [video, _setVideo] = useState<VideoState>("none");
  const videoRef = useRef<VideoState>(video);
  const setVideo = (v: VideoState) => {
    videoRef.current = v;
    _setVideo(v);
  };

  const peerRef = useRef<PeerSession | null>(null);
  const msgId = useRef(0);
  const requestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 3500);
  }

  function addMessage(mine: boolean, text: string) {
    setMessages((prev) => [...prev, { id: msgId.current++, mine, text }]);
  }

  function teardown(message?: string) {
    if (requestTimer.current) clearTimeout(requestTimer.current);
    peerRef.current?.close();
    peerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
    setMessages([]);
    setConn({ kind: "idle" });
    if (message) showNotice(message);
  }

  function startPeer(peerId: string, initiator: boolean) {
    const ps = new PeerSession(initiator, {
      onSignal: (type: DescType, payload: string) => {
        void sendSignal(token, peerId, type, payload).then((ok) => {
          if (!ok && connRef.current.kind === "connecting") {
            teardown("Couldn't connect. Please try again.");
          }
        });
      },
      onChat: (text) => addMessage(false, text),
      onControl: (ctrl) => handleControl(ctrl),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onConnectionState: (state) => {
        if (state === "failed") {
          void sendSignal(token, peerId, "end");
          teardown("Connection failed (network).");
        }
      },
      onChannelOpen: () => {
        setConn({ kind: "connected", peerId });
      },
      onChannelClose: () => {
        // The stranger closed their tab or lost the connection. Send "end"
        // anyway so the server frees both sides.
        void sendSignal(token, peerId, "end");
        teardown("Stranger disconnected.");
      },
    });
    peerRef.current = ps;
  }

  function handleControl(ctrl: PeerControl) {
    const ps = peerRef.current;
    switch (ctrl) {
      case "video-request":
        if (videoRef.current === "none") setVideo("incoming");
        break;
      case "video-accept":
        if (videoRef.current === "requesting" && ps) {
          ps.startVideo()
            .then((stream) => {
              setLocalStream(stream);
              setVideo("active");
            })
            .catch(() => {
              setVideo("none");
              ps.sendControl("video-end");
              showNotice("Camera unavailable.");
            });
        }
        break;
      case "video-decline":
        if (videoRef.current === "requesting") {
          setVideo("none");
          showNotice("Video declined.");
        }
        break;
      case "video-end":
        ps?.stopVideo();
        setLocalStream(null);
        setRemoteStream(null);
        setVideo("none");
        break;
    }
  }

  function requestConnection(peerId: string) {
    if (connRef.current.kind !== "idle") return;
    setConn({ kind: "requesting", peerId });
    void sendSignal(token, peerId, "request");
    requestTimer.current = setTimeout(() => {
      if (
        connRef.current.kind === "requesting" &&
        connRef.current.peerId === peerId
      ) {
        void sendSignal(token, peerId, "end");
        teardown("No answer.");
      }
    }, REQUEST_TIMEOUT_MS);
  }

  function cancelRequest() {
    if (connRef.current.kind === "requesting") {
      void sendSignal(token, connRef.current.peerId, "end");
    }
    teardown();
  }

  function acceptIncoming() {
    if (connRef.current.kind !== "incoming") return;
    const peerId = connRef.current.peerId;
    startPeer(peerId, false);
    setConn({ kind: "connecting", peerId });
    void sendSignal(token, peerId, "accept").then((ok) => {
      if (!ok && connRef.current.kind === "connecting") {
        teardown("That stranger is no longer available.");
      }
    });
  }

  function declineIncoming() {
    if (connRef.current.kind !== "incoming") return;
    void sendSignal(token, connRef.current.peerId, "decline");
    setConn({ kind: "idle" });
  }

  function endConnection() {
    const c = connRef.current;
    if (c.kind === "connecting" || c.kind === "connected") {
      void sendSignal(token, c.peerId, "end");
    }
    teardown();
  }

  function startVideoRequest() {
    if (videoRef.current !== "none" || !peerRef.current) return;
    setVideo("requesting");
    peerRef.current.sendControl("video-request");
  }

  function acceptVideo() {
    const ps = peerRef.current;
    if (!ps) return;
    ps.startVideo()
      .then((stream) => {
        setLocalStream(stream);
        ps.sendControl("video-accept");
        setVideo("active");
      })
      .catch(() => {
        ps.sendControl("video-decline");
        setVideo("none");
        showNotice("Camera unavailable.");
      });
  }

  function declineVideo() {
    peerRef.current?.sendControl("video-decline");
    setVideo("none");
  }

  function endVideo() {
    const ps = peerRef.current;
    ps?.stopVideo();
    ps?.sendControl("video-end");
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
  }

  function processSignal(sig: SignalMsg) {
    switch (sig.type) {
      case "request": {
        if (connRef.current.kind === "idle") {
          setConn({ kind: "incoming", peerId: sig.fromId });
        } else {
          void sendSignal(token, sig.fromId, "decline");
        }
        break;
      }
      case "accept": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          startPeer(sig.fromId, true);
          setConn({ kind: "connecting", peerId: sig.fromId });
        }
        break;
      }
      case "decline": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          teardown("Request declined.");
        }
        break;
      }
      case "offer":
      case "answer":
      case "ice": {
        const c = connRef.current;
        const peerId =
          c.kind === "connecting" || c.kind === "connected" ? c.peerId : null;
        if (peerRef.current && peerId === sig.fromId) {
          void peerRef.current.handleSignal(
            sig.type as DescType,
            sig.payload ?? "",
          );
        }
        break;
      }
      case "end": {
        const c = connRef.current;
        if (
          (c.kind === "incoming" ||
            c.kind === "connecting" ||
            c.kind === "connected") &&
          c.peerId === sig.fromId
        ) {
          if (c.kind === "incoming") setConn({ kind: "idle" });
          else teardown("Stranger disconnected.");
        }
        break;
      }
    }
  }

  // The server forgot us (e.g. the tab was asleep longer than STALE_MS).
  // Go back to the entry screen so the user can rejoin with a new session.
  function expireSession() {
    teardown();
    setToken("");
    setPhase("gate");
  }

  const processSignalRef = useRef(processSignal);
  const expireSessionRef = useRef(expireSession);
  useEffect(() => {
    processSignalRef.current = processSignal;
    expireSessionRef.current = expireSession;
  });

  useEffect(() => {
    if (phase !== "live" || !token) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const data = await poll(token);
        if (!active) return;
        setPeers(data.peers);
        for (const s of data.signals) processSignalRef.current(s);
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          expireSessionRef.current();
          return;
        }
      }
      if (active) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [phase, token]);

  useEffect(() => {
    if (!token || phase !== "live") return;
    // The server tells whoever we were talking to.
    const onLeave = () => leave(token);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [token, phase]);

  async function handleReady(lat: number, lng: number) {
    setToken(await join(lat, lng));
    setMyLocation({ lat, lng });
    setPhase("live");
  }

  const inChat = conn.kind === "connecting" || conn.kind === "connected";
  // Who we're dealing with right now, for colours and "about 300 km away".
  const peerId = conn.kind === "idle" ? null : conn.peerId;
  const peer = peers.find((p) => p.id === peerId);
  const peerColor = peerId ? dotColor(peerId) : undefined;
  const peerDistance = peer && myLocation ? describeDistance(myLocation, peer) : undefined;

  return (
    <main className="fixed inset-0 overflow-hidden">
      <WorldMap
        peers={peers}
        me={myLocation}
        onPeerClick={requestConnection}
        canConnect={conn.kind === "idle"}
        spinning={phase === "gate"}
      />

      {phase === "gate" ? (
        <EntryGate onReady={handleReady} />
      ) : (
        <TopBar online={peers.length} />
      )}

      {notice && <Toast>{notice}</Toast>}

      {conn.kind === "requesting" && (
        <Toast>
          <span className="size-2 animate-ping rounded-full" style={{ background: peerColor }} />
          <span>Waiting for them to answer…</span>
          <button
            onClick={cancelRequest}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium hover:bg-white/20"
          >
            Cancel
          </button>
        </Toast>
      )}

      {conn.kind === "incoming" && (
        <ConnectionPrompt
          title="Someone wants to talk"
          subtitle={peerDistance}
          color={peerColor}
          icon={<span className="text-2xl">👋</span>}
          acceptLabel="Accept"
          declineLabel="Decline"
          onAccept={acceptIncoming}
          onDecline={declineIncoming}
        />
      )}

      {inChat && (
        <ChatPanel
          messages={messages}
          connected={conn.kind === "connected"}
          videoBusy={video !== "none"}
          onSend={(text) => {
            peerRef.current?.sendChat(text);
            addMessage(true, text);
          }}
          onStartVideo={startVideoRequest}
          onEnd={endConnection}
        />
      )}

      {video === "requesting" && <Toast>Waiting for them to turn on video…</Toast>}

      {video === "incoming" && (
        <ConnectionPrompt
          title="Turn on video?"
          subtitle="They'd like to see each other. Your camera stays off unless you accept."
          color={peerColor}
          icon={<VideoIcon className="size-6" />}
          acceptLabel="Accept"
          declineLabel="Decline"
          onAccept={acceptVideo}
          onDecline={declineVideo}
        />
      )}

      {video === "active" && (
        <VideoPanel
          localStream={localStream}
          remoteStream={remoteStream}
          onEnd={endVideo}
        />
      )}
    </main>
  );
}
