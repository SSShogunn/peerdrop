import { createContext } from "react";
import { type PeerContextValue } from "../types";

export const PeerContext = createContext<PeerContextValue | null>(null);
