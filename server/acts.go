package main

// Act is one part of the fixed three-act structure.
type Act struct {
	Key     string
	Slug    string
	Role    string
	Title   string
	Purpose string
}

var acts = []Act{
	{"act-1", "act-1-problem", "problem", "Act 1 — Problem", "Set up the world and the problem/pain the audience feels."},
	{"act-2", "act-2-solution", "solution", "Act 2 — Solution", "Introduce the solution; show how the problem is resolved."},
	{"act-3", "act-3-lesson", "lesson", "Act 3 — Lesson", "The takeaway / moral / insight the audience leaves with."},
}

func actByKey(k string) (Act, bool) {
	for _, a := range acts {
		if a.Key == k {
			return a, true
		}
	}
	return Act{}, false
}

func allActKeys() []string {
	out := make([]string, 0, len(acts))
	for _, a := range acts {
		out = append(out, a.Key)
	}
	return out
}
