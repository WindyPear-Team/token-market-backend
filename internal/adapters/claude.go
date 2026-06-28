package adapters

import "net/http"

type Claude struct{}

func (Claude) Types() []string {
	return []string{"claude", "anthropic"}
}

func (Claude) Protocol(string) Protocol {
	return ProtocolClaude
}

func (Claude) Path(endpoint Endpoint, model string) (string, bool) {
	return baseAdapter.Path(endpoint, model)
}

func (Claude) Headers(apiKey string, protocol Protocol, stream bool) http.Header {
	return baseAdapter.Headers(apiKey, protocol, stream)
}

func (Claude) ApplyPayload(Endpoint, map[string]interface{}) {}
