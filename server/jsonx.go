package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

// extractJSON pulls the first {...} JSON object out of a model response
// (handles ```json fences and surrounding prose).
func extractJSON(s string) (map[string]any, error) {
	s = strings.TrimSpace(s)
	if strings.Contains(s, "```") {
		start := strings.Index(s, "```")
		rest := s[start+3:]
		if strings.HasPrefix(rest, "json") {
			rest = rest[4:]
		}
		end := strings.Index(rest, "```")
		if end >= 0 {
			s = strings.TrimSpace(rest[:end])
		}
	}
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start < 0 || end < 0 || end < start {
		return nil, fmt.Errorf("no JSON object found in response")
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(s[start:end+1]), &m); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}
	return m, nil
}
