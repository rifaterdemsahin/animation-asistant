package main

// Prompt templates live in a dedicated store (Azure container "prompts" when
// AZURE_STORAGE_CONNECTION_STRING is set, else local ./other/_prompts). Each
// template is a JSON file with named string fields and {{variable}} placeholders
// that are rendered at generation time. Templates are editable at runtime via
// the /api/prompts endpoints and the /pages/prompts.html UI.
//
// Defaults are compiled in so the app behaves identically before any edit and
// so a broken/missing store never blocks generation.

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
)

// --- prompt schemas (one JSON file per generation step) ---

type outlinePrompt struct {
	System string `json:"system"`
	User   string `json:"user"`
}

type scriptPrompt struct {
	System string `json:"system"`
	User   string `json:"user"`
}

type componentsPrompt struct {
	DefaultTypes []string          `json:"default_types"`
	Styles       map[string]string `json:"styles"`
	ImagePrompt  string            `json:"image_prompt"`
}

type sfxType struct {
	Name string `json:"name"`
	Desc string `json:"desc"`
}

type audioPrompt struct {
	MusicPrompt  string    `json:"music_prompt"`
	DefaultGenre string    `json:"default_genre"`
	DefaultMood  string    `json:"default_mood"`
	SfxPrompt    string    `json:"sfx_prompt"`
	SfxTypes     []sfxType `json:"sfx_types"`
}

type storyboardPrompt struct {
	System      string `json:"system"`
	User        string `json:"user"`
	ImagePrompt string `json:"image_prompt"`
}

// PromptDescriptor describes one editable prompt for the API/UI.
type PromptDescriptor struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Variables   []string `json:"variables"`
}

var promptDescriptors = []PromptDescriptor{
	{ID: "outline", Title: "Outline (project-level)", Description: "Generates the 3-act outline JSON (title, logline, act summaries).", Variables: []string{"topic", "component_type"}},
	{ID: "script", Title: "Script (per act)", Description: "Writes one act's narration + visual beats.", Variables: []string{"topic", "act_key", "act_role", "summary", "purpose"}},
	{ID: "components", Title: "Components (typed images)", Description: "Per-act component images. Edit default_types, the styles map, and image_prompt.", Variables: []string{"style", "beat", "topic"}},
	{ID: "audio", Title: "Audio (music + SFX)", Description: "fal.ai background music + sound-effect prompts.", Variables: []string{"genre", "mood", "act_role", "topic", "desc"}},
	{ID: "storyboard", Title: "Storyboard (assembly + image)", Description: "Assembles scenes (JSON) and the 4-frame infographic image.", Variables: []string{"context", "topic"}},
}

func descriptorByID(id string) (PromptDescriptor, bool) {
	for _, d := range promptDescriptors {
		if d.ID == id {
			return d, true
		}
	}
	return PromptDescriptor{}, false
}

// --- defaults (single source of truth; verbatim from the original code) ---

type promptDefaults struct {
	Outline    outlinePrompt
	Script     scriptPrompt
	Components componentsPrompt
	Audio      audioPrompt
	Storyboard storyboardPrompt
}

func defaultPromptValues() promptDefaults {
	return promptDefaults{
		Outline: outlinePrompt{
			System: "You design short animated explainer video outlines using a STRICT 3-act structure: Act 1 = Problem, Act 2 = Solution, Act 3 = Lesson. You return JSON only, no markdown.",
			User: `Topic: {{topic}}
Component type: {{component_type}}

Produce a JSON object with this exact shape:
{"title":"short title","logline":"one sentence","acts":{"act-1":{"summary":"..."},"act-2":{"summary":"..."},"act-3":{"summary":"..."}}}
Each act summary must be 1-2 sentences fitting the act's role. JSON only.`,
		},
		Script: scriptPrompt{
			System: "You are a scriptwriter for short animated explainer videos. You write ONE act and return STRICT JSON only, no markdown.",
			User: `Topic: {{topic}}
Act: {{act_key}} ({{act_role}})
Outline summary for this act: {{summary}}

Write only this act. Return JSON with this exact shape:
{"narration":"1-3 paragraphs of voiceover","beats":[{"id":"beat-1","text":"one concrete, visualizable story beat"}]}
Rules: stay focused on the act role ({{purpose}}); 3 to 6 beats; each beat must be concrete and easy to illustrate. JSON only.`,
		},
		Components: componentsPrompt{
			DefaultTypes: []string{"background", "lower-third", "speech-bubble", "infographic"},
			Styles: map[string]string{
				"background":    "wide 16:9 background scene illustration, clean flat vector style, no text",
				"lower-third":   "lower-third banner overlay graphic with space for a short caption, flat vector, minimal",
				"speech-bubble": "speech bubble graphic with space for a short quote, flat vector, clean",
				"infographic":   "clean infographic with simple data visualization using icons and numbers, flat vector",
				"character":     "single character or mascot illustration, flat vector, centered, plain background",
				"icon":          "simple minimal flat icon on a plain background",
				"title-card":    "full-screen title card graphic with space for a heading, bold flat vector",
				"transition":    "abstract motion-transition graphic, flat vector",
			},
			ImagePrompt: "{{style}}. Illustrate this idea: {{beat}}. Topic: {{topic}}. Flat vector, clean, consistent style.",
		},
		Audio: audioPrompt{
			MusicPrompt:  "{{genre}} {{mood}} background music for a {{act_role}} act in an explainer video about: {{topic}}. 30 seconds, seamless loop.",
			DefaultGenre: "cinematic",
			DefaultMood:  "inspiring and uplifting",
			SfxPrompt:    "{{desc}}. Short, clean, game-quality sound effect.",
			SfxTypes: []sfxType{
				{Name: "whoosh", Desc: "a quick whoosh transition sound effect"},
				{Name: "ding", Desc: "a bright notification ding sound effect"},
				{Name: "reveal", Desc: "a dramatic reveal sound effect"},
			},
		},
		Storyboard: storyboardPrompt{
			System: "You assemble a 3-act storyboard for an explainer video. Return STRICT JSON only, no markdown.",
			User: `Build a scene-by-scene storyboard from this project material:

{{context}}

Return JSON: {"acts":{"act-1":{"scenes":[{"scene_id":"s1","beat_ref":"beat-1","component_ids":[],"duration":4,"description":"..."}]},"act-2":{"scenes":[]},"act-3":{"scenes":[]}}}
Each scene may reference an existing component_id. Durations are seconds (2-8). JSON only.`,
			ImagePrompt: `A 4-frame storyboard infographic for a 3-act explainer video about: {{topic}}. ` +
				`Arrange four horizontal frames in a 2x2 grid. ` +
				`Frame 1 (top-left): Problem setup — show the pain point visually. ` +
				`Frame 2 (top-right): Solution approach — introduce the key idea. ` +
				`Frame 3 (bottom-left): Implementation — show how it works step by step. ` +
				`Frame 4 (bottom-right): Lesson/takeaway — the insight the audience leaves with. ` +
				`Each frame has a short label below it. Clean flat vector style, ` +
				`modern explainer video aesthetic, consistent colors, no text inside frames.`,
		},
	}
}

// defaultPromptJSON returns the seed JSON text for each prompt id.
func defaultPromptJSON() map[string]string {
	d := defaultPromptValues()
	marshal := func(v any) string {
		b, _ := json.MarshalIndent(v, "", "  ")
		return string(b)
	}
	return map[string]string{
		"outline":    marshal(d.Outline),
		"script":     marshal(d.Script),
		"components": marshal(d.Components),
		"audio":      marshal(d.Audio),
		"storyboard": marshal(d.Storyboard),
	}
}

// --- store interface ---

// PromptStore is where editable prompt templates live.
type PromptStore interface {
	Name() string
	Read(id string) (string, error)
	Write(id, raw string) error
	Exists(id string) bool
	List() ([]string, error)
}

// NewPromptStore picks Azure when a connection string is provided, else local.
// It is non-fatal: callers should fall back to an in-memory store on error.
func NewPromptStore(otherDir, connString, container string) (PromptStore, error) {
	root := filepath.Join(otherDir, "_prompts")
	_ = os.MkdirAll(root, 0o755)
	if connString == "" {
		return seedStore(&LocalPrompts{root: root})
	}
	client, err := azblob.NewClientFromConnectionString(connString, nil)
	if err != nil {
		return nil, fmt.Errorf("azure prompts connect: %w", err)
	}
	ctx := context.Background()
	if _, err := client.CreateContainer(ctx, container, nil); err != nil && !isAlreadyExistsErr(err) {
		return nil, fmt.Errorf("azure prompts create container: %w", err)
	}
	return seedStore(&AzurePrompts{client: client, container: container})
}

// seedStore writes any missing default prompts so the store is never empty.
func seedStore(s PromptStore) (PromptStore, error) {
	for id, raw := range defaultPromptJSON() {
		if !s.Exists(id) {
			if err := s.Write(id, raw); err != nil {
				return nil, fmt.Errorf("seed %s: %w", id, err)
			}
		}
	}
	return s, nil
}

func isAlreadyExistsErr(err error) bool {
	return err != nil && strings.Contains(err.Error(), "AlreadyExists")
}

// --- local filesystem ---

type LocalPrompts struct{ root string }

func (l *LocalPrompts) Name() string          { return "local:" + l.root }
func (l *LocalPrompts) path(id string) string { return filepath.Join(l.root, id+".json") }
func (l *LocalPrompts) Read(id string) (string, error) {
	b, err := os.ReadFile(l.path(id))
	if err != nil {
		return "", err
	}
	return string(b), nil
}
func (l *LocalPrompts) Write(id, raw string) error {
	_ = os.MkdirAll(l.root, 0o755)
	return os.WriteFile(l.path(id), []byte(raw), 0o644)
}
func (l *LocalPrompts) Exists(id string) bool {
	_, err := os.Stat(l.path(id))
	return err == nil
}
func (l *LocalPrompts) List() ([]string, error) {
	entries, err := os.ReadDir(l.root)
	if err != nil {
		return nil, err
	}
	var out []string
	for _, e := range entries {
		if name := e.Name(); strings.HasSuffix(name, ".json") {
			out = append(out, strings.TrimSuffix(name, ".json"))
		}
	}
	sort.Strings(out)
	return out, nil
}

// --- azure blob ---

type AzurePrompts struct {
	client    *azblob.Client
	container string
}

func (a *AzurePrompts) Name() string          { return "azure:" + a.container }
func (a *AzurePrompts) blob(id string) string { return id + ".json" }

func (a *AzurePrompts) Read(id string) (string, error) {
	ctx := context.Background()
	dr, err := a.client.DownloadStream(ctx, a.container, a.blob(id), nil)
	if err != nil {
		return "", err
	}
	defer dr.Body.Close()
	b, err := io.ReadAll(dr.Body)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func (a *AzurePrompts) Write(id, raw string) error {
	ctx := context.Background()
	_, err := a.client.UploadBuffer(ctx, a.container, a.blob(id), []byte(raw), nil)
	return err
}

func (a *AzurePrompts) Exists(id string) bool {
	_, err := a.Read(id)
	return err == nil
}

func (a *AzurePrompts) List() ([]string, error) {
	ctx := context.Background()
	pager := a.client.NewListBlobsFlatPager(a.container, nil)
	var out []string
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
			if strings.HasSuffix(name, ".json") {
				out = append(out, strings.TrimSuffix(name, ".json"))
			}
		}
	}
	sort.Strings(out)
	return out, nil
}

// --- in-memory fallback (used only if Azure/local init fails) ---

type MemoryPrompts struct {
	mu   sync.Mutex
	data map[string]string
}

func NewMemoryPrompts() *MemoryPrompts {
	m := &MemoryPrompts{data: map[string]string{}}
	for id, raw := range defaultPromptJSON() {
		m.data[id] = raw
	}
	return m
}
func (m *MemoryPrompts) Name() string { return "memory" }
func (m *MemoryPrompts) Read(id string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	v, ok := m.data[id]
	if !ok {
		return "", fmt.Errorf("not found: %s", id)
	}
	return v, nil
}
func (m *MemoryPrompts) Write(id, raw string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data[id] = raw
	return nil
}
func (m *MemoryPrompts) Exists(id string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, ok := m.data[id]
	return ok
}
func (m *MemoryPrompts) List() ([]string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]string, 0, len(m.data))
	for k := range m.data {
		out = append(out, k)
	}
	sort.Strings(out)
	return out, nil
}

// --- App-level cache + typed accessors ---

// promptRaw returns the raw JSON for a prompt id, falling back to the compiled
// default if the store is unavailable or empty. Results are cached in memory.
func (a *App) promptRaw(id string) string {
	def := defaultPromptJSON()[id]
	if a.prompts == nil {
		return def
	}
	a.pcacheMu.Lock()
	if v, ok := a.pcache[id]; ok {
		a.pcacheMu.Unlock()
		return v
	}
	a.pcacheMu.Unlock()
	raw, err := a.prompts.Read(id)
	if err != nil || strings.TrimSpace(raw) == "" {
		return def
	}
	a.pcacheMu.Lock()
	if a.pcache == nil {
		a.pcache = map[string]string{}
	}
	a.pcache[id] = raw
	a.pcacheMu.Unlock()
	return raw
}

func (a *App) invalidatePromptCache(id string) {
	a.pcacheMu.Lock()
	defer a.pcacheMu.Unlock()
	if a.pcache != nil {
		delete(a.pcache, id)
	}
}

func parseOr[T any](raw string, def T) T {
	var v T
	if err := json.Unmarshal([]byte(raw), &v); err != nil {
		return def
	}
	return v
}

// outlineTmpl returns the (system, user) outline templates.
func (a *App) outlineTmpl() (string, string) {
	d := defaultPromptValues().Outline
	v := parseOr(a.promptRaw("outline"), d)
	if v.System == "" {
		v.System = d.System
	}
	if v.User == "" {
		v.User = d.User
	}
	return v.System, v.User
}

// scriptTmpl returns the (system, user) per-act script templates.
func (a *App) scriptTmpl() (string, string) {
	d := defaultPromptValues().Script
	v := parseOr(a.promptRaw("script"), d)
	if v.System == "" {
		v.System = d.System
	}
	if v.User == "" {
		v.User = d.User
	}
	return v.System, v.User
}

// componentsTmpl returns (styles, defaultTypes, imagePrompt) for components.
func (a *App) componentsTmpl() (map[string]string, []string, string) {
	d := defaultPromptValues().Components
	v := parseOr(a.promptRaw("components"), d)
	if v.Styles == nil {
		v.Styles = d.Styles
	}
	if len(v.DefaultTypes) == 0 {
		v.DefaultTypes = d.DefaultTypes
	}
	if v.ImagePrompt == "" {
		v.ImagePrompt = d.ImagePrompt
	}
	return v.Styles, v.DefaultTypes, v.ImagePrompt
}

// musicTmpl returns (musicPrompt, defaultGenre, defaultMood).
func (a *App) musicTmpl() (string, string, string) {
	d := defaultPromptValues().Audio
	v := parseOr(a.promptRaw("audio"), d)
	if v.MusicPrompt == "" {
		v.MusicPrompt = d.MusicPrompt
	}
	if v.DefaultGenre == "" {
		v.DefaultGenre = d.DefaultGenre
	}
	if v.DefaultMood == "" {
		v.DefaultMood = d.DefaultMood
	}
	return v.MusicPrompt, v.DefaultGenre, v.DefaultMood
}

// sfxTmpl returns (sfxPrompt, sfxTypes).
func (a *App) sfxTmpl() (string, []sfxType) {
	d := defaultPromptValues().Audio
	v := parseOr(a.promptRaw("audio"), d)
	if v.SfxPrompt == "" {
		v.SfxPrompt = d.SfxPrompt
	}
	if len(v.SfxTypes) == 0 {
		v.SfxTypes = d.SfxTypes
	}
	return v.SfxPrompt, v.SfxTypes
}

// storyboardTmpl returns (system, user, imagePrompt) for the storyboard step.
func (a *App) storyboardTmpl() (string, string, string) {
	d := defaultPromptValues().Storyboard
	v := parseOr(a.promptRaw("storyboard"), d)
	if v.System == "" {
		v.System = d.System
	}
	if v.User == "" {
		v.User = d.User
	}
	if v.ImagePrompt == "" {
		v.ImagePrompt = d.ImagePrompt
	}
	return v.System, v.User, v.ImagePrompt
}

// renderTmpl replaces {{key}} placeholders with values.
func renderTmpl(tmpl string, vars map[string]string) string {
	s := tmpl
	for k, v := range vars {
		s = strings.ReplaceAll(s, "{{"+k+"}}", v)
	}
	return s
}
