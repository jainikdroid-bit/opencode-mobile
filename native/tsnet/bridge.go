// Package tsnetbridge: userspace Tailscale (tsnet) inside the app, no system VPN slot needed.
// The app reaches the computer through a local forward 127.0.0.1:<port> -> <tailnet host>:<port>.
package tsnetbridge

import (
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"runtime/debug"
	"sync"
	"time"

	"tailscale.com/ipn"
	"tailscale.com/tsnet"
)

type state struct {
	mu      sync.Mutex
	srv     *tsnet.Server
	authURL string
	ready   bool
	ip      string
	lastErr string
	fwds    []net.Listener
}

var g = &state{}

func setErr(e string) { g.mu.Lock(); g.lastErr = e; g.mu.Unlock() }

func Start(stateDir, hostname string) error { return StartWithKey(stateDir, hostname, "") }

func StartWithKey(stateDir, hostname, authKey string) error {
	g.mu.Lock()
	if g.srv != nil {
		g.mu.Unlock()
		return nil
	}
	if err := os.MkdirAll(stateDir, 0o700); err != nil {
		g.mu.Unlock()
		return err
	}
	tmp := filepath.Join(stateDir, "tmp")
	os.MkdirAll(tmp, 0o700)
	for k, v := range map[string]string{"HOME": stateDir, "TMPDIR": tmp, "XDG_CACHE_HOME": filepath.Join(stateDir, "cache"), "XDG_CONFIG_HOME": filepath.Join(stateDir, "config"), "TS_NO_LOGS_NO_SUPPORT": "true"} {
		if os.Getenv(k) == "" || k == "TS_NO_LOGS_NO_SUPPORT" {
			os.Setenv(k, v)
		}
	}
	if f, err := os.OpenFile(filepath.Join(stateDir, "crash.txt"), os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600); err == nil {
		debug.SetCrashOutput(f, debug.CrashOptions{})
		f.Close()
	}
	lf := logTo(stateDir)
	installProxy(lf)
	lf("start %s (interfaces from app: %v)", hostname, ifaceJSON.Load() != nil)
	s := &tsnet.Server{Dir: stateDir, Hostname: hostname, AuthKey: authKey, Ephemeral: false, Logf: lf, UserLogf: lf}
	g.srv, g.ready, g.authURL, g.lastErr = s, false, "", ""
	g.mu.Unlock()
	go watch(s)
	return nil
}

func watch(s *tsnet.Server) {
	if err := s.Start(); err != nil {
		s.Logf("Start: %v", err)
		setErr(err.Error())
		return
	}
	lc, err := s.LocalClient()
	if err != nil {
		setErr(err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	if _, err := lc.EditPrefs(ctx, &ipn.MaskedPrefs{Prefs: ipn.Prefs{RouteAll: true}, RouteAllSet: true}); err != nil {
		setErr("routes: " + err.Error())
	}
	cancel()
	for {
		g.mu.Lock()
		cur := g.srv
		g.mu.Unlock()
		if cur != s {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		st, err := lc.Status(ctx)
		cancel()
		g.mu.Lock()
		if err != nil {
			g.lastErr = err.Error()
		} else {
			g.authURL = st.AuthURL
			g.ready = st.BackendState == ipn.Running.String()
			if len(st.TailscaleIPs) > 0 {
				g.ip = st.TailscaleIPs[0].String()
			}
			if g.ready {
				g.lastErr = ""
			}
		}
		g.mu.Unlock()
		time.Sleep(time.Second)
	}
}

func AuthURL() string   { g.mu.Lock(); defer g.mu.Unlock(); return g.authURL }
func Ready() bool       { g.mu.Lock(); defer g.mu.Unlock(); return g.ready }
func SelfIP() string    { g.mu.Lock(); defer g.mu.Unlock(); return g.ip }
func LastError() string { g.mu.Lock(); defer g.mu.Unlock(); return g.lastErr }

func Forward(target string) (int, error) {
	g.mu.Lock()
	s := g.srv
	g.mu.Unlock()
	if s == nil {
		return 0, fmt.Errorf("tailnet is not started")
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	g.mu.Lock()
	g.fwds = append(g.fwds, ln)
	g.mu.Unlock()
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
				r, err := s.Dial(ctx, "tcp", target)
				cancel()
				if err != nil {
					setErr("dial " + target + ": " + err.Error())
					return
				}
				defer r.Close()
				go io.Copy(r, c)
				io.Copy(c, r)
			}(c)
		}
	}()
	return ln.Addr().(*net.TCPAddr).Port, nil
}

func Logout() error {
	g.mu.Lock()
	s := g.srv
	g.mu.Unlock()
	if s == nil {
		return nil
	}
	lc, err := s.LocalClient()
	if err != nil {
		return err
	}
	return lc.Logout(context.Background())
}

func Stop() {
	g.mu.Lock()
	defer g.mu.Unlock()
	for _, l := range g.fwds {
		l.Close()
	}
	g.fwds = nil
	if g.srv != nil {
		g.srv.Close()
	}
	g.srv, g.ready = nil, false
}
