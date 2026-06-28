package adapters

import "net/http"

type OpenAIVideo struct{}

func (OpenAIVideo) Types() []string {
	return []string{"openai-video", "openai_video", "video", "veo", "seedance"}
}

func (OpenAIVideo) Protocol(string) Protocol {
	return ProtocolOpenAIVideo
}

func (OpenAIVideo) Path(endpoint Endpoint, model string) (string, bool) {
	return baseAdapter.Path(endpoint, model)
}

func (OpenAIVideo) Headers(apiKey string, protocol Protocol, stream bool) http.Header {
	return baseAdapter.Headers(apiKey, protocol, stream)
}

func (OpenAIVideo) ApplyPayload(Endpoint, map[string]interface{}) {}
