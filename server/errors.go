package main

import (
	"encoding/json"
	"log"
	"net/http"
	"runtime/debug"
	"sync"
	"time"
)

type errorEntry struct {
	Timestamp string `json:"timestamp"`
	Code      int    `json:"code"`
	Method    string `json:"method"`
	Path      string `json:"path"`
	Message   string `json:"message"`
	Stack     string `json:"stack,omitempty"`
}

type errorRing struct {
	mu     sync.Mutex
	buf    []errorEntry
	pos    int
	filled bool
}

const maxErrors = 50

var recentErrors = &errorRing{buf: make([]errorEntry, maxErrors)}

func (r *errorRing) add(e errorEntry) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.buf[r.pos] = e
	r.pos++
	if r.pos >= maxErrors {
		r.pos = 0
		r.filled = true
	}
}

func (r *errorRing) snapshot() []errorEntry {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.filled {
		out := make([]errorEntry, r.pos)
		copy(out, r.buf[:r.pos])
		return out
	}
	out := make([]errorEntry, maxErrors)
	copy(out, r.buf[r.pos:])
	copy(out[maxErrors-r.pos:], r.buf[:r.pos])
	return out
}

func logError(method, path string, code int, msg string) {
	log.Printf("ERROR %s %s %d: %s", method, path, code, msg)
	recentErrors.add(errorEntry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Code:      code,
		Method:    method,
		Path:      path,
		Message:   msg,
	})
}

func logPanic(method, path string, v any, stack string) {
	msg := "panic: " + stringify(v)
	log.Printf("PANIC %s %s: %s\n%s", method, path, msg, stack)
	recentErrors.add(errorEntry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Code:      500,
		Method:    method,
		Path:      path,
		Message:   msg,
		Stack:     stack,
	})
}

func stringify(v any) string {
	if err, ok := v.(error); ok {
		return err.Error()
	}
	s, _ := json.Marshal(v)
	return string(s)
}

func recoverMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				stack := string(debug.Stack())
				logPanic(r.Method, r.URL.Path, v, stack)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]any{
					"error":     true,
					"code":      "internal_panic",
					"message":   "internal server error — check debug bar or /api/errors",
					"timestamp": time.Now().UTC().Format(time.RFC3339),
				})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func (a *App) listErrors(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"errors": recentErrors.snapshot(),
		"count":  len(recentErrors.snapshot()),
	})
}

type errResponse struct {
	Error     bool   `json:"error"`
	Code      string `json:"code"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

func writeError(w http.ResponseWriter, r *http.Request, code int, errCode, msg string) {
	logError(r.Method, r.URL.Path, code, errCode+": "+msg)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(errResponse{
		Error:     true,
		Code:      errCode,
		Message:   msg,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}
