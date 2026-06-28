package adapters

import (
	"net/http"
	"strings"
)

type XAI struct{}

func (XAI) Types() []string {
	return []string{"xai", "x_ai", "grok"}
}

func (XAI) Protocol(string) Protocol {
	return ProtocolOpenAI
}

func (XAI) Path(endpoint Endpoint, model string) (string, bool) {
	return baseAdapter.Path(endpoint, model)
}

func (XAI) Headers(apiKey string, protocol Protocol, stream bool) http.Header {
	return baseAdapter.Headers(apiKey, protocol, stream)
}

func (XAI) ApplyPayload(endpoint Endpoint, payload map[string]interface{}) {
	switch endpoint {
	case EndpointChat, EndpointResponses, EndpointImageGeneration:
		normalizeXAIModel(payload)
	}
	if endpoint == EndpointImageGeneration {
		if _, exists := payload["response_format"]; !exists {
			payload["response_format"] = "url"
		}
		if _, exists := payload["n"]; !exists {
			payload["n"] = 1
		}
	}
}

func normalizeXAIModel(payload map[string]interface{}) {
	model, _ := payload["model"].(string)
	model = strings.TrimSpace(model)
	if strings.HasSuffix(model, "-search") {
		model = strings.TrimSuffix(model, "-search")
		payload["search_parameters"] = map[string]interface{}{"mode": "on"}
	}
	for _, suffix := range []string{"-high", "-low"} {
		if strings.HasSuffix(model, suffix) {
			payload["reasoning_effort"] = strings.TrimPrefix(suffix, "-")
			model = strings.TrimSuffix(model, suffix)
			break
		}
	}
	if strings.HasPrefix(model, "grok-3-mini") {
		if _, hasCompletionTokens := payload["max_completion_tokens"]; !hasCompletionTokens {
			if maxTokens, hasMaxTokens := payload["max_tokens"]; hasMaxTokens {
				payload["max_completion_tokens"] = maxTokens
				delete(payload, "max_tokens")
			}
		}
	}
	if model != "" {
		payload["model"] = model
	}
}
