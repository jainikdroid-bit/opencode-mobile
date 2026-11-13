package tsnetbridge

import (
	"net"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"tailscale.com/net/tshttpproxy"
)

var (
	pmu       sync.Mutex
	pAt       time.Time
	pURL      *url.URL
	pSocks    bool
	httpPort  = 10809
	socksPort = 10808
	proxyOnce sync.Once
	proxyLogf func(string, ...any)
)

func SetProxyPorts(httpP, socksP int) {
	pmu.Lock()
	httpPort, socksPort, pAt = httpP, socksP, time.Time{}
	pmu.Unlock()
}

func portOpen(p int) bool {
	if p <= 0 {
		return false
	}
	c, err := net.DialTimeout("tcp", "127.0.0.1:"+strconv.Itoa(p), 300*time.Millisecond)
	if err != nil {
		return false
	}
	c.Close()
	return true
}

func localProxy() (*url.URL, bool) {
	pmu.Lock()
	defer pmu.Unlock()
	if !pAt.IsZero() && time.Since(pAt) < 5*time.Second {
		return pURL, pSocks
	}
	var u *url.URL
	socks := false
	if portOpen(httpPort) {
		u = &url.URL{Scheme: "http", Host: "127.0.0.1:" + strconv.Itoa(httpPort)}
	} else if portOpen(socksPort) {
		u, socks = &url.URL{Scheme: "socks5", Host: "127.0.0.1:" + strconv.Itoa(socksPort)}, true
	}
	if (u == nil) != (pURL == nil) || (u != nil && u.String() != pURL.String()) {
		if proxyLogf != nil {
			if u == nil {
				proxyLogf("local proxy: none, direct")
			} else {
				proxyLogf("local proxy: %s", u)
			}
		}
	}
	pURL, pSocks, pAt = u, socks, time.Now()
	return u, socks
}

func controlHost(h string) bool {
	switch strings.ToLower(h) {
	case "controlplane.tailscale.com", "login.tailscale.com", "log.tailscale.com", "log.tailscale.io":
		return true
	}
	return false
}

func proxyFor(u *url.URL) (*url.URL, error) {
	h := u.Hostname()
	if h == "" || strings.EqualFold(h, "localhost") {
		return nil, nil
	}
	if ip := net.ParseIP(h); ip != nil && (ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast()) {
		return nil, nil
	}
	p, socks := localProxy()
	if p == nil || (socks && !controlHost(h)) {
		return nil, nil
	}
	return p, nil
}

func installProxy(logf func(string, ...any)) {
	proxyOnce.Do(func() {
		proxyLogf = logf
		if err := tshttpproxy.SetProxyFunc(proxyFor); err != nil {
			logf("local proxy: %v", err)
		}
	})
}
