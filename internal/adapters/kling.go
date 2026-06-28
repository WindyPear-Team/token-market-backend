package adapters

import "net/http"

type Kling struct{}

func (Kling) Types() []string {
	return []string{"kling", "klingai", "kling_ai"}
}

func (Kling) Protocol(string) Protocol {
	return ProtocolKling
}

func (Kling) Path(endpoint Endpoint, model string) (string, bool) {
	switch endpoint {
	case EndpointVideoGeneration:
		return "/v1/videos/image2video", true
	case EndpointVideoStatus:
		return "/v1/videos/image2video/" + pathEscape(model), true
	default:
		return baseAdapter.Path(endpoint, model)
	}
}

func (Kling) Headers(apiKey string, protocol Protocol, stream bool) http.Header {
	return baseAdapter.Headers(apiKey, protocol, stream)
}

func (Kling) ApplyPayload(Endpoint, map[string]interface{}) {}
