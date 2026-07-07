// Package storage abstracts where project data lives.
//
// The local filesystem backend is the default (writes under OTHER_DIR, e.g.
// ./other). The Azure Blob backend is the intended production store; it is
// selected when AZURE_STORAGE_CONNECTION_STRING is set. NOTE: the Azure backend
// is a placeholder in this phase and returns "not implemented" — see risks.md.
package storage

import (
	"errors"
	"os"
	"path/filepath"
)

// Backend is the storage contract used by the server.
type Backend interface {
	Name() string
	ReadProject(slug string) ([]byte, error)
	WriteProject(slug string, data []byte) error
	ListProjects() ([]string, error)
	Read(slug, relpath string) ([]byte, error)
	Write(slug, relpath string, data []byte) error
	Delete(slug string) error
	Exists(slug string) bool
}

// New picks a backend: Azure when a connection string is provided, else local.
func New(otherDir, connString, container string) (Backend, error) {
	_ = os.MkdirAll(otherDir, 0o755)
	if connString != "" {
		return &Azure{container: container}, nil
	}
	return &Local{root: otherDir}, nil
}

// --- Local filesystem backend ---

type Local struct{ root string }

func (l *Local) Name() string { return "local:" + l.root }

func (l *Local) dir(slug string) string { return filepath.Join(l.root, slug) }

func (l *Local) ReadProject(slug string) ([]byte, error) {
	return os.ReadFile(filepath.Join(l.dir(slug), "project.json"))
}

func (l *Local) WriteProject(slug string, data []byte) error {
	_ = os.MkdirAll(l.dir(slug), 0o755)
	return os.WriteFile(filepath.Join(l.dir(slug), "project.json"), data, 0o644)
}

func (l *Local) ListProjects() ([]string, error) {
	entries, err := os.ReadDir(l.root)
	if err != nil {
		return nil, err
	}
	var slugs []string
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		if _, err := os.Stat(filepath.Join(l.root, e.Name(), "project.json")); err == nil {
			slugs = append(slugs, e.Name())
		}
	}
	return slugs, nil
}

func (l *Local) Read(slug, relpath string) ([]byte, error) {
	return os.ReadFile(filepath.Join(l.dir(slug), relpath))
}

func (l *Local) Write(slug, relpath string, data []byte) error {
	full := filepath.Join(l.dir(slug), relpath)
	_ = os.MkdirAll(filepath.Dir(full), 0o755)
	return os.WriteFile(full, data, 0o644)
}

func (l *Local) Delete(slug string) error {
	return os.RemoveAll(l.dir(slug))
}

func (l *Local) Exists(slug string) bool {
	_, err := os.Stat(filepath.Join(l.dir(slug), "project.json"))
	return err == nil
}

// --- Azure Blob backend (placeholder) ---

var errAzureNYI = errors.New("azure storage backend not implemented yet (see risks.md)")

type Azure struct{ container string }

func (a *Azure) Name() string                       { return "azure:" + a.container }
func (a *Azure) ReadProject(string) ([]byte, error) { return nil, errAzureNYI }
func (a *Azure) WriteProject(string, []byte) error  { return errAzureNYI }
func (a *Azure) ListProjects() ([]string, error)    { return nil, errAzureNYI }
func (a *Azure) Read(string, string) ([]byte, error) {
	return nil, errAzureNYI
}
func (a *Azure) Write(string, string, []byte) error { return errAzureNYI }
func (a *Azure) Delete(string) error                { return errAzureNYI }
func (a *Azure) Exists(string) bool                 { return false }
