package adapters

import (
	"net/http"
	"strings"
)

type Moonshot struct{}

func (Moonshot) Types() []string {
	return []string{"moonshot", "kimi"}
}

func (Moonshot) Protocol(string) Protocol {
	return ProtocolOpenAI
}

func (Moonshot) Path(endpoint Endpoint, model string) (string, bool) {
	switch endpoint {
	case EndpointClaudeMessages:
		return "/anthropic/v1/messages", true
	case EndpointResponses:
		return "", false
	default:
		return baseAdapter.Path(endpoint, model)
	}
}

func (Moonshot) Headers(apiKey string, protocol Protocol, stream bool) http.Header {
	return baseAdapter.Headers(apiKey, protocol, stream)
}

func (Moonshot) ApplyPayload(endpoint Endpoint, payload map[string]interface{}) {
	if endpoint != EndpointChat {
		return
	}
	model, _ := payload["model"].(string)
	if strings.EqualFold(strings.TrimSpace(model), "kimi-k2.6") {
		payload["temperature"] = 1.0
	}
}
