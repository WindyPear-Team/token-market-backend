package adapters

import (
	"net/http"
	"strings"
)

type DeepSeek struct{}

func (DeepSeek) Types() []string {
	return []string{"deepseek", "deep_seek"}
}

func (DeepSeek) Protocol(string) Protocol {
	return ProtocolOpenAI
}

func (DeepSeek) Path(endpoint Endpoint, model string) (string, bool) {
	switch endpoint {
	case EndpointChat:
		return "/v1/chat/completions", true
	case EndpointClaudeMessages:
		return "/anthropic/v1/messages", true
	case EndpointResponses, EndpointImageGeneration, EndpointImageEdit:
		return "", false
	default:
		return baseAdapter.Path(endpoint, model)
	}
}

func (DeepSeek) Headers(apiKey string, protocol Protocol, stream bool) http.Header {
	return baseAdapter.Headers(apiKey, protocol, stream)
}

func (DeepSeek) ApplyPayload(endpoint Endpoint, payload map[string]interface{}) {
	if endpoint != EndpointChat && endpoint != EndpointClaudeMessages {
		return
	}
	model, _ := payload["model"].(string)
	baseModel, effort := deepSeekThinkingModel(model)
	if baseModel == model || effort == "" {
		return
	}
	payload["model"] = baseModel
	payload["thinking"] = map[string]interface{}{"type": "enabled"}
	if endpoint == EndpointClaudeMessages {
		payload["output_config"] = map[string]interface{}{"effort": effort}
		return
	}
	payload["reasoning_effort"] = effort
}

func deepSeekThinkingModel(model string) (string, string) {
	model = strings.TrimSpace(model)
	for _, suffix := range []string{"-high", "-medium", "-low"} {
		if strings.HasSuffix(model, suffix) {
			return strings.TrimSuffix(model, suffix), strings.TrimPrefix(suffix, "-")
		}
	}
	for _, suffix := range []string{"-thinking", "-reasoner"} {
		if strings.HasSuffix(model, suffix) {
			return strings.TrimSuffix(model, suffix), "medium"
		}
	}
	return model, ""
}
