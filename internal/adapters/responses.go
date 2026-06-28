package adapters

import "net/http"

type Responses struct{}

func (Responses) Types() []string {
	return []string{"responses", "response", "openai_responses"}
}

func (Responses) Protocol(string) Protocol {
	return ProtocolResponses
}

func (Responses) Path(endpoint Endpoint, model string) (string, bool) {
	return baseAdapter.Path(endpoint, model)
}

func (Responses) Headers(apiKey string, protocol Protocol, stream bool) http.Header {
	return baseAdapter.Headers(apiKey, protocol, stream)
}

func (Responses) ApplyPayload(Endpoint, map[string]interface{}) {}
