package adapters

import "net/http"

type ZhipuV4 struct{}

func (ZhipuV4) Types() []string {
	return []string{"zhipu", "zhipu_v4", "bigmodel", "glm"}
}

func (ZhipuV4) Protocol(string) Protocol {
	return ProtocolOpenAI
}

func (ZhipuV4) Path(endpoint Endpoint, model string) (string, bool) {
	switch endpoint {
	case EndpointChat:
		return "/api/paas/v4/chat/completions", true
	case EndpointClaudeMessages:
		return "/api/anthropic/v1/messages", true
	case EndpointImageGeneration:
		return "/api/paas/v4/images/generations", true
	case EndpointImageEdit:
		return "", false
	case EndpointResponses:
		return "", false
	default:
		return baseAdapter.Path(endpoint, model)
	}
}

func (ZhipuV4) Headers(apiKey string, protocol Protocol, stream bool) http.Header {
	return baseAdapter.Headers(apiKey, protocol, stream)
}

func (ZhipuV4) ApplyPayload(endpoint Endpoint, payload map[string]interface{}) {
	if endpoint == EndpointChat {
		setFloatBelowOne(payload, "top_p")
	}
}
