package adapters

import "net/http"

type Seedream struct{}

func (Seedream) Types() []string {
	return []string{"seedream"}
}

func (Seedream) Protocol(string) Protocol {
	return ProtocolOpenAI
}

func (Seedream) Path(endpoint Endpoint, model string) (string, bool) {
	return baseAdapter.Path(endpoint, model)
}

func (Seedream) Headers(apiKey string, protocol Protocol, stream bool) http.Header {
	return baseAdapter.Headers(apiKey, protocol, stream)
}

func (Seedream) ApplyPayload(Endpoint, map[string]interface{}) {}
