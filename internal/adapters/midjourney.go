package adapters

import "net/http"

type Midjourney struct{}

func (Midjourney) Types() []string {
	return []string{"midjourney", "mj"}
}

func (Midjourney) Protocol(string) Protocol {
	return ProtocolMidjourney
}

func (Midjourney) Path(endpoint Endpoint, model string) (string, bool) {
	return baseAdapter.Path(endpoint, model)
}

func (Midjourney) Headers(apiKey string, protocol Protocol, stream bool) http.Header {
	return baseAdapter.Headers(apiKey, protocol, stream)
}

func (Midjourney) ApplyPayload(Endpoint, map[string]interface{}) {}
