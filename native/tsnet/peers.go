package tsnetbridge

import (
	"encoding/json"

	"tailscale.com/ipn/ipnstate"
)

type peerInfo struct {
	Name string `json:"name"`
	IP   string `json:"ip"`
}

// peersJSON lists the online devices of the tailnet (name and IPv4 address), as a JSON array.
func peersJSON(st *ipnstate.Status) string {
	out := []peerInfo{}
	if st != nil {
		for _, p := range st.Peer {
			if p == nil || !p.Online {
				continue
			}
			for _, a := range p.TailscaleIPs {
				if a.Is4() {
					out = append(out, peerInfo{Name: p.HostName, IP: a.String()})
					break
				}
			}
		}
	}
	b, err := json.Marshal(out)
	if err != nil {
		return "[]"
	}
	return string(b)
}

// Peers returns the online devices of the tailnet as JSON: [{"name":"...","ip":"100.x.y.z"}].
// Used to find the computer when pairing with a code. Empty list until the node is connected.
func Peers() string {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.peers == "" {
		return "[]"
	}
	return g.peers
}
