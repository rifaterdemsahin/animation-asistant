package main

import (
	"encoding/json"
	"net/http"
)

type loginReq struct {
	Password string `json:"password"`
}

func (a *App) login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, r, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	if req.Password == "" || req.Password != a.cfg.AdminPassword {
		writeError(w, r, http.StatusUnauthorized, "invalid_credentials", "invalid password")
		return
	}
	tok := a.cfg.MakeToken()
	http.SetCookie(w, &http.Cookie{
		Name: "auth", Value: tok, Path: "/", HttpOnly: true,
		SameSite: http.SameSiteLaxMode, MaxAge: 7 * 24 * 3600,
	})
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *App) logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{Name: "auth", Path: "/", MaxAge: -1})
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *App) me(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
