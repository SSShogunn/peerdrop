import { useContext } from "react";
import { PeerContext } from "./peer-context-instance";

export function usePeer() {
  const ctx = useContext(PeerContext);
  if (ctx === null) {
    throw new Error("usePeer must be used inside PeerProvider");
  }
  return ctx;
}
