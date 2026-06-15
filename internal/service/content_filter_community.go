//go:build !premium

package service

import (
	"strings"
	"unicode"
)

const (
	SensitiveFilterScopeRequest         = "request"
	SensitiveFilterScopeRequestResponse = "request_response"
)

type SensitiveWordMatch struct {
	Word string
}

func SensitiveFilterEnabled() bool {
	return false
}

func SensitiveFilterScope() string {
	return SensitiveFilterScopeRequest
}

func MatchSensitiveWords(text string) (SensitiveWordMatch, bool) {
	return SensitiveWordMatch{}, false
}

func SensitiveWords() []string {
	return nil
}

func normalizedRequestText(request normalizedAIRequest) string {
	parts := make([]string, 0, len(request.Messages)+1)
	if strings.TrimSpace(request.System) != "" {
		parts = append(parts, request.System)
	}
	for _, message := range request.Messages {
		if strings.TrimSpace(message.Content) != "" {
			parts = append(parts, message.Content)
		}
	}
	return strings.Join(parts, "\n")
}

func parseDelimitedList(raw string) []string {
	fields := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == '，' || r == '\n' || r == '\r' || r == ';' || r == '；' || unicode.IsSpace(r) && r != ' '
	})
	items := make([]string, 0, len(fields))
	seen := map[string]struct{}{}
	for _, field := range fields {
		item := strings.TrimSpace(field)
		if item == "" {
			continue
		}
		key := strings.ToLower(item)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		items = append(items, item)
	}
	return items
}
