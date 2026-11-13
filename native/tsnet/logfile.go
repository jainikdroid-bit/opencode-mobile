package tsnetbridge

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var logMu sync.Mutex
var logPath string

func logTo(dir string) func(string, ...any) {
	logMu.Lock()
	logPath = filepath.Join(dir, "tsnet.log")
	if st, err := os.Stat(logPath); err == nil && st.Size() > 512<<10 {
		os.Remove(logPath)
	}
	logMu.Unlock()
	return func(format string, args ...any) {
		line := time.Now().Format("15:04:05 ") + fmt.Sprintf(format, args...)
		logMu.Lock()
		defer logMu.Unlock()
		if f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600); err == nil {
			f.WriteString(strings.TrimRight(line, "\n") + "\n")
			f.Close()
		}
	}
}

func LogTail(n int) string {
	logMu.Lock()
	p := logPath
	logMu.Unlock()
	b, err := os.ReadFile(p)
	if err != nil {
		return ""
	}
	l := strings.Split(strings.TrimRight(string(b), "\n"), "\n")
	if len(l) > n {
		l = l[len(l)-n:]
	}
	return strings.Join(l, "\n")
}
