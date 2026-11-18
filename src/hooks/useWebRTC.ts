"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PeerInfo, SignalMessage } from "@/lib/types";

export interface RemotePeer {
  info: PeerInfo;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState | "new";
  dataChannelOpen: boolean;
  latencyMs: number;
}

export interface UseWebRTCOptions {
  roomCode: string | null;
  selfId: string;
  selfName: string;
  isHost: boolean;
  localStream: MediaStream | null;
  sendSignal: (message: SignalMessage) => void;
  subscribe: (handler: (message: SignalMessage) => void) => () => void;
  maxParticipants: number;
  onDataMessage: (peerId: string, data: ArrayBuffer | string) => void;
  onPeerOpen: (peerId: string, channel: RTCDataChannel) => void;
  onPeerClosed: (peerId: string) => void;
}

export interface UseWebRTC {
  peers: RemotePeer[];
  hostId: string | null;
  sendTo: (peerId: string, data: ArrayBuffer | string) => boolean;
  broadcastData: (data: ArrayBuffer | string) => number;
  replaceVideoTrack: (track: MediaStreamTrack | null) => Promise<void>;
  isFull: boolean;
  setSelfName: (name: string) => void;
}

function iceServers(): RTCIceServer[] {
  const stun = (process.env.NEXT_PUBLIC_STUN_URLS ?? "stun:stun.l.google.com:19302")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  const servers: RTCIceServer[] = stun.map((urls) => ({ urls }));
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}

/**
 * Full mesh WebRTC: every participant holds one RTCPeerConnection per peer.
 * Host is authoritative: it creates the offer once it learns a guest joined,
 * every guest answers. Media is bidirectional (remote previews + local
 * monitoring) while the data channel carries signals, clock ping/pong and raw
 * high-resolution captures.
 */
export function useWebRTC(options: UseWebRTCOptions): UseWebRTC {
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [isFull, setIsFull] = useState(false);

  const connections = useRef(new Map<string, RTCPeerConnection>());
  const channels = useRef(new Map<string, RTCDataChannel>());
  const names = useRef(new Map<string, { name: string; isHost: boolean; mirrored: boolean }>());
  const localStreamRef = useRef<MediaStream | null>(options.localStream);
  /** Stable join timestamp so every client derives the same slot ordering. */
  const selfJoinedAt = useRef(Date.now());
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const upsertPeer = useCallback((peerId: string) => {
    setPeers((previous) => {
      const existing = previous.find((peer) => peer.info.peerId === peerId);
      const meta = names.current.get(peerId);
      if (existing) return previous;
      return [
        ...previous,
        {
          info: {
            peerId,
            name: meta?.name ?? "Tamu",
            isHost: meta?.isHost ?? false,
            mirrored: meta?.mirrored ?? false,
            joinedAt: Date.now(),
          },
          stream: null,
          connectionState: "new",
          dataChannelOpen: false,
          latencyMs: 0,
        },
      ];
    });
  }, []);

  const patchPeer = useCallback((peerId: string, patch: Partial<RemotePeer>) => {
    setPeers((previous) =>
      previous.map((peer) => (peer.info.peerId === peerId ? { ...peer, ...patch } : peer)),
    );
  }, []);

  const markChannelOpen = useCallback((peerId: string, open: boolean) => {
    setPeers((previous) =>
      previous.map((peer) =>
        peer.info.peerId === peerId
          ? { ...peer, dataChannelOpen: open, connectionState: open ? "connected" : peer.connectionState }
          : peer,
      ),
    );
  }, []);

  const attachChannel = useCallback(
    (peerId: string, channel: RTCDataChannel) => {
      channels.current.set(peerId, channel);
      channel.binaryType = "arraybuffer";
      channel.onopen = () => {
        markChannelOpen(peerId, true);
        optionsRef.current.onPeerOpen(peerId, channel);
      };
      channel.onclose = () => {
        markChannelOpen(peerId, false);
        optionsRef.current.onPeerClosed(peerId);
      };
      channel.onmessage = (event: MessageEvent<ArrayBuffer | string>) => {
        optionsRef.current.onDataMessage(peerId, event.data);
      };
      channel.onerror = () => {
        markChannelOpen(peerId, false);
      };
    },
    [markChannelOpen],
  );

  const createConnection = useCallback(
    (peerId: string, initiator: boolean) => {
      const existing = connections.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: iceServers(), bundlePolicy: "max-bundle" });
      connections.current.set(peerId, pc);

      const stream = localStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream);
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          optionsRef.current.sendSignal({
            t: "ice",
            from: optionsRef.current.selfId,
            to: peerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        const [remote] = event.streams;
        if (remote) {
          patchPeer(peerId, { stream: remote });
        } else {
          const fallback = new MediaStream([event.track]);
          patchPeer(peerId, { stream: fallback });
        }
      };

      pc.onconnectionstatechange = () => {
        patchPeer(peerId, { connectionState: pc.connectionState });
        if (pc.connectionState === "failed") {
          try {
            pc.restartIce();
          } catch {
            /* ignore */
          }
        }
      };

      if (initiator) {
        const channel = pc.createDataChannel("pb-data", { ordered: true });
        attachChannel(peerId, channel);
        void (async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          optionsRef.current.sendSignal({
            t: "offer",
            from: optionsRef.current.selfId,
            to: peerId,
            sdp: offer,
          });
        })();
      } else {
        pc.ondatachannel = (event) => {
          attachChannel(peerId, event.channel);
        };
      }

      upsertPeer(peerId);
      return pc;
    },
    [attachChannel, patchPeer, upsertPeer],
  );

  const sendTo = useCallback((peerId: string, data: ArrayBuffer | string) => {
    const channel = channels.current.get(peerId);
    if (!channel || channel.readyState !== "open") return false;
    try {
      channel.send(data as never);
      return true;
    } catch {
      return false;
    }
  }, []);

  const broadcastData = useCallback((data: ArrayBuffer | string) => {
    let sent = 0;
    for (const channel of channels.current.values()) {
      if (channel.readyState !== "open") continue;
      try {
        channel.send(data as never);
        sent += 1;
      } catch {
        /* ignore */
      }
    }
    return sent;
  }, []);

  const replaceVideoTrack = useCallback(async (track: MediaStreamTrack | null) => {
    for (const pc of connections.current.values()) {
      const sender = pc.getSenders().find((item) => item.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(track);
      } else if (track) {
        const stream = localStreamRef.current;
        pc.addTrack(track, stream ?? new MediaStream([track]));
      }
    }
  }, []);

  useEffect(() => {
    localStreamRef.current = options.localStream;
    if (options.localStream) {
      void replaceVideoTrack(options.localStream.getVideoTracks()[0] ?? null);
    }
  }, [options.localStream, replaceVideoTrack]);

  // signalling message router
  useEffect(() => {
    if (!options.roomCode) return;
    const unsubscribe = options.subscribe((message) => {
      const selfId = optionsRef.current.selfId;

      switch (message.t) {
        case "hello": {
          names.current.set(message.peer.peerId, {
            name: message.peer.name,
            isHost: message.peer.isHost,
            mirrored: message.peer.mirrored,
          });
          setPeers((previous) => {
            const exists = previous.some((peer) => peer.info.peerId === message.peer.peerId);
            return exists
              ? previous.map((peer) =>
                  peer.info.peerId === message.peer.peerId
                    ? {
                        ...peer,
                        info: { ...peer.info, ...message.peer, joinedAt: peer.info.joinedAt },
                      }
                    : peer,
                )
              : [
                  ...previous,
                  {
                    info: message.peer,
                    stream: null,
                    connectionState: "new" as const,
                    dataChannelOpen: false,
                    latencyMs: 0,
                  },
                ];
          });
          if (message.peer.isHost) setHostId(message.peer.peerId);

          if (selfId !== message.peer.peerId) {
            const capacity = optionsRef.current.maxParticipants;
            const peerCount = connections.current.size + 1;
            if (optionsRef.current.isHost && peerCount > capacity) {
              optionsRef.current.sendSignal({ t: "full", to: message.peer.peerId, capacity });
              return;
            }
            if (optionsRef.current.isHost) {
              createConnection(message.peer.peerId, true);
              optionsRef.current.sendSignal({
                t: "welcome",
                peer: {
                  peerId: selfId,
                  name: optionsRef.current.selfName,
                  isHost: true,
                  mirrored: false,
                  joinedAt: selfJoinedAt.current,
                },
              });
            }
          }
          break;
        }

        case "welcome": {
          names.current.set(message.peer.peerId, {
            name: message.peer.name,
            isHost: message.peer.isHost,
            mirrored: message.peer.mirrored,
          });
          if (message.peer.isHost) setHostId(message.peer.peerId);
          setPeers((previous) =>
            previous.some((peer) => peer.info.peerId === message.peer.peerId)
              ? previous.map((peer) =>
                  peer.info.peerId === message.peer.peerId
                    ? {
                        ...peer,
                        info: { ...peer.info, ...message.peer, joinedAt: peer.info.joinedAt },
                      }
                    : peer,
                )
              : [
                  ...previous,
                  {
                    info: message.peer,
                    stream: null,
                    connectionState: "new" as const,
                    dataChannelOpen: false,
                    latencyMs: 0,
                  },
                ],
          );
          break;
        }

        case "full": {
          if (message.to === selfId) setIsFull(true);
          break;
        }

        case "offer": {
          if (message.to !== selfId) break;
          const pc = createConnection(message.from, false);
          void (async () => {
            await pc.setRemoteDescription(message.sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            optionsRef.current.sendSignal({ t: "answer", from: selfId, to: message.from, sdp: answer });
          })();
          break;
        }

        case "answer": {
          if (message.to !== selfId) break;
          const pc = connections.current.get(message.from);
          if (pc) void pc.setRemoteDescription(message.sdp);
          break;
        }

        case "ice": {
          if (message.to !== selfId || !message.candidate) break;
          const pc = connections.current.get(message.from);
          if (pc) {
            void pc.addIceCandidate(message.candidate).catch(() => {
              /* candidate race, safe to ignore */
            });
          }
          break;
        }

        case "peer-left":
        case "bye": {
          const peerId = message.peerId;
          connections.current.get(peerId)?.close();
          connections.current.delete(peerId);
          channels.current.delete(peerId);
          names.current.delete(peerId);
          setPeers((previous) => previous.filter((peer) => peer.info.peerId !== peerId));
          break;
        }

        case "mirror": {
          setPeers((previous) =>
            previous.map((peer) =>
              peer.info.peerId === message.peerId
                ? { ...peer, info: { ...peer.info, mirrored: message.mirrored } }
                : peer,
            ),
          );
          break;
        }

        case "rename": {
          setPeers((previous) =>
            previous.map((peer) =>
              peer.info.peerId === message.peerId ? { ...peer, info: { ...peer.info, name: message.name } } : peer,
            ),
          );
          break;
        }

        default:
          break;
      }
    });

    return () => unsubscribe();
  }, [createConnection, options.roomCode, options.subscribe]);

  // announce presence
  useEffect(() => {
    if (!options.roomCode) return;
    const announce = () => {
      options.sendSignal({
        t: "hello",
        peer: {
          peerId: options.selfId,
          name: options.selfName,
          isHost: options.isHost,
          mirrored: false,
          joinedAt: selfJoinedAt.current,
        },
      });
    };
    announce();
    const timer = window.setInterval(announce, 4000);
    return () => window.clearInterval(timer);
  }, [options.roomCode, options.selfId, options.selfName, options.isHost, options.sendSignal]);

  useEffect(() => {
    const conns = connections.current;
    const chans = channels.current;
    return () => {
      for (const channel of chans.values()) channel.close();
      for (const pc of conns.values()) pc.close();
      chans.clear();
      conns.clear();
    };
  }, []);

  const setSelfName = useCallback((name: string) => {
    optionsRef.current.sendSignal({
      t: "rename",
      peerId: optionsRef.current.selfId,
      name,
    });
  }, []);

  return useMemo(
    () => ({ peers, hostId, sendTo, broadcastData, replaceVideoTrack, isFull, setSelfName }),
    [peers, hostId, sendTo, broadcastData, replaceVideoTrack, isFull, setSelfName],
  );
}
