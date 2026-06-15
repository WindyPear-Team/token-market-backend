package service

import "testing"

func TestParseDelimitedList(t *testing.T) {
	got := parseDelimitedList("违规词, secret-key\nblocked；secret-key")
	want := []string{"违规词", "secret-key", "blocked"}
	if len(got) != len(want) {
		t.Fatalf("parseDelimitedList length = %d, want %d (%v)", len(got), len(want), got)
	}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("parseDelimitedList[%d] = %q, want %q (all=%v)", index, got[index], want[index], got)
		}
	}
}

func TestNormalizedRequestTextIncludesSystemAndMessages(t *testing.T) {
	got := normalizedRequestText(normalizedAIRequest{
		System: "system policy",
		Messages: []normalizedAIMessage{
			{Role: "user", Content: "hello"},
			{Role: "assistant", Content: ""},
			{Role: "user", Content: "违规词"},
		},
	})
	want := "system policy\nhello\n违规词"
	if got != want {
		t.Fatalf("normalizedRequestText() = %q, want %q", got, want)
	}
}
