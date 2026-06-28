package adapters

import "net/http"

type OpenAI struct{}

func (OpenAI) Types() []string {
	return []string{"completion", "completions", "chat_completion", "chat_completions"}
}

func (OpenAI) Protocol(string) Protocol {
	return ProtocolOpenAI
}

func (OpenAI) Path(endpoint Endpoint, model string) (string, bool) {
	return baseAdapter.Path(endpoint, model)
}

func (OpenAI) Headers(apiKey string, protocol Protocol, stream bool) http.Header {
	return baseAdapter.Headers(apiKey, protocol, stream)
}

func (OpenAI) ApplyPayload(Endpoint, map[string]interface{}) {}
