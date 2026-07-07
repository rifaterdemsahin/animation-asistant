// Package storage abstracts where project data lives.
//
// Local filesystem backend is the default (writes under OTHER_DIR, e.g. ./other).
// The Azure Blob backend is used when AZURE_STORAGE_CONNECTION_STRING is set
// and stores each file as a blob named "<slug>/<relpath>" inside the container.
package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
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
	if connString == "" {
		return &Local{root: otherDir}, nil
	}
	client, err := azblob.NewClientFromConnectionString(connString, nil)
	if err != nil {
		return nil, fmt.Errorf("azure connect: %w", err)
	}
	ctx := context.Background()
	if _, err := client.CreateContainer(ctx, container, nil); err != nil {
		// ignore "already exists"; surface anything else
		if !isAlreadyExists(err) {
			return nil, fmt.Errorf("azure create container: %w", err)
		}
	}
	return &Azure{client: client, container: container}, nil
}

func isAlreadyExists(err error) bool {
	return err != nil && strings.Contains(err.Error(), "AlreadyExists")
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

// --- Azure Blob backend ---

type Azure struct {
	client    *azblob.Client
	container string
}

func (a *Azure) Name() string { return "azure:" + a.container }

func (a *Azure) blobName(slug, rel string) string { return slug + "/" + rel }

func (a *Azure) ReadProject(slug string) ([]byte, error) {
	return a.Read(slug, "project.json")
}

func (a *Azure) WriteProject(slug string, data []byte) error {
	return a.Write(slug, "project.json", data)
}

func (a *Azure) Read(slug, relpath string) ([]byte, error) {
	ctx := context.Background()
	dr, err := a.client.DownloadStream(ctx, a.container, a.blobName(slug, relpath), nil)
	if err != nil {
		return nil, err
	}
	defer dr.Body.Close()
	return io.ReadAll(dr.Body)
}

func (a *Azure) Write(slug, relpath string, data []byte) error {
	ctx := context.Background()
	_, err := a.client.UploadBuffer(ctx, a.container, a.blobName(slug, relpath), data, nil)
	return err
}

func (a *Azure) Delete(slug string) error {
	ctx := context.Background()
	prefix := slug + "/"
	pager := a.client.NewListBlobsFlatPager(a.container, &azblob.ListBlobsFlatOptions{Prefix: &prefix})
	for pager.More() {
		page, err := pager.NextPage(ctx)
		if err != nil {
			return err
		}
		for _, item := range page.Segment.BlobItems {
			if item.Name != nil {
				_, _ = a.client.DeleteBlob(ctx, a.container, *item.Name, nil)
			}
		}
	}
	return nil
}

func (a *Azure) Exists(slug string) bool {
	_, err := a.Read(slug, "project.json")
	return err == nil
}

func (a *Azure) ListProjects() ([]string, error) {
	ctx := context.Background()
	pager := a.client.NewListBlobsFlatPager(a.container, nil)
	seen := map[string]bool{}
	for pager.More() {
		page, err := pager.NextPage(ctx)
		if err != nil {
			return nil, err
		}
		for _, item := range page.Segment.BlobItems {
			if item.Name == nil {
				continue
			}
			name := *item.Name
			if strings.HasSuffix(name, "/project.json") {
				seen[strings.TrimSuffix(name, "/project.json")] = true
			}
		}
	}
	out := make([]string, 0, len(seen))
	for k := range seen {
		out = append(out, k)
	}
	sort.Strings(out)
	return out, nil
}
