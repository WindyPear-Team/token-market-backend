package adapters

import "net/http"

type Gemini struct{}

func (Gemini) Types() []string {
	return []string{"gemini", "google"}
}

func (Gemini) Protocol(string) Protocol {
	return ProtocolGemini
}

func (Gemini) Path(endpoint Endpoint, model string) (string, bool) {
	return baseAdapter.Path(endpoint, model)
}

func (Gemini) Headers(apiKey string, protocol Protocol, stream bool) http.Header {
	return baseAdapter.Headers(apiKey, protocol, stream)
}

func (Gemini) ApplyPayload(Endpoint, map[string]interface{}) {}
