package tsnetbridge

import (
	"encoding/json"
	"net"
	"sync/atomic"

	"tailscale.com/net/netmon"
)

var ifaceJSON atomic.Value // string

type jsIface struct {
	Name      string   `json:"name"`
	Index     int      `json:"index"`
	MTU       int      `json:"mtu"`
	Up        bool     `json:"up"`
	Loopback  bool     `json:"loopback"`
	P2P       bool     `json:"p2p"`
	Multicast bool     `json:"multicast"`
	Addrs     []string `json:"addrs"` // "ip/prefix"
}

func SetInterfaces(js string) { ifaceJSON.Store(js) }

func init() { netmon.RegisterInterfaceGetter(interfaces) }

func interfaces() ([]netmon.Interface, error) {
	js, _ := ifaceJSON.Load().(string)
	if js == "" {
		return nil, nil
	}
	var in []jsIface
	if err := json.Unmarshal([]byte(js), &in); err != nil {
		return nil, err
	}
	out := make([]netmon.Interface, 0, len(in))
	for _, i := range in {
		var fl net.Flags
		if i.Up {
			fl |= net.FlagUp | net.FlagRunning
		}
		if i.Loopback {
			fl |= net.FlagLoopback
		}
		if i.P2P {
			fl |= net.FlagPointToPoint
		}
		if i.Multicast {
			fl |= net.FlagMulticast
		}
		addrs := []net.Addr{}
		for _, a := range i.Addrs {
			if ip, n, err := net.ParseCIDR(a); err == nil {
				addrs = append(addrs, &net.IPNet{IP: ip, Mask: n.Mask})
			}
		}
		out = append(out, netmon.Interface{Interface: &net.Interface{Index: i.Index, MTU: i.MTU, Name: i.Name, Flags: fl}, AltAddrs: addrs})
	}
	return out, nil
}
